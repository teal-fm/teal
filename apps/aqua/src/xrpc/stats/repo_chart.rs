use std::collections::HashMap;

use anyhow::{Result, anyhow};
use atmst::{Bytes, CarImporter, Ipld, mst::Mst};
use axum::{Json, extract::Query, http::StatusCode};
use chrono::{DateTime, Utc};
use futures::StreamExt;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::{api, redis_client::RedisClient};

const CACHE_SECONDS: u64 = 15 * 60;

#[derive(Deserialize)]
pub(super) struct ChartQuery {
    actor: String,
    period: Option<String>,
    limit: Option<usize>,
}

#[derive(Clone, Deserialize, Serialize)]
struct RepoPlay {
    played_at: Option<i64>,
    release_name: Option<String>,
    release_mbid: Option<String>,
    artist: String,
}

#[derive(Deserialize, Serialize)]
struct Snapshot {
    fetched_at: String,
    plays: Vec<RepoPlay>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChartRelease {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    mbid: Option<String>,
    play_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ChartResponse {
    releases: Vec<ChartRelease>,
    source_count: usize,
    album_play_count: usize,
    fetched_at: String,
}

pub(super) async fn get_repo_top_releases(
    Query(query): Query<ChartQuery>,
) -> Result<Json<ChartResponse>, (StatusCode, String)> {
    let cutoff = period_cutoff(query.period.as_deref())
        .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }
    let (did, pds) = api::resolve_user_to_pds(&query.actor)
        .await
        .map_err(internal_error)?;
    let snapshot = load_snapshot(&did, &pds).await.map_err(internal_error)?;
    Ok(Json(chart_from_snapshot(
        &snapshot,
        cutoff,
        query.limit.unwrap_or(25).clamp(1, 100),
    )))
}

fn internal_error(error: anyhow::Error) -> (StatusCode, String) {
    warn!("Repository chart failed: {error:#}");
    (
        StatusCode::BAD_GATEWAY,
        "Could not load the listener's repository".to_string(),
    )
}

fn period_cutoff(period: Option<&str>) -> Result<Option<i64>> {
    let days = match period.unwrap_or("90days") {
        "7days" => Some(7),
        "30days" => Some(30),
        "90days" => Some(90),
        "180days" => Some(180),
        "365days" => Some(365),
        "all" => None,
        other => return Err(anyhow!("unsupported period: {other}")),
    };
    Ok(days.map(|days| Utc::now().timestamp() - days * 86_400))
}

async fn load_snapshot(did: &str, pds: &str) -> Result<Snapshot> {
    let cache_key = format!("repo_top_releases:v1:{did}");
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let connection = match RedisClient::new(&redis_url) {
        Ok(client) => client.get_connection().await.ok(),
        Err(error) => {
            warn!("Repository chart cache unavailable: {error}");
            None
        }
    };
    let mut connection = connection;
    if let Some(conn) = connection.as_mut() {
        match conn.get::<_, Option<String>>(&cache_key).await {
            Ok(Some(data)) => match serde_json::from_str(&data) {
                Ok(snapshot) => return Ok(snapshot),
                Err(error) => warn!("Repository chart cache contains invalid data: {error}"),
            },
            Ok(None) => {}
            Err(error) => warn!("Repository chart cache read failed: {error}"),
        }
    }

    let car = api::fetch_car_from_pds(pds, did, None).await?;
    let plays = parse_repo_plays(car).await?;
    let snapshot = Snapshot {
        fetched_at: Utc::now().to_rfc3339(),
        plays,
    };
    if let Some(conn) = connection.as_mut() {
        match serde_json::to_string(&snapshot) {
            Ok(data) => {
                if let Err(error) = conn
                    .set_ex::<_, _, ()>(&cache_key, data, CACHE_SECONDS)
                    .await
                {
                    warn!("Repository chart cache write failed: {error}");
                }
            }
            Err(error) => warn!("Repository chart cache serialization failed: {error}"),
        }
    }
    Ok(snapshot)
}

async fn parse_repo_plays(car: Vec<u8>) -> Result<Vec<RepoPlay>> {
    let bytes = Bytes::from(car);
    let mut importer = CarImporter::new();
    importer.import_from_bytes(bytes.clone()).await?;
    let mst = Mst::from_car_importer(importer).await?;
    let mut data = CarImporter::new();
    data.import_from_bytes(bytes).await?;
    let mut plays = Vec::new();
    let mut stable = HashMap::new();
    let mut stream = mst.iter().into_stream();
    while let Some(entry) = stream.next().await {
        let (key, cid) = entry?;
        let (collection, rkey) = match key.split_once('/') {
            Some(parts) => parts,
            None => continue,
        };
        if collection != "fm.teal.feed.play" && collection != "fm.teal.alpha.feed.play" {
            continue;
        }
        let record = data.decode_cbor(&cid)?;
        let Some(play) = parse_play(&record) else {
            continue;
        };
        if collection == "fm.teal.feed.play" {
            stable.insert(rkey.to_string(), play);
        } else {
            plays.push((rkey.to_string(), play));
        }
    }
    // The namespace migration copied some records under the same rkey.
    let mut result: Vec<RepoPlay> = stable.values().cloned().collect();
    for (rkey, play) in plays {
        if stable
            .get(&rkey)
            .is_none_or(|current| !same_play(current, &play))
        {
            result.push(play);
        }
    }
    Ok(result)
}

fn same_play(a: &RepoPlay, b: &RepoPlay) -> bool {
    a.played_at == b.played_at
        && a.release_name == b.release_name
        && a.release_mbid == b.release_mbid
        && a.artist == b.artist
}

fn text_field<'a>(
    map: &'a std::collections::BTreeMap<String, Ipld>,
    field: &str,
) -> Option<&'a str> {
    match map.get(field) {
        Some(Ipld::String(value)) => Some(value),
        _ => None,
    }
}

