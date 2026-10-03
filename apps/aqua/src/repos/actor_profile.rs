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
    fm_teal::actor::profile_status::ProfileStatus,
    fm_teal::actor::{ProfileView, StatusView},
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
    pub stats_default_period: Option<String>,
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
            profile_status: row.profile_status.and_then(profile_status_from_record),
            stats_default_period: row.stats_default_period.map(Into::into),
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

// Serde's flattened extra_data retains the incoming record tag. The generated
// serializer writes its own stable tag, so retaining this key would emit a
// duplicate $type and let legacy alpha records override the public schema.
fn profile_status_from_record(record: Value) -> Option<ProfileStatus> {
    let mut status = from_json_value::<ProfileStatus>(record).ok()?;
    if let Some(extra_data) = status.extra_data.as_mut() {
        extra_data.remove("$type");
        if extra_data.is_empty() {
            status.extra_data = None;
        }
    }
    Some(status)
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
                p.stats_default_period,
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

#[cfg(test)]
mod tests {
    use super::PgProfileRepoRows;
    use serde_json::json;
    use types::fm_teal::actor::ProfileView;

    fn row_with_status(profile_status: serde_json::Value) -> PgProfileRepoRows {
        PgProfileRepoRows {
            avatar: None,
            banner: None,
            created_at: None,
            description: None,
            description_facets: None,
            did: Some("did:plc:ewvi7nxzyoun6zhxrhs64oiz".into()),
            display_name: Some("Teal listener".into()),
            handle: None,
            profile_status: Some(profile_status),
            stats_default_period: None,
            status: None,
        }
    }

    #[test]
    fn profile_status_emits_one_stable_tag_and_preserves_record_fields() {
        for record_type in [
            "fm.teal.alpha.actor.profileStatus",
            "fm.teal.actor.profileStatus",
        ] {
            let profile = ProfileView::from(row_with_status(json!({
                "$type": record_type,
                "completedOnboarding": "complete",
                "createdAt": "2025-06-08T13:10:00Z",
                "updatedAt": "2026-10-03T01:20:00Z",
                "client": "teal.amethyst",
                "onboardingMetadata": { "version": 2, "imported": true }
            })));
            let serialized = serde_json::to_string(&profile).expect("profile must serialize");
            assert_eq!(serialized.matches("\"$type\"").count(), 1);
            let output: serde_json::Value =
                serde_json::from_str(&serialized).expect("profile output must be JSON");
            let status = &output["profileStatus"];
            assert_eq!(status["$type"], "fm.teal.actor.profileStatus");
            assert_eq!(status["completedOnboarding"], "complete");
            assert_eq!(status["createdAt"], "2025-06-08T13:10:00Z");
            assert_eq!(status["updatedAt"], "2026-10-03T01:20:00Z");
            assert_eq!(status["client"], "teal.amethyst");
            assert_eq!(
                status["onboardingMetadata"],
                json!({ "version": 2, "imported": true })
            );
        }
    }

    #[test]
    fn profile_status_without_extensions_serializes_once() {
        let profile = ProfileView::from(row_with_status(json!({
            "$type": "fm.teal.actor.profileStatus",
            "completedOnboarding": "profileOnboarding"
        })));
        let status = profile
            .profile_status
            .expect("valid status must remain present");
        let serialized = serde_json::to_string(&status).expect("status must serialize");
        assert_eq!(serialized.matches("\"$type\"").count(), 1);
        let output: serde_json::Value =
            serde_json::from_str(&serialized).expect("status must be JSON");
        assert_eq!(output["$type"], "fm.teal.actor.profileStatus");
        assert_eq!(output["completedOnboarding"], "profileOnboarding");
    }
}
