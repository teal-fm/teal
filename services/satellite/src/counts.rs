use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct GlobalPlayCount {
    pub play_count: i64,
}

pub async fn get_global_play_count(
    State(state): State<AppState>,
) -> Result<Json<GlobalPlayCount>, (axum::http::StatusCode, String)> {
    let result = sqlx::query_as::<_, GlobalPlayCount>(
        "SELECT play_count FROM mv_global_play_count WHERE id = 1",
    )
    .fetch_one(&state.db_pool)
    .await;

    match result {
        Ok(count) => Ok(Json(count)),
        Err(e) => Err((
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )),
    }
}

const fn default_limit() -> i64 {
    12
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LatestPlayQueryParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

#[derive(FromRow, Debug, Deserialize, Serialize)]
pub struct Play {
    pub did: String,
    pub track_name: String,
    pub recording_mbid: Option<Uuid>,
    pub release_name: Option<String>,
    pub release_mbid: Option<Uuid>,
    pub duration: Option<i32>,
    pub played_time: Option<DateTime<Utc>>,
    pub uri: Option<String>,
    // MASSIVE HUGE HACK
    pub artists: Option<String>,
}

#[derive(FromRow, Debug, Deserialize, Serialize)]
pub struct PlayReturn {
    pub did: String,
    pub track_name: String,
    pub recording_mbid: Option<Uuid>,
    pub release_name: Option<String>,
    pub release_mbid: Option<Uuid>,
    pub duration: Option<i32>,
    pub played_time: Option<DateTime<Utc>>,
    pub uri: Option<String>,
    pub artists: Vec<Artist>,
}

#[derive(sqlx::Type, Debug, Deserialize, Serialize)]
pub struct Artist {
    pub artist_name: String,
    pub artist_mbid: Option<Uuid>,
}

pub async fn get_latest_plays(
    State(state): State<AppState>,
    Query(params): Query<LatestPlayQueryParams>,
) -> Result<Json<Vec<PlayReturn>>, (axum::http::StatusCode, String)> {
    if params.limit < 1 || params.limit > 50 {
        return Err((StatusCode::BAD_REQUEST, "Invalid limit".to_string()));
    }
    let result = sqlx::query_as!(
        Play,
        r#"
            SELECT
                p.did,
                p.track_name,
                -- TODO: replace with actual
                STRING_AGG(pa.artist_name || '|' || TEXT(pa.artist_mbid), ',') AS artists,
                p.release_name,
                p.played_time,
                p.duration,
                p.uri,
                p.recording_mbid,
                p.release_mbid

            FROM plays AS p
            LEFT JOIN play_to_artists AS pa ON pa.play_uri = p.uri
            GROUP BY p.did, p.track_name, p.release_name, p.played_time, p.duration, p.uri, p.recording_mbid, p.release_mbid
            ORDER BY p.played_time DESC
            LIMIT $1
        "#,
        params.limit
    )
    .fetch_all(&state.db_pool)
    .await;

    match result {
        Ok(counts) => {
            let fin: Vec<PlayReturn> = counts
                .into_iter()
                .map(|play| -> PlayReturn {
                    let artists = play
                        .artists
                        .expect("Artists found")
                        .split(',')
                        .map(|artist| {
                            let mut parts = artist.split('|');
                            Artist {
                                artist_name: parts
                                    .next()
                                    .expect("Artist name is required")
                                    .to_string(),
                                artist_mbid: parts
                                    .next()
                                    .and_then(|mbid| Uuid::parse_str(mbid).ok()),
                            }
                        })
                        .collect();
                    PlayReturn {
                        did: play.did.to_string(),
                        track_name: play.track_name,
                        recording_mbid: play.recording_mbid,
                        release_name: play.release_name,
                        release_mbid: play.release_mbid,
                        duration: play.duration,
                        played_time: play.played_time,
                        uri: play.uri,
                        artists,
                    }
                })
                .collect();

            Ok(Json(fin))
        }
        Err(e) => Err((
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )),
    }
}
