use async_trait::async_trait;
use jacquard_common::types::value;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;

use crate::ingestors::teal::assemble_at_uri;

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
        status: &types::fm_teal::alpha::actor::status::Status,
    ) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did, "fm.teal.alpha.actor.status", rkey);

        let record_json = serde_json::to_value(status)?;

        sqlx::query!(
            r#"
                INSERT INTO statii (uri, did, rkey, cid, record)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (uri) DO UPDATE SET
                    cid = EXCLUDED.cid,
                    record = EXCLUDED.record,
                    indexed_at = NOW();
            "#,
            uri,
            did,
            rkey,
            cid,
            record_json
        )
        .execute(&self.sql)
        .await?;

        Ok(())
    }

    pub async fn remove_status(&self, did: &str, rkey: &str) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did, "fm.teal.alpha.actor.status", rkey);

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

#[async_trait]
impl LexiconIngestor for ActorStatusIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let record: types::fm_teal::alpha::actor::status::Status =
                    value::from_json_value::<types::fm_teal::alpha::actor::status::Status>(
                        record.clone(),
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
