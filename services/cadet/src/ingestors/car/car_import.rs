use anyhow::{anyhow, Result};
use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use chrono;
use cid::Cid;
use iroh_car::{CarHeader, CarReader};
use libipld::cbor::DagCborCodec;
use libipld::{Block, Cid as LibipldCid, Ipld};
use reqwest;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;
use std::io::Cursor;
use tracing::{info, warn};
use url;

pub struct CarImportIngestor {
    sql: PgPool,
}

impl CarImportIngestor {
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    /// Process a CAR file from bytes
    async fn process_car_data(&self, car_data: &[u8], import_id: &str) -> Result<()> {
        info!("Starting CAR file processing for import {}", import_id);

        let cursor = Cursor::new(car_data);
        let mut reader = CarReader::new(cursor).await?;

        // Read the header
        let header = reader.header();
        info!("CAR header: {} root CIDs", header.roots().len());

        // Track import metadata
        // self.store_import_metadata(import_id, header).await?;

        // Process blocks
        let mut block_count = 0;
        while let Some((cid, block_data)) = reader.next_block().await? {
            // Convert iroh-car CID to our CID type for processing
            let our_cid: Cid = cid.to_string().parse()?;
            self.process_car_block(&our_cid, &block_data, import_id)
                .await?;
            block_count += 1;

            if block_count % 100 == 0 {
                info!("Processed {} blocks for import {}", block_count, import_id);
            }
        }

        info!(
            "Completed CAR file processing: {} blocks for import {}",
            block_count, import_id
        );
        // self.mark_import_complete(import_id, block_count).await?;

        Ok(())
    }

    /// Process an individual IPLD block from the CAR file
    async fn process_car_block(&self, cid: &Cid, block_data: &[u8], import_id: &str) -> Result<()> {
        // Store the raw block first
        // self.store_raw_block(cid, block_data, import_id).await?;

        // Try to decode as IPLD and extract meaningful data
        match self.decode_and_extract_data(cid, block_data).await {
            Ok(Some(extracted_data)) => {
                self.process_extracted_data(&extracted_data, cid, import_id)
                    .await?;
            }
            Ok(None) => {
                // Block doesn't contain extractable data, just stored raw
            }
            Err(e) => {
                warn!("Failed to decode block {}: {}", cid, e);
                // Continue processing other blocks
            }
        }

        Ok(())
    }

    /// Decode IPLD block and extract AT Protocol data if present
    async fn decode_and_extract_data(
        &self,
        cid: &Cid,
        block_data: &[u8],
    ) -> Result<Option<ExtractedData>> {
        // Create IPLD block (convert CID types)
        let libipld_cid: LibipldCid = cid.to_string().parse()?;
        let block: Block<libipld::DefaultParams> = Block::new(libipld_cid, block_data.to_vec())?;

        // Decode to IPLD (try to decode as DAG-CBOR, which is common in AT Protocol)
        let ipld: Ipld = match block.decode::<DagCborCodec, Ipld>() {
            Ok(ipld) => ipld,
            Err(_) => {
                // If DAG-CBOR fails, try as raw data
                return Ok(None);
            }
        };

        // Check if this looks like AT Protocol data
        if let Ipld::Map(map) = &ipld {
            // Look for AT Protocol patterns
            if let Some(collection) = map.get("$type").and_then(|v| {
                if let Ipld::String(s) = v {
                    Some(s.as_str())
                } else {
                    None
                }
            }) {
                return Ok(Some(ExtractedData {
                    collection: collection.to_string(),
                    data: ipld,
                    cid: cid.clone(),
                }));
            }

            // Check for commit structures
            if map.contains_key("ops") && map.contains_key("prev") {
                return Ok(Some(ExtractedData {
                    collection: "commit".to_string(),
                    data: ipld,
                    cid: cid.clone(),
                }));
            }
        }

        Ok(None)
    }

