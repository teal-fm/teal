use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::AppState;

// Struct to hold the total user count.
#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct TotalUsers {
    pub total_users: i64,
}

// Endpoint to get the total number of users.
pub async fn get_total_users(
    State(state): State<AppState>,
) -> Result<Json<TotalUsers>, (StatusCode, String)> {
    let total_users_result =
        sqlx::query_as::<_, TotalUsers>("SELECT COUNT(*) as total_users FROM profiles")
            .fetch_one(&state.db_pool)
            .await;

    match total_users_result {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error (total users): {}", e),
        )),
    }
}

// Struct to represent a latest signup.  Optional fields are now used.
#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct LatestSignup {
    pub did: String,
    pub display_name: Option<String>, // Now optional
    pub handle: Option<String>,
    pub created_at: Option<DateTime<Utc>>, // Now optional
    pub avatar: Option<String>,            // Now optional
    pub banner: Option<String>,            // Now optional
}

const fn default_limit() -> i64 {
    12
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LatestSignupQueryParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

// Endpoint to get the latest signups.
pub async fn get_latest_signups(
    State(state): State<AppState>,
    Query(params): Query<LatestSignupQueryParams>,
) -> Result<Json<Vec<LatestSignup>>, (StatusCode, String)> {
    if params.limit < 1 || params.limit > 50 {
        return Err((StatusCode::BAD_REQUEST, "Invalid limit".to_string()));
    }

    let latest_signups_result = sqlx::query_as::<_, LatestSignup>(
        "SELECT did, display_name, handle, created_at, avatar, banner FROM profiles ORDER BY created_at DESC LIMIT $1",
    )
    .bind(params.limit)
    .fetch_all(&state.db_pool)
    .await;

    match latest_signups_result {
        Ok(signups) => Ok(Json(signups)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error (latest signups): {}", e),
        )),
    }
}
