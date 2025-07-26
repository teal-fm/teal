use anyhow::Result;
use axum::{Extension, Json, extract::Multipart, extract::Path, http::StatusCode};
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use uuid;

use sys_info;

use crate::ctx::Context;
use crate::redis_client::RedisClient;
use crate::types::CarImportJobStatus;

#[derive(Debug, Serialize, Deserialize)]
pub struct MetaOsInfo {
    os_type: String,
    release: String,
    hostname: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MetaAppInfo {
    git_hash: String,
    git_date: String,
    build_time: String,
    rustc_ver: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MetaInfo {
    os: MetaOsInfo,
    app: MetaAppInfo,
}

pub async fn get_meta_info(
    Extension(_ctx): Extension<Context>,
) -> impl axum::response::IntoResponse {
    // Retrieve system information
    let git_hash = env!("VERGEN_GIT_DESCRIBE");
    let git_date = env!("VERGEN_GIT_COMMIT_DATE");
    let build_time = env!("VERGEN_BUILD_TIMESTAMP");
    let rustc_ver = env!("VERGEN_RUSTC_SEMVER");

    let os_type = sys_info::os_type().unwrap_or_else(|_| "Unknown".to_string());
    let os_release = sys_info::os_release().unwrap_or_else(|_| "Unknown".to_string());
    let hostname = sys_info::hostname().unwrap_or_else(|_| "Unknown".to_string());

    Json(MetaInfo {
        os: MetaOsInfo {
            os_type,
            release: os_release,
            hostname,
        },
        app: MetaAppInfo {
            git_hash: git_hash.to_string(),
            git_date: git_date.to_string(),
            build_time: build_time.to_string(),
            rustc_ver: rustc_ver.to_string(),
        },
    })
}

/// Get CAR import job status
pub async fn get_car_import_job_status(
    Path(job_id): Path<String>,
) -> Result<Json<CarImportJobStatus>, (StatusCode, Json<ErrorResponse>)> {
    use crate::types::queue_keys;

    info!("Getting status for job: {}", job_id);

    // Parse job ID
    let job_uuid = match uuid::Uuid::parse_str(&job_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            let error_response = ErrorResponse {
                error: "Invalid job ID format".to_string(),
                details: Some("Job ID must be a valid UUID".to_string()),
            };
            return Err((StatusCode::BAD_REQUEST, Json(error_response)));
        }
    };

    // Connect to Redis
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let redis_client = match RedisClient::new(&redis_url) {
        Ok(client) => client,
        Err(e) => {
            error!("Failed to connect to Redis: {}", e);
            let error_response = ErrorResponse {
                error: "Internal server error".to_string(),
                details: Some("Failed to connect to Redis".to_string()),
            };
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
        }
    };

    // Get job status
    match redis_client
        .get_job_status(&queue_keys::job_status_key(&job_uuid))
        .await
    {
        Ok(Some(status_data)) => match serde_json::from_str::<CarImportJobStatus>(&status_data) {
            Ok(status) => Ok(Json(status)),
            Err(e) => {
                error!("Failed to parse job status: {}", e);
                let error_response = ErrorResponse {
                    error: "Failed to parse job status".to_string(),
                    details: Some(e.to_string()),
                };
                Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)))
            }
        },
        Ok(None) => {
            let error_response = ErrorResponse {
                error: "Job not found".to_string(),
                details: Some(format!("No job found with ID: {}", job_id)),
            };
            Err((StatusCode::NOT_FOUND, Json(error_response)))
        }
        Err(e) => {
            error!("Failed to get job status from Redis: {}", e);
            let error_response = ErrorResponse {
                error: "Failed to get job status".to_string(),
                details: Some(e.to_string()),
            };
            Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)))
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CarImportRequest {
    pub import_id: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CarImportResponse {
    pub import_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchCarRequest {
    pub user_identifier: String, // DID or handle
    pub since: Option<String>,   // Optional revision for diff
    pub debug: Option<bool>,     // Enable debug mode for more verbose errors
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FetchCarResponse {
    pub import_id: String,
    pub user_did: String,
    pub pds_host: String,
    pub status: String,
    pub message: String,
}

pub async fn upload_car_import(
    Extension(ctx): Extension<Context>,
    mut multipart: Multipart,
) -> Result<Json<CarImportResponse>, StatusCode> {
    info!("Received CAR file upload request");

    let mut car_data: Option<Vec<u8>> = None;
    let mut import_id: Option<String> = None;
    let mut description: Option<String> = None;

    // Process multipart form data
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {
            "car_file" => {
                let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                car_data = Some(data.to_vec());
            }
            "import_id" => {
                let text = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                import_id = Some(text);
            }
            "description" => {
                let text = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                description = Some(text);
            }
            _ => {
                // Ignore unknown fields
            }
        }
    }

    let car_bytes = car_data.ok_or(StatusCode::BAD_REQUEST)?;
    let final_import_id = import_id.unwrap_or_else(|| {
        // Generate a unique import ID
        format!("car-import-{}", chrono::Utc::now().timestamp())
    });

    // Validate CAR file format
    match validate_car_file(&car_bytes).await {
        Ok(_) => {
            info!(
                "CAR file validation successful for import {}",
                final_import_id
            );
        }
        Err(e) => {
            error!("CAR file validation failed: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    // Store CAR import request in database for processing
    match store_car_import_request(&ctx, &final_import_id, &car_bytes, description.as_deref()).await
    {
        Ok(_) => {
            info!(
                "CAR import request stored successfully: {}",
                final_import_id
            );
            Ok(Json(CarImportResponse {
                import_id: final_import_id,
                status: "queued".to_string(),
                message: "CAR file uploaded successfully and queued for processing".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to store CAR import request: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_car_import_status(
    Extension(ctx): Extension<Context>,
    axum::extract::Path(import_id): axum::extract::Path<String>,
) -> Result<Json<CarImportResponse>, StatusCode> {
    match get_import_status(&ctx, &import_id).await {
        Ok(Some(status)) => Ok(Json(CarImportResponse {
            import_id,
            status: status.status,
            message: status.message,
        })),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get import status: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn validate_car_file(car_data: &[u8]) -> Result<()> {
    use iroh_car::CarReader;
    use std::io::Cursor;

    let cursor = Cursor::new(car_data);
    let reader = CarReader::new(cursor).await?;
    let header = reader.header();

    // Basic validation - ensure we have at least one root CID
    if header.roots().is_empty() {
        return Err(anyhow::anyhow!("CAR file has no root CIDs"));
    }

    info!("CAR file validated: {} root CIDs", header.roots().len());
    Ok(())
}

#[derive(Debug)]
struct ImportStatus {
    status: String,
    message: String,
}

pub async fn store_car_import_request(
    _ctx: &Context,
    _import_id: &str,
    _car_data: &[u8],
    _description: Option<&str>,
) -> Result<()> {
    // TODO: Implement database storage once tables are created
    info!("CAR import storage temporarily disabled - tables not yet created");
    Ok(())
}

async fn get_import_status(_ctx: &Context, _import_id: &str) -> Result<Option<ImportStatus>> {
    // TODO: Implement once database tables are created
    Ok(Some(ImportStatus {
        status: "pending".to_string(),
        message: "Database tables not yet created".to_string(),
    }))
}

pub async fn fetch_car_from_user(
    Extension(ctx): Extension<Context>,
    Json(request): Json<FetchCarRequest>,
) -> Result<Json<FetchCarResponse>, (StatusCode, Json<ErrorResponse>)> {
    info!(
        "Received CAR fetch request for user: {}",
        request.user_identifier
    );

    // Resolve user identifier to DID and PDS
    let (user_did, pds_host) = match resolve_user_to_pds(&request.user_identifier).await {
        Ok(result) => result,
        Err(e) => {
            error!("Failed to resolve user {}: {}", request.user_identifier, e);
            let error_response = ErrorResponse {
                error: "Failed to resolve user".to_string(),
                details: if request.debug.unwrap_or(false) {
                    Some(e.to_string())
                } else {
                    None
                },
            };
            return Err((StatusCode::BAD_REQUEST, Json(error_response)));
        }
    };

    info!(
        "Resolved {} to DID {} on PDS {}",
        request.user_identifier, user_did, pds_host
    );

    // Generate import ID
    let import_id = format!(
        "pds-fetch-{}-{}",
        user_did.replace(":", "-"),
        chrono::Utc::now().timestamp()
    );

    // Fetch CAR file from PDS
    match fetch_car_from_pds(&pds_host, &user_did, request.since.as_deref()).await {
        Ok(car_data) => {
            info!(
                "Successfully fetched CAR file for {} ({} bytes)",
                user_did,
                car_data.len()
            );

            // Store the fetched CAR file for processing
            let description = Some(format!(
                "Fetched from PDS {} for user {}",
                pds_host, request.user_identifier
            ));
            match store_car_import_request(&ctx, &import_id, &car_data, description.as_deref())
                .await
            {
                Ok(_) => {
                    info!("CAR import request stored successfully: {}", import_id);
                    Ok(Json(FetchCarResponse {
                        import_id,
                        user_did,
                        pds_host,
                        status: "queued".to_string(),
                        message: "CAR file fetched from PDS and queued for processing".to_string(),
                    }))
                }
                Err(e) => {
                    error!("Failed to store fetched CAR import request: {}", e);
                    let error_response = ErrorResponse {
                        error: "Failed to store CAR import request".to_string(),
                        details: Some(e.to_string()),
                    };
                    Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)))
                }
            }
        }
        Err(e) => {
            error!("Failed to fetch CAR file from PDS {}: {}", pds_host, e);
            let error_response = ErrorResponse {
                error: "Failed to fetch CAR file from PDS".to_string(),
                details: Some(format!("PDS: {}, Error: {}", pds_host, e)),
            };
            Err((StatusCode::BAD_GATEWAY, Json(error_response)))
        }
    }
}

/// Resolve a user identifier (DID or handle) to their DID and PDS host
pub async fn resolve_user_to_pds(user_identifier: &str) -> Result<(String, String)> {
    if user_identifier.starts_with("did:") {
        // User provided a DID directly, resolve to PDS
        let pds_host = resolve_did_to_pds(user_identifier).await?;
        Ok((user_identifier.to_string(), pds_host))
    } else {
        // User provided a handle, resolve to DID then PDS
        let user_did = resolve_handle_to_did(user_identifier).await?;
        let pds_host = resolve_did_to_pds(&user_did).await?;
        Ok((user_did, pds_host))
    }
}

/// Resolve a handle to a DID using com.atproto.identity.resolveHandle
async fn resolve_handle_to_did(handle: &str) -> Result<String> {
    let url = format!(
        "https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={}",
        handle
    );

    let response = reqwest::get(&url).await?;
    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Failed to resolve handle {}: {}",
            handle,
            response.status()
        ));
    }

    let json: serde_json::Value = response.json().await?;
    let did = json["did"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("No DID found in response for handle {}", handle))?;

    Ok(did.to_string())
}

/// Resolve a DID to their PDS host using DID document
async fn resolve_did_to_pds(did: &str) -> Result<String> {
    // For DID:plc, use the PLC directory
    if did.starts_with("did:plc:") {
        let url = format!("https://plc.directory/{}", did);

        let response = reqwest::get(&url).await?;
        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Failed to resolve DID {}: {}",
                did,
                response.status()
            ));
        }

        let doc: serde_json::Value = response.json().await?;

        // Find the PDS service endpoint
        if let Some(services) = doc["service"].as_array() {
            for service in services {
                if service["id"].as_str() == Some("#atproto_pds") {
                    if let Some(endpoint) = service["serviceEndpoint"].as_str() {
                        // Extract hostname from URL
                        let url = url::Url::parse(endpoint)?;
                        let host = url.host_str().ok_or_else(|| {
                            anyhow::anyhow!("Invalid PDS endpoint URL: {}", endpoint)
                        })?;
                        return Ok(host.to_string());
                    }
                }
            }
        }

        Err(anyhow::anyhow!(
            "No PDS service found in DID document for {}",
            did
        ))
    } else {
        Err(anyhow::anyhow!("Unsupported DID method: {}", did))
    }
}

/// Fetch CAR file from PDS using com.atproto.sync.getRepo
pub async fn fetch_car_from_pds(pds_host: &str, did: &str, since: Option<&str>) -> Result<Vec<u8>> {
    let mut url = format!(
        "https://{}/xrpc/com.atproto.sync.getRepo?did={}",
        pds_host, did
    );

    if let Some(since_rev) = since {
        url.push_str(&format!("&since={}", since_rev));
    }

    info!("Fetching CAR file from: {}", url);

    let response = reqwest::get(&url).await?;
    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "Failed to fetch CAR from PDS {}: {}",
            pds_host,
            response.status()
        ));
    }

    // Verify content type
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("application/vnd.ipld.car") {
        return Err(anyhow::anyhow!("Unexpected content type: {}", content_type));
    }

    let car_data = response.bytes().await?;
    Ok(car_data.to_vec())
}
