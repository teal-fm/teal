use std::net::SocketAddr;

use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;

mod api;
mod db;
mod jetstream;
mod replay;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub handle_resolver: String,
    pub http_client: reqwest::Client,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let db = db::init_pool().await?;
    if std::env::args().any(|argument| argument == "backfill") {
        let client = reqwest::Client::new();
        let endpoint = std::env::var("JETSTREAM_REPLAY_URL")
            .unwrap_or_else(|_| "https://jetstream.us-east.bsky.network".to_string());
        let api_key = std::env::var("JETSTREAM_API_KEY")
            .map_err(|_| anyhow::anyhow!("JETSTREAM_API_KEY is required for backfill"))?;
        replay::backfill(&db, &client, &endpoint, &api_key).await?;
        let removed = db::prune_non_current_statuses(&db).await?;
        tracing::info!(removed, "Pruned non-current status records");
        return Ok(());
    }
    if std::env::args().any(|argument| argument == "prune") {
        let removed = db::prune_non_current_statuses(&db).await?;
        tracing::info!(removed, "Pruned non-current status records");
        return Ok(());
    }

    let state = AppState {
        db: db.clone(),
        handle_resolver: std::env::var("STATUS_HANDLE_RESOLVER")
            .unwrap_or_else(|_| "https://public.api.bsky.app".to_string()),
        http_client: reqwest::Client::new(),
    };

    let jetstream_url = std::env::var("JETSTREAM_URL").unwrap_or_else(|_| {
        "wss://jetstream.us-east.bsky.network/xrpc/network.bsky.jetstream.subscribeEvents"
            .to_string()
    });
    let mut jetstream_handle = tokio::spawn(jetstream::run(db, jetstream_url));

    let app = Router::new()
        .route("/", get(api::root))
        .route("/health", get(api::health))
        .route("/xrpc/fm.teal.actor.getStatus", get(api::get_status))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let host = std::env::var("STATUS_API_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("STATUS_API_PORT")
        .or_else(|_| std::env::var("PORT"))
        .unwrap_or_else(|_| "3002".to_string())
        .parse::<u16>()?;
    let addr: SocketAddr = format!("{host}:{port}").parse()?;

    tracing::info!(%addr, "Status API listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;

    let server_result = tokio::select! {
        result = &mut jetstream_handle => {
            match result {
                Ok(()) => anyhow::bail!("Jetstream consumer exited unexpectedly"),
                Err(error) => anyhow::bail!("Jetstream consumer task failed: {error}"),
            }
        }
        result = axum::serve(listener, app) => result,
    };

    jetstream_handle.abort();
    server_result?;

    Ok(())
}
