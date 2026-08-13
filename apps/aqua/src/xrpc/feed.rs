use crate::ctx::Context;
use axum::{http::StatusCode, response::IntoResponse, routing::get, Extension};
use jacquard_common::IntoStatic;
use serde::{Deserialize, Serialize};
use types::fm_teal::feed::PlayView;

// mount feed routes
pub fn feed_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.feed.getPlay", get(get_feed_play))
        .route("/fm.teal.feed.getPlays", get(get_feed_plays))
        .route("/fm.teal.feed.getActorFeed", get(get_actor_feed))
}

#[derive(Deserialize)]
pub struct GetFeedPlayQuery {
    #[serde(rename = "authorDID")]
    pub author_did: Option<String>,
    pub rkey: Option<String>,
}

#[derive(Serialize)]
pub struct GetFeedPlayResponse {
    play: PlayView,
}

pub async fn get_feed_play(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetFeedPlayQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;
    let (author_did, rkey) = match (query.author_did.as_deref(), query.rkey.as_deref()) {
        (Some(author_did), Some(rkey)) if !author_did.is_empty() && !rkey.is_empty() => {
            (author_did, rkey)
        }
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                "authorDID and rkey are required".to_string(),
            ));
        }
    };
    let identity = format!("at://{author_did}/fm.teal.feed.play/{rkey}");

    match repo.get_feed_play(&identity).await {
        Ok(Some(play)) => Ok(axum::Json(GetFeedPlayResponse {
            play: play.into_static(),
        })),
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
    plays: Vec<PlayView>,
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
        Ok(plays) => Ok(axum::Json(GetFeedPlaysResponse {
            plays: plays.into_static(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetActorFeedQuery {
    #[serde(rename = "authorDID")]
    pub author_did: String,
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct GetActorFeedResponse {
    plays: Vec<PlayView>,
}

pub async fn get_actor_feed(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetActorFeedQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if !query.author_did.starts_with("did:") {
        return Err((
            StatusCode::BAD_REQUEST,
            "authorDID must be a DID".to_string(),
        ));
    }

    let limit = query.limit.unwrap_or(20);
    if !(1..=50).contains(&limit) {
        return Err((
            StatusCode::BAD_REQUEST,
            "limit must be between 1 and 50".to_string(),
        ));
    }
    let limit = limit as usize;
    let offset = query
        .cursor
        .as_deref()
        .unwrap_or("0")
        .parse::<usize>()
        .map_err(|_| (StatusCode::BAD_REQUEST, "cursor is invalid".to_string()))?;

    match ctx
        .db
        .get_feed_plays_for_profile(std::slice::from_ref(&query.author_did))
        .await
    {
        Ok(plays) => Ok(axum::Json(GetActorFeedResponse {
            plays: plays.into_iter().skip(offset).take(limit).collect(),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
