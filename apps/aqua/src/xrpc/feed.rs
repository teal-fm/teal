use crate::ctx::Context;
use axum::{http::StatusCode, response::IntoResponse, routing::get, Extension};
use jacquard_common::IntoStatic;
use serde::{Deserialize, Serialize};
use types::fm_teal::feed::PlayView;

// mount feed routes
pub fn feed_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.feed.getPlay", get(get_feed_play))
        .route("/fm.teal.feed.getActorFeed", get(get_actor_feed))
        .route("/fm.teal.feed.getPlays", get(get_feed_plays))
}

#[derive(Deserialize)]
pub struct GetFeedPlayQuery {
    #[serde(rename = "authorDID")]
    pub author_did: Option<String>,
    pub rkey: Option<String>,
    pub uri: Option<String>,
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
    let uri = match (query.uri, query.author_did, query.rkey) {
        (Some(uri), _, _) => uri,
        (None, Some(author_did), Some(rkey)) => {
            format!("at://{author_did}/fm.teal.feed.play/{rkey}")
        }
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                "uri or authorDID and rkey are required".to_string(),
            ));
        }
    };

    match repo.get_feed_play(&uri).await {
        Ok(Some(play)) => Ok(axum::Json(GetFeedPlayResponse {
            play: play.into_static(),
        })),
        Ok(None) => Err((StatusCode::NOT_FOUND, "Feed play not found".to_string())),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GetActorFeedQuery {
    #[serde(rename = "authorDID")]
    pub author_did: String,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct GetActorFeedResponse {
    plays: Vec<PlayView>,
    cursor: Option<String>,
}

pub async fn get_actor_feed(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetActorFeedQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let repo = &ctx.db;

    if query.author_did.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "authorDID is required".to_string()));
    }

    match repo
        .get_actor_feed(&query.author_did, query.limit, query.cursor.as_deref())
        .await
    {
        Ok(page) => Ok(axum::Json(GetActorFeedResponse {
            cursor: page.cursor,
            plays: page.plays.into_static(),
        })),
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
