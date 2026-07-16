use std::sync::{Arc, Mutex};

use cadet::{
    account,
    cursor::{self, resolve_startup_cursor},
    db, identity, ingestors, redis_client, teal_ingestors,
};
use metrics_exporter_prometheus::PrometheusBuilder;
use tracing::{error, info};

use rocketman::{
    connection::JetstreamConnection, endpoints::JetstreamEndpoints, handler,
    options::JetstreamOptions,
};

fn setup_tracing() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();
}

fn setup_metrics() {
    // Initialize metrics here
    if let Err(e) = PrometheusBuilder::new().install() {
        error!(
            "Failed to install, program will run without Prometheus exporter: {}",
            e
        );
    }
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    setup_tracing();
    setup_metrics();

    let stream_mode =
        std::env::var("CADET_STREAM_MODE").unwrap_or_else(|_| "jetstream".to_string());
    let jetstream_url = std::env::var("JETSTREAM_URL")
        .unwrap_or_else(|_| "wss://jetstream1.us-east.bsky.network/subscribe".to_string());

    if stream_mode != "jetstream" {
        error!(
            "Unsupported CADET_STREAM_MODE={}. subscribeRepos is reserved for a later CBOR firehose adapter; use jetstream for now.",
            stream_mode
        );
        std::process::exit(1);
    }

    info!(
        "Starting Cadet in {} mode with Jetstream endpoint {}",
        stream_mode, jetstream_url
    );

    let pool = db::init_pool()
        .await
        .expect("Could not get PostgreSQL pool");

    let opts = JetstreamOptions::builder()
        .ws_url(JetstreamEndpoints::Custom(jetstream_url.clone()))
        .wanted_collections(
            [
                "fm.teal.alpha.feed.play",
                "fm.teal.alpha.actor.profile",
                "fm.teal.alpha.actor.status",
                "fm.teal.alpha.actor.profileStatus",
                "fm.teal.alpha.feed.social.post",
                "fm.teal.alpha.feed.social.like",
                "fm.teal.alpha.feed.social.repost",
                "fm.teal.alpha.graph.follow",
                "fm.teal.alpha.feed.social.playlist",
                "fm.teal.alpha.feed.social.playlistItem",
                "fm.teal.alpha.feed.social.badge",
                "fm.teal.alpha.feed.social.badgeAssignment",
                "com.atproto.repo.importRepo",
            ]
            .iter()
            .map(|collection| collection.to_string())
            .collect(),
        )
        .build();

    let jetstream = JetstreamConnection::new(opts);

    let ingestors = teal_ingestors::build_ingestors(pool.clone());

    // Keep the indexed catalog normalized as new clients introduce alternate
    // release/recording IDs for the same artist and title.
    let consolidation_interval_secs = std::env::var("CADET_CONSOLIDATION_INTERVAL_SECS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(6 * 60 * 60);
    let consolidation_pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(
            consolidation_interval_secs,
        ));
        interval.tick().await;

        loop {
            let ingestor = ingestors::teal::feed_play::PlayIngestor::new(consolidation_pool.clone());
            if let Err(error) = ingestor.run_full_consolidation().await {
                error!("Automatic catalog consolidation failed: {}", error);
            }
            interval.tick().await;
        }
    });

    // CAR import job worker
    let car_ingestor = ingestors::car::CarImportIngestor::new(pool.clone());
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

    match redis_client::RedisClient::new(&redis_url) {
        Ok(redis_client) => {
            // Spawn CAR import job processing task
            tokio::spawn(async move {
                use chrono::Utc;
                use ingestors::car::jobs::{
                    queue_keys, CarImportJob, CarImportJobStatus, JobProgress, JobStatus,
                };
                use tracing::{error, info};

                info!("Starting CAR import job worker, polling Redis queue...");

                loop {
                    // Block for up to 10 seconds waiting for jobs
                    match redis_client.pop_job(queue_keys::CAR_IMPORT_JOBS, 10).await {
                        Ok(Some(job_data)) => {
                            info!("Received CAR import job: {}", job_data);

                            // Parse job
                            match serde_json::from_str::<CarImportJob>(&job_data) {
                                Ok(job) => {
                                    // Update status to processing
                                    let processing_status = CarImportJobStatus {
                                        status: JobStatus::Processing,
                                        created_at: job.created_at,
                                        started_at: Some(Utc::now()),
                                        completed_at: None,
                                        error_message: None,
                                        progress: Some(JobProgress {
                                            step: "Starting CAR fetch and processing".to_string(),
                                            user_did: None,
                                            pds_host: None,
                                            car_size_bytes: None,
                                            blocks_processed: None,
                                        }),
                                    };

                                    let status_key = queue_keys::job_status_key(&job.request_id);
                                    if let Ok(status_data) =
                                        serde_json::to_string(&processing_status)
                                    {
                                        let _ = redis_client
                                            .update_job_status(&status_key, &status_data)
                                            .await;
                                    }

                                    // Process the job
                                    match car_ingestor
                                        .fetch_and_process_identity_car(&job.identity)
                                        .await
                                    {
                                        Ok(import_id) => {
                                            info!(
                                                "✅ CAR import job completed successfully: {}",
                                                job.request_id
                                            );

                                            let completed_status = CarImportJobStatus {
                                                status: JobStatus::Completed,
                                                created_at: job.created_at,
                                                started_at: processing_status.started_at,
                                                completed_at: Some(Utc::now()),
                                                error_message: None,
                                                progress: Some(JobProgress {
                                                    step: format!(
                                                        "CAR import completed: {}",
                                                        import_id
                                                    ),
                                                    user_did: None,
                                                    pds_host: None,
                                                    car_size_bytes: None,
                                                    blocks_processed: None,
                                                }),
                                            };

                                            if let Ok(status_data) =
                                                serde_json::to_string(&completed_status)
                                            {
                                                let _ = redis_client
                                                    .update_job_status(&status_key, &status_data)
                                                    .await;
                                            }
                                        }
                                        Err(e) => {
                                            error!(
                                                "❌ CAR import job failed: {}: {}",
                                                job.request_id, e
                                            );

                                            let failed_status = CarImportJobStatus {
                                                status: JobStatus::Failed,
                                                created_at: job.created_at,
                                                started_at: processing_status.started_at,
                                                completed_at: Some(Utc::now()),
                                                error_message: Some(e.to_string()),
                                                progress: None,
                                            };

                                            if let Ok(status_data) =
                                                serde_json::to_string(&failed_status)
                                            {
                                                let _ = redis_client
                                                    .update_job_status(&status_key, &status_data)
                                                    .await;
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Failed to parse CAR import job: {}", e);
                                }
                            }
                        }
                        Ok(None) => {
                            // Timeout, continue polling
                        }
                        Err(e) => {
                            error!("Failed to poll Redis queue: {}", e);
                            // Sleep before retrying to avoid tight loop
                            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        }
                    }
                }
            });
        }
        Err(e) => {
            error!("Failed to connect to Redis for CAR import jobs: {}", e);
            error!("CAR import job worker will not be available");
        }
    }

    // tracks the last message we've processed
    // Always start cursor as Some(_) so rocketman::handler can advance it; an
    // unset Mutex<Option<u64>> stays None forever and the jetstream offset is
    // never persisted on subsequent restarts. resolve_startup_cursor falls back
    // to "now" when no stored cursor exists, and clamps stale stored cursors so
    // we don't try to replay history jetstream no longer retains.
    let startup_cursor = resolve_startup_cursor().await;
    let cursor: Arc<Mutex<Option<u64>>> = Arc::new(Mutex::new(Some(startup_cursor)));

    // get channels
    let msg_rx = jetstream.get_msg_rx();
    let reconnect_tx = jetstream.get_reconnect_tx();

    // Spawn a task to process messages from the queue.
    // bleh at this clone
    let c_cursor = cursor.clone();
    tokio::spawn(async move {
        while let Ok(message) = msg_rx.recv_async().await {
            if let Ok(text) = message.to_text() {
                if let Err(e) = identity::ingest_identity_event(&pool, text).await {
                    error!("Error processing identity event: {}", e);
                }
                if let Err(e) = account::ingest_account_event(&pool, text).await {
                    error!("Error processing account event: {}", e);
                }
                match account::should_ingest_commit(&pool, text).await {
                    Ok(false) => continue,
                    Ok(true) => {}
                    Err(e) => error!("Error checking account state: {}", e),
                }
            }
            if let Err(e) =
                handler::handle_message(message, &ingestors, reconnect_tx.clone(), c_cursor.clone())
                    .await
            {
                error!("Error processing message: {}", e);
            };
        }
    });

    // store cursor every so often
    let c_cursor = cursor.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            let cursor_to_store: Option<u64> = {
                let cursor_guard = c_cursor.lock().unwrap();
                *cursor_guard
            };
            if let Some(cursor) = cursor_to_store {
                if let Err(e) = cursor::store_cursor(cursor).await {
                    error!("Error storing cursor: {}", e);
                }
            }
        }
    });

    if let Err(e) = jetstream.connect(cursor.clone()).await {
        error!("Failed to connect to Jetstream: {}", e);
        std::process::exit(1);
    }
}
