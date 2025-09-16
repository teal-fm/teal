use std::env;

use refresh::refresh_materialized_views;
use sqlx::{Pool, Postgres};
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::info;

mod actor;
mod counts;
mod db;
mod refresh;
#[derive(Clone)]
pub struct AppState {
    pub db_pool: Pool<Postgres>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let db = db::init_pool()
        .await
        .expect("Failed to connect to database");

    let cron = env::var("REFRESH_MV_CRON").unwrap_or("0/30 * * * * *".to_string());

    let mut scheduler = JobScheduler::new()
        .await
        .expect("Could not create scheduler");

    let scheduler_pool = db.clone();

    let refresh_job = Job::new_async(cron.as_str(), move |_uuid, _l| {
        let pool = scheduler_pool.clone();
        Box::pin(async move {
            if let Err(e) = refresh_materialized_views(&pool).await {
                eprintln!("Error refreshing materialized views: {}", e);
            }
        })
    })?;
    scheduler.add(refresh_job).await?;

    info!("MV refresh scheduled with crontab {}", cron);

    let app = axum::Router::new()
        .route("/", axum::routing::get(|| async { "Hello, world!" }))
        .route(
            "/play/count",
            axum::routing::get(counts::get_global_play_count),
        )
        .route("/play/latest", axum::routing::get(counts::get_latest_plays))
        .route("/actor/count", axum::routing::get(actor::get_total_users))
        .route(
            "/actor/latest",
            axum::routing::get(actor::get_latest_signups),
        )
        .with_state(AppState { db_pool: db })
        .into_make_service();

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    info!(
        "listening on http://{}",
        listener
            .local_addr()
            .map(|addr| addr.to_string())
            .unwrap_or("unknown".to_string())
    );
    axum::serve(listener, app).await?;

    scheduler.shutdown().await?;

    Ok(())
}
