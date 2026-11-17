use anyhow::Result;
use axum::{Extension, Json, extract::Path, http::StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tracing::{error, info};

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
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

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
                if service["id"].as_str() == Some("#atproto_pds")
                    && let Some(endpoint) = service["serviceEndpoint"].as_str()
                {
                    // Extract hostname from URL
                    let url = url::Url::parse(endpoint)?;
                    let host = url
                        .host_str()
                        .ok_or_else(|| anyhow::anyhow!("Invalid PDS endpoint URL: {}", endpoint))?;
                    return Ok(host.to_string());
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

    const MAX_CAR_BYTES: u64 = 256 * 1024 * 1024;
    let mut url = url::Url::parse(&format!(
        "https://{pds_host}/xrpc/com.atproto.sync.getRepo"
    ))?;
    url.query_pairs_mut().append_pair("did", did);

    if let Some(since_rev) = since {
        url.query_pairs_mut().append_pair("since", since_rev);
    }

    info!("Fetching CAR file from: {}", url);

    // Pinned to the addresses checked now, so a second DNS answer can't point
    // the download at a private address.
    let client =
        crate::identity::public_client_with_timeout(pds_host, std::time::Duration::from_secs(60))
            .await?;
    let mut response = client.get(url).send().await?;
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

    if response
        .content_length()
        .is_some_and(|length| length > MAX_CAR_BYTES)
    {
        return Err(anyhow::anyhow!(
            "CAR file exceeds the {} byte limit",
            MAX_CAR_BYTES
        ));
    }

    let mut car_data = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if car_data.len() as u64 + chunk.len() as u64 > MAX_CAR_BYTES {
            return Err(anyhow::anyhow!(
                "CAR file exceeds the {} byte limit",
                MAX_CAR_BYTES
            ));
        }
        car_data.extend_from_slice(&chunk);
    }
    Ok(car_data)
}

/// Generate a DID document for did:web
fn generate_did_document(host: &str, pubkey: &str) -> Value {
    json!({
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/multikey/v1",
            "https://w3id.org/security/suites/secp256k1-2019/v1"
        ],
        "id": format!("did:web:{}", host),
        "alsoKnownAs": [
            format!("at://{}", host)
        ],
        "service": [
            {
                "id": "#bsky_fg",
                "type": "BskyFeedGenerator",
                "serviceEndpoint": format!("https://{}", host)
            },
            {
                "id": "#atproto_pds",
                "type": "AtprotoPersonalDataServer",
                "serviceEndpoint": format!("https://{}", host)
            }
        ],
        "verificationMethod": [
            {
                "id": format!("did:web:{}#atproto", host),
                "type": "Multikey",
                "controller": format!("did:web:{}", host),
                "publicKeyMultibase": pubkey
            }
        ]
    })
}

/// Handler for /.well-known/did.json endpoint
pub async fn get_did_document(
    Extension(_ctx): Extension<Context>,
) -> Result<Json<Value>, StatusCode> {
    let host = std::env::var("APP_HOST")
        .or_else(|_| std::env::var("HOST"))
        .unwrap_or_else(|_| "localhost:3000".to_string());

    // Without a configured key there is no service identity to publish; a
    // made-up key would advertise a signing key nobody holds.
    let pubkey = std::env::var("TEST_PUBKEY").map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(generate_did_document(&host, &pubkey)))
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_PUBKEY: &str = "z6Mkw5f8g3h4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f7g8h9i";

    #[test]
    fn test_generate_did_document() {
        let host = "example.com";
        let did_doc = generate_did_document(host, TEST_PUBKEY);

        // Verify the structure of the generated DID document
        assert_eq!(did_doc["id"], format!("did:web:{}", host));
        assert_eq!(did_doc["alsoKnownAs"][0], format!("at://{}", host));

        // Check services
        let services = did_doc["service"].as_array().unwrap();
        assert_eq!(services.len(), 2);

        let bsky_fg = &services[0];
        assert_eq!(bsky_fg["id"], "#bsky_fg");
        assert_eq!(bsky_fg["type"], "BskyFeedGenerator");
        assert_eq!(bsky_fg["serviceEndpoint"], format!("https://{}", host));

        let atproto_pds = &services[1];
        assert_eq!(atproto_pds["id"], "#atproto_pds");
        assert_eq!(atproto_pds["type"], "AtprotoPersonalDataServer");
        assert_eq!(atproto_pds["serviceEndpoint"], format!("https://{}", host));

        // Check verification method
        let verification_methods = did_doc["verificationMethod"].as_array().unwrap();
        assert_eq!(verification_methods.len(), 1);

        let vm = &verification_methods[0];
        assert_eq!(vm["id"], format!("did:web:{}#atproto", host));
        assert_eq!(vm["type"], "Multikey");
        assert_eq!(vm["controller"], format!("did:web:{}", host));
        assert!(vm["publicKeyMultibase"].as_str().unwrap().starts_with("z"));
    }

    #[test]
    fn test_did_document_context() {
        let host = "test.example.org";
        let did_doc = generate_did_document(host, TEST_PUBKEY);

        let context = did_doc["@context"].as_array().unwrap();
        assert_eq!(context.len(), 3);
        assert_eq!(context[0], "https://www.w3.org/ns/did/v1");
        assert_eq!(context[1], "https://w3id.org/security/multikey/v1");
        assert_eq!(
            context[2],
            "https://w3id.org/security/suites/secp256k1-2019/v1"
        );
    }

    #[test]
    fn test_different_hosts() {
        // Test with different host formats
        let hosts = vec![
            "localhost:3000",
            "bsky.social",
            "example.org:8080",
            "my-service.com",
        ];

        for host in hosts {
            let did_doc = generate_did_document(host, TEST_PUBKEY);

            // Verify basic structure for each host
            assert_eq!(did_doc["id"], format!("did:web:{}", host));
            assert_eq!(did_doc["alsoKnownAs"][0], format!("at://{}", host));

            let services = did_doc["service"].as_array().unwrap();
            assert_eq!(services.len(), 2);

            let verification_methods = did_doc["verificationMethod"].as_array().unwrap();
            assert_eq!(verification_methods.len(), 1);
        }
    }
}
