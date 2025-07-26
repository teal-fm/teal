use actor_profile::ActorProfileRepo;

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
) -> atrium_api::types::string::Datetime {
    atrium_api::types::string::Datetime::new(
        dt.with_timezone(&chrono::FixedOffset::west_opt(0).expect("0 is not negative")),
    )
}

pub fn time_to_chrono_utc(dt: time::OffsetDateTime) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(dt.unix_timestamp(), dt.nanosecond()).unwrap_or_default()
}
