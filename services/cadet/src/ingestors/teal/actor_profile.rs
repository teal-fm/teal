use async_trait::async_trait;
use jacquard_common::types::blob::BlobRef;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;
use tracing::info;

use crate::resolve::resolve_identity;

pub struct ActorProfileIngestor {
    sql: PgPool,
}

fn get_blob_ref(blob_ref: &BlobRef) -> String {
    blob_ref.blob().r#ref.as_str().to_string()
}

pub(crate) fn deserialize_profile(
    value: &Value,
) -> anyhow::Result<types::fm_teal::alpha::actor::profile::Profile> {
    // Jacquard's CID link visitor needs borrowed JSON keys for blob refs.
    Ok(serde_json::from_str(&serde_json::to_string(value)?)?)
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
        // TODO: cache the doc for like 8 hours or something
        let did = resolve_identity(provided_did, "https://public.api.bsky.app").await?;

        let handle = did
            .doc
            .also_known_as
            .first()
            .map(String::as_str)
            .and_then(|alias| alias.strip_prefix("at://"));

        self.upsert_profile(&did.identity, handle, profile).await
    }

    async fn upsert_profile(
        &self,
        did: &str,
        handle: Option<&str>,
        profile: &types::fm_teal::alpha::actor::profile::Profile,
    ) -> anyhow::Result<()> {
        let created_time = profile
            .created_at
            .clone()
            .unwrap_or(jacquard_common::types::string::Datetime::now());
        let time_datetime =
            time::OffsetDateTime::from_unix_timestamp(created_time.as_ref().timestamp())
                .unwrap_or_else(|_| time::OffsetDateTime::now_utc());

        let avatar = profile.avatar.as_ref().map(get_blob_ref);
        let banner = profile.banner.as_ref().map(get_blob_ref);
        let display_name = profile.display_name.as_ref().map(ToString::to_string);
        let description = profile.description.as_ref().map(ToString::to_string);
        let stats_default_period = profile
            .stats_default_period
            .as_ref()
            .map(ToString::to_string);
        sqlx::query(
            r#"
                INSERT INTO profiles (did, handle, display_name, description, description_facets, avatar, banner, stats_default_period, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (did) DO UPDATE SET
                    handle = EXCLUDED.handle,
                    display_name = EXCLUDED.display_name,
                    description = EXCLUDED.description,
                    description_facets = EXCLUDED.description_facets,
                    avatar = EXCLUDED.avatar,
                    banner = EXCLUDED.banner,
                    stats_default_period = EXCLUDED.stats_default_period,
                    created_at = EXCLUDED.created_at;
            "#,
        )
        .bind(did)
        .bind(handle)
        .bind(display_name)
        .bind(description)
        .bind(serde_json::to_value(profile.description_facets.clone())?)
        .bind(avatar)
        .bind(banner)
        .bind(stats_default_period)
        .bind(time_datetime)
        .execute(&self.sql)
        .await?;

        info!("Indexed Teal profile for {}", did);
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

        info!("Deleted Teal profile for {}", did);
        Ok(())
    }
}

#[async_trait]
impl LexiconIngestor for ActorProfileIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let record = deserialize_profile(record)?;
                if let Some(ref commit) = message.commit {
                    if let Some(ref _cid) = commit.cid {
                        // TODO: verify cid
                        self.insert_profile(&message.did, &record).await?;
                    }
                }
            } else {
                info!("{}: Profile {} deleted", message.did, commit.rkey);
                self.remove_profile(&message.did).await?;
            }
        } else {
            return Err(anyhow::anyhow!("Message has no commit"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use rocketman::{
        ingestion::LexiconIngestor,
        types::event::{Commit, Event, Kind, Operation},
    };
    use serde_json::json;
    use sqlx::PgPool;
    use uuid::Uuid;

    use super::{deserialize_profile, ActorProfileIngestor};

    async fn test_pool() -> anyhow::Result<PgPool> {
        let database_url = std::env::var("DATABASE_URL")?;
        Ok(PgPool::connect(&database_url).await?)
    }

    fn profile(
        display_name: &str,
        description: &str,
    ) -> anyhow::Result<types::fm_teal::alpha::actor::profile::Profile> {
        deserialize_profile(&json!({
            "$type": "fm.teal.alpha.actor.profile",
            "displayName": display_name,
            "description": description,
            "statsDefaultPeriod": "90days",
            "avatar": {
                "$type": "blob",
                "ref": {
                    "$link": "bafyreih4g7bvo6hdq2juolev5bfzpbo4ewkxh5mzxwgvkjp3kitc6hqkha"
                },
                "mimeType": "image/png",
                "size": 128
            },
            "createdAt": "2026-05-31T00:00:00Z"
        }))
    }

    #[tokio::test]
    #[ignore = "requires DATABASE_URL pointing at a migrated Postgres database"]
    async fn creates_updates_and_deletes_profile() -> anyhow::Result<()> {
        let pool = test_pool().await?;
        let ingestor = ActorProfileIngestor::new(pool.clone());
        let did = format!("did:plc:cadet-profile-test-{}", Uuid::new_v4());

        ingestor
            .upsert_profile(
                &did,
                Some("first.example"),
                &profile("First Name", "Initial profile")?,
            )
            .await?;

        let inserted = sqlx::query_as::<
            _,
            (
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
            ),
        >(
            "SELECT handle, display_name, description, avatar, stats_default_period FROM profiles WHERE did = $1",
        )
        .bind(&did)
        .fetch_one(&pool)
        .await?;
        assert_eq!(inserted.0.as_deref(), Some("first.example"));
        assert_eq!(inserted.1.as_deref(), Some("First Name"));
        assert_eq!(inserted.2.as_deref(), Some("Initial profile"));
        assert_eq!(
            inserted.3.as_deref(),
            Some("bafyreih4g7bvo6hdq2juolev5bfzpbo4ewkxh5mzxwgvkjp3kitc6hqkha")
        );
        assert_eq!(inserted.4.as_deref(), Some("90days"));

        ingestor
            .upsert_profile(
                &did,
                Some("updated.example"),
                &profile("Updated Name", "Updated profile")?,
            )
            .await?;

        let updated = sqlx::query_as::<
            _,
            (
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
            ),
        >(
            "SELECT handle, display_name, description, avatar, stats_default_period FROM profiles WHERE did = $1",
        )
        .bind(&did)
        .fetch_one(&pool)
        .await?;
        assert_eq!(updated.0.as_deref(), Some("updated.example"));
        assert_eq!(updated.1.as_deref(), Some("Updated Name"));
        assert_eq!(updated.2.as_deref(), Some("Updated profile"));
        assert_eq!(
            updated.3.as_deref(),
            Some("bafyreih4g7bvo6hdq2juolev5bfzpbo4ewkxh5mzxwgvkjp3kitc6hqkha")
        );
        assert_eq!(updated.4.as_deref(), Some("90days"));

        ingestor
            .ingest(Event {
                did: did.clone(),
                time_us: Some(1),
                kind: Kind::Commit,
                commit: Some(Commit {
                    rev: "test-rev".to_string(),
                    operation: Operation::Delete,
                    collection: "fm.teal.alpha.actor.profile".to_string(),
                    rkey: "self".to_string(),
                    record: None,
                    cid: None,
                }),
                identity: None,
            })
            .await?;

        let remaining =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM profiles WHERE did = $1")
                .bind(&did)
                .fetch_one(&pool)
                .await?;
        assert_eq!(remaining, 0);

        Ok(())
    }
}
