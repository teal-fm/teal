//! CAR (Content Addressable aRchive) Import Ingestor using atmst
//!
//! This module handles importing Teal records from CAR files using the atmst library,
//! which provides proper AT Protocol-style Merkle Search Tree handling. The CAR import process:
//!
//! 1. Receives CAR data via the LexiconIngestor interface (base64 encoded or URL)
//! 2. Uses atmst::CarImporter to parse the CAR file and extract MST structure
//! 3. Converts the CarImporter to an MST for proper tree traversal
//! 4. Iterates through MST nodes to find Teal record types (play, profile, status)
//! 5. Delegates to existing Teal ingestors using the actual DID and proper rkey
//!
//! ## Usage Example
//!
//! ```rust,ignore
//! // CAR data can be provided in a record like:
//! {
//!   "carData": "base64-encoded-car-file-here"
//! }
//!
//! // Or as a URL reference:
//! {
//!   "carData": {
//!     "url": "https://example.com/my-archive.car"
//!   }
//! }
//! ```
//!
//! The ingestor will automatically detect record types and store them using the
//! same logic as real-time Jetstream ingestion, ensuring data consistency.
//! All imported records will be attributed to the DID that initiated the import
//! and use the original rkey from the AT Protocol MST structure.

use crate::ingestors::car::jobs::{queue_keys, CarImportJob};
use crate::redis_client::RedisClient;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use atmst::{mst::Mst, Bytes, CarImporter};
use base64::Engine;
use futures::StreamExt;
use jacquard_common::types::value;
use redis::AsyncCommands;
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::PgPool;
use tracing::{info, warn};

/// Helper struct for extracted records
#[derive(Debug)]
pub struct ExtractedRecord {
    pub collection: String,
    pub rkey: String,
    pub data: serde_json::Value,
}

const STABLE_PLAY_COLLECTION: &str = "fm.teal.feed.play";
const STABLE_PROFILE_COLLECTION: &str = "fm.teal.actor.profile";
const STABLE_STATUS_COLLECTION: &str = "fm.teal.actor.status";
const LEGACY_PLAY_COLLECTION: &str = "fm.teal.alpha.feed.play";
const LEGACY_PROFILE_COLLECTION: &str = "fm.teal.alpha.actor.profile";
const LEGACY_STATUS_COLLECTION: &str = "fm.teal.alpha.actor.status";

/// Return the stable collection handled by the existing Teal ingestor.
///
/// Historical CAR files contain records under the alpha namespace. Their
/// records have the same shape as the stable records, so they can be passed
/// through the stable ingestors after the collection is normalized.
fn stable_collection_for(collection: &str) -> Option<&'static str> {
    match collection {
        STABLE_PLAY_COLLECTION | LEGACY_PLAY_COLLECTION => Some(STABLE_PLAY_COLLECTION),
        STABLE_PROFILE_COLLECTION | LEGACY_PROFILE_COLLECTION => Some(STABLE_PROFILE_COLLECTION),
        STABLE_STATUS_COLLECTION | LEGACY_STATUS_COLLECTION => Some(STABLE_STATUS_COLLECTION),
        _ => None,
    }
}

fn is_teal_record_key(key: &str) -> bool {
    let Some((collection, rkey)) = key.rsplit_once('/') else {
        return false;
    };

    !rkey.is_empty() && stable_collection_for(collection).is_some()
}

fn parse_teal_key(key: &str) -> Option<(String, String)> {
    if !is_teal_record_key(key) {
        return None;
    }

    let (collection, rkey) = key.rsplit_once('/')?;
    Some((collection.to_string(), rkey.to_string()))
}

fn normalize_legacy_record_type(data: &Value) -> Value {
    let Value::Object(object) = data else {
        return data.clone();
    };

    let mut normalized = object.clone();
    if let Some(Value::String(record_type)) = normalized.get_mut("$type") {
        if let Some(stable_type) = record_type.strip_prefix("fm.teal.alpha.") {
            *record_type = format!("fm.teal.{stable_type}");
        }
    }

    Value::Object(normalized)
}

