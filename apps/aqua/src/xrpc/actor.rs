use crate::ctx::Context;
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use serde::Deserialize;
use types::fm_teal::actor::get_profile::GetProfileOutput;
use types::fm_teal::actor::get_profiles::GetProfilesOutput;

// mount actor routes
pub fn actor_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.actor.getProfile", get(get_actor))
        .route("/fm.teal.actor.getProfiles", get(get_actors))
}

#[derive(Deserialize)]
pub struct GetProfileQuery {
    pub actor: Option<String>,
}

pub async fn get_actor(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetProfileQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db; // assuming ctx.db is Box<dyn ActorProfileRepo + Send + Sync>
    let identity = query
        .actor
        .as_deref()
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "actor is required".to_string()))?;

    let mut found = repo.get_actor_profile(identity).await;
    // An account Cadet hasn't seen a profile for may still have one on its PDS. A row
    // with no created_at holds only a handle or status, not a teal profile record.
    let unindexed = match &found {
        Ok(None) => identity.starts_with("did:").then(|| identity.to_string()),
        Ok(Some(profile)) if profile.created_at.is_none() => profile
            .did
            .as_ref()
            .map(|did| did.to_string())
            .or_else(|| identity.starts_with("did:").then(|| identity.to_string())),
        _ => None,
    };
    // Bounded like feed lookups, so a slow PDS can't hold the profile page; the
    // backfill carries on in the background either way.
    if let Some(did) = unindexed
        && ctx.actors.backfill_within_wait(&did).await
    {
        found = repo.get_actor_profile(identity).await;
    }

    match found {
        Ok(Some(profile)) => Ok(axum::Json(GetProfileOutput {
            extra_data: Default::default(),
            profile: profile.into_static(),
        })),
        // No teal profile anywhere: the app shows the Bluesky profile, or the DID.
        Ok(None) => Err((StatusCode::NOT_FOUND, "Profile not found".to_string())),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetProfilesQuery {
    pub actors: Vec<String>,
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

    match repo.get_multiple_actor_profiles(actor).await {
        Ok(profiles) => Ok(axum::Json(GetProfilesOutput {
            extra_data: Default::default(),
            profiles: profiles.into_static(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
