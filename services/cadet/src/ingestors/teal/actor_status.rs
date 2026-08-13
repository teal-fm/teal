use async_trait::async_trait;
use jacquard_common::types::value;
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

#[async_trait]
impl LexiconIngestor for ActorStatusIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let record = parse_status_record(record)?;

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

/// Normalize legacy namespace tags before deserializing the generated record type.
fn parse_status_record(record: &Value) -> anyhow::Result<types::fm_teal::actor::status::Status> {
    Ok(value::from_json_value::<
        types::fm_teal::actor::status::Status,
    >(normalize_legacy_record_type(record))?)
}

#[cfg(test)]
mod tests {
    use super::parse_status_record;
    use crate::ingestors::teal::{ALPHA_ACTOR_STATUS, STABLE_ACTOR_STATUS};
    use rocketman::types::event::Event;
    use serde_json::{json, Value};

    fn direct_record(operation: &str, collection: &str) -> Value {
        let event: Event<Value> = serde_json::from_value(json!({
            "did": "did:plc:test",
            "kind": "commit",
            "commit": {
                "rev": "3ltest",
                "operation": operation,
                "collection": collection,
                "rkey": "self",
                "record": {
                    "$type": collection,
                    "time": "2024-01-01T00:00:00Z",
                    "item": {
                        "artists": [{"artistName": "Test Artist"}],
                        "trackName": "Test Song"
                    }
                },
                "cid": "bafytest"
            }
        }))
        .expect("valid direct event");

        event.commit.expect("commit event").record.expect("record")
    }

    #[test]
    fn direct_create_and_update_records_accept_stable_and_legacy_types() {
        for operation in ["create", "update"] {
            for record_type in [STABLE_ACTOR_STATUS, ALPHA_ACTOR_STATUS] {
                let record = direct_record(operation, record_type);
                let parsed = parse_status_record(&record)
                    .unwrap_or_else(|error| panic!("{operation} record should parse: {error}"));

                assert_eq!(parsed.item.track_name.as_str(), "Test Song");
            }
        }
    }
}
