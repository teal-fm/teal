use axum::{Extension, http::StatusCode, response::IntoResponse, routing::get};
use jacquard_common::IntoStatic;
use serde::Deserialize;
use types::fm_teal::alpha::search::get_results::GetResultsOutput;

use crate::ctx::Context;

pub fn search_routes() -> axum::Router {
    axum::Router::new().route("/fm.teal.alpha.search.getResults", get(get_results))
}

#[derive(Deserialize)]
pub struct GetResultsQuery {
    pub q: String,
    pub limit: Option<i32>,
}

pub async fn get_results(
    Extension(ctx): Extension<Context>,
    axum::extract::Query(query): axum::extract::Query<GetResultsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let query_text = query.q.trim();
    if query_text.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "q is required".to_string()));
    }

    match ctx.db.search(query_text, query.limit).await {
        Ok(results) => Ok(axum::Json(
            GetResultsOutput {
                users: results.users,
                songs: results.songs,
                artists: results.artists,
                albums: results.albums,
                extra_data: Default::default(),
            }
            .into_static(),
        )),
        Err(error) => Err((StatusCode::INTERNAL_SERVER_ERROR, error.to_string())),
    }
}
