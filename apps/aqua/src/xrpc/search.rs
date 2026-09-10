use axum::{extract::Query, http::StatusCode, response::IntoResponse, routing::get, Extension};
use jacquard_common::types::string::Did;
use jacquard_common::IntoStatic;
use serde::Deserialize;
use types::fm_teal::search::get_results::GetResultsOutput;

use crate::ctx::Context;

pub fn search_routes() -> axum::Router {
    axum::Router::new().route("/fm.teal.search.getResults", get(get_results))
}

#[derive(Deserialize)]
pub struct GetResultsQuery {
    pub q: String,
    pub limit: Option<i32>,
    pub actor: Option<String>,
}

pub async fn get_results(
    Extension(ctx): Extension<Context>,
    Query(query): Query<GetResultsQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let query_text = query.q.trim();
    if query_text.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "q is required".to_string()));
    }
    if query_text.len() > 640 || query_text.chars().count() > 128 {
        return Err((
            StatusCode::BAD_REQUEST,
            "q exceeds the maximum length".to_string(),
        ));
    }

    let actor = query
        .actor
        .as_deref()
        .map(|actor| {
            Did::<String>::new_owned(actor)
                .map(|did| did.to_string())
                .map_err(|_| {
                    (
                        StatusCode::BAD_REQUEST,
                        "actor must be a valid DID".to_string(),
                    )
                })
        })
        .transpose()?;

    match ctx
        .db
        .search(query_text, query.limit, actor.as_deref())
        .await
    {
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
