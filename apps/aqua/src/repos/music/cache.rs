use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Context;
use tokio::sync::{Mutex, OnceCell};
use uuid::Uuid;

use super::{ArtistReleaseMeta, MusicBrainzReleaseData};

const FRESH_FOR: Duration = Duration::from_secs(24 * 60 * 60);
const RETRY_AFTER: Duration = Duration::from_secs(30);
const REQUEST_INTERVAL: Duration = Duration::from_secs(1);
const QUEUE_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Default)]
struct Entry<T> {
    value: Option<T>,
    retry_at: Option<Instant>,
}

struct Slot<T> {
    used_at: Instant,
    entry: Arc<Mutex<Entry<T>>>,
}

/// Bounded successful metadata, retained through upstream outages. Failed cold
/// lookups have a short cooldown, rather than caching missing metadata forever.
pub(super) struct MetadataCache<T> {
    entries: Mutex<HashMap<Uuid, Slot<T>>>,
    capacity: usize,
    fresh_for: Duration,
}

impl<T: Clone + Default> MetadataCache<T> {
    pub(super) fn new(capacity: usize, fresh_for: Duration) -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            capacity,
            fresh_for,
        }
    }

    pub(super) async fn get_or_fetch<F, Fut>(&self, key: Uuid, fetch: F) -> anyhow::Result<T>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = anyhow::Result<T>>,
    {
        let entry = {
            let mut entries = self.entries.lock().await;
            if !entries.contains_key(&key) && entries.len() >= self.capacity {
                let oldest = entries
                    .iter()
                    .filter(|(_, slot)| Arc::strong_count(&slot.entry) == 1)
                    .min_by_key(|(_, slot)| slot.used_at)
                    .map(|(key, _)| *key);
                if let Some(oldest) = oldest {
                    entries.remove(&oldest);
                } else {
                    anyhow::bail!("MusicBrainz metadata cache is busy; retry later");
                }
            }
            let slot = entries.entry(key).or_insert_with(|| Slot {
                used_at: Instant::now(),
                entry: Arc::new(Mutex::new(Entry::default())),
            });
            slot.used_at = Instant::now();
            Arc::clone(&slot.entry)
        };
        // Hold only this key's lock while fetching, so concurrent cards share
        // one lookup while cached unrelated releases remain immediately usable.
        let mut entry = entry.lock().await;
        if entry
            .retry_at
            .is_some_and(|retry_at| retry_at > Instant::now())
        {
            return entry
                .value
                .clone()
                .ok_or_else(|| anyhow::anyhow!("MusicBrainz metadata unavailable; retry later"));
        }
        match fetch().await {
            Ok(value) => {
                entry.value = Some(value.clone());
                entry.retry_at = Some(Instant::now() + self.fresh_for);
                Ok(value)
            }
            Err(error) => {
                entry.retry_at = Some(Instant::now() + RETRY_AFTER);
                if let Some(value) = &entry.value {
                    tracing::warn!(%key, %error, "Serving cached MusicBrainz metadata after refresh failed");
                    Ok(value.clone())
                } else {
                    Err(error)
                }
            }
        }
    }

    pub(super) async fn insert(&self, key: Uuid, value: T) {
        // Seeding is best effort and must not wait behind an in-flight lookup.
        let mut entries = self.entries.lock().await;
        if !entries.contains_key(&key) && entries.len() >= self.capacity {
            return;
        }
        let slot = entries.entry(key).or_insert_with(|| Slot {
            used_at: Instant::now(),
            entry: Arc::new(Mutex::new(Entry::default())),
        });
        if let Ok(mut entry) = slot.entry.try_lock() {
            entry.value = Some(value);
            entry.retry_at = Some(Instant::now() + self.fresh_for);
        }
    }
}

pub(crate) struct MusicBrainzCache {
    pub(super) releases: MetadataCache<MusicBrainzReleaseData>,
    pub(super) release_groups: MetadataCache<Option<Uuid>>,
    pub(super) artist_releases: MetadataCache<HashMap<Uuid, ArtistReleaseMeta>>,
    client: OnceCell<reqwest::Client>,
    next_request: Mutex<Instant>,
}

impl Default for MusicBrainzCache {
    fn default() -> Self {
        Self {
            releases: MetadataCache::new(128, FRESH_FOR),
            release_groups: MetadataCache::new(1024, FRESH_FOR),
            artist_releases: MetadataCache::new(64, FRESH_FOR),
            client: OnceCell::new(),
            next_request: Mutex::new(Instant::now()),
        }
    }
}

