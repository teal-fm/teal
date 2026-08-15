use std::time::{SystemTime, UNIX_EPOCH};

use redis::AsyncCommands;
use tracing::warn;

/// Jetstream retains roughly 24 hours of history; cursors older than this will
/// resume at the oldest available message and silently lose anything in between.
/// We clamp to a 12-hour replay window so a freshly restored cursor still has
/// some headroom for upstream availability.
const MAX_REPLAY_AGE_US: u64 = 12 * 60 * 60 * 1_000_000;

fn cursor_file() -> String {
    std::env::var("CURSOR_FILE").unwrap_or_else(|_| "./cursor.txt".to_string())
}

fn cursor_key() -> String {
    std::env::var("CADET_CURSOR_REDIS_KEY").unwrap_or_else(|_| "cadet:jetstream:cursor".to_string())
}

async fn redis_connection() -> anyhow::Result<redis::aio::MultiplexedConnection> {
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let client = redis::Client::open(redis_url)?;
    Ok(client.get_multiplexed_async_connection().await?)
}

pub async fn store_cursor(cursor: u64) -> anyhow::Result<()> {
    let mut redis_ok = false;
    match redis_connection().await {
        Ok(mut conn) => {
            let _: () = conn.set(cursor_key(), cursor).await?;
            redis_ok = true;
        }
        Err(e) => {
            warn!(
                "Redis cursor store unavailable, falling back to file: {}",
                e
            );
        }
    }

    // Always mirror the cursor to the local file so it survives Redis wipes.
    if let Err(e) = tokio::fs::write(cursor_file(), cursor.to_string()).await {
        if redis_ok {
            warn!("Cursor file mirror failed (redis ok, will retry): {}", e);
        } else {
            return Err(e.into());
        }
    }
    Ok(())
}

pub async fn load_cursor() -> Option<u64> {
    if let Ok(mut conn) = redis_connection().await {
        match conn.get::<_, Option<u64>>(cursor_key()).await {
            Ok(Some(cursor)) => return Some(cursor),
            Ok(None) => {}
            Err(e) => warn!("Redis cursor load failed, falling back to file: {}", e),
        }
    }

    tokio::fs::read_to_string(cursor_file())
        .await
        .ok()
        .and_then(|s| s.parse().ok())
}

/// Current wall-clock time in microseconds since the Unix epoch, matching the
/// jetstream `time_us` envelope field.
pub fn now_us() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_micros() as u64)
        .unwrap_or(0)
}

