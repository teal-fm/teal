use anyhow::{Context, Result};
use async_trait::async_trait;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::{PgPool, Row};
use time::{Duration, OffsetDateTime};
use tokio::time::{sleep, Duration as TokioDuration};
use tracing::{error, info, warn};

use crate::ingestors::teal::feed_play::PlayIngestor;

const MAX_ATTEMPTS: i32 = 25;
const MAX_BACKOFF_SECONDS: i64 = 60 * 60;
const RETRY_POLL_SECONDS: u64 = 5;

#[derive(Clone)]
pub struct IngestionRetryStore {
    pool: PgPool,
}

struct RetryJob {
    id: i64,
    event: Value,
    attempts: i32,
}

struct RetryEnvelope {
    event: Value,
    event_key: String,
    did: String,
    collection: String,
    rkey: String,
}

impl RetryEnvelope {
    fn from_message(message: &Event<Value>) -> Result<Self> {
        let commit = message
            .commit
            .as_ref()
            .context("cannot retry an event without a commit")?;

        Ok(Self {
            event: serde_json::to_value(message).context("serialize failed ingestion event")?,
            event_key: event_key(
                &message.did,
                &commit.collection,
                &commit.rkey,
                commit.cid.as_deref(),
            ),
            did: message.did.clone(),
            collection: commit.collection.clone(),
            rkey: commit.rkey.clone(),
        })
    }
}

