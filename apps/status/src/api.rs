use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

use crate::{AppState, db};

pub async fn root() -> &'static str {
    "\n\
This is an AT Protocol API Server for Teal listening status.\n\
\n\
Most API routes are under /xrpc/\n\
\n\
  Health:   /health\n\
  Status:   /xrpc/fm.teal.actor.getStatus?actor=did:plc:...\n\
  Protocol: https://atproto.com\n\
"
}

pub async fn health() -> &'static str {
    "ok"
}

#[derive(Deserialize)]
pub struct GetStatusQuery {
    pub actor: Option<String>,
}

#[derive(Serialize)]
pub struct GetStatusResponse {
    pub did: String,
    #[serde(rename = "isListening")]
    pub is_listening: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<&'static str>,
}

pub async fn get_status(
    State(state): State<AppState>,
    Query(query): Query<GetStatusQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let actor = query
        .actor
        .as_deref()
        .map(str::trim)
        .filter(|actor| !actor.is_empty())
        .ok_or((StatusCode::BAD_REQUEST, "actor is required".to_string()))?;

    let did = db::resolve_actor(&state.db, &state.http_client, &state.handle_resolver, actor)
        .await
        .map_err(internal_error)?
        .ok_or((StatusCode::NOT_FOUND, "Actor not found".to_string()))?;

    let status = db::current_status(&state.db, &did)
        .await
        .map_err(internal_error)?;

    let response = match status {
        Some(status) => GetStatusResponse {
            did,
            is_listening: true,
            status: Some(status),
            message: None,
        },
        None => GetStatusResponse {
            did,
            is_listening: false,
            status: None,
            message: Some("Not listening to anything right now"),
        },
    };

    Ok(Json(response))
}

fn internal_error(error: anyhow::Error) -> (StatusCode, String) {
    tracing::error!(%error, "Status API request failed");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "Internal server error".to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::GetStatusResponse;

    #[test]
    fn inactive_response_explains_missing_status() {
        let response = GetStatusResponse {
            did: "did:plc:example".to_string(),
            is_listening: false,
            status: None,
            message: Some("Not listening to anything right now"),
        };

        let json = serde_json::to_value(response).expect("response should serialize");
        assert_eq!(json["isListening"], false);
        assert_eq!(json["message"], "Not listening to anything right now");
        assert!(json.get("status").is_none());
    }
}
