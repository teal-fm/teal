use async_trait::async_trait;
use jacquard_common::types::{string::Datetime, value};
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;

use crate::ingestors::teal::{assemble_at_uri, normalize_legacy_record_type};

pub struct ActorStatusIngestor {
    sql: PgPool,
}

impl ActorStatusIngestor {
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    pub async fn insert_status(
        &self,
        did: &str,
        rkey: &str,
        cid: &str,
        status: &types::fm_teal::actor::status::Status,
    ) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did, "fm.teal.actor.status", rkey);

        let record_json = serde_json::to_value(status)?;
        let (status_time, expires_at) = status_times(&status.time, status.expiry.as_ref());

        // Lock the account and skip deactivated ones, so a write that started
        // before a deactivation can't land after its purge.
        let mut tx = self.sql.begin().await?;
        if !crate::account::lock_active_account(&mut tx, did).await? {
            tx.rollback().await?;
            return Ok(());
        }
        sqlx::query(
            r#"
                INSERT INTO statii (uri, did, rkey, cid, record, status_time, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (uri) DO UPDATE SET
                    cid = EXCLUDED.cid,
                    record = EXCLUDED.record,
                    status_time = EXCLUDED.status_time,
                    expires_at = EXCLUDED.expires_at,
                    indexed_at = NOW();
            "#,
        )
        .bind(uri)
        .bind(did)
        .bind(rkey)
        .bind(cid)
        .bind(record_json)
        .bind(status_time)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn remove_status(&self, did: &str, rkey: &str) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did, "fm.teal.actor.status", rkey);

        sqlx::query!(
            r#"
                DELETE FROM statii WHERE uri = $1
            "#,
            uri
        )
        .execute(&self.sql)
        .await?;

        Ok(())
    }
}

pub(crate) fn status_times(
    time: &Datetime,
    expiry: Option<&Datetime>,
) -> (time::OffsetDateTime, time::OffsetDateTime) {
    let status_time = datetime_to_time(time);
    let expires_at = expiry
        .map(datetime_to_time)
        .unwrap_or_else(|| status_time + time::Duration::minutes(10));
    (status_time, expires_at)
}

/// Parse a status record from either namespace. Early alpha statuses wrote
/// `time` and `expiry` as Unix-second strings; those become datetimes.
pub fn parse_status(record: &Value) -> anyhow::Result<types::fm_teal::actor::status::Status> {
    let mut record = normalize_legacy_record_type(record);
    if let Value::Object(fields) = &mut record {
        for key in ["time", "expiry"] {
            let Some(Value::String(text)) = fields.get(key) else {
                continue;
            };
            let Some(datetime) = text
                .parse::<i64>()
                .ok()
                .and_then(|seconds| chrono::DateTime::from_timestamp(seconds, 0))
            else {
                continue;
            };
            fields.insert(
                key.to_string(),
                Value::String(datetime.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)),
            );
        }
    }
    Ok(value::from_json_value::<
        types::fm_teal::actor::status::Status,
    >(record)?)
}

fn datetime_to_time(datetime: &Datetime) -> time::OffsetDateTime {
    time::OffsetDateTime::from_unix_timestamp(datetime.as_ref().timestamp())
        .unwrap_or_else(|_| time::OffsetDateTime::now_utc())
}

#[async_trait]
impl LexiconIngestor for ActorStatusIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let record = parse_status(record)?;

                if let Some(ref cid) = commit.cid {
                    self.insert_status(&message.did, &commit.rkey, cid, &record)
                        .await?;
                }
            } else {
                tracing::info!("{}: Status {} deleted", message.did, commit.rkey);
                self.remove_status(&message.did, &commit.rkey).await?;
            }
        } else {
            return Err(anyhow::anyhow!("Message has no commit"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use jacquard_common::types::string::Datetime;

    use super::{parse_status, status_times};

    #[test]
    fn parses_alpha_status_with_unix_second_times() -> anyhow::Result<()> {
        let status = parse_status(&serde_json::json!({
            "$type": "fm.teal.alpha.actor.status",
            "time": "1770428871",
            "expiry": "1770429471",
            "item": { "trackName": "Holly Hox, Forget Me Nots", "artists": [] }
        }))?;
        assert_eq!(status.time.as_str(), "2026-02-07T01:47:51Z");
        assert_eq!(
            status.expiry.as_ref().map(|expiry| expiry.as_str()),
            Some("2026-02-07T01:57:51Z")
        );
        Ok(())
    }

    fn datetime(value: &str) -> Datetime {
        serde_json::from_value(serde_json::json!(value)).expect("valid datetime")
    }

    #[test]
    fn status_expiry_defaults_to_ten_minutes_after_status_time() {
        let time = datetime("2026-06-01T12:00:00Z");
        let (status_time, expires_at) = status_times(&time, None);

        assert_eq!(expires_at - status_time, time::Duration::minutes(10));
    }

    #[test]
    fn status_expiry_uses_record_expiry_when_present() {
        let time = datetime("2026-06-01T12:00:00Z");
        let expiry = datetime("2026-06-01T12:03:00Z");
        let (status_time, expires_at) = status_times(&time, Some(&expiry));

        assert_eq!(expires_at - status_time, time::Duration::minutes(3));
    }
}
