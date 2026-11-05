//! Fills in actor views for accounts Aqua hasn't indexed a profile for.
//!
//! Every XRPC response that embeds an author or actor passes through here, so no
//! endpoint shows a post or a listen by a bare DID when the account's teal profile,
//! Bluesky profile, or handle can be found. See `crate::identity` for the lookup order.

use std::{collections::HashMap, sync::Arc};

use axum::{
    body::{Body, to_bytes},
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::Response,
};
use serde_json::{Map, Value, json};

use crate::identity::{ActorIdentity, ActorResolver};

/// Keys whose values are actor views (or lists of them) in teal's lexicons.
const ACTOR_KEYS: [&str; 5] = ["author", "actor", "actors", "listeners", "circleSample"];
/// Views that sit beside the DID they describe, and come back null when unindexed.
const VIEW_DIDS: [(&str, &str); 2] = [("author", "authorDid"), ("actor", "actorDid")];

pub async fn hydrate_actors(
    State(resolver): State<Arc<ActorResolver>>,
    request: Request,
    next: Next,
) -> Response {
    let xrpc = request.uri().path().starts_with("/xrpc/");
    let response = next.run(request).await;
    let json = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("application/json"));
    if !xrpc || !json || !response.status().is_success() {
        return response;
    }

    let (mut parts, body) = response.into_parts();
    // XRPC bodies are serialized JSON already in memory, so buffering costs nothing extra.
    let Ok(bytes) = to_bytes(body, usize::MAX).await else {
        // The handler's body failed mid-stream; say so rather than send a truncated 200.
        let mut response = Response::new(Body::from("response body failed"));
        *response.status_mut() = StatusCode::BAD_GATEWAY;
        return response;
    };
    let Ok(mut value) = serde_json::from_slice::<Value>(&bytes) else {
        return Response::from_parts(parts, Body::from(bytes));
    };

    let mut dids = Vec::new();
    let created = collect(&mut value, &mut dids);
    let found = if dids.is_empty() {
        HashMap::new()
    } else {
        resolver.resolve(dids).await
    };
    if !created && found.is_empty() {
        return Response::from_parts(parts, Body::from(bytes));
    }
    fill(&mut value, &found);
    match serde_json::to_vec(&value) {
        Ok(body) => {
            parts.headers.remove(header::CONTENT_LENGTH);
            Response::from_parts(parts, Body::from(body))
        }
        Err(_) => Response::from_parts(parts, Body::from(bytes)),
    }
}

/// Gives every null author or actor a DID-only view, and gathers the DIDs of views
/// missing a handle or name. Returns whether it added any views.
fn collect(value: &mut Value, dids: &mut Vec<String>) -> bool {
    let mut created = false;
    match value {
        Value::Array(items) => {
            for item in items {
                created |= collect(item, dids);
            }
        }
        Value::Object(map) => {
            for (view, did_key) in VIEW_DIDS {
                if map.get(view).is_none_or(Value::is_null)
                    && let Some(did) = map.get(did_key).and_then(Value::as_str)
                {
                    let did = did.to_string();
                    map.insert(view.to_string(), json!({ "did": did }));
                    created = true;
                }
            }
            for key in ACTOR_KEYS {
                for actor in actors(map.get(key)) {
                    if let Some(did) = needs_identity(actor)
                        && !dids.iter().any(|known| known == did)
                    {
                        dids.push(did.to_string());
                    }
                }
            }
            for child in map.values_mut() {
                created |= collect(child, dids);
            }
        }
        _ => {}
    }
    created
}

fn fill(value: &mut Value, found: &HashMap<String, ActorIdentity>) {
    match value {
        Value::Array(items) => items.iter_mut().for_each(|item| fill(item, found)),
        Value::Object(map) => {
            for key in ACTOR_KEYS {
                match map.get_mut(key) {
                    Some(Value::Object(actor)) => fill_actor(actor, found),
                    Some(Value::Array(list)) => list
                        .iter_mut()
                        .filter_map(Value::as_object_mut)
                        .for_each(|actor| fill_actor(actor, found)),
                    _ => {}
                }
            }
            map.values_mut().for_each(|child| fill(child, found));
        }
        _ => {}
    }
}

fn actors(value: Option<&Value>) -> Vec<&Map<String, Value>> {
    match value {
        Some(Value::Object(actor)) => vec![actor],
        Some(Value::Array(list)) => list.iter().filter_map(Value::as_object).collect(),
        _ => Vec::new(),
    }
}

fn needs_identity(actor: &Map<String, Value>) -> Option<&str> {
    let did = actor.get("did")?.as_str()?;
    let missing = |key: &str| actor.get(key).and_then(Value::as_str).is_none_or(str::is_empty);
    (missing("handle") || missing("displayName")).then_some(did)
}

fn fill_actor(actor: &mut Map<String, Value>, found: &HashMap<String, ActorIdentity>) {
    let Some(identity) = actor
        .get("did")
        .and_then(Value::as_str)
        .and_then(|did| found.get(did))
    else {
        return;
    };
    for (key, value) in [
        ("handle", &identity.handle),
        ("displayName", &identity.display_name),
        ("avatar", &identity.avatar),
    ] {
        let missing = actor.get(key).and_then(Value::as_str).is_none_or(str::is_empty);
        if missing && let Some(value) = value {
            actor.insert(key.to_string(), Value::String(value.clone()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gives_unindexed_authors_a_view_and_asks_for_them() {
        let mut feed = json!({
            "items": [
                { "authorDid": "did:plc:unindexed", "author": null, "text": "Wait that's a banger" },
                { "authorDid": "did:plc:known", "author": { "did": "did:plc:known", "handle": "known.test", "displayName": "Known" } }
            ]
        });
        let mut dids = Vec::new();
        assert!(collect(&mut feed, &mut dids));
        assert_eq!(dids, vec!["did:plc:unindexed".to_string()]);
        assert_eq!(feed["items"][0]["author"], json!({ "did": "did:plc:unindexed" }));
    }

    #[test]
    fn fills_only_missing_fields_in_nested_lists() {
        let mut listening = json!({
            "items": [{ "listeners": [{ "did": "did:plc:a", "displayName": "Their teal name" }] }]
        });
        let found = HashMap::from([(
            "did:plc:a".to_string(),
            ActorIdentity {
                handle: Some("a.test".into()),
                display_name: Some("Bluesky name".into()),
                avatar: Some("https://cdn.bsky.app/img/avatar/plain/did:plc:a/bafk@jpeg".into()),
            },
        )]);
        fill(&mut listening, &found);
        let listener = &listening["items"][0]["listeners"][0];
        assert_eq!(listener["displayName"], "Their teal name");
        assert_eq!(listener["handle"], "a.test");
        assert!(listener["avatar"].as_str().is_some());
    }

    #[test]
    fn leaves_complete_views_and_other_dids_alone() {
        let mut body = json!({
            "actor": { "did": "did:plc:x", "handle": "x.test", "displayName": "X" },
            "subject": { "did": "did:plc:not-an-actor-view" }
        });
        let mut dids = Vec::new();
        assert!(!collect(&mut body, &mut dids));
        assert!(dids.is_empty());
    }
}
