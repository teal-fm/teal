use crate::ctx::Context;
use axum::{http::StatusCode, response::IntoResponse, routing::get, Extension};
use jacquard_common::IntoStatic;
use serde::{Deserialize, Serialize};
use types::fm_teal::actor::MiniProfileView;

pub fn graph_routes() -> axum::Router {
    axum::Router::new()
        .route("/fm.teal.graph.getSummary", get(get_summary))
        .route("/fm.teal.graph.getFollowers", get(get_followers))
        .route("/fm.teal.graph.getFollows", get(get_follows))
}

#[derive(Deserialize)]
pub struct GraphSummaryQuery {
    pub actor: String,
    pub viewer: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphSummaryResponse {
    followers_count: i64,
    follows_count: i64,
    viewer_following: Option<String>,
}

pub async fn get_summary(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GraphSummaryQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match ctx
        .db
        .get_graph_summary(&query.actor, query.viewer.as_deref())
        .await
    {
        Ok(summary) => Ok(axum::Json(GraphSummaryResponse {
            followers_count: summary.followers_count,
            follows_count: summary.follows_count,
            viewer_following: summary.viewer_following,
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct GraphListQuery {
    pub actor: String,
    pub limit: Option<i32>,
    pub cursor: Option<String>,
}

#[derive(Serialize)]
pub struct GraphListResponse {
    actors: Vec<MiniProfileView>,
    cursor: Option<String>,
}

pub async fn get_followers(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GraphListQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match ctx
        .db
        .get_followers(&query.actor, query.limit, query.cursor.as_deref())
        .await
    {
        Ok(page) => Ok(axum::Json(GraphListResponse {
            actors: page.actors.into_static(),
            cursor: page.cursor,
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

pub async fn get_follows(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GraphListQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if query.actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    match ctx
        .db
        .get_follows(&query.actor, query.limit, query.cursor.as_deref())
        .await
    {
        Ok(page) => Ok(axum::Json(GraphListResponse {
            actors: page.actors.into_static(),
            cursor: page.cursor,
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
