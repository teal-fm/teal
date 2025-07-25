use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// CAR import job data for Redis queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarImportJob {
    /// Unique identifier for this job
    pub request_id: Uuid,
    /// Identity to import (handle or DID)
    pub identity: String,
    /// Optional revision/cursor for incremental imports
    pub since: Option<String>,
    /// When the job was created
    pub created_at: DateTime<Utc>,
    /// Optional description for tracking
    pub description: Option<String>,
}

/// Job status tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarImportJobStatus {
    /// Current status of the job
    pub status: JobStatus,
    /// When the job was created
    pub created_at: DateTime<Utc>,
    /// When processing started (if applicable)
    pub started_at: Option<DateTime<Utc>>,
    /// When the job completed (if applicable)
    pub completed_at: Option<DateTime<Utc>>,
    /// Error message if failed
    pub error_message: Option<String>,
    /// Current progress information
    pub progress: Option<JobProgress>,
}

/// Job status enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

/// Progress information for long-running jobs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    /// Current step description
    pub step: String,
    /// User DID (if resolved)
    pub user_did: Option<String>,
    /// PDS host (if discovered)
    pub pds_host: Option<String>,
    /// CAR file size in bytes (if fetched)
    pub car_size_bytes: Option<usize>,
    /// Number of IPLD blocks processed
    pub blocks_processed: Option<u32>,
}

/// Redis queue constants
pub mod queue_keys {
    pub const CAR_IMPORT_JOBS: &str = "car_import_jobs";
    pub const CAR_IMPORT_FAILED: &str = "car_import_failed";
    
    pub fn job_status_key(job_id: &uuid::Uuid) -> String {
        format!("car_import_status:{}", job_id)
    }
}