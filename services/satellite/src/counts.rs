use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::types::Json as SqlxJson;
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
        "SELECT total_plays AS play_count FROM mv_global_play_count",
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

#[derive(FromRow, Debug)]
pub struct Play {
    pub did: String,
    pub track_name: String,
    pub recording_mbid: Option<Uuid>,
    pub release_name: Option<String>,
    pub release_mbid: Option<Uuid>,
    pub duration: Option<i32>,
    pub uri: Option<String>,
    pub artists: SqlxJson<Value>,
}

#[derive(FromRow, Debug, Deserialize, Serialize)]
pub struct PlayReturn {
    pub did: String,
    pub track_name: String,
    pub recording_mbid: Option<Uuid>,
    pub release_name: Option<String>,
    pub release_mbid: Option<Uuid>,
    pub duration: Option<i32>,
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
    let result = sqlx::query_as::<_, Play>(
        r#"
            SELECT
                p.did,
                p.track_name,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'artist_name', ptae.artist_name,
                            'artist_mbid', ae.mbid
                        )
                        ORDER BY ptae.artist_name
                    ) FILTER (WHERE ptae.artist_name IS NOT NULL),
                    '[]'::json
                ) AS artists,
                p.release_name,
                p.duration,
                p.uri,
                p.recording_mbid,
                p.release_mbid

            FROM plays AS p
            LEFT JOIN play_to_artists_extended AS ptae ON ptae.play_uri = p.uri
            LEFT JOIN artists_extended AS ae ON ae.id = ptae.artist_id
            GROUP BY p.did, p.track_name, p.release_name, p.played_time, p.duration, p.uri, p.recording_mbid, p.release_mbid
            ORDER BY COALESCE(p.played_time, p.processed_time) DESC, p.uri DESC
            LIMIT $1
        "#,
    )
    .bind(params.limit)
    .fetch_all(&state.db_pool)
    .await;

    match result {
        Ok(counts) => {
            let fin = counts
                .into_iter()
                .map(|play| {
                    let artists = serde_json::from_value(play.artists.0).map_err(|error| {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            format!("Invalid artist data returned by database: {error}"),
                        )
                    })?;
                    Ok(PlayReturn {
                        did: play.did.to_string(),
                        track_name: play.track_name,
                        recording_mbid: play.recording_mbid,
                        release_name: play.release_name,
                        release_mbid: play.release_mbid,
                        duration: play.duration,
                        uri: play.uri,
                        artists,
                    })
                })
                .collect::<Result<Vec<_>, _>>()?;

            Ok(Json(fin))
        }
        Err(e) => Err((
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::Artist;
    use uuid::Uuid;

    #[test]
    fn deserializes_artist_names_with_legacy_delimiters() {
        let mbid = Uuid::nil();
        let artists: Vec<Artist> = serde_json::from_value(serde_json::json!([
            {"artist_name": "AC/DC, Live | Remastered", "artist_mbid": mbid}
        ]))
        .unwrap();

        assert_eq!(artists.len(), 1);
        assert_eq!(artists[0].artist_name, "AC/DC, Live | Remastered");
        assert_eq!(artists[0].artist_mbid, Some(mbid));
    }
}
