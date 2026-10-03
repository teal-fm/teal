use crate::ctx::Context;
use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use jacquard_common::types::string::AtUri;
use serde::Deserialize;
use types::fm_teal::graph::{
    get_followers::GetFollowersOutput, get_follows::GetFollowsOutput, get_summary::GetSummaryOutput,
};

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
        Ok(summary) => Ok(axum::Json(GetSummaryOutput {
            extra_data: Default::default(),
            followers_count: summary.followers_count,
            follows_count: summary.follows_count,
            viewer_following: summary
                .viewer_following
                .map(AtUri::<jacquard_common::DefaultStr>::new_owned)
                .transpose()
                .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?,
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
        Ok(page) => Ok(axum::Json(GetFollowersOutput {
            extra_data: Default::default(),
            actors: page.actors.into_static(),
            cursor: page.cursor.map(Into::into),
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
        Ok(page) => Ok(axum::Json(GetFollowsOutput {
            extra_data: Default::default(),
            actors: page.actors.into_static(),
            cursor: page.cursor.map(Into::into),
        })),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}