impl MusicBrainzCache {
    pub(super) async fn request<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
    ) -> anyhow::Result<T> {
        let client = self
            .client
            .get_or_try_init(|| async {
                reqwest::Client::builder()
                    .timeout(Duration::from_secs(3))
                    .user_agent("teal-aqua/0.1 (https://teal.fm)")
                    .build()
            })
            .await?;
        self.reserve_request_slot(QUEUE_TIMEOUT).await?;
        Ok(client
            .get(url)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?)
    }

    async fn reserve_request_slot(&self, wait_for: Duration) -> anyhow::Result<()> {
        tokio::time::timeout(wait_for, async {
            let mut next_request = self.next_request.lock().await;
            tokio::time::sleep_until((*next_request).into()).await;
            *next_request = Instant::now() + REQUEST_INTERVAL;
        })
        .await
        .context("MusicBrainz request queue is busy; retry later")
    }
}

#[cfg(test)]
mod tests {
    use super::{MetadataCache, MusicBrainzCache};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;
    use uuid::Uuid;

    #[tokio::test]
    async fn coalesces_concurrent_lookups_for_the_same_release() {
        let cache = MetadataCache::new(2, Duration::from_secs(60));
        let requests = AtomicUsize::new(0);
        let key = Uuid::new_v4();
        let fetch = || async {
            requests.fetch_add(1, Ordering::SeqCst);
            tokio::task::yield_now().await;
            Ok(Some(key))
        };
        let (first, second) = tokio::join!(
            cache.get_or_fetch(key, fetch),
            cache.get_or_fetch(key, fetch)
        );
        assert_eq!(first.unwrap(), Some(key));
        assert_eq!(second.unwrap(), Some(key));
        assert_eq!(requests.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn keeps_canonical_release_group_when_refresh_is_rate_limited() {
        let cache = MetadataCache::new(2, Duration::ZERO);
        let key = Uuid::new_v4();
        let group = Uuid::new_v4();
        assert_eq!(
            cache
                .get_or_fetch(key, || async { Ok(Some(group)) })
                .await
                .unwrap(),
            Some(group)
        );
        assert_eq!(
            cache
                .get_or_fetch(key, || async { anyhow::bail!("HTTP 503") })
                .await
                .unwrap(),
            Some(group)
        );
        let result = cache
            .get_or_fetch(key, || async { panic!("must respect retry cooldown") })
            .await;
        assert_eq!(result.unwrap(), Some(group));
    }

    #[tokio::test]
    async fn failed_cold_lookup_retries_after_cooldown() {
        let cache = MetadataCache::<Option<Uuid>>::new(2, Duration::from_secs(60));
        let key = Uuid::new_v4();
        assert!(
            cache
                .get_or_fetch(key, || async { anyhow::bail!("HTTP 503") })
                .await
                .is_err()
        );
        assert!(
            cache
                .get_or_fetch(key, || async { panic!("must respect retry cooldown") })
                .await
                .is_err()
        );
        let entry = cache.entries.lock().await.get(&key).unwrap().entry.clone();
        entry.lock().await.retry_at = None;
        assert_eq!(
            cache
                .get_or_fetch(key, || async { Ok(Some(key)) })
                .await
                .unwrap(),
            Some(key)
        );
    }

    #[tokio::test]
    async fn evicts_least_recently_used_release_without_growing_past_capacity() {
        let cache = MetadataCache::new(2, Duration::from_secs(60));
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let third = Uuid::new_v4();
        cache
            .get_or_fetch(first, || async { Ok(Some(first)) })
            .await
            .unwrap();
        cache
            .get_or_fetch(second, || async { Ok(Some(second)) })
            .await
            .unwrap();
        cache
            .get_or_fetch(first, || async { panic!("must use cache") })
            .await
            .unwrap();
        cache
            .get_or_fetch(third, || async { Ok(Some(third)) })
            .await
            .unwrap();
        let entries = cache.entries.lock().await;
        assert_eq!(entries.len(), 2);
        assert!(entries.contains_key(&first));
        assert!(!entries.contains_key(&second));
    }

    #[tokio::test]
    async fn successful_missing_release_group_is_cached() {
        let cache = MetadataCache::<Option<Uuid>>::new(2, Duration::from_secs(60));
        let key = Uuid::new_v4();
        assert_eq!(
            cache
                .get_or_fetch(key, || async { Ok(None) })
                .await
                .unwrap(),
            None
        );
        assert_eq!(
            cache
                .get_or_fetch(key, || async { panic!("must cache valid absence") })
                .await
                .unwrap(),
            None
        );
    }

    #[tokio::test]
    async fn bounds_wait_for_the_shared_musicbrainz_request_queue() {
        let cache = MusicBrainzCache::default();
        let _busy_queue = cache.next_request.lock().await;
        let result = cache.reserve_request_slot(Duration::from_millis(10)).await;
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("request queue is busy")
        );
    }
}
