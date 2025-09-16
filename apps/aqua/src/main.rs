use axum::{
    Router,
    extract::Extension,
    routing::{get, post},
};
use chrono::Utc;
use clap::{Arg, Command};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use ctx::RawContext;
use redis_client::RedisClient;
use repos::DataSource;
use repos::pg::PgDataSource;

mod api;
mod ctx;
mod db;
mod redis_client;
mod repos;
mod types;
mod xrpc;

#[tokio::main]
async fn main() -> Result<(), String> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let matches = Command::new("aqua")
        .about("Teal Aqua Service")
        .arg(
            Arg::new("import-identity-car")
                .long("import-identity-car")
                .value_name("HANDLE_OR_DID")
                .help("Import CAR file for a specific identity (handle or DID)")
                .action(clap::ArgAction::Set),
        )
        .get_matches();

    let db = db::init_pool().await.expect("failed to init db");
    let pgds = PgDataSource::new(db.clone()).boxed();
    let ctx = RawContext::new(pgds).build(); // Arc<RawContext>

    // Check if we should import a CAR file instead of starting the server
    if let Some(identity) = matches.get_one::<String>("import-identity-car") {
        return import_identity_car(&ctx, identity).await;
    }

    // Normal server startup
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/meta_info", get(api::get_meta_info))
        .route("/.well-known/did.json", get(api::get_did_document))
        .route("/api/car/upload", post(api::upload_car_import))
        .route("/api/car/fetch", post(api::fetch_car_from_user))
        .route(
            "/api/car/status/{import_id}",
            get(api::get_car_import_status),
        )
        .route(
            "/api/car/job-status/{job_id}",
            get(api::get_car_import_job_status),
        )
        .nest("/xrpc/", xrpc::actor::actor_routes())
        .nest("/xrpc/", xrpc::feed::feed_routes())
        .nest("/xrpc/", xrpc::stats::stats_routes())
        .layer(Extension(ctx))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}

async fn import_identity_car(_ctx: &ctx::Context, identity: &str) -> Result<(), String> {
    use crate::types::{CarImportJob, CarImportJobStatus, JobStatus, queue_keys};
    use tracing::{error, info};

    info!("Submitting CAR import job for identity: {}", identity);

    // Connect to Redis
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let redis_client =
        RedisClient::new(&redis_url).map_err(|e| format!("Failed to connect to Redis: {}", e))?;

    // Create job
    let job = CarImportJob {
        request_id: Uuid::new_v4(),
        identity: identity.to_string(),
        since: None,
        created_at: Utc::now(),
        description: Some(format!("CLI import request for {}", identity)),
    };

    // Serialize job for queue
    let job_data =
        serde_json::to_string(&job).map_err(|e| format!("Failed to serialize job: {}", e))?;

    // Initialize job status
    let status = CarImportJobStatus {
        status: JobStatus::Pending,
        created_at: job.created_at,
        started_at: None,
        completed_at: None,
        error_message: None,
        progress: None,
    };
    let status_data =
        serde_json::to_string(&status).map_err(|e| format!("Failed to serialize status: {}", e))?;

    // Submit to queue and set initial status
    match redis_client
        .queue_job(queue_keys::CAR_IMPORT_JOBS, &job_data)
        .await
    {
        Ok(_) => {
            // Set initial status
            if let Err(e) = redis_client
                .set_job_status(&queue_keys::job_status_key(&job.request_id), &status_data)
                .await
            {
                error!("Failed to set job status: {}", e);
            }

            info!("✅ CAR import job queued successfully!");
            info!("Job ID: {}", job.request_id);
            info!("Identity: {}", identity);
            info!(
                "Monitor status with: curl http://localhost:3000/api/car/status/{}",
                job.request_id
            );
            Ok(())
        }
        Err(e) => {
            error!("Failed to queue job: {}", e);
            Err(format!("Failed to queue CAR import job: {}", e))
        }
    }
}
