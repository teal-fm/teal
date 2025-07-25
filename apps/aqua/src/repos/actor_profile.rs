use async_trait::async_trait;
use serde_json::Value;
use types::fm::teal::alpha::actor::defs::ProfileViewData;

use super::{pg::PgDataSource, utc_to_atrium_datetime};

#[async_trait]
pub trait ActorProfileRepo {
    async fn get_actor_profile(&self, identity: &str) -> anyhow::Result<Option<ProfileViewData>>;
    async fn get_multiple_actor_profiles(
        &self,
        identities: &Vec<String>,
    ) -> anyhow::Result<Vec<ProfileViewData>>;
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

impl From<PgProfileRepoRows> for ProfileViewData {
    fn from(row: PgProfileRepoRows) -> Self {
        Self {
            avatar: row.avatar,
            banner: row.banner,
            // chrono -> atrium time
            created_at: row.created_at.map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
            description: row.description,
            description_facets: row
                .description_facets
                .and_then(|v| serde_json::from_value(v).ok()),
            did: row.did,
            featured_item: None,
            display_name: row.display_name,
            status: row.status.and_then(|v| serde_json::from_value(v).ok()),
        }
    }
}

#[async_trait]
impl ActorProfileRepo for PgDataSource {
    async fn get_actor_profile(&self, identity: &str) -> anyhow::Result<Option<ProfileViewData>> {
        self.get_multiple_actor_profiles(&vec![identity.to_string()])
            .await
            .map(|p| p.first().cloned())
    }
    async fn get_multiple_actor_profiles(
        &self,
        identities: &Vec<String>,
    ) -> anyhow::Result<Vec<ProfileViewData>> {
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
