use serde::Deserialize;
use sqlx::{PgPool, Postgres, Transaction};
use tracing::info;

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum EventKind {
    Account,
    Commit,
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct AccountEnvelope {
    did: String,
    kind: EventKind,
    account: Option<AccountDetails>,
}

#[derive(Debug, Deserialize)]
struct AccountDetails {
    active: bool,
    status: Option<String>,
    seq: Option<i64>,
    time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CommitEnvelope {
    did: String,
    kind: EventKind,
}

pub async fn ingest_account_event(pool: &PgPool, text: &str) -> anyhow::Result<bool> {
    if text.trim().is_empty() {
        return Ok(false);
    }

    let envelope: AccountEnvelope = serde_json::from_str(text)?;
    if envelope.kind != EventKind::Account {
        return Ok(false);
    }

    let Some(account) = envelope.account else {
        return Ok(false);
    };

    upsert_account_state(pool, &envelope.did, &account).await?;
    if !account.active {
        purge_indexed_account_data(pool, &envelope.did).await?;
    }

    info!(
        "Indexed account lifecycle event for {}: active={}, status={:?}",
        envelope.did, account.active, account.status
    );
    Ok(true)
}

pub async fn should_ingest_commit(pool: &PgPool, text: &str) -> anyhow::Result<bool> {
    if text.trim().is_empty() {
        return Ok(true);
    }

    let envelope: CommitEnvelope = serde_json::from_str(text)?;
    if envelope.kind != EventKind::Commit {
        return Ok(true);
    }

    let active = sqlx::query_scalar::<_, bool>(
        r#"
            SELECT COALESCE(
                (SELECT active FROM account_states WHERE did = $1),
                TRUE
            )
        "#,
    )
    .bind(&envelope.did)
    .fetch_one(pool)
    .await?;

    if !active {
        info!("Skipping commit from inactive account {}", envelope.did);
    }
    Ok(active)
}

async fn upsert_account_state(
    pool: &PgPool,
    did: &str,
    account: &AccountDetails,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
            INSERT INTO account_states (did, active, status, event_time, seq)
            VALUES ($1, $2, $3, $4::timestamptz, $5)
            ON CONFLICT (did) DO UPDATE SET
                active = EXCLUDED.active,
                status = EXCLUDED.status,
                event_time = EXCLUDED.event_time,
                seq = EXCLUDED.seq,
                updated_at = NOW()
        "#,
    )
    .bind(did)
    .bind(account.active)
    .bind(account.status.as_deref())
    .bind(account.time.as_deref())
    .bind(account.seq)
    .execute(pool)
    .await?;

    Ok(())
}

async fn purge_indexed_account_data(pool: &PgPool, did: &str) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;

    delete_plays(&mut tx, did).await?;
    delete_profile_records(&mut tx, did).await?;
    delete_social_records(&mut tx, did).await?;

    tx.commit().await?;
    info!("Purged indexed records for inactive account {}", did);
    Ok(())
}

async fn delete_plays(tx: &mut Transaction<'_, Postgres>, did: &str) -> anyhow::Result<()> {
    let play_uris = sqlx::query_scalar::<_, String>("SELECT uri FROM plays WHERE did = $1")
        .bind(did)
        .fetch_all(&mut **tx)
        .await?;

    if play_uris.is_empty() {
        return Ok(());
    }

    sqlx::query("DELETE FROM play_to_artists_extended WHERE play_uri = ANY($1)")
        .bind(&play_uris)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM play_to_artists WHERE play_uri = ANY($1)")
        .bind(&play_uris)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM plays WHERE uri = ANY($1)")
        .bind(&play_uris)
        .execute(&mut **tx)
        .await?;

    Ok(())
}

async fn delete_profile_records(
    tx: &mut Transaction<'_, Postgres>,
    did: &str,
) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM featured_items WHERE did = $1")
        .bind(did)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM profile_statuses WHERE did = $1")
        .bind(did)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM statii WHERE did = $1")
        .bind(did)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM profiles WHERE did = $1")
        .bind(did)
        .execute(&mut **tx)
        .await?;

    Ok(())
}

async fn delete_social_records(
    tx: &mut Transaction<'_, Postgres>,
    did: &str,
) -> anyhow::Result<()> {
    let mut record_uris = Vec::new();
    record_uris.extend(fetch_uris(tx, "social_posts", did).await?);
    record_uris.extend(fetch_uris(tx, "social_likes", did).await?);
    record_uris.extend(fetch_uris(tx, "social_reposts", did).await?);
    record_uris.extend(fetch_uris(tx, "social_follows", did).await?);
    record_uris.extend(fetch_uris(tx, "social_playlists", did).await?);
    record_uris.extend(fetch_uris(tx, "social_playlist_items", did).await?);
    record_uris.extend(fetch_uris(tx, "social_badges", did).await?);
    record_uris.extend(fetch_uris(tx, "social_badge_assignments", did).await?);

    let reply_subjects =
        fetch_optional_subject_uris(tx, "social_posts", "reply_parent_uri", did).await?;
    let like_subjects = fetch_subject_uris(tx, "social_likes", "subject_uri", did).await?;
    let repost_subjects = fetch_subject_uris(tx, "social_reposts", "subject_uri", did).await?;
    let playlist_subjects =
        fetch_subject_uris(tx, "social_playlist_items", "playlist_uri", did).await?;

    delete_by_did(tx, "social_badge_assignments", did).await?;
    delete_by_did(tx, "social_badges", did).await?;
    delete_by_did(tx, "social_playlist_items", did).await?;
    delete_by_did(tx, "social_playlists", did).await?;
    delete_by_did(tx, "social_reposts", did).await?;
    delete_by_did(tx, "social_likes", did).await?;
    delete_by_did(tx, "social_posts", did).await?;
    delete_by_did(tx, "social_follows", did).await?;

    decrement_subject_counts(tx, &reply_subjects, "reply_count").await?;
    decrement_subject_counts(tx, &like_subjects, "like_count").await?;
    decrement_subject_counts(tx, &repost_subjects, "repost_count").await?;
    decrement_subject_counts(tx, &playlist_subjects, "playlist_item_count").await?;

    if !record_uris.is_empty() {
        sqlx::query("DELETE FROM indexed_record_facets WHERE record_uri = ANY($1)")
            .bind(&record_uris)
            .execute(&mut **tx)
            .await?;
        sqlx::query("DELETE FROM indexed_record_blobs WHERE record_uri = ANY($1)")
            .bind(&record_uris)
            .execute(&mut **tx)
            .await?;
        sqlx::query(
            r#"
                DELETE FROM social_notifications
                WHERE record_uri = ANY($1)
                   OR actor_did = $2
                   OR recipient_did = $2
            "#,
        )
        .bind(&record_uris)
        .bind(did)
        .execute(&mut **tx)
        .await?;
    } else {
        sqlx::query("DELETE FROM social_notifications WHERE actor_did = $1 OR recipient_did = $1")
            .bind(did)
            .execute(&mut **tx)
            .await?;
    }

    Ok(())
}

