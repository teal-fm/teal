use async_trait::async_trait;
use jacquard_common::types::{blob::BlobRef, value};
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;

use crate::resolve::resolve_identity;

pub struct ActorProfileIngestor {
    sql: PgPool,
}

fn get_blob_ref(blob_ref: &BlobRef) -> String {
    blob_ref.blob().r#ref.as_str().to_string()
}

impl ActorProfileIngestor {
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    pub async fn insert_profile(
        &self,
        provided_did: &str,
        profile: &types::fm_teal::alpha::actor::profile::Profile,
    ) -> anyhow::Result<()> {
        dbg!(&profile);
        // TODO: cache the doc for like 8 hours or something
        let did = resolve_identity(provided_did, "https://public.api.bsky.app").await?;

        let handle = did.doc.also_known_as.first().to_owned();

        let created_time = profile
            .created_at
            .clone()
            .unwrap_or(jacquard_common::types::string::Datetime::now());
        let time_datetime =
            time::OffsetDateTime::from_unix_timestamp(created_time.as_ref().timestamp())
                .unwrap_or_else(|_| time::OffsetDateTime::now_utc());

        dbg!(&profile.avatar);
        let avatar = profile.avatar.as_ref().map(get_blob_ref);
        let banner = profile.banner.as_ref().map(get_blob_ref);
        let display_name = profile.display_name.as_ref().map(ToString::to_string);
        let description = profile.description.as_ref().map(ToString::to_string);
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
            display_name,
            description,
            serde_json::to_value(profile.description_facets.clone())?,
            avatar,
            banner,
            time_datetime
        )
        .execute(&self.sql)
        .await?;
        Ok(())
    }
    pub async fn remove_profile(&self, did: &str) -> anyhow::Result<()> {
        sqlx::query!(
            r#"
                DELETE FROM profiles WHERE did = $1
            "#,
            did
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
                let record: types::fm_teal::alpha::actor::profile::Profile =
                    value::from_json_value::<types::fm_teal::alpha::actor::profile::Profile>(
                        record.clone(),
                    )?;
                if let Some(ref commit) = message.commit {
                    if let Some(ref _cid) = commit.cid {
                        // TODO: verify cid
                        self.insert_profile(&message.did, &record).await?;
                    }
                }
            } else {
                println!("{}: Message {} deleted", message.did, commit.rkey);
                self.remove_profile(&message.did).await?;
            }
        } else {
            return Err(anyhow::anyhow!("Message has no commit"));
        }
        Ok(())
    }
}