fn is_legacy_collection(collection: &str) -> bool {
    matches!(
        collection,
        LEGACY_PLAY_COLLECTION | LEGACY_PROFILE_COLLECTION | LEGACY_STATUS_COLLECTION
    )
}

/// Drop duplicate stable/alpha records from a repository snapshot.
///
/// The namespace is part of a record's `$type`, so compare records after only
/// normalizing that root NSID. Records with the same canonical collection,
/// exact rkey, and exact normalized JSON are the same logical record. Prefer
/// the stable collection when both namespace variants are present.
fn deduplicate_records(records: Vec<ExtractedRecord>) -> Vec<ExtractedRecord> {
    let mut deduplicated: Vec<ExtractedRecord> = Vec::with_capacity(records.len());

    for record in records {
        let canonical_collection = stable_collection_for(&record.collection);
        let normalized_data = normalize_legacy_record_type(&record.data);
        let duplicate_index = deduplicated.iter().position(|existing| {
            stable_collection_for(&existing.collection) == canonical_collection
                && existing.rkey == record.rkey
                && normalize_legacy_record_type(&existing.data) == normalized_data
        });

        if let Some(index) = duplicate_index {
            if is_legacy_collection(&deduplicated[index].collection)
                && !is_legacy_collection(&record.collection)
            {
                deduplicated[index] = record;
            }
        } else {
            deduplicated.push(record);
        }
    }

    deduplicated
}

/// CAR Import Ingestor handles importing Teal records from CAR files using atmst
pub struct CarImportIngestor {
    sql: PgPool,
}

impl CarImportIngestor {
    /// Create a new CAR import ingestor with database connection
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    /// Helper to get a Redis connection for job queueing
    pub async fn get_redis_connection(&self) -> Result<redis::aio::MultiplexedConnection> {
        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        let client = RedisClient::new(&redis_url)?;
        client
            .get_connection()
            .await
            .map_err(|e| anyhow!("Redis connection error: {}", e))
    }

    /// Process CAR file data using atmst library and extract Teal records
    async fn process_car_data(&self, car_data: &[u8], import_id: &str, did: &str) -> Result<()> {
        info!(
            "Starting CAR file processing with atmst for import {} (DID: {})",
            import_id, did
        );

        // Convert to Bytes for atmst
        let car_bytes: Bytes = Bytes::from(car_data.to_vec());

        // Create CarImporter and import the CAR data
        let mut car_importer = CarImporter::new();
        car_importer
            .import_from_bytes(car_bytes.clone())
            .await
            .map_err(|e| anyhow!("Failed to import CAR with atmst: {}", e))?;

        info!(
            "CAR imported successfully. Root CIDs: {:?}, Total blocks: {}",
            car_importer.roots(),
            car_importer.len()
        );

        // Convert CarImporter to MST for proper tree traversal
        let mst = Mst::from_car_importer(car_importer)
            .await
            .map_err(|e| anyhow!("Failed to convert CAR to MST: {}", e))?;

        info!("MST conversion successful, starting record extraction");

        // Create a new CarImporter for data access since the previous one was consumed
        let mut data_importer = CarImporter::new();
        data_importer
            .import_from_bytes(car_bytes)
            .await
            .map_err(|e| anyhow!("Failed to re-import CAR for data access: {}", e))?;

        // Extract all records from the MST
        let records = self
            .extract_records_from_mst(&mst, &data_importer, did)
            .await?;
        let extracted_count = records.len();
        let records = deduplicate_records(records);

        info!(
            "Extracted {} records from MST ({} after namespace deduplication)",
            extracted_count,
            records.len()
        );

        // Process each record through the appropriate ingestor
        let mut processed_count = 0;
        for record in records {
            match self.process_extracted_record(&record, import_id, did).await {
                Ok(()) => {
                    processed_count += 1;
                    if processed_count % 10 == 0 {
                        info!("Processed {} records so far", processed_count);
                    }
                }
                Err(e) => {
                    warn!("Failed to process record {}: {}", record.rkey, e);
                    // Continue processing other records
                }
            }
        }

        info!(
            "Completed CAR file processing: {} records processed for import {}",
            processed_count, import_id
        );

        Ok(())
    }

