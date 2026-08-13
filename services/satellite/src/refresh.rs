use sqlx::{Pool, Postgres};
use tracing::info;

pub async fn refresh_materialized_views(pool: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    info!("Refreshing materialized views");
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_play_counts")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_release_play_counts")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recording_play_counts")
        .execute(pool)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_play_count")
        .execute(pool)
        .await?;
    info!("Materialized views refreshed");
    Ok(())
}
