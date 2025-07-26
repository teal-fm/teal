use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Actor types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileViewData {
    pub avatar: Option<String>,
    pub banner: Option<String>,
    pub created_at: Option<atrium_api::types::string::Datetime>,
    pub description: Option<String>,
    pub description_facets: Option<Vec<String>>,
    pub did: Option<String>,
    pub display_name: Option<String>,
    pub featured_item: Option<String>,
    pub handle: Option<String>,
    pub status: Option<StatusViewData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusViewData {
    pub expiry: Option<DateTime<Utc>>,
    pub item: Option<PlayViewData>,
    pub time: Option<DateTime<Utc>>,
}

// Feed types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayViewData {
    pub track_name: Option<String>,
    pub track_mb_id: Option<String>,
    pub recording_mb_id: Option<String>,
    pub duration: Option<i64>,
    pub artists: Option<Vec<Artist>>,
    pub release_name: Option<String>,
    pub release_mb_id: Option<String>,
    pub isrc: Option<String>,
    pub origin_url: Option<String>,
    pub music_service_base_domain: Option<String>,
    pub submission_client_agent: Option<String>,
    pub played_time: Option<atrium_api::types::string::Datetime>,
    // Compatibility fields
    pub album: Option<String>,
    pub artist: Option<String>,
    pub created_at: Option<atrium_api::types::string::Datetime>,
    pub did: Option<String>,
    pub image: Option<String>,
    pub title: Option<String>,
    pub track_number: Option<i32>,
    pub uri: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub artist_name: Option<String>,
    pub artist_mb_id: Option<String>,
    pub mbid: Option<String>,
    pub name: Option<String>,
}

// Stats types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistViewData {
    pub mbid: Option<String>,
    pub name: Option<String>,
    pub play_count: Option<i64>,
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseViewData {
    pub album: Option<String>,
    pub artist: Option<String>,
    pub mbid: Option<String>,
    pub name: Option<String>,
    pub play_count: Option<i64>,
    pub image: Option<String>,
}

// Namespace modules for compatibility
pub mod fm {
    pub mod teal {
        pub mod alpha {
            pub mod actor {
                pub mod defs {
                    pub use crate::types::lexicon::ProfileViewData;
                }
            }
            pub mod feed {
                pub mod defs {
                    pub use crate::types::lexicon::{Artist, PlayViewData};
                }
            }
            pub mod stats {
                pub mod defs {
                    pub use crate::types::lexicon::{ArtistViewData, ReleaseViewData};
                }
            }
        }
    }
}
