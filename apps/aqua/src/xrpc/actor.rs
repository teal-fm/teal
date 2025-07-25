use crate::ctx::Context;
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use serde::{Deserialize, Serialize};
use types::fm::teal::alpha::actor::defs::ProfileViewData;

// mount actor routes
pub fn actor_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.alpha.actor.getProfile", get(get_actor))
        .route("/fm.teal.alpha.actor.getProfiles", get(get_actors))
}

#[derive(Deserialize)]
pub struct GetProfileQuery {
    pub actor: Option<String>,
}

#[derive(Serialize)]
pub struct GetProfileResponse {
    profile: ProfileViewData,
}

pub async fn get_actor(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetProfileQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db; // assuming ctx.db is Box<dyn ActorProfileRepo + Send + Sync>
    let identity = &query.actor;

    if identity.is_none() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match repo
        .get_actor_profile(identity.as_ref().expect("actor is not none").as_str())
        .await
    {
        Ok(Some(profile)) => Ok(axum::Json(GetProfileResponse { profile })),
        Ok(None) => Err((StatusCode::NOT_FOUND, "Profile not found".to_string())),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetProfilesQuery {
    pub actors: Vec<String>,
}

#[derive(Serialize)]
pub struct GetProfilesResponse {
    profiles: Vec<ProfileViewData>,
}

pub async fn get_actors(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetProfilesQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db; // assuming ctx.db is Box<dyn ActorProfileRepo + Send + Sync>
    let actor = &query.actors;

    if actor.len() == 0 {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match repo.get_multiple_actor_profiles(actor).await {
        Ok(profiles) => Ok(axum::Json(GetProfilesResponse { profiles })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
