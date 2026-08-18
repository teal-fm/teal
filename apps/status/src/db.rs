use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use sqlx::{PgPool, postgres::PgPoolOptions};

pub async fn init_pool() -> Result<PgPool> {
    let database_url = std::env::var("DATABASE_URL")?;
    Ok(PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?)
}

pub async fn resolve_actor(
    pool: &PgPool,
    client: &Client,
    resolver_base: &str,
    identity: &str,
) -> Result<Option<String>> {
    let identity = normalize_identity(identity);
    if identity.is_empty() {
        return Ok(None);
    }

    if identity.starts_with("did:") {
        return Ok(Some(identity));
    }

    let at_handle = format!("at://{identity}");
    let row = sqlx::query!(
        r#"
        SELECT did as "did!"
        FROM status_actors
        WHERE handle = $1
        LIMIT 1
        "#,
        identity,
    )
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        return Ok(Some(row.did));
    }

    let row = sqlx::query!(
        r#"
        SELECT did as "did!"
        FROM profiles
        WHERE handle = $1 OR handle = $2
        LIMIT 1
        "#,
        identity,
        at_handle,
    )
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        return Ok(Some(row.did));
    }

    resolve_handle(client, resolver_base, &identity).await
}

pub async fn current_status(pool: &PgPool, did: &str) -> Result<Option<Value>> {
    let row = sqlx::query!(
        r#"
        WITH status_times AS (
            SELECT
                record->'item' AS item,
                CASE
                    WHEN record->>'expiry' ~ '^[0-9]+(\.[0-9]+)?$'
                        THEN to_timestamp((record->>'expiry')::double precision)
                    WHEN pg_input_is_valid(NULLIF(record->>'expiry', ''), 'timestamptz')
                        THEN NULLIF(record->>'expiry', '')::timestamptz
                    ELSE NULL
                END AS expiry,
                CASE
                    WHEN record->>'time' ~ '^[0-9]+(\.[0-9]+)?$'
                        THEN to_timestamp((record->>'time')::double precision)
                    WHEN pg_input_is_valid(NULLIF(record->>'time', ''), 'timestamptz')
                        THEN NULLIF(record->>'time', '')::timestamptz
                    ELSE NULL
                END AS status_time,
                indexed_at
            FROM statii
            WHERE did = $1
              AND rkey = 'self'
        )
        SELECT item AS "item: serde_json::Value"
        FROM status_times
        WHERE COALESCE(expiry, status_time + INTERVAL '10 minutes') > NOW()
        ORDER BY status_time DESC NULLS LAST, indexed_at DESC
        LIMIT 1
        "#,
        did,
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.and_then(|row| row.item))
}

pub async fn load_cursor(pool: &PgPool) -> Result<Option<u64>> {
    let row = sqlx::query!(
        r#"
        SELECT cursor
        FROM status_stream_cursor
        WHERE id = TRUE
        "#
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| row.cursor as u64))
}

