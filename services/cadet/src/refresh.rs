use std::time::Duration;

use anyhow::{Context, Result};
use sqlx::PgPool;
use tokio::time::{interval, MissedTickBehavior};
use tracing::{debug, error, info};

pub fn refresh_interval(value: Option<&str>) -> Result<Duration> {
    let seconds = value
        .unwrap_or("60")
        .parse::<u32>()
        .context("CADET_MATERIALIZED_VIEW_REFRESH_INTERVAL_SECS must be a positive integer")?;
    anyhow::ensure!(
        seconds > 0,
        "materialized view refresh interval must be nonzero"
    );
    Ok(Duration::from_secs(u64::from(seconds)))
}

/// Refresh all counts atomically. The transaction lock prevents multiple Cadet
/// instances from queuing redundant refreshes and is released on failure.
pub async fn refresh_materialized_views(pool: &PgPool) -> Result<bool> {
    let mut tx = pool.begin().await?;
    let acquired =
        sqlx::query_scalar!("SELECT pg_try_advisory_xact_lock(1952801132, 1) AS \"acquired!\"")
            .fetch_one(&mut *tx)
            .await?;
    if !acquired {
        tx.rollback().await?;
        return Ok(false);
    }

    // Bound each statement, including waits for a refresh from another service.
    sqlx::query!("SET LOCAL statement_timeout = '120s'")
        .execute(&mut *tx)
        .await?;
    sqlx::query!("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_play_counts")
        .execute(&mut *tx)
        .await?;
    sqlx::query!("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_release_play_counts")
        .execute(&mut *tx)
        .await?;
    sqlx::query!("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recording_play_counts")
        .execute(&mut *tx)
        .await?;
    sqlx::query!("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_play_count")
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(true)
}

pub async fn run(pool: PgPool, period: Duration) {
    let mut ticks = interval(period);
    ticks.set_missed_tick_behavior(MissedTickBehavior::Skip);
    info!(
        interval_secs = period.as_secs(),
        "Starting materialized view refresh worker"
    );
    loop {
        // The first tick is immediate, repairing counts after downtime.
        ticks.tick().await;
        match refresh_materialized_views(&pool).await {
            Ok(true) => info!("Materialized play counts refreshed"),
            Ok(false) => debug!("Another Cadet instance is refreshing play counts"),
            Err(error) => error!(%error, "Play count refresh failed; retrying next interval"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::refresh_interval;
    use std::time::Duration;

    #[test]
    fn validates_refresh_interval() -> anyhow::Result<()> {
        assert_eq!(refresh_interval(None)?, Duration::from_secs(60));
        assert_eq!(refresh_interval(Some("15"))?, Duration::from_secs(15));
        for value in ["0", "-1", "", "invalid", "4294967296"] {
            assert!(refresh_interval(Some(value)).is_err(), "accepted {value}");
        }
        Ok(())
    }
}