    /// Process extracted AT Protocol data
    async fn process_extracted_data(
        &self,
        data: &ExtractedData,
        cid: &Cid,
        import_id: &str,
    ) -> Result<()> {
        match data.collection.as_str() {
            "fm.teal.alpha.feed.play" => {
                self.process_play_record(&data.data, cid, import_id).await?;
            }
            "fm.teal.alpha.actor.profile" => {
                self.process_profile_record(&data.data, cid, import_id)
                    .await?;
            }
            "fm.teal.alpha.actor.status" => {
                self.process_status_record(&data.data, cid, import_id)
                    .await?;
            }
            "commit" => {
                self.process_commit_record(&data.data, cid, import_id)
                    .await?;
            }
            _ => {
                info!("Unhandled collection type: {}", data.collection);
            }
        }

        Ok(())
    }

    /// Process a Teal play record from IPLD data
    async fn process_play_record(&self, ipld: &Ipld, cid: &Cid, import_id: &str) -> Result<()> {
        // Convert IPLD to JSON value for processing by existing ingestors
        let json_value = ipld_to_json(ipld)?;

        // Delegate to existing play ingestor logic
        if let Ok(play_record) =
            serde_json::from_value::<types::fm::teal::alpha::feed::play::RecordData>(json_value)
        {
            info!("Importing play record from CAR: {}", play_record.track_name);

            // Use existing play ingestor for consistency
            let play_ingestor = super::super::teal::feed_play::PlayIngestor::new(self.sql.clone());

            // Create a synthetic AT URI for the imported record
            let synthetic_did = format!("car-import:{}", import_id);
            let rkey = cid.to_string();
            let uri = super::super::teal::assemble_at_uri(
                &synthetic_did,
                "fm.teal.alpha.feed.play",
                &rkey,
            );

            // Store using existing logic
            play_ingestor
                .insert_play(&play_record, &uri, &cid.to_string(), &synthetic_did, &rkey)
                .await?;

            // Track the extracted record
            // self.store_extracted_record(import_id, cid, "fm.teal.alpha.feed.play", Some(&uri)).await?;
        }

        Ok(())
    }

    /// Process a Teal profile record from IPLD data
    async fn process_profile_record(&self, ipld: &Ipld, cid: &Cid, import_id: &str) -> Result<()> {
        let json_value = ipld_to_json(ipld)?;

        if let Ok(profile_record) =
            serde_json::from_value::<types::fm::teal::alpha::actor::profile::RecordData>(json_value)
        {
            info!(
                "Importing profile record from CAR: {:?}",
                profile_record.display_name
            );

            // For now, just log until we have public methods on profile ingestor
            info!(
                "Would store profile record from CAR import {} with CID {}",
                import_id, cid
            );

            // Track the extracted record
            // self.store_extracted_record(import_id, cid, "fm.teal.alpha.actor.profile", None).await?;
        }

        Ok(())
    }

    /// Process a Teal status record from IPLD data
    async fn process_status_record(&self, ipld: &Ipld, cid: &Cid, import_id: &str) -> Result<()> {
        let json_value = ipld_to_json(ipld)?;

        if let Ok(_status_record) =
            serde_json::from_value::<types::fm::teal::alpha::actor::status::RecordData>(json_value)
        {
            info!("Importing status record from CAR");

            // For now, just log until we have public methods on status ingestor
            info!(
                "Would store status record from CAR import {} with CID {}",
                import_id, cid
            );

            // Track the extracted record
            // self.store_extracted_record(import_id, cid, "fm.teal.alpha.actor.status", None).await?;
        }

        Ok(())
    }

    /// Process a commit record from IPLD data
    async fn process_commit_record(
        &self,
        _ipld: &Ipld,
        _cid: &Cid,
        _import_id: &str,
    ) -> Result<()> {
        info!("Processing commit record from CAR import");

        // Store commit metadata for tracking
        // self.store_commit_metadata(ipld, cid, import_id).await?;

        Ok(())
    }

    /// Store CAR import metadata
    async fn store_import_metadata(&self, _import_id: &str, _header: &CarHeader) -> Result<()> {
        // TODO: Implement when database tables are ready
        Ok(())
    }

