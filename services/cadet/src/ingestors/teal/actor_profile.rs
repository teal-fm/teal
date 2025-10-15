use async_trait::async_trait;
use jacquard_common::types::{did::Did, value};
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;

use crate::resolve::resolve_identity;

pub struct ActorProfileIngestor {
    sql: PgPool,
}

fn get_blob_ref(blob_ref: &jacquard_common::types::blob::Blob) -> String {
    blob_ref.r#ref.as_ref().to_string()
}

impl ActorProfileIngestor {
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    pub async fn insert_profile<'a>(
        &self,
        provided_did: Did<'_>,
        profile: &'a types::fm_teal::alpha::actor::profile::Profile<'a>,
    ) -> anyhow::Result<()> {
        dbg!(&profile);
        // TODO: cache the doc for like 8 hours or something
        let did = resolve_identity(provided_did.as_str(), "https://public.api.bsky.app").await?;

        let handle = did.doc.also_known_as.first().to_owned();

        let created_time = profile
            .created_at
            .clone()
            .unwrap_or(jacquard_common::types::string::Datetime::now());
        let time_datetime =
            time::OffsetDateTime::from_unix_timestamp(created_time.as_ref().timestamp())
                .unwrap_or_else(|_| time::OffsetDateTime::now_utc());

        dbg!(&profile.avatar);
        let avatar = profile.avatar.as_ref().map(|bref| get_blob_ref(bref));
        let banner = profile.banner.as_ref().map(|bref| get_blob_ref(bref));
        sqlx::query!(
            r#"
                INSERT INTO profiles (did, handle, display_name, description, description_facets, avatar, banner, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (did) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    description_facets = EXCLUDED.description_facets,
                    avatar = EXCLUDED.avatar,
                    banner = EXCLUDED.banner,
                    created_at = EXCLUDED.created_at;
            "#,
            did.identity,
            handle,
            profile.display_name.as_ref().map(|s| s.as_ref()),
            profile.description.as_ref().map(|s| s.as_ref()),
            serde_json::to_value(profile.description_facets.clone())?,
            avatar,
            banner,
            time_datetime
        )
        .execute(&self.sql)
        .await?;
        Ok(())
    }
    pub async fn remove_profile(&self, did: Did<'_>) -> anyhow::Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM profiles WHERE did = $1
            "#,
            did.as_str()
        )
        .execute(&self.sql)
        .await?;
        Ok(())
    }
}

#[async_trait]
impl LexiconIngestor for ActorProfileIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let data = &value::Data::from_json(record).to_owned()?;
                let record: types::fm_teal::alpha::actor::profile::Profile =
                    value::from_data(data)?;
                if let Some(ref commit) = message.commit {
                    if let Some(ref _cid) = commit.cid {
                        // TODO: verify cid
                        self.insert_profile(
                            Did::new(&message.did)
                                .map_err(|e| anyhow::anyhow!("Failed to create Did: {}", e))?,
                            &record,
                        )
                        .await?;
                    }
                }
            } else {
                println!("{}: Message {} deleted", message.did, commit.rkey);
                self.remove_profile(
                    Did::new(&message.did)
                        .map_err(|e| anyhow::anyhow!("Failed to create Did: {}", e))?,
                )
                .await?;
            }
        } else {
            return Err(anyhow::anyhow!("Message has no commit"));
        }
        Ok(())
    }
}