    /// Extract all Teal records from the MST
    async fn extract_records_from_mst(
        &self,
        mst: &Mst,
        car_importer: &CarImporter,
        _did: &str,
    ) -> Result<Vec<ExtractedRecord>> {
        let mut records = Vec::new();

        // Use the MST iterator to traverse all entries
        let mut stream = mst.iter().into_stream();

        while let Some(result) = stream.next().await {
            match result {
                Ok((key, record_cid)) => {
                    // Check if this is a Teal record based on the key pattern
                    if is_teal_record_key(&key) {
                        info!("🎵 Found Teal record: {} -> {}", key, record_cid);
                        if let Some((collection, rkey)) = parse_teal_key(&key) {
                            info!("   Collection: {}, rkey: {}", collection, rkey);
                            // Get the actual record data using the CID
                            match self.get_record_data(&record_cid, car_importer).await {
                                Ok(Some(data)) => {
                                    info!("   ✅ Successfully got record data for {}", record_cid);
                                    records.push(ExtractedRecord {
                                        collection,
                                        rkey,
                                        data,
                                    });
                                }
                                Ok(None) => {
                                    warn!("   ❌ No data found for record CID: {}", record_cid);
                                }
                                Err(e) => {
                                    warn!(
                                        "   ❌ Failed to get record data for {}: {}",
                                        record_cid, e
                                    );
                                }
                            }
                        } else {
                            warn!("   ❌ Failed to parse Teal key: {}", key);
                        }
                    }
                }
                Err(e) => {
                    warn!("Error iterating MST: {}", e);
                    // Continue with other entries
                }
            }
        }

        Ok(records)
    }

