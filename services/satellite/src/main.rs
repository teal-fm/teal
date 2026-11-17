use std::env;

use anyhow::Context;
use sqlx::{Pool, Postgres};
use tracing::info;

mod actor;
mod counts;
mod db;
#[derive(Clone)]
pub struct AppState {
    pub db_pool: Pool<Postgres>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let db = db::init_pool().await.context("connecting to the database")?;

    // Cadet refreshes the materialized views this service reads, under an
    // advisory lock; refreshing here as well would only duplicate that work.
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

    let addr = env::var("SATELLITE_ADDR").unwrap_or_else(|_| "0.0.0.0:3001".to_string());
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    info!(
        "listening on http://{}",
        listener
            .local_addr()
            .map(|addr| addr.to_string())
            .unwrap_or("unknown".to_string())
    );
    axum::serve(listener, app).await?;

    Ok(())
}
