use actor_profile::ActorProfileRepo;
use jacquard_common::{deps::smol_str::SmolStr, types::string::UriValue};
use uuid::Uuid;

use crate::repos::feed_play::FeedPlayRepo;
use crate::repos::stats::StatsRepo;

pub mod actor_profile;
pub mod feed_play;
pub mod pg;
pub mod stats;

#[async_trait::async_trait]
pub trait DataSource: ActorProfileRepo + FeedPlayRepo + StatsRepo + Send + Sync {
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

pub fn uri_value(value: String) -> UriValue {
    UriValue::Any(SmolStr::new(value))
}
