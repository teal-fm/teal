use axum::{extract::Query, http::StatusCode, response::IntoResponse, routing::get, Extension, Json};
use serde::Deserialize;

use crate::{ctx::Context, repos::listening::BadRequest};

pub fn listening_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.feed.getToday", get(get_today))
        .route("/fm.teal.feed.social.getReactions", get(get_reactions))
        .route("/fm.teal.actor.getTasteMatch", get(get_taste_match))
        .route(
            "/fm.teal.stats.getListeningCalendar",
            get(get_listening_calendar),
        )
}

#[derive(Deserialize)]
pub struct TodayQuery {
    pub viewer: Option<String>,
    pub tz: Option<String>,
    pub limit: Option<i32>,
}

#[derive(Deserialize)]
pub struct ReactionsQuery {
    pub subject: String,
    pub viewer: Option<String>,
    pub emoji: Option<String>,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Deserialize)]
pub struct TasteMatchQuery {
    pub actor: String,
    pub viewer: String,
}

#[derive(Deserialize)]
pub struct CalendarQuery {
    pub actor: String,
    pub from: String,
    pub to: String,
    pub tz: Option<String>,
}

pub async fn get_today(
    Extension(ctx): Extension<Context>,
    Query(query): Query<TodayQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_today(query.viewer.as_deref(), query.tz.as_deref(), query.limit)
        .await
        .map(Json)
        .map_err(to_response)
}

pub async fn get_reactions(
    Extension(ctx): Extension<Context>,
    Query(query): Query<ReactionsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_reactions(
            &query.subject,
            query.viewer.as_deref(),
            query.emoji.as_deref(),
            query.limit,
            query.cursor.as_deref(),
        )
        .await
        .map(Json)
        .map_err(to_response)
}

pub async fn get_taste_match(
    Extension(ctx): Extension<Context>,
    Query(query): Query<TasteMatchQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_taste_match(&query.actor, &query.viewer)
        .await
        .map(Json)
        .map_err(to_response)
}

pub async fn get_listening_calendar(
    Extension(ctx): Extension<Context>,
    Query(query): Query<CalendarQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    ctx.db
        .get_listening_calendar(&query.actor, &query.from, &query.to, query.tz.as_deref())
        .await
        .map(Json)
        .map_err(to_response)
}

fn to_response(error: anyhow::Error) -> (StatusCode, String) {
    if let Some(bad) = error.downcast_ref::<BadRequest>() {
        return (StatusCode::BAD_REQUEST, bad.to_string());
    }
    tracing::error!(?error, "listening request failed");
    (StatusCode::INTERNAL_SERVER_ERROR, "internal error".to_string())
}
