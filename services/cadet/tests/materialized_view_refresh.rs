use std::time::Duration;

use anyhow::Result;
use cadet::refresh::{refresh_materialized_views, run};
use sqlx::PgPool;
use tokio::time::{sleep, timeout};
use uuid::Uuid;

async fn insert_play(pool: &PgPool) -> Result<()> {
    let mbid = Uuid::nil();
    let artist_id = sqlx::query_scalar!(
        "INSERT INTO artists_extended (mbid, name) VALUES ($1, 'Refresh artist') RETURNING id",
        mbid
    )
    .fetch_one(pool)
    .await?;
    sqlx::query!(
        "INSERT INTO releases (mbid, name) VALUES ($1, 'Refresh release')",
        mbid
    )
    .execute(pool)
    .await?;
    sqlx::query!(
        "INSERT INTO recordings (mbid, name) VALUES ($1, 'Refresh recording')",
        mbid
    )
    .execute(pool)
    .await?;
    sqlx::query!(
        "INSERT INTO plays (uri, did, rkey, cid, track_name, recording_mbid, release_mbid)
         VALUES ('at://did:plc:refresh/fm.teal.feed.play/1', 'did:plc:refresh', '1', 'cid', 'Refresh recording', $1, $1)",
        mbid
    ).execute(pool).await?;
    sqlx::query!(
        "INSERT INTO play_to_artists_extended (play_uri, artist_id, artist_name)
         VALUES ('at://did:plc:refresh/fm.teal.feed.play/1', $1, 'Refresh artist')",
        artist_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn counts(pool: &PgPool) -> Result<[i64; 4]> {
    let row = sqlx::query!(
        "SELECT
         COALESCE((SELECT play_count FROM mv_artist_play_counts LIMIT 1), 0) AS \"artist!\",
         COALESCE((SELECT play_count FROM mv_release_play_counts LIMIT 1), 0) AS \"release!\",
         COALESCE((SELECT play_count FROM mv_recording_play_counts LIMIT 1), 0) AS \"recording!\",
         (SELECT total_plays FROM mv_global_play_count) AS \"global!\""
    )
    .fetch_one(pool)
    .await?;
    Ok([row.artist, row.release, row.recording, row.global])
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "requires PostgreSQL via DATABASE_URL; runs in an isolated database"]
async fn refreshes_all_counts_after_insert_and_delete(pool: PgPool) -> Result<()> {
    insert_play(&pool).await?;
    assert_eq!(counts(&pool).await?, [0; 4]);
    assert!(refresh_materialized_views(&pool).await?);
    assert_eq!(counts(&pool).await?, [1; 4]);

    sqlx::query!("DELETE FROM play_to_artists_extended")
        .execute(&pool)
        .await?;
    sqlx::query!("DELETE FROM plays").execute(&pool).await?;
    assert!(refresh_materialized_views(&pool).await?);
    assert_eq!(counts(&pool).await?, [0; 4]);
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "requires PostgreSQL via DATABASE_URL; runs in an isolated database"]
async fn skips_overlapping_refresh_and_releases_lock(pool: PgPool) -> Result<()> {
    insert_play(&pool).await?;
    let mut holder = pool.begin().await?;
    sqlx::query!("SELECT pg_advisory_xact_lock(1952801132, 1)")
        .execute(&mut *holder)
        .await?;
    assert!(!timeout(Duration::from_secs(2), refresh_materialized_views(&pool)).await??);
    assert_eq!(counts(&pool).await?, [0; 4]);
    holder.rollback().await?;
    assert!(refresh_materialized_views(&pool).await?);
    assert_eq!(counts(&pool).await?, [1; 4]);
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "requires PostgreSQL via DATABASE_URL; runs in an isolated database"]
async fn rolls_back_failed_refresh_and_recovers(pool: PgPool) -> Result<()> {
    insert_play(&pool).await?;
    // Fail the last refresh after the preceding views have been updated.
    sqlx::query!("DROP INDEX idx_mv_global_play_count")
        .execute(&pool)
        .await?;
    assert!(refresh_materialized_views(&pool).await.is_err());
    assert_eq!(counts(&pool).await?, [0; 4]);
    sqlx::query!(
        "CREATE UNIQUE INDEX idx_mv_global_play_count ON mv_global_play_count(total_plays)"
    )
    .execute(&pool)
    .await?;
    assert!(refresh_materialized_views(&pool).await?);
    assert_eq!(counts(&pool).await?, [1; 4]);
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "requires PostgreSQL via DATABASE_URL; runs in an isolated database"]
async fn refresh_does_not_wait_for_readers(pool: PgPool) -> Result<()> {
    insert_play(&pool).await?;
    let mut reader = pool.begin().await?;
    sqlx::query!("SELECT * FROM mv_artist_play_counts")
        .fetch_all(&mut *reader)
        .await?;
    assert!(timeout(Duration::from_secs(2), refresh_materialized_views(&pool)).await??);
    reader.rollback().await?;
    assert_eq!(counts(&pool).await?, [1; 4]);
    Ok(())
}

async fn wait_for_counts(pool: &PgPool, expected: [i64; 4]) -> Result<()> {
    timeout(Duration::from_secs(10), async {
        loop {
            if counts(pool).await? == expected {
                return Ok::<(), anyhow::Error>(());
            }
            sleep(Duration::from_millis(10)).await;
        }
    })
    .await??;
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
#[ignore = "requires PostgreSQL via DATABASE_URL; runs in an isolated database"]
async fn worker_refreshes_on_later_ticks(pool: PgPool) -> Result<()> {
    insert_play(&pool).await?;
    let worker = tokio::spawn(run(pool.clone(), Duration::from_millis(50)));
    let result = async {
        wait_for_counts(&pool, [1; 4]).await?;
        sqlx::query!("DELETE FROM play_to_artists_extended")
            .execute(&pool)
            .await?;
        sqlx::query!("DELETE FROM plays").execute(&pool).await?;
        wait_for_counts(&pool, [0; 4]).await
    }
    .await;
    worker.abort();
    let _ = worker.await;
    result
}
