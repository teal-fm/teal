//! Consume a tab (or Tap) channel and store every Teal record through Cadet's
//! ingestors. Each event is acknowledged once it is handled, so a restart
//! resumes where the last run stopped. Records are spread over workers by
//! DID, which keeps each repo's records in order.

use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    hash::{Hash, Hasher},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};

use futures::{SinkExt, StreamExt};
use rocketman::{
    ingestion::LexiconIngestor,
    types::event::{Commit, Event, Kind, Operation},
};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use cadet::{db, teal_ingestors};

type Ingestors = HashMap<String, Box<dyn LexiconIngestor + Send + Sync>>;

const INGEST_ATTEMPTS: u32 = 3;

#[derive(Debug, Deserialize)]
struct TabEnvelope {
    id: u64,
    #[serde(rename = "type")]
    event_type: String,
    record: Option<TabRecord>,
}

#[derive(Clone, Debug, Deserialize)]
struct TabRecord {
    rev: String,
    did: String,
    collection: String,
    rkey: String,
    action: String,
    cid: Option<String>,
    record: Option<Value>,
}

struct Counters {
    processed: AtomicU64,
    failed: AtomicU64,
    skipped: AtomicU64,
}

fn tab_record_to_event(record: TabRecord) -> anyhow::Result<Event<Value>> {
    let operation = match record.action.as_str() {
        "create" => Operation::Create,
        "update" => Operation::Update,
        "delete" => Operation::Delete,
        action => anyhow::bail!("unsupported record action: {action}"),
    };

    if !record.collection.starts_with("fm.teal.") {
        anyhow::bail!("non-Teal collection: {}", record.collection);
    }

    if !matches!(operation, Operation::Delete) && record.record.is_none() {
        anyhow::bail!(
            "{} event for {} missing record",
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

fn worker_for(did: &str, workers: usize) -> usize {
    let mut hasher = DefaultHasher::new();
    did.hash(&mut hasher);
    usize::try_from(hasher.finish() % workers as u64).unwrap_or(0)
}

async fn ingest_record(ingestors: &Ingestors, record: TabRecord, counters: &Counters) {
    let collection = record.collection.clone();
    let Some(ingestor) = ingestors.get(&collection) else {
        if collection.starts_with("fm.teal.") {
            warn!("Unsupported Teal collection {collection}. Add a Cadet ingestor for it.");
        }
        counters.skipped.fetch_add(1, Ordering::Relaxed);
        return;
    };
    if let Err(err) = tab_record_to_event(record.clone()) {
        warn!("Skipped record: {err}");
        counters.skipped.fetch_add(1, Ordering::Relaxed);
        return;
    }

    // Retry transient failures before giving up; a record that still fails is
    // logged and acknowledged so it cannot block the rest of the backfill.
    for attempt in 1..=INGEST_ATTEMPTS {
        let result = match tab_record_to_event(record.clone()) {
            Ok(event) => ingestor.ingest(event).await,
            Err(err) => Err(err),
        };
        match result {
            Ok(()) => {
                let processed = counters.processed.fetch_add(1, Ordering::Relaxed) + 1;
                if processed.is_multiple_of(1000) {
                    info!(
                        processed,
                        failed = counters.failed.load(Ordering::Relaxed),
                        skipped = counters.skipped.load(Ordering::Relaxed),
                        "Backfill progress"
                    );
                }
                return;
            }
            Err(err) if attempt == INGEST_ATTEMPTS => {
                counters.failed.fetch_add(1, Ordering::Relaxed);
                error!(did = %record.did, collection, "Failed to ingest record: {err}");
            }
            Err(_) => tokio::time::sleep(Duration::from_millis(500 * u64::from(attempt))).await,
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    // Refreshing the play-count views after every record would dominate a
    // backfill; Cadet's refresh worker picks the new plays up.
    std::env::set_var("CADET_DEFER_MATERIALIZED_VIEW_REFRESH", "1");
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let channel_url =
        std::env::var("TAB_CHANNEL_URL").unwrap_or_else(|_| "ws://127.0.0.1:2480/channel".into());
    let workers = std::env::var("TAB_BACKFILL_WORKERS")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|&value| value > 0)
        .unwrap_or(8);

    let pool = db::init_pool().await?;
    let ingestors: Arc<Ingestors> = Arc::new(teal_ingestors::build_ingestors(pool));
    let counters = Arc::new(Counters {
        processed: AtomicU64::new(0),
        failed: AtomicU64::new(0),
        skipped: AtomicU64::new(0),
    });

    info!("Connecting to {channel_url} with {workers} workers");
    let (ws, _) = connect_async(&channel_url).await?;
    let (mut ws_write, mut ws_read) = ws.split();

    // One writer owns the socket's send half: acks from every worker and
    // pong replies go through it.
    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<Message>();
    let writer = tokio::spawn(async move {
        while let Some(message) = out_rx.recv().await {
            if let Err(err) = ws_write.send(message).await {
                error!("Failed to write to the tab channel: {err}");
                break;
            }
        }
    });

    let mut senders = Vec::with_capacity(workers);
    let mut handles = Vec::with_capacity(workers);
    for _ in 0..workers {
        let (tx, mut rx) = mpsc::channel::<(u64, TabRecord)>(256);
        let ingestors = ingestors.clone();
        let counters = counters.clone();
        let out_tx = out_tx.clone();
        handles.push(tokio::spawn(async move {
            while let Some((id, record)) = rx.recv().await {
                ingest_record(&ingestors, record, &counters).await;
                let ack = json!({ "type": "ack", "id": id }).to_string();
                if out_tx.send(Message::Text(ack.into())).is_err() {
                    break;
                }
            }
        }));
        senders.push(tx);
    }

    while let Some(message) = ws_read.next().await {
        let payload = match message? {
            Message::Text(text) => text.to_string().into_bytes(),
            Message::Binary(bytes) => bytes.to_vec(),
            Message::Ping(bytes) => {
                let _ = out_tx.send(Message::Pong(bytes));
                continue;
            }
            Message::Pong(_) | Message::Frame(_) => continue,
            Message::Close(frame) => {
                warn!("Tab channel closed: {frame:?}");
                break;
            }
        };

        let envelope: TabEnvelope = match serde_json::from_slice(&payload) {
            Ok(envelope) => envelope,
            Err(err) => {
                error!("Failed to parse tab event: {err}");
                continue;
            }
        };

        match envelope.record {
            Some(record) if envelope.event_type == "record" => {
                let worker = worker_for(&record.did, workers);
                if senders[worker].send((envelope.id, record)).await.is_err() {
                    anyhow::bail!("backfill worker {worker} stopped");
                }
            }
            // Identity events and anything else: Cadet's live consumer owns
            // account state, so acknowledge and move on.
            _ => {
                counters.skipped.fetch_add(1, Ordering::Relaxed);
                let ack = json!({ "type": "ack", "id": envelope.id }).to_string();
                let _ = out_tx.send(Message::Text(ack.into()));
            }
        }
    }

    drop(senders);
    for handle in handles {
        let _ = handle.await;
    }
    drop(out_tx);
    let _ = writer.await;

    info!(
        processed = counters.processed.load(Ordering::Relaxed),
        failed = counters.failed.load(Ordering::Relaxed),
        skipped = counters.skipped.load(Ordering::Relaxed),
        "Tab consumer stopped"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_create_to_rocketman_commit() -> anyhow::Result<()> {
        let envelope: TabEnvelope = serde_json::from_value(json!({
            "id": 7,
            "type": "record",
            "record": {
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
            }
        }))?;
        assert_eq!(envelope.id, 7);

        let record = envelope
            .record
            .ok_or_else(|| anyhow::anyhow!("no record"))?;
        let event = tab_record_to_event(record)?;
        let commit = event.commit.ok_or_else(|| anyhow::anyhow!("no commit"))?;
        assert_eq!(event.did, "did:plc:listener");
        assert_eq!(commit.collection, "fm.teal.alpha.feed.play");
        assert!(matches!(commit.operation, Operation::Create));
        assert_eq!(commit.cid.as_deref(), Some("bafyrecord"));
        assert!(commit.record.is_some());
        Ok(())
    }

    #[test]
    fn converts_delete_without_record() -> anyhow::Result<()> {
        let record: TabRecord = serde_json::from_value(json!({
            "live": true,
            "rev": "3l",
            "did": "did:plc:listener",
            "collection": "fm.teal.alpha.actor.profile",
            "rkey": "self",
            "action": "delete"
        }))?;

        let event = tab_record_to_event(record)?;
        let commit = event.commit.ok_or_else(|| anyhow::anyhow!("no commit"))?;
        assert!(matches!(commit.operation, Operation::Delete));
        assert!(commit.record.is_none());
        assert!(commit.cid.is_none());
        Ok(())
    }

    #[test]
    fn keeps_a_did_on_one_worker() {
        let did = "did:plc:listener";
        assert_eq!(worker_for(did, 8), worker_for(did, 8));
        assert!(worker_for(did, 8) < 8);
    }
}