    /// Mark import as complete
    async fn mark_import_complete(&self, _import_id: &str, _block_count: i32) -> Result<()> {
        // TODO: Implement when database tables are ready
        Ok(())
    }

    /// Store raw IPLD block
    async fn store_raw_block(
        &self,
        _cid: &Cid,
        _block_data: &[u8],
        _import_id: &str,
    ) -> Result<()> {
        // TODO: Implement when database tables are ready
        Ok(())
    }

    /// Store commit metadata
    async fn store_commit_metadata(&self, _ipld: &Ipld, _cid: &Cid, import_id: &str) -> Result<()> {
        info!("Would store commit metadata from CAR import {}", import_id);
        Ok(())
    }

    /// Store extracted record tracking
    async fn store_extracted_record(
        &self,
        _import_id: &str,
        _cid: &Cid,
        _collection: &str,
        _record_uri: Option<&str>,
    ) -> Result<()> {
        // TODO: Implement when database tables are ready
        Ok(())
    }

    /// Fetch and process CAR file for a given identity (handle or DID)
    pub async fn fetch_and_process_identity_car(&self, identity: &str) -> Result<String> {
        info!(
            "Starting CAR fetch and processing for identity: {}",
            identity
        );

        // Resolve identity to DID and PDS
        let (user_did, pds_host) = self.resolve_user_to_pds(identity).await?;
        info!(
            "Resolved {} to DID {} on PDS {}",
            identity, user_did, pds_host
        );

        // Fetch CAR file from PDS
        let car_data = self.fetch_car_from_pds(&pds_host, &user_did, None).await?;
        info!(
            "Successfully fetched CAR file for {} ({} bytes)",
            user_did,
            car_data.len()
        );

        // Generate import ID
        let import_id = format!(
            "pds-{}-{}",
            user_did.replace(":", "-"),
            chrono::Utc::now().timestamp()
        );

        // Process through existing pipeline
        self.process_car_data(&car_data, &import_id).await?;

        info!("✅ CAR import completed successfully for {}", identity);
        Ok(import_id)
    }

    /// Resolve a user identifier (DID or handle) to their DID and PDS host
    async fn resolve_user_to_pds(&self, user_identifier: &str) -> Result<(String, String)> {
        if user_identifier.starts_with("did:") {
            // User provided a DID directly, resolve to PDS
            let pds_host = self.resolve_did_to_pds(user_identifier).await?;
            Ok((user_identifier.to_string(), pds_host))
        } else {
            // User provided a handle, resolve to DID then PDS
            let user_did = self.resolve_handle_to_did(user_identifier).await?;
            let pds_host = self.resolve_did_to_pds(&user_did).await?;
            Ok((user_did, pds_host))
        }
    }

    /// Resolve a handle to a DID using com.atproto.identity.resolveHandle
    async fn resolve_handle_to_did(&self, handle: &str) -> Result<String> {
        let url = format!(
            "https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={}",
            handle
        );

        let response = reqwest::get(&url).await?;
        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to resolve handle {}: {}",
                handle,
                response.status()
            ));
        }

        let json: serde_json::Value = response.json().await?;
        let did = json["did"]
            .as_str()
            .ok_or_else(|| anyhow!("No DID found in response for handle {}", handle))?;

        Ok(did.to_string())
    }

    /// Resolve a DID to their PDS host using DID document
    async fn resolve_did_to_pds(&self, did: &str) -> Result<String> {
        // For DID:plc, use the PLC directory
        if did.starts_with("did:plc:") {
            let url = format!("https://plc.directory/{}", did);

            let response = reqwest::get(&url).await?;
            if !response.status().is_success() {
                return Err(anyhow!(
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
                            let parsed_url = url::Url::parse(endpoint)?;
                            let host = parsed_url
                                .host_str()
                                .ok_or_else(|| anyhow!("Invalid PDS endpoint URL: {}", endpoint))?;
                            return Ok(host.to_string());
                        }
                    }
                }
            }

            Err(anyhow!("No PDS service found in DID document for {}", did))
        } else {
            Err(anyhow!("Unsupported DID method: {}", did))
        }
    }

    /// Fetch CAR file from PDS using com.atproto.sync.getRepo
    async fn fetch_car_from_pds(
        &self,
        pds_host: &str,
        did: &str,
        since: Option<&str>,
    ) -> Result<Vec<u8>> {
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
            return Err(anyhow!(
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
            return Err(anyhow!("Unexpected content type: {}", content_type));
        }

        let car_data = response.bytes().await?;
        Ok(car_data.to_vec())
    }
}

