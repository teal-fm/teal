use std::{
    collections::HashSet,
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    time::Duration,
};

use cadet::{db, ingestors::car::CarImportIngestor};
use serde::Deserialize;
use sqlx::PgPool;
use tokio::time::sleep;

const DEFAULT_LIGHTRAIL_URL: &str = "https://lightrail.microcosm.blue";
const DEFAULT_COLLECTION: &str = "fm.teal.alpha.feed.play";
const DEFAULT_STATE_FILE: &str = ".teal-lightrail-backfill-done.txt";
const DEFAULT_FAILED_FILE: &str = ".teal-lightrail-backfill-failed.txt";

#[derive(Debug, Deserialize)]
struct LightrailRepo {
    did: String,
}

#[derive(Debug, Deserialize)]
struct ListReposByCollectionResponse {
    cursor: Option<String>,
    repos: Vec<LightrailRepo>,
}

fn setup_tracing() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::ERROR)
        .init();
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

fn load_completed(path: &PathBuf) -> anyhow::Result<HashSet<String>> {
    if std::env::var("LIGHTRAIL_BACKFILL_RESET").as_deref() == Ok("1") {
        let _ = fs::remove_file(path);
    }

    match fs::read_to_string(path) {
        Ok(contents) => Ok(contents
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(ToString::to_string)
            .collect()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(HashSet::new()),
        Err(err) => Err(err.into()),
    }
}

fn load_did_list(path: &PathBuf) -> anyhow::Result<Vec<String>> {
    match fs::read_to_string(path) {
        Ok(contents) => {
            let mut dids = contents
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>();
            dids.sort();
            dids.dedup();
            Ok(dids)
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(err) => Err(err.into()),
    }
}

fn record_completed(path: &PathBuf, did: &str) -> anyhow::Result<()> {
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "{did}")?;
    file.flush()?;
    Ok(())
}

fn write_failed(path: &PathBuf, failed: &[(String, String)]) -> anyhow::Result<()> {
    if failed.is_empty() {
        let _ = fs::remove_file(path);
        return Ok(());
    }

    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(path)?;
    for (did, _) in failed {
        writeln!(file, "{did}")?;
    }
    file.flush()?;
    Ok(())
}

async fn discover_repos(
    client: &reqwest::Client,
    lightrail_url: &str,
    collection: &str,
    page_limit: usize,
) -> anyhow::Result<Vec<String>> {
    let mut cursor = None::<String>;
    let mut repos = Vec::new();

    loop {
        let mut request = client
            .get(format!(
                "{}/xrpc/com.atproto.sync.listReposByCollection",
                lightrail_url.trim_end_matches('/')
            ))
            .query(&[
                ("collection", collection),
                ("limit", &page_limit.to_string()),
            ]);

        if let Some(cursor) = cursor.as_deref() {
            request = request.query(&[("cursor", cursor)]);
        }

        let response = request.send().await?.error_for_status()?;
        let page = response.json::<ListReposByCollectionResponse>().await?;
        let page_len = page.repos.len();
        repos.extend(page.repos.into_iter().map(|repo| repo.did));

        match page.cursor {
            Some(next_cursor)
                if page_len > 0 && cursor.as_deref() != Some(next_cursor.as_str()) =>
            {
                cursor = Some(next_cursor);
            }
            _ => break,
        }
    }

    repos.sort();
    repos.dedup();
    Ok(repos)
}

async fn refresh_materialized_views(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::query("REFRESH MATERIALIZED VIEW mv_artist_play_counts")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW mv_release_play_counts")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW mv_recording_play_counts")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW mv_global_play_count")
        .execute(pool)
        .await?;
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    setup_tracing();

    std::env::set_var("CADET_DEFER_MATERIALIZED_VIEW_REFRESH", "1");

    let lightrail_url =
        std::env::var("LIGHTRAIL_URL").unwrap_or_else(|_| DEFAULT_LIGHTRAIL_URL.to_string());
    let collection =
        std::env::var("LIGHTRAIL_COLLECTION").unwrap_or_else(|_| DEFAULT_COLLECTION.to_string());
    let page_limit = env_usize("LIGHTRAIL_PAGE_LIMIT", 1000);
    let max_repos = env_usize("LIGHTRAIL_BACKFILL_MAX_REPOS", usize::MAX);
    let retry_count = env_u64("LIGHTRAIL_BACKFILL_RETRIES", 2);
    let retry_sleep_ms = env_u64("LIGHTRAIL_BACKFILL_RETRY_SLEEP_MS", 2500);
    let state_file = PathBuf::from(
        std::env::var("LIGHTRAIL_BACKFILL_STATE_FILE")
            .unwrap_or_else(|_| DEFAULT_STATE_FILE.to_string()),
    );
    let failed_file = PathBuf::from(
        std::env::var("LIGHTRAIL_BACKFILL_FAILED_FILE")
            .unwrap_or_else(|_| DEFAULT_FAILED_FILE.to_string()),
    );
    let retry_failed = std::env::var("LIGHTRAIL_BACKFILL_RETRY_FAILED").as_deref() == Ok("1");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("teal-cadet-lightrail-backfill/0.1")
        .build()?;

    let mut repos = if retry_failed {
        eprintln!(
            "Retrying failed repos from {}",
            failed_file.to_string_lossy()
        );
        load_did_list(&failed_file)?
    } else {
        eprintln!("Discovering repos with {collection} via {lightrail_url}");
        discover_repos(&client, &lightrail_url, &collection, page_limit).await?
    };
    if repos.len() > max_repos {
        repos.truncate(max_repos);
    }

    let mut completed = load_completed(&state_file)?;
    let pool = db::init_pool().await?;
    let ingestor = CarImportIngestor::new(pool.clone());
    let total = repos.len();
    let mut imported = 0_usize;
    let mut skipped = 0_usize;
    let mut failed = Vec::new();

    eprintln!(
        "Starting Lightrail CAR backfill for {total} repos ({already_done} already done)",
        already_done = completed.len()
    );

    for (index, did) in repos.into_iter().enumerate() {
        let ordinal = index + 1;
        if completed.contains(&did) {
            skipped += 1;
            continue;
        }

        eprintln!("[{ordinal}/{total}] importing {did}");
        let mut last_error = None;
        for attempt in 0..=retry_count {
            match ingestor.fetch_and_process_identity_car(&did).await {
                Ok(import_id) => {
                    record_completed(&state_file, &did)?;
                    completed.insert(did.clone());
                    imported += 1;
                    eprintln!("[{ordinal}/{total}] imported {did} ({import_id})");
                    last_error = None;
                    break;
                }
                Err(err) => {
                    last_error = Some(err);
                    if attempt < retry_count {
                        eprintln!(
                            "[{ordinal}/{total}] retrying {did} after failure: {last_error}",
                            last_error = last_error.as_ref().unwrap()
                        );
                        sleep(Duration::from_millis(retry_sleep_ms)).await;
                    }
                }
            }
        }

        if let Some(err) = last_error {
            eprintln!("[{ordinal}/{total}] failed {did}: {err}");
            failed.push((did, err.to_string()));
        }
    }

    write_failed(&failed_file, &failed)?;

    eprintln!("Refreshing materialized play views");
    refresh_materialized_views(&pool).await?;

    eprintln!(
        "Lightrail backfill complete: imported {imported}, skipped {skipped}, failed {}",
        failed.len()
    );
    if !failed.is_empty() {
        for (did, error) in &failed {
            eprintln!("failed {did}: {error}");
        }
        anyhow::bail!("{} repos failed during Lightrail backfill", failed.len());
    }

    Ok(())
}
