use rocketman::types::event::Kind;
use serde::Deserialize;
use sqlx::PgPool;
use tracing::info;

#[derive(Debug, Deserialize)]
struct IdentityDetails {
    handle: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IdentityEnvelope {
    did: String,
    kind: Kind,
    identity: Option<IdentityDetails>,
}

pub async fn ingest_identity_event(pool: &PgPool, text: &str) -> anyhow::Result<bool> {
    if text.trim().is_empty() {
        return Ok(false);
    }

    let envelope: IdentityEnvelope = serde_json::from_str(text)?;
    if !matches!(&envelope.kind, Kind::Identity) {
        return Ok(false);
    }

    upsert_identity_handle(
        pool,
        &envelope.did,
        envelope.identity.and_then(|id| id.handle),
    )
    .await?;
    Ok(true)
}

async fn upsert_identity_handle(
    pool: &PgPool,
    did: &str,
    handle: Option<String>,
) -> anyhow::Result<()> {
    let handle = handle
        .as_deref()
        .map(str::trim)
        .filter(|handle| !handle.is_empty() && *handle != "handle.invalid");

    sqlx::query(
        r#"
            INSERT INTO profiles (did, handle)
            VALUES ($1, $2)
            ON CONFLICT (did) DO UPDATE SET
                handle = EXCLUDED.handle
        "#,
    )
    .bind(did)
    .bind(handle)
    .execute(pool)
    .await?;

    info!("Indexed identity handle for {}: {:?}", did, handle);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn ignores_non_identity_event_json() {
        let envelope: IdentityEnvelope = serde_json::from_str(
            r#"{
                "did": "did:plc:test",
                "time_us": 1,
                "kind": "commit",
                "commit": {
                    "rev": "3k",
                    "operation": "create",
                    "collection": "fm.teal.alpha.feed.play",
                    "rkey": "3k",
                    "record": {"trackName": "Ceremony"},
                    "cid": "bafy"
                }
            }"#,
        )
        .expect("event parses");

        assert!(matches!(envelope.kind, Kind::Commit));
    }

    #[test]
    fn parses_identity_handle_event_json() {
        let envelope: IdentityEnvelope = serde_json::from_str(
            r#"{
                "did": "did:plc:listener",
                "time_us": 1,
                "kind": "identity",
                "identity": {
                    "did": "did:plc:listener",
                    "handle": "listener.example",
                    "seq": 10,
                    "time": "2026-06-05T00:00:00Z"
                }
            }"#,
        )
        .expect("identity event parses");

        assert!(matches!(envelope.kind, Kind::Identity));
        assert_eq!(
            envelope
                .identity
                .and_then(|identity| identity.handle)
                .as_deref(),
            Some("listener.example")
        );
    }
}