impl IngestionRetryStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn enqueue(&self, retry: &RetryEnvelope, error: &anyhow::Error) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO ingestion_retry_events (
                event_key, did, collection, rkey, event, last_error, next_attempt_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (event_key) DO UPDATE SET
                event = EXCLUDED.event,
                last_error = EXCLUDED.last_error,
                next_attempt_at = NOW(),
                dead_lettered_at = NULL,
                updated_at = NOW()
            "#,
        )
        .bind(&retry.event_key)
        .bind(&retry.did)
        .bind(&retry.collection)
        .bind(&retry.rkey)
        .bind(&retry.event)
        .bind(error.to_string())
        .execute(&self.pool)
        .await
        .context("persist failed ingestion event")?;

        Ok(())
    }

    async fn claim_due(&self) -> Result<Option<RetryJob>> {
        let mut transaction = self.pool.begin().await?;
        let row = sqlx::query(
            r#"
            SELECT id, event, attempts
            FROM ingestion_retry_events
            WHERE dead_lettered_at IS NULL
              AND next_attempt_at <= NOW()
            ORDER BY next_attempt_at, id
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            "#,
        )
        .fetch_optional(&mut *transaction)
        .await?;

        let Some(row) = row else {
            transaction.commit().await?;
            return Ok(None);
        };

        let id: i64 = row.try_get("id")?;
        let event: Value = row.try_get("event")?;
        let attempts: i32 = row.try_get::<i32, _>("attempts")? + 1;
        let next_attempt_at =
            OffsetDateTime::now_utc() + Duration::seconds(retry_delay_seconds(attempts));

        sqlx::query(
            r#"
            UPDATE ingestion_retry_events
            SET attempts = $2, next_attempt_at = $3, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(attempts)
        .bind(next_attempt_at)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;

        Ok(Some(RetryJob {
            id,
            event,
            attempts,
        }))
    }

    async fn complete(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM ingestion_retry_events WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn fail(&self, id: i64, attempts: i32, error: &anyhow::Error) -> Result<()> {
        if attempts >= MAX_ATTEMPTS {
            sqlx::query(
                r#"
                UPDATE ingestion_retry_events
                SET last_error = $2, dead_lettered_at = NOW(), updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(id)
            .bind(error.to_string())
            .execute(&self.pool)
            .await?;
            warn!(id, attempts, "Dead-lettered ingestion retry: {error}");
        } else {
            let next_attempt_at =
                OffsetDateTime::now_utc() + Duration::seconds(retry_delay_seconds(attempts));
            sqlx::query(
                r#"
                UPDATE ingestion_retry_events
                SET last_error = $2, next_attempt_at = $3, updated_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(id)
            .bind(error.to_string())
            .bind(next_attempt_at)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }
}

pub fn event_key(did: &str, collection: &str, rkey: &str, cid: Option<&str>) -> String {
    format!("{did}:{collection}:{rkey}:{}", cid.unwrap_or("delete"))
}

pub fn retry_delay_seconds(attempts: i32) -> i64 {
    let exponent = attempts.saturating_sub(1).clamp(0, 10) as u32;
    (5_i64.saturating_mul(2_i64.pow(exponent))).min(MAX_BACKOFF_SECONDS)
}

pub struct DurableRetryPlayIngestor {
    inner: PlayIngestor,
    retry_store: IngestionRetryStore,
}

impl DurableRetryPlayIngestor {
    pub fn new(pool: PgPool, retry_store: IngestionRetryStore) -> Self {
        Self {
            inner: PlayIngestor::new(pool),
            retry_store,
        }
    }
}

#[async_trait]
impl LexiconIngestor for DurableRetryPlayIngestor {
    async fn ingest(&self, message: Event<Value>) -> Result<()> {
        let retry_event = RetryEnvelope::from_message(&message).ok();
        let result = self.inner.ingest(message).await;
        if let Err(error) = result {
            if let Some(retry_event) = retry_event {
                if let Err(queue_error) = self.retry_store.enqueue(&retry_event, &error).await {
                    error!("Could not persist failed ingestion event: {queue_error}");
                }
            }
            return Err(error);
        }
        Ok(())
    }
}

pub async fn run_worker(retry_store: IngestionRetryStore, play_ingestor: PlayIngestor) {
    info!("Starting durable ingestion retry worker");

    loop {
        match retry_store.claim_due().await {
            Ok(Some(job)) => {
                let result = match serde_json::from_value::<Event<Value>>(job.event) {
                    Ok(event) => play_ingestor.ingest(event).await,
                    Err(error) => Err(error.into()),
                };

                match result {
                    Ok(()) => {
                        if let Err(error) = retry_store.complete(job.id).await {
                            error!(
                                job.id,
                                "Could not remove completed ingestion retry: {error}"
                            );
                        }
                    }
                    Err(error) => {
                        error!(job.id, job.attempts, "Ingestion retry failed: {error}");
                        if let Err(update_error) =
                            retry_store.fail(job.id, job.attempts, &error).await
                        {
                            error!(
                                job.id,
                                "Could not reschedule ingestion retry: {update_error}"
                            );
                        }
                    }
                }
            }
            Ok(None) => sleep(TokioDuration::from_secs(RETRY_POLL_SECONDS)).await,
            Err(error) => {
                error!("Could not claim ingestion retry: {error}");
                sleep(TokioDuration::from_secs(RETRY_POLL_SECONDS)).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use rocketman::types::event::{Commit, Event, Kind, Operation};
    use serde_json::json;

    use super::{event_key, retry_delay_seconds, RetryEnvelope};

    #[test]
    fn retry_envelope_round_trips_a_commit_event() {
        let message = Event {
            did: "did:plc:test".to_string(),
            time_us: Some(42),
            kind: Kind::Commit,
            commit: Some(Commit {
                rev: "rev".to_string(),
                operation: Operation::Create,
                collection: "fm.teal.alpha.feed.play".to_string(),
                rkey: "abc".to_string(),
                record: Some(json!({"$type": "fm.teal.alpha.feed.play"})),
                cid: Some("cid-1".to_string()),
            }),
            identity: None,
        };

        let retry = RetryEnvelope::from_message(&message).expect("event should serialize");
        let restored: Event<serde_json::Value> =
            serde_json::from_value(retry.event).expect("event should deserialize");

        assert_eq!(restored.did, message.did);
        assert_eq!(
            retry.event_key,
            "did:plc:test:fm.teal.alpha.feed.play:abc:cid-1"
        );
    }

    #[test]
    fn event_key_distinguishes_versions_and_deletes() {
        assert_eq!(
            event_key(
                "did:plc:test",
                "fm.teal.alpha.feed.play",
                "abc",
                Some("cid-1")
            ),
            "did:plc:test:fm.teal.alpha.feed.play:abc:cid-1"
        );
        assert_ne!(
            event_key(
                "did:plc:test",
                "fm.teal.alpha.feed.play",
                "abc",
                Some("cid-1")
            ),
            event_key(
                "did:plc:test",
                "fm.teal.alpha.feed.play",
                "abc",
                Some("cid-2")
            )
        );
        assert_eq!(
            event_key("did:plc:test", "fm.teal.alpha.feed.play", "abc", None),
            "did:plc:test:fm.teal.alpha.feed.play:abc:delete"
        );
    }

    #[test]
    fn retry_delay_is_exponential_and_capped() {
        assert_eq!(retry_delay_seconds(1), 5);
        assert_eq!(retry_delay_seconds(2), 10);
        assert_eq!(retry_delay_seconds(3), 20);
        assert_eq!(retry_delay_seconds(25), 3600);
    }
}
