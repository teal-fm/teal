use anyhow::{Context, Result};
use async_trait::async_trait;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::{PgPool, Row};
use time::{Duration, OffsetDateTime};
use tokio::time::{sleep, Duration as TokioDuration};
use tracing::{error, info, warn};

use crate::account;
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
    event_key: String,
    event: Value,
    attempts: i32,
    event_time_us: i64,
    event_rev: String,
}

struct RetryEnvelope {
    event: Value,
    event_key: String,
    did: String,
    collection: String,
    rkey: String,
    event_time_us: i64,
    event_rev: String,
}

impl RetryEnvelope {
    fn from_message(message: &Event<Value>) -> Result<Self> {
        let commit = message
            .commit
            .as_ref()
            .context("cannot retry an event without a commit")?;

        Ok(Self {
            event: serde_json::to_value(message).context("serialize failed ingestion event")?,
            event_key: event_key(&message.did, &commit.collection, &commit.rkey),
            did: message.did.clone(),
            collection: commit.collection.clone(),
            rkey: commit.rkey.clone(),
            event_time_us: i64::try_from(message.time_us.unwrap_or_default())
                .context("event time does not fit in an i64")?,
            event_rev: commit.rev.clone(),
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
                event_key, did, collection, rkey, event, event_time_us, event_rev,
                last_error, next_attempt_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (event_key) DO UPDATE SET
                event = EXCLUDED.event,
                event_time_us = EXCLUDED.event_time_us,
                event_rev = EXCLUDED.event_rev,
                attempts = CASE
                    WHEN (EXCLUDED.event_time_us, EXCLUDED.event_rev) >
                         (ingestion_retry_events.event_time_us, ingestion_retry_events.event_rev)
                    THEN 0
                    ELSE ingestion_retry_events.attempts
                END,
                last_error = EXCLUDED.last_error,
                next_attempt_at = NOW(),
                dead_lettered_at = NULL,
                updated_at = NOW()
            WHERE (EXCLUDED.event_time_us, EXCLUDED.event_rev) >=
                  (ingestion_retry_events.event_time_us, ingestion_retry_events.event_rev)
            "#,
        )
        .bind(&retry.event_key)
        .bind(&retry.did)
        .bind(&retry.collection)
        .bind(&retry.rkey)
        .bind(&retry.event)
        .bind(retry.event_time_us)
        .bind(&retry.event_rev)
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
                 , event_key, event_time_us, event_rev
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
        let event_key: String = row.try_get("event_key")?;
        let event_time_us: i64 = row.try_get("event_time_us")?;
        let event_rev: String = row.try_get("event_rev")?;
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
            event_key,
            event,
            attempts,
            event_time_us,
            event_rev,
        }))
    }

    async fn is_current(&self, job: &RetryJob) -> Result<bool> {
        sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1
                FROM ingestion_retry_events
                WHERE id = $1
                  AND event_key = $2
                  AND event_time_us = $3
                  AND event_rev = $4
            )
            "#,
        )
        .bind(job.id)
        .bind(&job.event_key)
        .bind(job.event_time_us)
        .bind(&job.event_rev)
        .fetch_one(&self.pool)
        .await
        .context("check retry freshness")
    }

    async fn complete(&self, job: &RetryJob) -> Result<()> {
        sqlx::query(
            r#"
            DELETE FROM ingestion_retry_events
            WHERE id = $1
              AND event_key = $2
              AND event_time_us = $3
              AND event_rev = $4
            "#,
        )
        .bind(job.id)
        .bind(&job.event_key)
        .bind(job.event_time_us)
        .bind(&job.event_rev)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn clear_superseded(&self, retry: &RetryEnvelope) -> Result<()> {
        sqlx::query(
            r#"
            DELETE FROM ingestion_retry_events
            WHERE event_key = $1
              AND (event_time_us, event_rev) <= ($2, $3)
            "#,
        )
        .bind(&retry.event_key)
        .bind(retry.event_time_us)
        .bind(&retry.event_rev)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn fail(&self, job: &RetryJob, error: &anyhow::Error) -> Result<()> {
        if job.attempts >= MAX_ATTEMPTS {
            sqlx::query(
                r#"
                UPDATE ingestion_retry_events
                SET last_error = $2, dead_lettered_at = NOW(), updated_at = NOW()
                WHERE id = $1
                  AND event_key = $3
                  AND event_time_us = $4
                  AND event_rev = $5
                "#,
            )
            .bind(job.id)
            .bind(error.to_string())
            .bind(&job.event_key)
            .bind(job.event_time_us)
            .bind(&job.event_rev)
            .execute(&self.pool)
            .await?;
            warn!(
                id = job.id,
                attempts = job.attempts,
                "Dead-lettered ingestion retry: {error}"
            );
        } else {
            let next_attempt_at =
                OffsetDateTime::now_utc() + Duration::seconds(retry_delay_seconds(job.attempts));
            sqlx::query(
                r#"
                UPDATE ingestion_retry_events
                SET last_error = $2, next_attempt_at = $3, updated_at = NOW()
                WHERE id = $1
                  AND event_key = $4
                  AND event_time_us = $5
                  AND event_rev = $6
                "#,
            )
            .bind(job.id)
            .bind(error.to_string())
            .bind(next_attempt_at)
            .bind(&job.event_key)
            .bind(job.event_time_us)
            .bind(&job.event_rev)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }
}

pub fn event_key(did: &str, collection: &str, rkey: &str) -> String {
    format!("{did}:{collection}:{rkey}")
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
        if let Some(retry_event) = retry_event {
            if let Err(error) = self.retry_store.clear_superseded(&retry_event).await {
                error!("Could not remove superseded ingestion retry: {error}");
            }
        }
        Ok(())
    }
}

pub async fn run_worker(retry_store: IngestionRetryStore, play_ingestor: PlayIngestor) {
    info!("Starting durable ingestion retry worker");

    loop {
        match retry_store.claim_due().await {
            Ok(Some(job)) => {
                if !retry_store.is_current(&job).await.unwrap_or(false) {
                    continue;
                }

                let result = async {
                    let event = serde_json::from_value::<Event<Value>>(job.event.clone())?;
                    let event_text = serde_json::to_string(&event)?;
                    if !account::should_ingest_commit(&retry_store.pool, &event_text).await? {
                        return Ok::<(), anyhow::Error>(());
                    }
                    play_ingestor.ingest(event).await
                }
                .await;

                match result {
                    Ok(()) => {
                        if let Err(error) = retry_store.complete(&job).await {
                            error!(
                                job.id,
                                "Could not remove completed ingestion retry: {error}"
                            );
                        }
                    }
                    Err(error) => {
                        error!(job.id, job.attempts, "Ingestion retry failed: {error}");
                        if let Err(update_error) = retry_store.fail(&job, &error).await {
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
    use anyhow::anyhow;
    use rocketman::types::event::{Commit, Event, Kind, Operation};
    use serde_json::json;
    use sqlx::{PgPool, Row};
    use uuid::Uuid;

    use super::{event_key, retry_delay_seconds, IngestionRetryStore, RetryEnvelope};

    async fn test_pool() -> anyhow::Result<PgPool> {
        let database_url = std::env::var("DATABASE_URL")?;
        Ok(PgPool::connect(&database_url).await?)
    }

    fn retry_envelope(event_key: String, event_time_us: i64, event_rev: &str) -> RetryEnvelope {
        RetryEnvelope {
            event: json!({"event_rev": event_rev}),
            event_key,
            did: "did:plc:retry-version-test".to_string(),
            collection: "fm.teal.alpha.feed.play".to_string(),
            rkey: "test-rkey".to_string(),
            event_time_us,
            event_rev: event_rev.to_string(),
        }
    }

    async fn retry_state(
        pool: &PgPool,
        event_key: &str,
    ) -> anyhow::Result<(i32, bool, i64, String)> {
        let row = sqlx::query(
            r#"
            SELECT attempts, dead_lettered_at IS NULL AS is_active, event_time_us, event_rev
            FROM ingestion_retry_events
            WHERE event_key = $1
            "#,
        )
        .bind(event_key)
        .fetch_one(pool)
        .await?;

        Ok((
            row.try_get("attempts")?,
            row.try_get("is_active")?,
            row.try_get("event_time_us")?,
            row.try_get("event_rev")?,
        ))
    }

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
        assert_eq!(retry.event_key, "did:plc:test:fm.teal.alpha.feed.play:abc");
    }

    #[test]
    fn event_key_is_scoped_to_the_logical_record() {
        assert_eq!(
            event_key("did:plc:test", "fm.teal.alpha.feed.play", "abc"),
            "did:plc:test:fm.teal.alpha.feed.play:abc"
        );
    }

    #[test]
    fn retry_delay_is_exponential_and_capped() {
        assert_eq!(retry_delay_seconds(1), 5);
        assert_eq!(retry_delay_seconds(2), 10);
        assert_eq!(retry_delay_seconds(3), 20);
        assert_eq!(retry_delay_seconds(25), 3600);
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL pointing at a migrated Postgres database"]
    async fn newer_retry_revision_resets_attempts_but_duplicate_and_older_events_do_not(
    ) -> anyhow::Result<()> {
        let pool = test_pool().await?;
        let store = IngestionRetryStore::new(pool.clone());
        let rkey = Uuid::new_v4().to_string();
        let event_key = format!(
            "{}:{}",
            event_key("did:plc:test", "collection", &rkey),
            Uuid::new_v4()
        );

        sqlx::query(
            r#"
            INSERT INTO ingestion_retry_events (
                event_key, did, collection, rkey, event, attempts,
                event_time_us, event_rev, last_error, dead_lettered_at
            ) VALUES ($1, $2, $3, $4, $5, 24, $6, $7, 'old failure', NOW())
            "#,
        )
        .bind(&event_key)
        .bind("did:plc:retry-version-test")
        .bind("fm.teal.alpha.feed.play")
        .bind("test-rkey")
        .bind(json!({"event_rev": "3k"}))
        .bind(100_i64)
        .bind("3k")
        .execute(&pool)
        .await?;

        let newer = retry_envelope(event_key.clone(), 101, "3l");
        store.enqueue(&newer, &anyhow!("newer failure")).await?;
        assert_eq!(
            retry_state(&pool, &event_key).await?,
            (0, true, 101, "3l".to_string())
        );

        sqlx::query(
            "UPDATE ingestion_retry_events SET attempts = 7, dead_lettered_at = NOW() WHERE event_key = $1",
        )
        .bind(&event_key)
        .execute(&pool)
        .await?;

        store.enqueue(&newer, &anyhow!("duplicate failure")).await?;
        assert_eq!(
            retry_state(&pool, &event_key).await?,
            (7, true, 101, "3l".to_string())
        );

        let older = retry_envelope(event_key.clone(), 100, "3m");
        store.enqueue(&older, &anyhow!("older failure")).await?;
        assert_eq!(
            retry_state(&pool, &event_key).await?,
            (7, true, 101, "3l".to_string())
        );

        sqlx::query("DELETE FROM ingestion_retry_events WHERE event_key = $1")
            .bind(&event_key)
            .execute(&pool)
            .await?;

        Ok(())
    }
}