/// Resolve the cursor to use when (re)connecting to jetstream.
///
/// Returns `Some(now_us)` when no cursor is available so the
/// `rocketman::handler` (which only advances cursors that are already
/// `Some(_)`) can keep updating it as messages arrive. Also clamps stored
/// cursors that are older than [`MAX_REPLAY_AGE_US`] to avoid an unbounded
/// replay attempt against a history jetstream no longer retains.
pub async fn resolve_startup_cursor() -> u64 {
    let now = now_us();
    match load_cursor().await {
        Some(0) => {
            tracing::info!("Cursor was zero, starting jetstream at current time");
            now
        }
        Some(stored) if stored > now => {
            tracing::warn!(
                "Stored cursor {} is ahead of current time {}, resetting to now",
                stored,
                now
            );
            now
        }
        Some(stored) if now.saturating_sub(stored) > MAX_REPLAY_AGE_US => {
            tracing::warn!(
                "Stored cursor {} is older than replay window ({} us behind now); clamping to last {} hours",
                stored,
                now.saturating_sub(stored),
                MAX_REPLAY_AGE_US / 3_600_000_000
            );
            now.saturating_sub(MAX_REPLAY_AGE_US)
        }
        Some(stored) => {
            tracing::info!("Resuming jetstream from stored cursor {}", stored);
            stored
        }
        None => {
            tracing::info!(
                "No cursor available, starting jetstream at current time {} (will persist forward)",
                now
            );
            now
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use tokio::sync::Mutex;

    use super::*;

    // Cursor tests mutate global env vars; serialise them so cargo's parallel
    // test runner can't race on REDIS_URL / CURSOR_FILE. Using a tokio mutex
    // keeps clippy's await_holding_lock happy.
    static ENV_LOCK: Mutex<()> = Mutex::const_new(());

    fn unique_cursor_file() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!("cadet-cursor-{suffix}.txt"))
    }

    fn clear_env(cursor_file: &PathBuf) {
        let _ = std::fs::remove_file(cursor_file);
        std::env::remove_var("REDIS_URL");
        std::env::remove_var("CURSOR_FILE");
        std::env::remove_var("CADET_CURSOR_REDIS_KEY");
    }

    #[tokio::test]
    async fn stores_and_loads_cursor_from_file_when_redis_is_unavailable() {
        let _guard = ENV_LOCK.lock().await;
        let cursor_file = unique_cursor_file();
        std::env::set_var("REDIS_URL", "redis://127.0.0.1:0");
        std::env::set_var("CURSOR_FILE", &cursor_file);
        std::env::set_var("CADET_CURSOR_REDIS_KEY", "cadet:test:cursor");

        store_cursor(42).await.expect("cursor should store");

        let loaded = load_cursor().await;
        assert_eq!(loaded, Some(42));

        clear_env(&cursor_file);
    }

    #[tokio::test]
    async fn resolve_startup_cursor_falls_back_to_now_when_unset() {
        let _guard = ENV_LOCK.lock().await;
        let cursor_file = unique_cursor_file();
        std::env::set_var("REDIS_URL", "redis://127.0.0.1:0");
        std::env::set_var("CURSOR_FILE", &cursor_file);
        std::env::set_var("CADET_CURSOR_REDIS_KEY", "cadet:test:resolve:unset");

        let before = now_us();
        let cursor = resolve_startup_cursor().await;
        let after = now_us();

        assert!(
            cursor >= before && cursor <= after,
            "expected cursor in [{}, {}], got {}",
            before,
            after,
            cursor
        );

        clear_env(&cursor_file);
    }

    #[tokio::test]
    async fn resolve_startup_cursor_resumes_recent_stored_value() {
        let _guard = ENV_LOCK.lock().await;
        let cursor_file = unique_cursor_file();
        std::env::set_var("REDIS_URL", "redis://127.0.0.1:0");
        std::env::set_var("CURSOR_FILE", &cursor_file);
        std::env::set_var("CADET_CURSOR_REDIS_KEY", "cadet:test:resolve:recent");

        let stored = now_us() - 60 * 1_000_000;
        store_cursor(stored).await.expect("cursor should store");

        let cursor = resolve_startup_cursor().await;
        assert_eq!(cursor, stored, "recent cursor should be resumed as-is");

        clear_env(&cursor_file);
    }

    #[tokio::test]
    async fn resolve_startup_cursor_clamps_stale_stored_value() {
        let _guard = ENV_LOCK.lock().await;
        let cursor_file = unique_cursor_file();
        std::env::set_var("REDIS_URL", "redis://127.0.0.1:0");
        std::env::set_var("CURSOR_FILE", &cursor_file);
        std::env::set_var("CADET_CURSOR_REDIS_KEY", "cadet:test:resolve:stale");

        let stale = now_us().saturating_sub(48 * 60 * 60 * 1_000_000);
        store_cursor(stale).await.expect("cursor should store");

        let before = now_us();
        let cursor = resolve_startup_cursor().await;

        assert!(
            cursor >= before.saturating_sub(MAX_REPLAY_AGE_US),
            "stale cursor should be clamped forward, got {} expected >= {}",
            cursor,
            before.saturating_sub(MAX_REPLAY_AGE_US)
        );
        assert!(
            cursor <= now_us(),
            "clamped cursor should not exceed current time"
        );

        clear_env(&cursor_file);
    }
}
