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
        .execute(&self.sql)
        .await?;

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

fn datetime_to_time(datetime: &Datetime) -> time::OffsetDateTime {
    time::OffsetDateTime::from_unix_timestamp(datetime.as_ref().timestamp())
        .unwrap_or_else(|_| time::OffsetDateTime::now_utc())
}

#[async_trait]
impl LexiconIngestor for ActorStatusIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let record: types::fm_teal::actor::status::Status =
                    value::from_json_value::<types::fm_teal::actor::status::Status>(
                        normalize_legacy_record_type(record),
                    )?;

                if let Some(ref cid) = commit.cid {
                    self.insert_status(&message.did, &commit.rkey, cid, &record)
                        .await?;
                }
            } else {
                println!("{}: Status {} deleted", message.did, commit.rkey);
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

    use super::status_times;

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