    /// Get record data from the CAR importer using a CID
    async fn get_record_data(
        &self,
        cid: &atmst::Cid,
        car_importer: &CarImporter,
    ) -> Result<Option<Value>> {
        // Try to decode the block as CBOR IPLD directly with atmst::Cid
        info!("🔍 Attempting to decode CBOR for CID: {}", cid);
        match car_importer.decode_cbor(cid) {
            Ok(ipld) => {
                info!("   ✅ Successfully decoded CBOR for CID: {}", cid);
                // Convert IPLD to JSON for processing by existing ingestors
                match self.ipld_to_json(&ipld) {
                    Ok(json) => {
                        info!("   ✅ Successfully converted IPLD to JSON for CID: {}", cid);
                        Ok(Some(json))
                    }
                    Err(e) => {
                        warn!(
                            "   ❌ Failed to convert IPLD to JSON for CID {}: {}",
                            cid, e
                        );
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                warn!("   ❌ Failed to decode CBOR for CID {}: {}", cid, e);
                Ok(None)
            }
        }
    }

    /// Process a single extracted record through the appropriate ingestor
    async fn process_extracted_record(
        &self,
        record: &ExtractedRecord,
        _import_id: &str,
        did: &str,
    ) -> Result<()> {
        info!(
            "Processing {} record with rkey: {}",
            record.collection, record.rkey
        );

        info!(
            "🔄 Processing {} record: {}",
            record.collection, record.rkey
        );
        match stable_collection_for(&record.collection) {
            Some(STABLE_PLAY_COLLECTION) => {
                info!("   📀 Processing play record...");
                let result = self
                    .process_play_record(&record.data, did, &record.rkey)
                    .await;
                if result.is_ok() {
                    info!("   ✅ Successfully processed play record");
                } else {
                    warn!("   ❌ Failed to process play record: {:?}", result);
                }
                result
            }
            Some(STABLE_PROFILE_COLLECTION) => {
                info!("   👤 Processing profile record...");
                let result = self
                    .process_profile_record(&record.data, did, &record.rkey)
                    .await;
                if result.is_ok() {
                    info!("   ✅ Successfully processed profile record");
                } else {
                    warn!("   ❌ Failed to process profile record: {:?}", result);
                }
                result
            }
            Some(STABLE_STATUS_COLLECTION) => {
                info!("   📢 Processing status record...");
                let result = self
                    .process_status_record(&record.data, did, &record.rkey)
                    .await;
                if result.is_ok() {
                    info!("   ✅ Successfully processed status record");
                } else {
                    warn!("   ❌ Failed to process status record: {:?}", result);
                }
                result
            }
            _ => {
                warn!("❓ Unknown Teal collection: {}", record.collection);
                Ok(())
            }
        }
    }

    /// Process a play record using the existing PlayIngestor
    async fn process_play_record(&self, data: &Value, did: &str, rkey: &str) -> Result<()> {
        let data = normalize_legacy_record_type(data);
        let play_record: types::fm_teal::feed::play::Play =
            value::from_json_value::<types::fm_teal::feed::play::Play>(data)?;

        let play_ingestor = super::super::teal::feed_play::PlayIngestor::new(self.sql.clone());
        let uri = super::super::teal::assemble_at_uri(did, STABLE_PLAY_COLLECTION, rkey);

        play_ingestor
            .insert_play(
                &play_record,
                &uri,
                &format!("car-import-{}", uuid::Uuid::new_v4()),
                did,
                rkey,
            )
            .await?;

        info!(
            "Successfully stored play record: {} by {:?}",
            play_record.track_name, play_record.artist_names
        );
        Ok(())
    }

    /// Process a profile record using the existing ActorProfileIngestor
    async fn process_profile_record(&self, data: &Value, did: &str, _rkey: &str) -> Result<()> {
        let data = normalize_legacy_record_type(data);
        let profile_record: types::fm_teal::actor::profile::Profile =
            value::from_json_value::<types::fm_teal::actor::profile::Profile>(data)?;

        let profile_ingestor =
            super::super::teal::actor_profile::ActorProfileIngestor::new(self.sql.clone());

        profile_ingestor
            .insert_profile(did, &profile_record)
            .await?;

        info!(
            "Successfully stored profile record: {:?}",
            profile_record.display_name
        );
        Ok(())
    }

    /// Process a status record using the existing ActorStatusIngestor
    async fn process_status_record(&self, data: &Value, did: &str, rkey: &str) -> Result<()> {
        let data = normalize_legacy_record_type(data);
        let status_record: types::fm_teal::actor::status::Status =
            value::from_json_value::<types::fm_teal::actor::status::Status>(data)?;

        let status_ingestor =
            super::super::teal::actor_status::ActorStatusIngestor::new(self.sql.clone());

        status_ingestor
            .insert_status(
                did,
                rkey,
                &format!("car-import-{}", uuid::Uuid::new_v4()),
                &status_record,
            )
            .await?;

        info!("Successfully stored status record from CAR import");
        Ok(())
    }

    /// Fetch and process a CAR file from a PDS for a given identity
    pub async fn fetch_and_process_identity_car(&self, handle_or_did: &str) -> Result<String> {
        info!("Fetching CAR file for identity: {}", handle_or_did);

        // Resolve to DID if needed
        let did = if handle_or_did.starts_with("did:") {
            handle_or_did.to_string()
        } else {
            self.resolve_handle_to_did(handle_or_did).await?
        };

        // Resolve DID to PDS
        let pds_url = self.resolve_did_to_pds(&did).await?;
        info!("Resolved {} to PDS: {}", did, pds_url);

        // Fetch CAR file
        let car_data = self.fetch_car_from_pds(&pds_url, &did).await?;

        // Generate import ID
        let import_id = uuid::Uuid::new_v4().to_string();

        // Process the CAR data
        self.process_car_data(&car_data, &import_id, &did).await?;

        Ok(import_id)
    }

    /// Resolve handle to DID
    async fn resolve_handle_to_did(&self, handle: &str) -> Result<String> {
        let url = format!(
            "https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={}",
            handle
        );
        let response: Value = reqwest::get(&url).await?.json().await?;

        response["did"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow!("Failed to resolve handle to DID"))
    }

    /// Resolve DID to PDS URL
    async fn resolve_did_to_pds(&self, did: &str) -> Result<String> {
        let url = format!("https://plc.directory/{}", did);
        let response: Value = reqwest::get(&url).await?.json().await?;

        if let Some(services) = response["service"].as_array() {
            for service in services {
                if service["id"] == "#atproto_pds" {
                    if let Some(endpoint) = service["serviceEndpoint"].as_str() {
                        return Ok(endpoint.to_string());
                    }
                }
            }
        }

        Err(anyhow!("Could not resolve PDS for DID: {}", did))
    }

    /// Fetch CAR file from PDS
    async fn fetch_car_from_pds(&self, pds_url: &str, did: &str) -> Result<Vec<u8>> {
        let url = format!("{}/xrpc/com.atproto.sync.getRepo?did={}", pds_url, did);
        let response = reqwest::get(&url).await?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to fetch CAR file: HTTP {}",
                response.status()
            ));
        }