#[async_trait]
impl LexiconIngestor for CarImportIngestor {
    async fn ingest(&self, message: Event<Value>) -> Result<()> {
        // For CAR imports, we expect the message to contain CAR file data
        // This could be a file path, URL, or base64 encoded data

        if let Some(commit) = &message.commit {
            if let Some(record) = &commit.record {
                // Check if this is a CAR import request
                if let Some(car_data_field) = record.get("carData") {
                    let import_id = format!("{}:{}", message.did, commit.rkey);

                    match car_data_field {
                        Value::String(base64_data) => {
                            // Decode base64 CAR data
                            if let Ok(car_bytes) = general_purpose::STANDARD.decode(base64_data) {
                                self.process_car_data(&car_bytes, &import_id).await?;
                            } else {
                                return Err(anyhow!("Invalid base64 CAR data"));
                            }
                        }
                        Value::Object(obj) => {
                            // Handle different CAR data formats (URL, file path, etc.)
                            if let Some(Value::String(url)) = obj.get("url") {
                                // Download and process CAR from URL
                                let car_bytes = self.download_car_file(url).await?;
                                self.process_car_data(&car_bytes, &import_id).await?;
                            }
                        }
                        _ => {
                            return Err(anyhow!("Unsupported CAR data format"));
                        }
                    }
                } else {
                    return Err(anyhow!("No CAR data found in record"));
                }
            }
        }

        Ok(())
    }
}

impl CarImportIngestor {
    /// Download CAR file from URL
    async fn download_car_file(&self, url: &str) -> Result<Vec<u8>> {
        let response = reqwest::get(url).await?;
        let bytes = response.bytes().await?;
        Ok(bytes.to_vec())
    }
}

/// Helper struct for extracted AT Protocol data
#[derive(Debug)]
struct ExtractedData {
    collection: String,
    data: Ipld,
    cid: Cid,
}

/// Convert IPLD to JSON Value for compatibility with existing ingestors
fn ipld_to_json(ipld: &Ipld) -> Result<Value> {
    match ipld {
        Ipld::Null => Ok(Value::Null),
        Ipld::Bool(b) => Ok(Value::Bool(*b)),
        Ipld::Integer(i) => {
            // Convert i128 to i64 for JSON compatibility
            if let Ok(i64_val) = i64::try_from(*i) {
                Ok(Value::Number(i64_val.into()))
            } else {
                // Fall back to string representation for very large integers
                Ok(Value::String(i.to_string()))
            }
        }
        Ipld::Float(f) => {
            if let Some(num) = serde_json::Number::from_f64(*f) {
                Ok(Value::Number(num))
            } else {
                Err(anyhow!("Invalid float value"))
            }
        }
        Ipld::String(s) => Ok(Value::String(s.clone())),
        Ipld::Bytes(b) => {
            // Convert bytes to base64 string
            Ok(Value::String(general_purpose::STANDARD.encode(b)))
        }
        Ipld::List(list) => {
            let json_array: Result<Vec<Value>> = list.iter().map(ipld_to_json).collect();
            Ok(Value::Array(json_array?))
        }
        Ipld::Map(map) => {
            let mut json_map = serde_json::Map::new();
            for (key, value) in map {
                json_map.insert(key.clone(), ipld_to_json(value)?);
            }
            Ok(Value::Object(json_map))
        }
        Ipld::Link(cid) => {
            // Convert CID to string representation
            Ok(Value::String(cid.to_string()))
        }
    }
}
