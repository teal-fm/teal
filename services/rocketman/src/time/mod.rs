use std::time::{Duration, Instant, SystemTime};

pub mod system_time;

pub trait TimeProvider {
    fn new() -> Self;
    fn now(&self) -> SystemTime; // Get the current time
    fn elapsed(&self, earlier: SystemTime) -> Duration; // Calculate the elapsed time.
    fn instant_now(&self) -> Instant; // For compatibility with your existing code (if needed)
    fn instant_elapsed(&self, earlier: Instant) -> Duration;
}
