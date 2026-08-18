use std::time::Duration;

use anyhow::{Context, Result, anyhow};
use futures::StreamExt;
use serde::Deserialize;
use serde_json::Value;
use sqlx::PgPool;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::db;

pub(crate) const STATUS_COLLECTIONS: [&str; 2] =
    ["fm.teal.actor.status", "fm.teal.alpha.actor.status"];

pub async fn run(pool: PgPool, endpoint: String) {
    let mut retry_delay = Duration::from_secs(1);

    loop {
        match db::load_cursor(&pool).await {
            Ok(cursor) => match consume_connection(&pool, &endpoint, cursor).await {
                Ok(()) => {
                    retry_delay = Duration::from_secs(1);
                    info!("Jetstream v2 connection closed; reconnecting");
                }
                Err(error) => {
                    error!(%error, "Jetstream v2 consumer failed");
                }
            },
            Err(error) => error!(%error, "Could not load Jetstream cursor"),
        }

        tokio::time::sleep(retry_delay).await;
        retry_delay = (retry_delay * 2).min(Duration::from_secs(120));
    }
}

async fn consume_connection(pool: &PgPool, endpoint: &str, cursor: Option<u64>) -> Result<()> {
    let url = stream_url(endpoint, cursor)?;
    info!(%url, "Connecting to Jetstream v2");
    let (socket, response) = connect_async(url).await?;
    info!(status = %response.status(), "Connected to Jetstream v2");

    let (_, mut read) = socket.split();
    while let Some(message) = read.next().await {
        let message = message?;
        let event = match message {
            Message::Text(text) => parse_event(&text)?,
            Message::Close(_) => return Ok(()),
            Message::Ping(_) | Message::Pong(_) => continue,
            Message::Binary(_) => {
                return Err(anyhow!("unexpected binary Jetstream v2 frame"));
            }
            _ => continue,
        };

        process_event(pool, &event).await?;
        db::save_cursor(pool, event.cursor).await?;
    }

    Ok(())
}

fn parse_event(text: &str) -> Result<JetstreamEvent> {
    let envelope: JetstreamEnvelope = serde_json::from_str(text)?;
    let payload = envelope.payload;
    let event_type = payload
        .get("$type")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("Jetstream payload is missing $type"))?;
    let kind = event_type
        .rsplit_once('#')
        .map(|(_, kind)| kind)
        .ok_or_else(|| anyhow!("invalid Jetstream event type: {event_type}"))?
        .to_string();
    let did = payload
        .get("did")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("Jetstream payload is missing did"))?
        .to_string();
    let cursor = payload
        .get("seq")
        .or_else(|| payload.get("cursor"))
        .and_then(Value::as_u64)
        .ok_or_else(|| anyhow!("Jetstream payload is missing seq/cursor"))?;

    let commit = (kind == "commit")
        .then(|| serde_json::from_value(payload.clone()))
        .transpose()?;
    let identity = (kind == "identity")
        .then(|| serde_json::from_value(payload))
        .transpose()?;

    Ok(JetstreamEvent {
        did,
        cursor,
        kind: kind.to_string(),
        commit,
        identity,
    })
}

fn stream_url(endpoint: &str, cursor: Option<u64>) -> Result<String> {
    let mut url = url::Url::parse(endpoint).context("invalid JETSTREAM_URL")?;
    for collection in STATUS_COLLECTIONS {
        url.query_pairs_mut().append_pair("collections", collection);
    }
    if let Some(cursor) = cursor {
        url.query_pairs_mut()
            .append_pair("cursor", &cursor.to_string());
    }
    Ok(url.to_string())
}

async fn process_event(pool: &PgPool, event: &JetstreamEvent) -> Result<()> {
    match event.kind.as_str() {
        "commit" => {
            let commit = event
                .commit
                .as_ref()
                .ok_or_else(|| anyhow!("commit event is missing commit payload"))?;
            if !STATUS_COLLECTIONS.contains(&commit.collection.as_str()) {
                return Ok(());
            }

            let record = match (&commit.operation[..], commit.record.as_ref()) {
                ("delete", _) => None,
                (_, Some(record)) => Some(record.clone()),
                (_, None) => return Err(anyhow!("status commit is missing record")),
            };
            db::apply_status_event(
                pool,
                &event.did,
                &commit.operation,
                &commit.collection,
                &commit.rkey,
                commit.cid.as_deref(),
                record,
            )
            .await?;
        }
        "identity" => {
            if let Some(identity) = &event.identity
                && let Some(handle) = &identity.handle
            {
                db::apply_identity_event(pool, &event.did, handle).await?;
            }
        }
        "account" | "sync" => {}
        other => warn!(kind = other, "Ignoring unknown Jetstream event kind"),
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
struct JetstreamEnvelope {
    payload: Value,
}

#[derive(Debug)]
struct JetstreamEvent {
    did: String,
    cursor: u64,
    kind: String,
    commit: Option<Commit>,
    identity: Option<Identity>,
}

#[derive(Debug, Deserialize)]
struct Commit {
    operation: String,
    collection: String,
    rkey: String,
    cid: Option<String>,
    record: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct Identity {
    handle: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::stream_url;

    #[test]
    fn stream_url_requests_both_status_collections() {
        let url = stream_url(
            "wss://jetstream.us-east.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents",
            Some(42),
        )
        .expect("valid URL");

        assert!(url.contains("collections=fm.teal.actor.status"));
        assert!(url.contains("collections=fm.teal.alpha.actor.status"));
        assert!(url.contains("cursor=42"));
    }
}
