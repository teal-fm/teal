use std::time::{Duration, Instant, SystemTime};

use super::TimeProvider;

#[derive(Default, Clone, Copy)] // Add these derives for ease of use
pub struct SystemTimeProvider; // No fields needed, just a marker type

impl TimeProvider for SystemTimeProvider {
    fn new() -> Self {
        Self
    }

    fn now(&self) -> SystemTime {
        SystemTime::now()
    }

    fn elapsed(&self, earlier: SystemTime) -> Duration {
        earlier.elapsed().unwrap_or_else(|_| Duration::from_secs(0))
    }

    fn instant_now(&self) -> Instant {
        Instant::now()
    }

    fn instant_elapsed(&self, earlier: Instant) -> Duration {
        earlier.elapsed()
    }
}
