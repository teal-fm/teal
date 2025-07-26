use bon::Builder;

use crate::endpoints::JetstreamEndpoints;

#[derive(Builder, Debug)]
pub struct JetstreamOptions {
    #[builder(default)]
    pub ws_url: JetstreamEndpoints,
    #[builder(default)]
    pub max_retry_interval_seconds: u64,
    #[builder(default)]
    pub connection_success_time_seconds: u64,
    #[builder(default)]
    pub bound: usize,
    #[builder(default)]
    pub timeout_time_sec: usize,
    #[cfg(feature = "zstd")]
    #[builder(default = true)]
    pub compress: bool,
    pub wanted_collections: Option<Vec<String>>,
    pub wanted_dids: Option<Vec<String>>,
    pub cursor: Option<String>,
}

impl Default for JetstreamOptions {
    fn default() -> Self {
        Self {
            ws_url: JetstreamEndpoints::default(),
            max_retry_interval_seconds: 120,
            connection_success_time_seconds: 60,
            bound: 65536,
            timeout_time_sec: 40,
            #[cfg(feature = "zstd")]
            compress: true,
            wanted_collections: None,
            wanted_dids: None,
            cursor: None,
        }
    }
}
