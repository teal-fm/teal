use async_trait::async_trait;
use jacquard_common::types::{did::Did, value};
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

    pub async fn insert_status<'a>(
        &self,
        did: Did<'_>,
        rkey: &str,
        cid: &str,
        status: &types::fm_teal::alpha::actor::status::Status<'a>,
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

    pub async fn remove_status(&self, did: Did<'_>, rkey: &str) -> anyhow::Result<()> {
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
                let data = &value::Data::from_json(record).to_owned()?;
                let record: types::fm_teal::alpha::actor::status::Status = value::from_data(data)?;

                if let Some(ref cid) = commit.cid {
                    self.insert_status(Did::from(message.did), &commit.rkey, cid, &record)
                        .await?;
                }
            } else {
                println!("{}: Status {} deleted", message.did, commit.rkey);
                self.remove_status(Did::from(message.did), &commit.rkey)
                    .await?;
            }
        } else {
            return Err(anyhow::anyhow!("Message has no commit"));
        }
        Ok(())
    }
}
