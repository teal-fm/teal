use crate::{ctx::Context, repos::social::Page};
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use serde::{Deserialize, Serialize};

pub fn social_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.alpha.feed.social.getFeed", get(get_feed))
        .route("/fm.teal.alpha.feed.social.getPost", get(get_post))
        .route("/fm.teal.alpha.feed.social.getReplies", get(get_replies))
        .route("/fm.teal.alpha.feed.social.getLikes", get(get_likes))
        .route("/fm.teal.alpha.feed.social.getReposts", get(get_reposts))
        .route(
            "/fm.teal.alpha.feed.social.getActorPlaylists",
            get(get_actor_playlists),
        )
        .route("/fm.teal.alpha.feed.social.getPlaylist", get(get_playlist))
        .route(
            "/fm.teal.alpha.feed.social.getBadgeCatalog",
            get(get_badge_catalog),
        )
        .route(
            "/fm.teal.alpha.feed.social.getActorBadges",
            get(get_actor_badges),
        )
        .route(
            "/fm.teal.alpha.feed.social.getNotifications",
            get(get_notifications),
        )
}

#[derive(Deserialize)]
pub struct PageQuery {
    pub limit: Option<i32>,
    pub cursor: Option<String>,
    pub viewer: Option<String>,
    pub actor: Option<String>,
}

#[derive(Deserialize)]
pub struct UriPageQuery {
    pub uri: String,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
    pub viewer: Option<String>,
}

#[derive(Deserialize)]
pub struct ActorPageQuery {
    pub actor: String,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct PageResponse<T> {
    items: Vec<T>,
    cursor: Option<String>,
}

impl<T> From<Page<T>> for PageResponse<T> {
    fn from(page: Page<T>) -> Self {
        Self {
            items: page.items,
            cursor: page.cursor,
        }
    }
}

#[derive(Serialize)]
pub struct PostResponse<T> {
    post: T,
}

#[derive(Serialize)]
pub struct PlaylistResponse<T, U> {
    playlist: T,
    items: Vec<U>,
    cursor: Option<String>,
}

pub async fn get_feed(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<PageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_social_feed(
            query.limit,
            query.cursor.as_deref(),
            query.viewer.as_deref(),
            query.actor.as_deref(),
        )
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

pub async fn get_post(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<UriPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    match ctx.db.get_post(&query.uri, query.viewer.as_deref()).await {
        Ok(Some(post)) => Ok(axum::Json(PostResponse { post })),
        Ok(None) => Err((StatusCode::NOT_FOUND, "post not found".to_string())),
        Err(e) => Err(internal_error(e)),
    }
}

pub async fn get_replies(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<UriPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_post_replies(
            &query.uri,
            query.limit,
            query.cursor.as_deref(),
            query.viewer.as_deref(),
        )
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

pub async fn get_likes(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<UriPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_post_likes(&query.uri, query.limit, query.cursor.as_deref())
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

pub async fn get_reposts(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<UriPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_post_reposts(&query.uri, query.limit, query.cursor.as_deref())
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

pub async fn get_actor_playlists(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<ActorPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_actor_playlists(&query.actor, query.limit, query.cursor.as_deref())
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

pub async fn get_playlist(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<UriPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    match ctx
        .db
        .get_playlist(&query.uri, query.limit, query.cursor.as_deref())
        .await
    {
        Ok(Some((playlist, page))) => Ok(axum::Json(PlaylistResponse {
            playlist,
            items: page.items,
            cursor: page.cursor,
        })),
        Ok(None) => Err((StatusCode::NOT_FOUND, "playlist not found".to_string())),
        Err(e) => Err(internal_error(e)),
    }
}

pub async fn get_badge_catalog(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<PageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_badge_catalog(query.limit, query.cursor.as_deref())
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

pub async fn get_actor_badges(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<ActorPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_actor_badges(&query.actor, query.limit, query.cursor.as_deref())
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

pub async fn get_notifications(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<ActorPageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_notifications(&query.actor, query.limit, query.cursor.as_deref())
        .await
        .map(PageResponse::from)
        .map(axum::Json)
        .map_err(internal_error)
}

fn internal_error(error: anyhow::Error) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
}
