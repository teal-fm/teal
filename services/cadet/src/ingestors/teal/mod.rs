pub mod actor_profile;
pub mod actor_status;
pub mod feed_play;

/// Parses an AT uri into parts:
/// did/handle, collection, rkey
// fn parse_at_parts(aturi: &str) -> (&str, Option<&str>, Option<&str>) {
//     // example: at://did:plc:k644h4rq5bjfzcetgsa6tuby/fm.teal.alpha.feed.play/3liubcmz4sy2a
//     let split: Vec<&str> = aturi.split('/').collect();
//     let did = split.get(2).unwrap_or(&"").clone();
//     let collection = split.get(4).map(|s| *s).clone();
//     let rkey = split.get(5).map(|s| *s).clone();
//     (did, collection, rkey)
// }
pub fn assemble_at_uri(did: &str, collection: &str, rkey: &str) -> String {
    format!("at://{did}/{collection}/{rkey}")
}
