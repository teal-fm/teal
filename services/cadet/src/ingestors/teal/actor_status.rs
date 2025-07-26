use async_trait::async_trait;
use atrium_api::types::string::Did;
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
        did: Did,
        rkey: &str,
        cid: &str,
        status: &types::fm::teal::alpha::actor::status::RecordData,
    ) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did.as_str(), "fm.teal.alpha.actor.status", rkey);
        
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
            did.as_str(),
            rkey,
            cid,
            record_json
        )
        .execute(&self.sql)
        .await?;
        
        Ok(())
    }

    pub async fn remove_status(&self, did: Did, rkey: &str) -> anyhow::Result<()> {
        let uri = assemble_at_uri(did.as_str(), "fm.teal.alpha.actor.status", rkey);
        
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
                let record = serde_json::from_value::<
                    types::fm::teal::alpha::actor::status::RecordData,
                >(record.clone())?;
                
                if let Some(ref commit) = message.commit {
                    if let Some(ref cid) = commit.cid {
                        self.insert_status(
                            Did::new(message.did)
                                .map_err(|e| anyhow::anyhow!("Failed to create Did: {}", e))?,
                            &commit.rkey,
                            cid,
                            &record,
                        )
                        .await?;
                    }
                }
            } else {
                println!("{}: Status {} deleted", message.did, commit.rkey);
                self.remove_status(
                    Did::new(message.did)
                        .map_err(|e| anyhow::anyhow!("Failed to create Did: {}", e))?,
                    &commit.rkey,
                )
                .await?;
            }
        } else {
            return Err(anyhow::anyhow!("Message has no commit"));
        }
        Ok(())
    }
}