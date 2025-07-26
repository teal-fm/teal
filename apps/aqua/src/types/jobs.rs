use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarImportJob {
    pub request_id: Uuid,
    pub identity: String,
    pub since: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarImportJobStatus {
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub progress: Option<JobProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub current: u64,
    pub total: Option<u64>,
    pub message: Option<String>,
}

pub mod queue_keys {
    use uuid::Uuid;

    pub const CAR_IMPORT_JOBS: &str = "car_import_jobs";
    pub const CAR_IMPORT_STATUS_PREFIX: &str = "car_import_status";

    pub fn job_status_key(job_id: &Uuid) -> String {
        format!("{}:{}", CAR_IMPORT_STATUS_PREFIX, job_id)
    }
}
