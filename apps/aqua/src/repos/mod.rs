use actor_profile::ActorProfileRepo;
use jacquard_common::{deps::smol_str::SmolStr, types::string::UriValue};
use types::fm_teal::alpha::actor::MiniProfileView;
use uuid::Uuid;

use crate::repos::feed_play::FeedPlayRepo;
use crate::repos::search::SearchRepo;
use crate::repos::stats::StatsRepo;

pub mod actor_profile;
pub mod feed_play;
pub mod pg;
pub mod search;
pub mod stats;

#[async_trait::async_trait]
pub trait DataSource:
    ActorProfileRepo + FeedPlayRepo + SearchRepo + StatsRepo + Send + Sync
{
    fn boxed(self) -> Box<dyn DataSource>
    where
        Self: Sized + Send + Sync + 'static,
    {
        Box::new(self)
    }
}

pub fn utc_to_atrium_datetime(
    dt: chrono::DateTime<chrono::Utc>,
) -> jacquard_common::types::string::Datetime {
    jacquard_common::types::string::Datetime::new(
        dt.with_timezone(&chrono::FixedOffset::west_opt(0).expect("0 is not negative")),
    )
}

pub fn time_to_chrono_utc(dt: time::OffsetDateTime) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(dt.unix_timestamp(), dt.nanosecond()).unwrap_or_default()
}

pub fn mbid_uri(mbid: Uuid) -> UriValue {
    UriValue::Any(SmolStr::new(format!("mbid:{mbid}")))
}

pub fn mini_profile(
    did: Option<String>,
    handle: Option<String>,
    display_name: Option<String>,
    avatar: Option<String>,
) -> Option<MiniProfileView> {
    did.map(|did| MiniProfileView {
        did: Some(did.into()),
        handle: handle.map(|handle| handle.trim_start_matches("at://").into()),
        display_name: display_name.map(Into::into),
        avatar: avatar.map(Into::into),
        extra_data: Default::default(),
    })
}

#[cfg(test)]
mod tests {
    use super::mini_profile;

    #[test]
    fn mini_profile_normalizes_at_uri_handle() {
        let profile = mini_profile(
            Some("did:plc:listener".to_string()),
            Some("at://listener.example".to_string()),
            Some("Listener".to_string()),
            None,
        )
        .expect("profile should be present");

        assert_eq!(profile.handle.as_deref(), Some("listener.example"));
    }
}