fn parse_play(record: &Ipld) -> Option<RepoPlay> {
    let Ipld::Map(map) = record else { return None };
    let played_at = text_field(map, "playedTime")
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|value| value.timestamp());
    let artist = match map.get("artists") {
        Some(Ipld::List(artists)) => artists.first().and_then(|artist| match artist {
            Ipld::Map(artist) => {
                text_field(artist, "artistName").or_else(|| text_field(artist, "name"))
            }
            _ => None,
        }),
        _ => None,
    }
    .unwrap_or("")
    .trim()
    .to_string();
    Some(RepoPlay {
        played_at,
        release_name: text_field(map, "releaseName")
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(str::to_string),
        release_mbid: text_field(map, "releaseMbId").map(str::to_string),
        artist,
    })
}

fn chart_from_snapshot(snapshot: &Snapshot, cutoff: Option<i64>, limit: usize) -> ChartResponse {
    let mut grouped: HashMap<(String, String), ChartRelease> = HashMap::new();
    let mut source_count = 0;
    let mut album_play_count = 0;
    for play in &snapshot.plays {
        if cutoff.is_some_and(|cutoff| play.played_at.is_none_or(|played_at| played_at < cutoff)) {
            continue;
        }
        source_count += 1;
        let Some(name) = &play.release_name else {
            continue;
        };
        album_play_count += 1;
        let key = (name.to_lowercase(), play.artist.to_lowercase());
        let release = grouped.entry(key).or_insert_with(|| ChartRelease {
            name: name.clone(),
            mbid: play.release_mbid.clone(),
            play_count: 0,
        });
        release.play_count += 1;
        if release.mbid.is_none() {
            release.mbid.clone_from(&play.release_mbid);
        }
    }
    let mut releases: Vec<_> = grouped.into_values().collect();
    releases.sort_by(|a, b| {
        b.play_count
            .cmp(&a.play_count)
            .then_with(|| a.name.cmp(&b.name))
    });
    releases.truncate(limit);
    ChartResponse {
        releases,
        source_count,
        album_play_count,
        fetched_at: snapshot.fetched_at.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_named_albums_without_mbid_and_keeps_periods() {
        let snapshot = Snapshot {
            fetched_at: "2026-09-25T00:00:00Z".into(),
            plays: vec![
                RepoPlay {
                    played_at: Some(100),
                    release_name: Some("Nurture".into()),
                    release_mbid: None,
                    artist: "Porter Robinson".into(),
                },
                RepoPlay {
                    played_at: Some(101),
                    release_name: Some("nurture".into()),
                    release_mbid: Some("mbid:abc".into()),
                    artist: "porter robinson".into(),
                },
                RepoPlay {
                    played_at: Some(50),
                    release_name: Some("Other".into()),
                    release_mbid: None,
                    artist: "A".into(),
                },
                RepoPlay {
                    played_at: Some(102),
                    release_name: None,
                    release_mbid: None,
                    artist: "A".into(),
                },
            ],
        };
        let chart = chart_from_snapshot(&snapshot, Some(100), 10);
        assert_eq!(chart.source_count, 3);
        assert_eq!(chart.album_play_count, 2);
        assert_eq!(chart.releases.len(), 1);
        assert_eq!(chart.releases[0].play_count, 2);
        assert_eq!(chart.releases[0].mbid.as_deref(), Some("mbid:abc"));
    }
}
