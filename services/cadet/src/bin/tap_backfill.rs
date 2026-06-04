use futures::{SinkExt, StreamExt};
use rocketman::types::event::{Commit, Event, Kind, Operation};
use serde::Deserialize;
use serde_json::Value;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use cadet::{db, teal_ingestors};

#[derive(Debug, Deserialize)]
struct TapEnvelope {
    id: Option<i64>,
    #[serde(rename = "type")]
    event_type: String,
    record: Option<TapRecord>,
}

#[derive(Debug, Deserialize)]
struct TapRecord {
    #[allow(dead_code)]
    live: bool,
    rev: String,
    did: String,
    collection: String,
    rkey: String,
    action: String,
    cid: Option<String>,
    record: Option<Value>,
}

fn setup_tracing() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();
}

fn tap_record_to_event(record: TapRecord) -> anyhow::Result<Event<Value>> {
    let operation = match record.action.as_str() {
        "create" => Operation::Create,
        "update" => Operation::Update,
        "delete" => Operation::Delete,
        action => anyhow::bail!("unsupported TAP record action: {action}"),
    };

    if !record.collection.starts_with("fm.teal.") {
        anyhow::bail!("non-Teal collection: {}", record.collection);
    }

    if !matches!(operation, Operation::Delete) && record.record.is_none() {
        anyhow::bail!(
            "TAP {} event for {} missing record",
            record.action,
            record.collection
        );
    }

    Ok(Event {
        did: record.did,
        time_us: None,
        kind: Kind::Commit,
        commit: Some(Commit {
            rev: record.rev,
            operation,
            collection: record.collection,
            rkey: record.rkey,
            record: record.record,
            cid: record.cid,
        }),
        identity: None,
    })
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    setup_tracing();

    let tap_channel_url =
        std::env::var("TAP_CHANNEL_URL").unwrap_or_else(|_| "ws://127.0.0.1:2480/channel".into());
    let pool = db::init_pool().await?;
    let ingestors = teal_ingestors::build_ingestors(pool);
    let supported_collections = teal_ingestors::supported_teal_collections();

    info!(
        "Connecting to TAP at {}. Supported Teal collections: {}",
        tap_channel_url,
        supported_collections.join(", ")
    );

    let (mut ws, _) = connect_async(&tap_channel_url).await?;
    let mut processed = 0_u64;
    let mut skipped = 0_u64;

    while let Some(message) = ws.next().await {
        let message = message?;
        let payload = match message {
            Message::Text(text) => text.to_string().into_bytes(),
            Message::Binary(bytes) => bytes.to_vec(),
            Message::Ping(bytes) => {
                ws.send(Message::Pong(bytes)).await?;
                continue;
            }
            Message::Pong(_) => continue,
            Message::Close(frame) => {
                warn!("TAP channel closed: {:?}", frame);
                break;
            }
            Message::Frame(_) => continue,
        };

        let envelope: TapEnvelope = match serde_json::from_slice(&payload) {
            Ok(envelope) => envelope,
            Err(err) => {
                error!("Failed to parse TAP event: {err}");
                continue;
            }
        };

        if envelope.event_type != "record" {
            skipped += 1;
            continue;
        }

        let Some(record) = envelope.record else {
            skipped += 1;
            continue;
        };

        let collection = record.collection.clone();
        let Some(ingestor) = ingestors.get(&collection) else {
            if collection.starts_with("fm.teal.") {
                warn!(
                    "TAP delivered unsupported Teal collection {}. Add a Cadet ingestor for it.",
                    collection
                );
            }
            skipped += 1;
            continue;
        };

        match tap_record_to_event(record) {
            Ok(event) => match ingestor.ingest(event).await {
                Ok(()) => {
                    processed += 1;
                    if processed % 100 == 0 {
                        info!(
                            "Processed {} TAP Teal records (skipped {})",
                            processed, skipped
                        );
                    }
                }
                Err(err) => {
                    error!(
                        "Failed to ingest TAP event {:?} for {}: {}",
                        envelope.id, collection, err
                    );
                }
            },
            Err(err) => {
                skipped += 1;
                warn!("Skipped TAP event {:?}: {}", envelope.id, err);
            }
        }
    }

    info!(
        "TAP consumer stopped after processing {} records and skipping {} events",
        processed, skipped
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_tap_create_to_rocketman_commit() {
        let record: TapRecord = serde_json::from_value(serde_json::json!({
            "live": false,
            "rev": "3k",
            "did": "did:plc:listener",
            "collection": "fm.teal.alpha.feed.play",
            "rkey": "3k",
            "action": "create",
            "cid": "bafyrecord",
            "record": {
                "$type": "fm.teal.alpha.feed.play",
                "trackName": "Ceremony",
                "artists": []
            }
        }))
        .expect("valid tap record");

        let event = tap_record_to_event(record).expect("converted event");
        let commit = event.commit.expect("commit");
        assert_eq!(event.did, "did:plc:listener");
        assert_eq!(commit.collection, "fm.teal.alpha.feed.play");
        assert!(matches!(commit.operation, Operation::Create));
        assert_eq!(commit.cid.as_deref(), Some("bafyrecord"));
        assert!(commit.record.is_some());
    }

    #[test]
    fn converts_tap_delete_without_record() {
        let record: TapRecord = serde_json::from_value(serde_json::json!({
            "live": true,
            "rev": "3l",
            "did": "did:plc:listener",
            "collection": "fm.teal.alpha.actor.profile",
            "rkey": "self",
            "action": "delete"
        }))
        .expect("valid tap record");

        let event = tap_record_to_event(record).expect("converted event");
        let commit = event.commit.expect("commit");
        assert!(matches!(commit.operation, Operation::Delete));
        assert!(commit.record.is_none());
        assert!(commit.cid.is_none());
    }
}
