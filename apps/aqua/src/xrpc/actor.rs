use crate::ctx::Context;
use axum::{http::StatusCode, response::IntoResponse, routing::get, Extension};
use jacquard_common::IntoStatic;
use serde::{Deserialize, Serialize};
use types::fm_teal::actor::{MiniProfileView, ProfileView};

// mount actor routes
pub fn actor_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.actor.getProfile", get(get_actor))
        .route("/fm.teal.actor.getProfiles", get(get_actors))
        .route("/fm.teal.actor.searchActors", get(search_actors))
}

#[derive(Deserialize)]
pub struct GetProfileQuery {
    pub actor: Option<String>,
}

#[derive(Serialize)]
pub struct GetProfileResponse {
    actor: ProfileView,
}

pub async fn get_actor(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetProfileQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db; // assuming ctx.db is Box<dyn ActorProfileRepo + Send + Sync>
    let identity = match query.actor.as_deref() {
        Some(identity) => identity,
        None => return Err((StatusCode::BAD_REQUEST, "actor is required".to_string())),
    };

    match repo.get_actor_profile(identity).await {
        Ok(Some(profile)) => Ok(axum::Json(GetProfileResponse {
            actor: profile.into_static(),
        })),
        Ok(None) => Err((StatusCode::NOT_FOUND, "Profile not found".to_string())),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct SearchActorsQuery {
    pub q: String,
    pub limit: Option<i64>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct SearchActorsResponse {
    actors: Vec<MiniProfileView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cursor: Option<String>,
}

pub async fn search_actors(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<SearchActorsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if query.q.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "q is required".to_string()));
    }

    let limit = query.limit.unwrap_or(25);
    if !(1..=25).contains(&limit) {
        return Err((
            StatusCode::BAD_REQUEST,
            "limit must be between 1 and 25".to_string(),
        ));
    }
    let offset = query
        .cursor
        .as_deref()
        .unwrap_or("0")
        .parse::<i64>()
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                "cursor must be a non-negative integer".to_string(),
            )
        })?;
    if offset < 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "cursor must be a non-negative integer".to_string(),
        ));
    }

    let next_offset = offset.checked_add(limit).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "cursor is out of range".to_string(),
        )
    })?;
    let mut actors = ctx
        .db
        .search_actor_profiles(query.q.trim(), limit + 1, offset)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let cursor = if actors.len() > limit as usize {
        actors.truncate(limit as usize);
        Some(next_offset.to_string())
    } else {
        None
    };

    Ok(axum::Json(SearchActorsResponse {
        actors: actors.into_static(),
        cursor,
    }))
}

#[derive(Deserialize)]
pub struct GetProfilesQuery {
    pub actors: Vec<String>,
}

#[derive(Serialize)]
pub struct GetProfilesResponse {
    actors: Vec<MiniProfileView>,
}

pub async fn get_actors(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetProfilesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db; // assuming ctx.db is Box<dyn ActorProfileRepo + Send + Sync>
    let actor = &query.actors;

    if actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match repo.get_multiple_actor_mini_profiles(actor).await {
        Ok(actors) => Ok(axum::Json(GetProfilesResponse {
            actors: actors.into_static(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
