use async_trait::async_trait;
use jacquard_common::types::value;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;
use tracing::info;

use super::assemble_at_uri;

pub struct ActorProfileStatusIngestor {
    sql: PgPool,
}

impl ActorProfileStatusIngestor {
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    pub async fn insert_profile_status(
        &self,
        did: &str,
        rkey: &str,
        cid: &str,
        status: &types::fm_teal::alpha::actor::profile_status::ProfileStatus,
    ) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did, "fm.teal.alpha.actor.profileStatus", rkey);
        let created_at = status.created_at.as_ref().and_then(datetime_to_time);
        let updated_at = status.updated_at.as_ref().and_then(datetime_to_time);
        let record_json = serde_json::to_value(status)?;

        sqlx::query(
            r#"
                INSERT INTO profile_statuses (
                    did, uri, rkey, cid, completed_onboarding,
                    created_at, updated_at, record
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (did) DO UPDATE SET
                    uri = EXCLUDED.uri,
                    rkey = EXCLUDED.rkey,
                    cid = EXCLUDED.cid,
                    completed_onboarding = EXCLUDED.completed_onboarding,
                    created_at = EXCLUDED.created_at,
                    updated_at = EXCLUDED.updated_at,
                    record = EXCLUDED.record,
                    indexed_at = NOW()
            "#,
        )
        .bind(did)
        .bind(&uri)
        .bind(rkey)
        .bind(cid)
        .bind(status.completed_onboarding.to_string())
        .bind(created_at)
        .bind(updated_at)
        .bind(record_json)
        .execute(&self.sql)
        .await?;

        info!("Indexed Teal profile status for {}", did);
        Ok(())
    }

    pub async fn remove_profile_status(&self, did: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM profile_statuses WHERE did = $1")
            .bind(did)
            .execute(&self.sql)
            .await?;

        info!("Deleted Teal profile status for {}", did);
        Ok(())
    }
}

fn datetime_to_time(
    datetime: &jacquard_common::types::string::Datetime,
) -> Option<time::OffsetDateTime> {
    time::OffsetDateTime::from_unix_timestamp(datetime.as_ref().timestamp()).ok()
}

#[async_trait]
impl LexiconIngestor for ActorProfileStatusIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        let commit = message
            .commit
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Message has no commit"))?;

        if let Some(record) = &commit.record {
            let record: types::fm_teal::alpha::actor::profile_status::ProfileStatus =
                value::from_json_value::<
                    types::fm_teal::alpha::actor::profile_status::ProfileStatus,
                >(record.clone())?;
            if let Some(cid) = &commit.cid {
                self.insert_profile_status(&message.did, &commit.rkey, cid, &record)
                    .await?;
            }
        } else {
            self.remove_profile_status(&message.did).await?;
        }

        Ok(())
    }
}
