use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use types::fm_teal::actor::get_status::{GetStatus, GetStatusOutput};

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

pub async fn get_status(
    State(state): State<AppState>,
    Query(query): Query<GetStatus>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let actor = query.actor.trim();
    if actor.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "actor is required".to_string()));
    }

    let (did, status) = retrieve_status(&state, actor)
        .await
        .map_err(internal_error)?
        .ok_or((StatusCode::NOT_FOUND, "Actor not found".to_string()))?;

    let response = match status {
        Some(status) => GetStatusOutput {
            did: did.into(),
            is_listening: true,
            status: Some(
                serde_json::from_value(status).map_err(|error| internal_error(error.into()))?,
            ),
            message: None,
            extra_data: None,
        },
        None => GetStatusOutput {
            did: did.into(),
            is_listening: false,
            status: None,
            message: Some("Not listening to anything right now".into()),
            extra_data: None,
        },
    };

    Ok(Json(response))
}

async fn retrieve_status(
    state: &AppState,
    actor: &str,
) -> anyhow::Result<Option<(String, Option<serde_json::Value>)>> {
    let Some(did) =
        db::resolve_actor(&state.db, &state.http_client, &state.handle_resolver, actor).await?
    else {
        return Ok(None);
    };

    let status = db::current_status(&state.db, &did).await?;
    Ok(Some((did, status)))
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
    use super::GetStatusOutput;

    #[test]
    fn inactive_response_explains_missing_status() {
        let response = GetStatusOutput {
            did: "did:plc:example".to_string().into(),
            is_listening: false,
            status: None,
            message: Some("Not listening to anything right now".into()),
            extra_data: None,
        };

        let json = serde_json::to_value(response).expect("response should serialize");
        assert_eq!(json["isListening"], false);
        assert_eq!(json["message"], "Not listening to anything right now");
        assert!(json.get("status").is_none());
    }
}