async fn fetch_uris(
    tx: &mut Transaction<'_, Postgres>,
    table: &str,
    did: &str,
) -> anyhow::Result<Vec<String>> {
    let sql = format!("SELECT uri FROM {table} WHERE did = $1");
    Ok(sqlx::query_scalar::<_, String>(&sql)
        .bind(did)
        .fetch_all(&mut **tx)
        .await?)
}

async fn fetch_subject_uris(
    tx: &mut Transaction<'_, Postgres>,
    table: &str,
    column: &str,
    did: &str,
) -> anyhow::Result<Vec<String>> {
    let sql = format!("SELECT {column} FROM {table} WHERE did = $1");
    Ok(sqlx::query_scalar::<_, String>(&sql)
        .bind(did)
        .fetch_all(&mut **tx)
        .await?)
}

async fn fetch_optional_subject_uris(
    tx: &mut Transaction<'_, Postgres>,
    table: &str,
    column: &str,
    did: &str,
) -> anyhow::Result<Vec<String>> {
    let sql = format!("SELECT {column} FROM {table} WHERE did = $1 AND {column} IS NOT NULL");
    Ok(sqlx::query_scalar::<_, String>(&sql)
        .bind(did)
        .fetch_all(&mut **tx)
        .await?)
}

async fn delete_by_did(
    tx: &mut Transaction<'_, Postgres>,
    table: &str,
    did: &str,
) -> anyhow::Result<()> {
    let sql = format!("DELETE FROM {table} WHERE did = $1");
    sqlx::query(&sql).bind(did).execute(&mut **tx).await?;
    Ok(())
}

async fn decrement_subject_counts(
    tx: &mut Transaction<'_, Postgres>,
    subject_uris: &[String],
    column: &str,
) -> anyhow::Result<()> {
    for subject_uri in subject_uris {
        let sql = format!(
            r#"
                INSERT INTO social_subject_counts (subject_uri, {column})
                VALUES ($1, 0)
                ON CONFLICT (subject_uri) DO UPDATE SET
                    {column} = GREATEST(social_subject_counts.{column} - 1, 0),
                    updated_at = NOW()
            "#
        );
        sqlx::query(&sql)
            .bind(subject_uri)
            .execute(&mut **tx)
            .await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_active_account_event() {
        let envelope: AccountEnvelope = serde_json::from_str(
            r#"{
                "did": "did:plc:listener",
                "time_us": 1,
                "kind": "account",
                "account": {
                    "active": true,
                    "did": "did:plc:listener",
                    "seq": 10,
                    "time": "2026-06-05T00:00:00Z"
                }
            }"#,
        )
        .expect("account event parses");

        let account = envelope.account.expect("account details");
        assert_eq!(envelope.kind, EventKind::Account);
        assert!(account.active);
        assert_eq!(account.status, None);
    }

    #[test]
    fn parses_inactive_account_event_status() {
        let envelope: AccountEnvelope = serde_json::from_str(
            r#"{
                "did": "did:plc:listener",
                "time_us": 1,
                "kind": "account",
                "account": {
                    "active": false,
                    "did": "did:plc:listener",
                    "seq": 11,
                    "status": "takendown",
                    "time": "2026-06-05T00:00:00Z"
                }
            }"#,
        )
        .expect("account event parses");

        let account = envelope.account.expect("account details");
        assert!(!account.active);
        assert_eq!(account.status.as_deref(), Some("takendown"));
    }

    #[test]
    fn parses_commit_envelope() {
        let envelope: CommitEnvelope = serde_json::from_str(
            r#"{
                "did": "did:plc:listener",
                "time_us": 1,
                "kind": "commit",
                "commit": {
                    "rev": "3k",
                    "operation": "delete",
                    "collection": "fm.teal.alpha.feed.play",
                    "rkey": "3k"
                }
            }"#,
        )
        .expect("commit event parses");

        assert_eq!(envelope.kind, EventKind::Commit);
    }

    #[test]
    fn treats_old_tombstone_kind_as_other() {
        let envelope: AccountEnvelope = serde_json::from_str(
            r#"{
                "did": "did:plc:listener",
                "time_us": 1,
                "kind": "tombstone"
            }"#,
        )
        .expect("legacy event parses");

        assert_eq!(envelope.kind, EventKind::Other);
        assert!(envelope.account.is_none());
    }
}
