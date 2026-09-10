use std::collections::BTreeMap;

use async_trait::async_trait;
use jacquard_common::{
    deps::smol_str::SmolStr,
    from_json_value,
    types::{string::AtprotoStr, value::Data},
};
use serde_json::Value;
use types::{
    app_bsky::richtext::facet::Facet,
    fm_teal::alpha::actor::profile_status::ProfileStatus,
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

#[derive(sqlx::FromRow)]
pub struct PgProfileRepoRows {
    pub avatar: Option<String>,
    pub banner: Option<String>,
    pub created_at: Option<time::OffsetDateTime>,
    pub description: Option<String>,
    pub description_facets: Option<Value>,
    pub did: Option<String>,
    pub display_name: Option<String>,
    pub handle: Option<String>,
    pub profile_status: Option<Value>,
    pub status: Option<Value>,
}

impl From<PgProfileRepoRows> for ProfileView {
    fn from(row: PgProfileRepoRows) -> Self {
        let mut extra_data = BTreeMap::new();
        if let Some(handle) = row.handle {
            extra_data.insert(
                SmolStr::new_static("handle"),
                Data::String(AtprotoStr::new(SmolStr::new(handle))),
            );
        }

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
                .and_then(|v| from_json_value::<Vec<Facet>>(v).ok()),
            did: row.did.map(Into::into),
            display_name: row.display_name.map(Into::into),
            featured_item: None,
            profile_status: row
                .profile_status
                .and_then(|v| from_json_value::<ProfileStatus>(v).ok()),
            status: row
                .status
                .and_then(|v| from_json_value::<StatusView>(v).ok()),
            extra_data: if extra_data.is_empty() {
                None
            } else {
                Some(extra_data)
            },
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

        let profiles = sqlx::query_as::<_, PgProfileRepoRows>(
            "WITH actors AS (
                SELECT p.did
                FROM profiles p
                WHERE (p.did = ANY($1))
                OR (p.handle = ANY($2))
                UNION
                SELECT ps.did
                FROM profile_statuses ps
                WHERE ps.did = ANY($1)
                UNION
                SELECT s.did
                FROM statii s
                WHERE s.did = ANY($1)
                  AND s.expires_at > NOW()
            )
            SELECT
                p.avatar,
                p.banner,
                p.created_at,
                p.description,
                p.description_facets,
                actors.did,
                p.display_name,
                p.handle,
                ps.record as profile_status,
                s.record as status
            FROM actors
            LEFT JOIN profiles p ON p.did = actors.did
            LEFT JOIN profile_statuses ps ON actors.did = ps.did
            LEFT JOIN LATERAL (
                SELECT record
                FROM statii
                WHERE did = actors.did
                  AND expires_at > NOW()
                ORDER BY status_time DESC, indexed_at DESC
                LIMIT 1
            ) s ON TRUE
            ORDER BY actors.did",
        )
        .bind(&dids)
        .bind(&handles)
        .fetch_all(&self.db)
        .await?;
        Ok(profiles.into_iter().map(|p| p.into()).collect())
    }
}