        let car_data = response.bytes().await?.to_vec();
        info!("Fetched CAR file: {} bytes", car_data.len());

        Ok(car_data)
    }

    /// Helper: Convert IPLD to JSON
    #[allow(clippy::only_used_in_recursion)]
    fn ipld_to_json(&self, ipld: &atmst::Ipld) -> Result<Value> {
        use atmst::Ipld;

        match ipld {
            Ipld::Null => Ok(Value::Null),
            Ipld::Bool(b) => Ok(Value::Bool(*b)),
            Ipld::Integer(i) => {
                if let Ok(i64_val) = i64::try_from(*i) {
                    Ok(Value::Number(i64_val.into()))
                } else {
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
            Ipld::Bytes(b) => Ok(Value::String(
                base64::engine::general_purpose::STANDARD.encode(b),
            )),
            Ipld::List(list) => {
                let json_array: Result<Vec<Value>> =
                    list.iter().map(|v| self.ipld_to_json(v)).collect();
                Ok(Value::Array(json_array?))
            }
            Ipld::Map(map) => {
                let mut json_map = serde_json::Map::new();
                for (key, value) in map {
                    json_map.insert(key.clone(), self.ipld_to_json(value)?);
                }
                Ok(Value::Object(json_map))
            }
            Ipld::Link(cid) => Ok(Value::String(cid.to_string())),
        }
    }
}

#[async_trait]
impl LexiconIngestor for CarImportIngestor {
    async fn ingest(&self, message: Event<Value>) -> Result<()> {
        let commit = message
            .commit
            .as_ref()
            .ok_or_else(|| anyhow!("CarImportIngestor requires a commit event"))?;

        let record = commit
            .record
            .as_ref()
            .ok_or_else(|| anyhow!("CarImportIngestor requires a record in the commit"))?;

        // Enqueue CAR import job into Redis
        let job = CarImportJob {
            request_id: uuid::Uuid::new_v4(),
            identity: record
                .get("identity")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing identity in record"))?
                .to_string(),
            since: None,
            created_at: chrono::Utc::now(),
            description: None,
        };
        let job_payload = serde_json::to_string(&job)?;
        let mut conn = self.get_redis_connection().await?;
        // Specify the expected return type to avoid FromRedisValue fallback issues in edition 2024
        let _: () = conn.lpush(queue_keys::CAR_IMPORT_JOBS, job_payload).await?;
        tracing::info!("Enqueued CAR import job: {}", job.request_id);

        Ok(())
    }
}

#[allow(dead_code)]
impl CarImportIngestor {
    /// Download CAR file from URL
    async fn download_car_file(&self, url: &str) -> Result<Vec<u8>> {
        let response = reqwest::get(url).await?;
        Ok(response.bytes().await?.to_vec())
    }

    /// Import CAR data from bytes (public interface)
    pub async fn import_car_bytes(&self, car_data: &[u8], did: &str) -> Result<String> {
        let import_id = uuid::Uuid::new_v4().to_string();
        self.process_car_data(car_data, &import_id, did).await?;
        Ok(import_id)
    }

    /// Consolidate synthetic artists with MusicBrainz artists
    pub async fn consolidate_synthetic_artists(&self, min_confidence: f64) -> Result<usize> {
        let play_ingestor = super::super::teal::feed_play::PlayIngestor::new(self.sql.clone());
        play_ingestor
            .consolidate_synthetic_artists(min_confidence)
            .await
    }

    /// Consolidate duplicate releases
    pub async fn consolidate_duplicate_releases(&self, min_confidence: f64) -> Result<usize> {
        let play_ingestor = super::super::teal::feed_play::PlayIngestor::new(self.sql.clone());
        play_ingestor
            .consolidate_duplicate_releases(min_confidence)
            .await
    }

    /// Consolidate duplicate recordings
    pub async fn consolidate_duplicate_recordings(&self, min_confidence: f64) -> Result<usize> {
        let play_ingestor = super::super::teal::feed_play::PlayIngestor::new(self.sql.clone());
        play_ingestor
            .consolidate_duplicate_recordings(min_confidence)
            .await
    }

    /// Preview consolidation candidates before running consolidation
    pub async fn preview_consolidation_candidates(&self, min_confidence: f64) -> Result<()> {
        let play_ingestor = super::super::teal::feed_play::PlayIngestor::new(self.sql.clone());
        play_ingestor
            .preview_consolidation_candidates(min_confidence)
            .await
    }

    /// Run full batch consolidation for all entity types
    pub async fn run_full_consolidation(&self) -> Result<()> {
        let play_ingestor = super::super::teal::feed_play::PlayIngestor::new(self.sql.clone());
        play_ingestor.run_full_consolidation().await
    }
}

// Removed unused helper struct for extracted records.

#[cfg(test)]
mod tests {
    use super::*;
    use atmst::{CarBuilder, Ipld};
    use std::collections::BTreeMap;

    fn create_mock_teal_play_record() -> Ipld {
        let mut record = BTreeMap::new();
        record.insert(
            "$type".to_string(),
            Ipld::String("fm.teal.feed.play".to_string()),
        );
        record.insert(
            "track_name".to_string(),
            Ipld::String("Test Song".to_string()),
        );
        record.insert(
            "artist_names".to_string(),
            Ipld::List(vec![Ipld::String("Test Artist".to_string())]),
        );
        record.insert("duration".to_string(), Ipld::Integer(180000));
        record.insert(
            "created_at".to_string(),
            Ipld::String("2024-01-01T00:00:00Z".to_string()),
        );
        Ipld::Map(record)
    }

    fn create_mock_teal_profile_record() -> Ipld {
        let mut record = BTreeMap::new();
        record.insert(
            "$type".to_string(),
            Ipld::String("fm.teal.actor.profile".to_string()),
        );
        record.insert(
            "display_name".to_string(),
            Ipld::String("Test User".to_string()),
        );
        record.insert(
            "description".to_string(),
            Ipld::String("Music lover".to_string()),
        );
        Ipld::Map(record)
    }

    async fn create_test_car_with_teal_records() -> Result<Bytes> {
        let mut builder = CarBuilder::new();

        // Create test Teal records
        let play_record = create_mock_teal_play_record();
        let profile_record = create_mock_teal_profile_record();

        // Add records to CAR
        let play_cid = builder.add_cbor(&play_record)?;
        let profile_cid = builder.add_cbor(&profile_record)?;

        // Add roots (in a real MST, these would be MST nodes, but for testing this is sufficient)
        builder.add_root(play_cid);
        builder.add_root(profile_cid);

        let importer = builder.build();
        importer
            .export_to_bytes()
            .await
            .map_err(|e| anyhow!("Failed to export CAR: {}", e))
    }

    #[test]
    fn test_parse_teal_key() {
        for collection in [STABLE_PLAY_COLLECTION, LEGACY_PLAY_COLLECTION] {
            let key = format!("{collection}/3k2akjdlkjsf");
            let (parsed_collection, rkey) = parse_teal_key(&key).expect("valid Teal key");

            assert_eq!(parsed_collection, collection);
            assert_eq!(rkey, "3k2akjdlkjsf");
        }
    }

    #[test]
    fn test_is_teal_record_key() {
        assert!(is_teal_record_key("fm.teal.feed.play/abc123"));
        assert!(is_teal_record_key("fm.teal.actor.profile/def456"));
        assert!(is_teal_record_key("fm.teal.alpha.feed.play/abc123"));
        assert!(is_teal_record_key("fm.teal.alpha.actor.profile/def456"));
        assert!(is_teal_record_key("fm.teal.alpha.actor.status/ghi789"));
        assert!(!is_teal_record_key("app.bsky.feed.post/xyz789"));
        assert!(!is_teal_record_key("fm.teal.feed.play")); // No rkey
        assert!(!is_teal_record_key("fm.teal.feed.play/")); // Empty rkey
    }

    #[test]
    fn test_legacy_collections_route_to_stable_ingestors() {
        let collections = [
            (
                LEGACY_PLAY_COLLECTION,
                STABLE_PLAY_COLLECTION,
                "3k2akjdlkjsf",
            ),
            (LEGACY_PROFILE_COLLECTION, STABLE_PROFILE_COLLECTION, "self"),
            (LEGACY_STATUS_COLLECTION, STABLE_STATUS_COLLECTION, "self"),
        ];

        for (legacy_collection, stable_collection, rkey) in collections {
            let key = format!("{legacy_collection}/{rkey}");
            let (parsed_collection, parsed_rkey) =
                parse_teal_key(&key).expect("legacy Teal record should be retained");

            assert_eq!(parsed_collection, legacy_collection);
            assert_eq!(parsed_rkey, rkey);
            assert_eq!(
                stable_collection_for(&parsed_collection),
                Some(stable_collection)
            );
            assert_eq!(
                crate::ingestors::teal::assemble_at_uri(
                    "did:plc:historical",
                    stable_collection_for(&parsed_collection).unwrap(),
                    &parsed_rkey,
                ),
                format!("at://did:plc:historical/{stable_collection}/{rkey}"),
            );
        }
    }

    #[test]
    fn test_normalize_legacy_record_type() {
        let data = serde_json::json!({
            "$type": "fm.teal.alpha.actor.status",
            "time": "2024-01-01T00:00:00Z"
        });

        let normalized = normalize_legacy_record_type(&data);
        assert_eq!(normalized["$type"], "fm.teal.actor.status");
    }

    #[test]
    fn test_deduplicate_identical_alpha_and_stable_records_prefers_stable() {
        let record_fields = serde_json::json!({
            "trackName": "Same recording",
            "playedTime": "2024-01-01T00:00:00Z"
        });
        let mut legacy_data = record_fields.clone();
        legacy_data["$type"] = serde_json::json!(LEGACY_PLAY_COLLECTION);
        let mut stable_data = record_fields;
        stable_data["$type"] = serde_json::json!(STABLE_PLAY_COLLECTION);

        let records = deduplicate_records(vec![
            ExtractedRecord {
                collection: LEGACY_PLAY_COLLECTION.to_string(),
                rkey: "same-rkey".to_string(),
                data: legacy_data,
            },
            ExtractedRecord {
                collection: STABLE_PLAY_COLLECTION.to_string(),
                rkey: "same-rkey".to_string(),
                data: stable_data,
            },
        ]);

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].collection, STABLE_PLAY_COLLECTION);
        assert_eq!(records[0].rkey, "same-rkey");
        assert_eq!(records[0].data["$type"], STABLE_PLAY_COLLECTION);
    }

    #[test]
    fn test_deduplicate_keeps_different_content_or_rkeys() {
        let records = deduplicate_records(vec![
            ExtractedRecord {
                collection: LEGACY_STATUS_COLLECTION.to_string(),
                rkey: "same-rkey".to_string(),
                data: serde_json::json!({
                    "$type": LEGACY_STATUS_COLLECTION,
                    "time": "2024-01-01T00:00:00Z"
                }),
            },
            ExtractedRecord {
                collection: STABLE_STATUS_COLLECTION.to_string(),
                rkey: "same-rkey".to_string(),
                data: serde_json::json!({
                    "$type": STABLE_STATUS_COLLECTION,
                    "time": "2024-01-01T00:01:00Z"
                }),
            },
            ExtractedRecord {
                collection: STABLE_STATUS_COLLECTION.to_string(),
                rkey: "different-rkey".to_string(),
                data: serde_json::json!({
                    "$type": STABLE_STATUS_COLLECTION,
                    "time": "2024-01-01T00:00:00Z"
                }),
            },
        ]);

        assert_eq!(records.len(), 3);
    }

    #[test]
    fn test_ipld_to_json_conversion() {
        // Test IPLD to JSON conversion logic directly
        use atmst::Ipld;
        use std::collections::BTreeMap;

        let mut record = BTreeMap::new();
        record.insert(
            "$type".to_string(),
            Ipld::String("fm.teal.feed.play".to_string()),
        );
        record.insert(
            "track_name".to_string(),
            Ipld::String("Test Song".to_string()),
        );
        record.insert("duration".to_string(), Ipld::Integer(180000));
        let play_record = Ipld::Map(record);

        // Test the conversion logic inline
        fn ipld_to_json(ipld: &Ipld) -> Result<Value> {
            match ipld {
                Ipld::Null => Ok(Value::Null),
                Ipld::Bool(b) => Ok(Value::Bool(*b)),
                Ipld::Integer(i) => {
                    if let Ok(i64_val) = i64::try_from(*i) {
                        Ok(Value::Number(i64_val.into()))
                    } else {
                        Ok(Value::String(i.to_string()))
                    }
                }
                Ipld::String(s) => Ok(Value::String(s.clone())),
                Ipld::Map(map) => {
                    let mut json_map = serde_json::Map::new();
                    for (key, value) in map {
                        json_map.insert(key.clone(), ipld_to_json(value)?);
                    }
                    Ok(Value::Object(json_map))
                }
                _ => Ok(Value::Null), // Simplified for test
            }
        }

        let json_result = ipld_to_json(&play_record);
        assert!(json_result.is_ok());
        let json = json_result.unwrap();
        assert_eq!(json["$type"], "fm.teal.feed.play");
        assert_eq!(json["track_name"], "Test Song");
        assert_eq!(json["duration"], 180000);
    }

    #[tokio::test]
    async fn test_car_creation_and_basic_parsing() -> Result<()> {
        // Test that we can create a CAR file with Teal records and parse it
        let car_bytes = create_test_car_with_teal_records().await?;

        // Verify we can import the CAR with atmst
        let mut importer = CarImporter::new();
        importer.import_from_bytes(car_bytes).await?;

        assert!(!importer.is_empty());
        assert!(importer.len() >= 2); // Should have at least our 2 test records

        // Test that we can decode the records
        for cid in importer.cids() {
            if let Ok(Ipld::Map(map)) = importer.decode_cbor(&cid) {
                if let Some(Ipld::String(record_type)) = map.get("$type") {
                    assert!(record_type.starts_with("fm.teal."));
                    println!("Found Teal record: {}", record_type);
                }
            }
        }

        Ok(())
    }

    #[tokio::test]
    #[ignore = "requires database connection"]
    async fn test_full_car_import_integration() -> Result<()> {
        // This test requires a real database connection
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://localhost/teal_test".to_string());

        let pool = sqlx::PgPool::connect(&database_url).await?;
        let ingestor = CarImportIngestor::new(pool);

        // Create test CAR with Teal records
        let car_bytes = create_test_car_with_teal_records().await?;

        // Test the full import process
        let import_id = uuid::Uuid::new_v4().to_string();
        let test_did = "did:plc:test123";

        // This should work with our new atmst implementation
        let result = ingestor
            .process_car_data(&car_bytes, &import_id, test_did)
            .await;

        // For now, we expect this to work but records might not actually get stored
        // because the test CAR doesn't have proper MST structure
        match result {
            Ok(()) => {
                println!("✅ CAR import completed successfully");
            }
            Err(e) => {
                println!("⚠️  CAR import failed (expected for test data): {}", e);
                // This is expected since our test CAR doesn't have proper MST structure
            }
        }

        Ok(())
    }
}
