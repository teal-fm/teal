use std::collections::BTreeMap;

use async_trait::async_trait;
use jacquard_common::from_json_value;
use serde_json::Value;
use types::{
    app_bsky::richtext::facet::Facet,
    fm_teal::alpha::actor::{ProfileView, StatusView},
};

use super::{pg::PgDataSource, utc_to_atrium_datetime};

#[async_trait]
pub trait ActorProfileRepo {
    async fn get_actor_profile(&self, identity: &str) -> anyhow::Result<Option<ProfileView>>;
    async fn get_multiple_actor_profiles(
        &self,
        identities: &[String],
    ) -> anyhow::Result<Vec<ProfileView>>;
}

pub struct PgProfileRepoRows {
    pub avatar: Option<String>,
    pub banner: Option<String>,
    pub created_at: Option<time::OffsetDateTime>,
    pub description: Option<String>,
    pub description_facets: Option<Value>,
    pub did: Option<String>,
    pub display_name: Option<String>,
    pub status: Option<Value>,
}

impl From<PgProfileRepoRows> for ProfileView<'static> {
    fn from(row: PgProfileRepoRows) -> Self {
        Self {
            avatar: row.avatar.map(Into::into),
            banner: row.banner.map(Into::into),
            // chrono -> atrium time
            created_at: row
                .created_at
                .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
            description: row.description.map(Into::into),
            description_facets: row
                .description_facets
                .and_then(|v| from_json_value::<Vec<Facet<'_>>>(v).ok()),
            did: row.did.map(Into::into),
            display_name: row.display_name.map(Into::into),
            featured_item: None,
            status: row
                .status
                .and_then(|v| from_json_value::<StatusView<'_>>(v).ok()),
            extra_data: BTreeMap::new(),
        }
    }
}

#[async_trait]
impl ActorProfileRepo for PgDataSource {
    async fn get_actor_profile(&self, identity: &str) -> anyhow::Result<Option<ProfileView>> {
        self.get_multiple_actor_profiles(&[identity.to_string()])
            .await
            .map(|p| p.first().cloned())
    }
    async fn get_multiple_actor_profiles(
        &self,
        identities: &[String],
    ) -> anyhow::Result<Vec<ProfileView>> {
        // split identities into dids (prefixed with "did:") and handles (not prefixed) in one iteration
        let mut dids = Vec::new();
        let mut handles = Vec::new();
        for id in identities.iter() {
            if id.starts_with("did:") {
                dids.push(id.clone());
            } else {
                handles.push(id.clone());
            }
        }

        let profiles = sqlx::query_as!(
            PgProfileRepoRows,
            "SELECT
                p.avatar,
                p.banner,
                p.created_at,
                p.description,
                p.description_facets,
                p.did,
                p.display_name,
                s.record as status
            FROM profiles p
            LEFT JOIN statii s ON p.did = s.did AND s.rkey = 'self'
            WHERE (p.did = ANY($1))
            OR (p.handle = ANY($2))",
            &dids,
            &handles,
        )
        .fetch_all(&self.db)
        .await?;
        Ok(profiles.into_iter().map(|p| p.into()).collect())
    }
}