pub async fn save_cursor(pool: &PgPool, cursor: u64) -> Result<()> {
    let cursor = i64::try_from(cursor)?;
    sqlx::query!(
        r#"
        INSERT INTO status_stream_cursor (id, cursor)
        VALUES (TRUE, $1)
        ON CONFLICT (id) DO UPDATE SET cursor = EXCLUDED.cursor
        "#,
        cursor,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn load_replay_progress(pool: &PgPool) -> Result<Option<(u64, u64)>> {
    let row = sqlx::query!(
        r#"
        SELECT sealed_tip, after_seq
        FROM status_replay_progress
        WHERE id = TRUE
        "#
    )
    .fetch_optional(pool)
    .await?;

    row.map(|row| {
        Ok((
            u64::try_from(row.sealed_tip)?,
            u64::try_from(row.after_seq)?,
        ))
    })
    .transpose()
}

pub async fn save_replay_progress(pool: &PgPool, sealed_tip: u64, after_seq: u64) -> Result<()> {
    let sealed_tip = i64::try_from(sealed_tip)?;
    let after_seq = i64::try_from(after_seq)?;
    sqlx::query!(
        r#"
        INSERT INTO status_replay_progress (id, sealed_tip, after_seq)
        VALUES (TRUE, $1, $2)
        ON CONFLICT (id) DO UPDATE SET
            sealed_tip = EXCLUDED.sealed_tip,
            after_seq = EXCLUDED.after_seq
        "#,
        sealed_tip,
        after_seq,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn clear_replay_progress(pool: &PgPool) -> Result<()> {
    sqlx::query!("DELETE FROM status_replay_progress WHERE id = TRUE")
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn apply_status_event(
    pool: &PgPool,
    did: &str,
    operation: &str,
    collection: &str,
    rkey: &str,
    cid: Option<&str>,
    record: Option<Value>,
) -> Result<()> {
    let collection = canonical_collection(collection);
    let uri = format!("at://{did}/{collection}/{rkey}");

    if operation == "delete" {
        sqlx::query!("DELETE FROM statii WHERE uri = $1", uri)
            .execute(pool)
            .await?;
        return Ok(());
    }

    let cid = cid.ok_or_else(|| anyhow::anyhow!("status event is missing cid"))?;
    let record = record.ok_or_else(|| anyhow::anyhow!("status event is missing record"))?;
    let record = normalize_legacy_record_type(record);

    sqlx::query!(
        r#"
        INSERT INTO statii (uri, did, rkey, cid, record)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (uri) DO UPDATE SET
            cid = EXCLUDED.cid,
            record = EXCLUDED.record,
            indexed_at = NOW()
        "#,
        uri,
        did,
        rkey,
        cid,
        record,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn apply_identity_event(pool: &PgPool, did: &str, handle: &str) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO status_actors (did, handle, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (did) DO UPDATE SET
            handle = EXCLUDED.handle,
            updated_at = EXCLUDED.updated_at
        "#,
        did,
        handle,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn prune_non_current_statuses(pool: &PgPool) -> Result<u64> {
    let result = sqlx::query!(
        r#"
        WITH status_times AS (
            SELECT
                uri,
                did,
                CASE
                    WHEN record->>'expiry' ~ '^[0-9]+(\.[0-9]+)?$'
                        THEN to_timestamp((record->>'expiry')::double precision)
                    WHEN pg_input_is_valid(NULLIF(record->>'expiry', ''), 'timestamptz')
                        THEN NULLIF(record->>'expiry', '')::timestamptz
                    ELSE NULL
                END AS expiry,
                CASE
                    WHEN record->>'time' ~ '^[0-9]+(\.[0-9]+)?$'
                        THEN to_timestamp((record->>'time')::double precision)
                    WHEN pg_input_is_valid(NULLIF(record->>'time', ''), 'timestamptz')
                        THEN NULLIF(record->>'time', '')::timestamptz
                    ELSE NULL
                END AS status_time,
                indexed_at
            FROM statii
            WHERE rkey = 'self'
        ), current_statuses AS (
            SELECT DISTINCT ON (did) uri
            FROM status_times
            WHERE COALESCE(expiry, status_time + INTERVAL '10 minutes') > NOW()
            ORDER BY did, status_time DESC NULLS LAST, indexed_at DESC, uri DESC
        )
        DELETE FROM statii
        WHERE uri NOT IN (SELECT uri FROM current_statuses)
        "#
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
}

fn canonical_collection(collection: &str) -> &str {
    match collection {
        "fm.teal.alpha.actor.status" => "fm.teal.actor.status",
        _ => collection,
    }
}

fn normalize_legacy_record_type(mut record: Value) -> Value {
    if let Some(record_type) = record.get("$type").and_then(Value::as_str)
        && let Some(stable_type) = record_type.strip_prefix("fm.teal.alpha.")
    {
        record["$type"] = Value::String(format!("fm.teal.{stable_type}"));
    }
    record
}

fn normalize_identity(identity: &str) -> String {
    identity
        .trim()
        .strip_prefix('@')
        .unwrap_or(identity.trim())
        .strip_prefix("at://")
        .unwrap_or_else(|| identity.trim().strip_prefix('@').unwrap_or(identity.trim()))
        .to_string()
}

async fn resolve_handle(
    client: &Client,
    resolver_base: &str,
    handle: &str,
) -> Result<Option<String>> {
    let url = format!(
        "{}/xrpc/com.atproto.identity.resolveHandle",
        resolver_base.trim_end_matches('/')
    );
    let response = client.get(url).query(&[("handle", handle)]).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let error = response.json::<ResolverError>().await?;
        if error.error.as_deref() == Some("HandleNotFound") {
            return Ok(None);
        }

        return Err(anyhow::anyhow!(
            "handle resolver returned {status}: {}",
            error.error.as_deref().unwrap_or("unknown error")
        ));
    }

    let resolved = response.json::<ResolvedHandle>().await?;
    Ok(Some(resolved.did))
}

#[derive(Deserialize)]
struct ResolvedHandle {
    did: String,
}

#[derive(Deserialize)]
struct ResolverError {
    error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::{normalize_identity, normalize_legacy_record_type};

    #[test]
    fn normalizes_supported_actor_identifiers() {
        assert_eq!(normalize_identity("did:plc:abc"), "did:plc:abc");
        assert_eq!(normalize_identity("alice.example"), "alice.example");
        assert_eq!(normalize_identity("@alice.example"), "alice.example");
        assert_eq!(normalize_identity("at://alice.example"), "alice.example");
        assert_eq!(normalize_identity(" @alice.example "), "alice.example");
    }

    #[test]
    fn canonicalizes_legacy_status_records() {
        let record = normalize_legacy_record_type(serde_json::json!({
            "$type": "fm.teal.alpha.actor.status"
        }));
        assert_eq!(record["$type"], "fm.teal.actor.status");
    }
}
