use redis::AsyncCommands;
use tracing::warn;

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
    match redis_connection().await {
        Ok(mut conn) => {
            let _: () = conn.set(cursor_key(), cursor).await?;
            Ok(())
        }
        Err(e) => {
            warn!(
                "Redis cursor store unavailable, falling back to file: {}",
                e
            );
            tokio::fs::write(cursor_file(), cursor.to_string()).await?;
            Ok(())
        }
    }
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

#[cfg(test)]
mod tests {
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;

    fn unique_cursor_file() -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!("cadet-cursor-{suffix}.txt"))
    }

    #[tokio::test]
    async fn stores_and_loads_cursor_from_file_when_redis_is_unavailable() {
        let cursor_file = unique_cursor_file();
        std::env::set_var("REDIS_URL", "redis://127.0.0.1:0");
        std::env::set_var("CURSOR_FILE", &cursor_file);
        std::env::set_var("CADET_CURSOR_REDIS_KEY", "cadet:test:cursor");

        store_cursor(42).await.expect("cursor should store");

        let loaded = load_cursor().await;
        assert_eq!(loaded, Some(42));

        let _ = tokio::fs::remove_file(cursor_file).await;
        std::env::remove_var("REDIS_URL");
        std::env::remove_var("CURSOR_FILE");
        std::env::remove_var("CADET_CURSOR_REDIS_KEY");
    }
}
