use sqlx::{Pool, Postgres};

pub async fn refresh_materialized_views(pool: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    println!("Refreshing materialized views...");
    let mut tx = pool.begin().await?;
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_play_counts")
        .execute(&mut *tx)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_release_play_counts")
        .execute(&mut *tx)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recording_play_counts")
        .execute(&mut *tx)
        .await?;
    sqlx::query("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_play_count")
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    println!("Materialized views refreshed.");
    Ok(())
}
