use crate::ctx::Context;
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use serde::{Deserialize, Serialize};
use types::fm::teal::alpha::feed::defs::PlayViewData;

// mount feed routes
pub fn feed_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.alpha.feed.getPlay", get(get_feed_play))
        .route("/fm.teal.alpha.feed.getPlays", get(get_feed_plays))
}

#[derive(Deserialize)]
pub struct GetFeedPlayQuery {
    pub identity: Option<String>,
}

#[derive(Serialize)]
pub struct GetFeedPlayResponse {
    play: PlayViewData,
}

pub async fn get_feed_play(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetFeedPlayQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;
    let identity = &query.identity;

    if identity.is_none() {
        return Err((StatusCode::BAD_REQUEST, "identity is required".to_string()));
    }

    match repo
        .get_feed_play(identity.as_ref().expect("identity is not none").as_str())
        .await
    {
        Ok(Some(play)) => Ok(axum::Json(GetFeedPlayResponse { play })),
        Ok(None) => Err((StatusCode::NOT_FOUND, "Feed play not found".to_string())),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetFeedPlaysQuery {
    pub identities: Vec<String>,
}

#[derive(Serialize)]
pub struct GetFeedPlaysResponse {
    plays: Vec<PlayViewData>,
}

pub async fn get_feed_plays(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetFeedPlaysQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db; // assuming ctx.db is Box<dyn FeedPlayRepo + Send + Sync>
    let identities = &query.identities;

    if identities.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "identities is required".to_string(),
        ));
    }

    match repo.get_feed_plays_for_profile(identities).await {
        Ok(plays) => Ok(axum::Json(GetFeedPlaysResponse { plays })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
