pub mod actor_profile;
pub mod actor_status;
pub mod feed_play;

use serde_json::Value;

pub const STABLE_FEED_PLAY: &str = "fm.teal.feed.play";
pub const STABLE_ACTOR_PROFILE: &str = "fm.teal.actor.profile";
pub const STABLE_ACTOR_STATUS: &str = "fm.teal.actor.status";

pub const ALPHA_FEED_PLAY: &str = "fm.teal.alpha.feed.play";
pub const ALPHA_ACTOR_PROFILE: &str = "fm.teal.alpha.actor.profile";
pub const ALPHA_ACTOR_STATUS: &str = "fm.teal.alpha.actor.status";

/// Normalize the root record namespace used by historical Teal records.
pub fn normalize_legacy_record_type(data: &Value) -> Value {
    let Value::Object(object) = data else {
        return data.clone();
    };

    let mut normalized = object.clone();
    if let Some(Value::String(record_type)) = normalized.get_mut("$type") {
        if let Some(stable_type) = record_type.strip_prefix("fm.teal.alpha.") {
            *record_type = format!("fm.teal.{stable_type}");
        }
    }

    Value::Object(normalized)
}

const COLLECTION_ALIASES: [(&str, &str); 3] = [
    (ALPHA_FEED_PLAY, STABLE_FEED_PLAY),
    (ALPHA_ACTOR_PROFILE, STABLE_ACTOR_PROFILE),
    (ALPHA_ACTOR_STATUS, STABLE_ACTOR_STATUS),
];

pub fn canonical_collection(collection: &str) -> &str {
    COLLECTION_ALIASES
        .iter()
        .find_map(|(alias, stable)| (*alias == collection).then_some(*stable))
        .unwrap_or(collection)
}

pub fn wanted_collections() -> Vec<String> {
    [
        STABLE_FEED_PLAY,
        STABLE_ACTOR_PROFILE,
        STABLE_ACTOR_STATUS,
        ALPHA_FEED_PLAY,
        ALPHA_ACTOR_PROFILE,
        ALPHA_ACTOR_STATUS,
        "com.atproto.repo.importRepo",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

/// Parses an AT uri into parts:
/// did/handle, collection, rkey
// fn parse_at_parts(aturi: &str) -> (&str, Option<&str>, Option<&str>) {
//     // example: at://did:plc:k644h4rq5bjfzcetgsa6tuby/fm.teal.feed.play/3liubcmz4sy2a
//     let split: Vec<&str> = aturi.split('/').collect();
//     let did = split.get(2).unwrap_or(&"").clone();
//     let collection = split.get(4).map(|s| *s).clone();
//     let rkey = split.get(5).map(|s| *s).clone();
//     (did, collection, rkey)
// }
pub fn assemble_at_uri(did: &str, collection: &str, rkey: &str) -> String {
    format!("at://{did}/{collection}/{rkey}")
}

#[cfg(test)]
mod tests {
    use super::{canonical_collection, wanted_collections};

    #[test]
    fn canonicalizes_alpha_collections_to_stable_names() {
        for (alpha, stable) in [
            ("fm.teal.alpha.feed.play", "fm.teal.feed.play"),
            ("fm.teal.alpha.actor.profile", "fm.teal.actor.profile"),
            ("fm.teal.alpha.actor.status", "fm.teal.actor.status"),
        ] {
            assert_eq!(canonical_collection(alpha), stable);
        }
    }

    #[test]
    fn wanted_collections_include_stable_and_alpha_records() {
        let wanted = wanted_collections();

        for collection in [
            "fm.teal.feed.play",
            "fm.teal.actor.profile",
            "fm.teal.actor.status",
            "fm.teal.alpha.feed.play",
            "fm.teal.alpha.actor.profile",
            "fm.teal.alpha.actor.status",
        ] {
            assert!(wanted.iter().any(|wanted| wanted == collection));
        }
    }
}
