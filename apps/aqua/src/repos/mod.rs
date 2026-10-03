use actor_profile::ActorProfileRepo;
use jacquard_common::{
    deps::{fluent_uri::Uri, smol_str::SmolStr},
    from_json_value,
    types::string::{Handle, UriValue},
};
use serde_json::Value;
use types::fm_teal::{actor::MiniProfileView, feed::Artist};
use uuid::Uuid;

use crate::repos::feed_play::FeedPlayRepo;
use crate::repos::graph::GraphRepo;
use crate::repos::music::MusicRepo;
use crate::repos::search::SearchRepo;
use crate::repos::social::SocialRepo;
use crate::repos::stats::StatsRepo;

pub mod actor_profile;
pub mod feed_play;
pub mod graph;
pub mod music;
pub mod pg;
pub mod search;
pub mod social;
pub mod stats;

#[async_trait::async_trait]
pub trait DataSource:
    ActorProfileRepo
    + FeedPlayRepo
    + GraphRepo
    + MusicRepo
    + SearchRepo
    + SocialRepo
    + StatsRepo
    + Send
    + Sync
{
    fn boxed(self) -> Box<dyn DataSource>
    where
        Self: Sized + Send + Sync + 'static,
    {
        Box::new(self)
    }
}

pub fn utc_to_atrium_datetime(
    dt: chrono::DateTime<chrono::Utc>,
) -> jacquard_common::types::string::Datetime {
    jacquard_common::types::string::Datetime::new(
        dt.with_timezone(&chrono::FixedOffset::west_opt(0).expect("0 is not negative")),
    )
}

pub fn time_to_chrono_utc(dt: time::OffsetDateTime) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(dt.unix_timestamp(), dt.nanosecond()).unwrap_or_default()
}

pub fn mbid_uri(mbid: Uuid) -> UriValue {
    UriValue::Any(SmolStr::new(format!("mbid:{mbid}")))
}

/// SQL JSON aggregates contain bare UUIDs, while play views require URI IDs.
/// Preserve artist metadata even when its optional identifier cannot be used.
pub fn artists_from_json(value: Option<Value>) -> Vec<Artist> {
    let Some(Value::Array(artists)) = value else {
        return Vec::new();
    };
    artists
        .into_iter()
        .filter_map(|mut value| {
            let artist = value.as_object_mut()?;
            if let Some(id) = artist.get("artistMbId") {
                let normalized = id.as_str().and_then(|id| {
                    if Uri::parse(id).is_ok() {
                        Some(id.to_owned())
                    } else {
                        Uuid::parse_str(id).ok().map(|mbid| format!("mbid:{mbid}"))
                    }
                });
                match normalized {
                    Some(id) => {
                        artist.insert("artistMbId".into(), Value::String(id));
                    }
                    None => {
                        artist.remove("artistMbId");
                    }
                }
            }
            from_json_value::<Artist>(value).ok()
        })
        .collect()
}

pub fn uri_value(value: String) -> UriValue {
    UriValue::Any(SmolStr::new(value))
}

/// Older indexed plays store a service domain rather than a URI.
pub fn music_service_uri(value: Option<String>) -> Option<UriValue> {
    let value = value?;
    if Uri::parse(value.as_str()).is_ok() {
        return Some(uri_value(value));
    }
    let domain = value.trim();
    let valid_domain = domain.contains('.')
        && domain.len() <= 253
        && domain.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        });
    valid_domain.then(|| uri_value(format!("https://{domain}")))
}

pub fn mini_profile(
    did: Option<String>,
    handle: Option<String>,
    display_name: Option<String>,
    avatar: Option<String>,
) -> Option<MiniProfileView> {
    did.map(|did| MiniProfileView {
        did: Some(did.into()),
        handle: handle
            .and_then(|handle| Handle::new_owned(handle.trim_start_matches("at://")).ok()),
        display_name: display_name.map(Into::into),
        avatar: avatar.map(Into::into),
        extra_data: Default::default(),
    })
}

#[cfg(test)]
mod tests {
    use super::{artists_from_json, mini_profile, music_service_uri};
    use jacquard_common::deps::fluent_uri::Uri;
    use serde_json::json;
    use types::fm_teal::feed::PlayView;

    #[test]
    fn mini_profile_normalizes_at_uri_handle() {
        let profile = mini_profile(
            Some("did:plc:listener".to_string()),
            Some("at://alice.bsky.social".to_string()),
            Some("Listener".to_string()),
            None,
        )
        .expect("profile should be present");

        assert_eq!(profile.handle.as_deref(), Some("alice.bsky.social"));
    }

    #[test]
    fn mini_profile_drops_invalid_handle_instead_of_panicking() {
        let profile = mini_profile(
            Some("did:plc:listener".to_string()),
            Some("at://listener.example".to_string()),
            Some("Listener".to_string()),
            None,
        )
        .expect("profile should be present");

        assert_eq!(profile.handle, None);
    }

    #[test]
    fn serialized_play_artists_have_uri_ids_and_preserve_unknown_fields() {
        let raw_mbid = "0517db23-5491-51e6-a76c-079e884463d9";
        let artists = artists_from_json(Some(json!([
            { "artistName": "Raw UUID", "artistMbId": raw_mbid, "role": "lead" },
            { "artistName": "Prefixed UUID", "artistMbId": format!("mbid:{raw_mbid}") },
            { "artistName": "URI", "artistMbId": "https://musicbrainz.org/artist/example", "source": "external" },
            { "artistName": "Unknown ID" },
            { "artistName": "Null ID", "artistMbId": null }
        ])));
        let play = PlayView::builder()
            .track_name("Example track")
            .artists(artists)
            .build();
        let output = serde_json::to_value(play).unwrap();
        let artists = output["artists"].as_array().unwrap();
        assert_eq!(artists.len(), 5);
        assert_eq!(artists[0]["artistMbId"], format!("mbid:{raw_mbid}"));
        assert_eq!(artists[1]["artistMbId"], format!("mbid:{raw_mbid}"));
        assert_eq!(
            artists[2]["artistMbId"],
            "https://musicbrainz.org/artist/example"
        );
        assert_eq!(artists[0]["role"], "lead");
        assert_eq!(artists[2]["source"], "external");
        assert!(artists[3].get("artistMbId").is_none());
        assert!(artists[4].get("artistMbId").is_none());
        for artist in artists {
            if let Some(id) = artist.get("artistMbId") {
                assert!(Uri::parse(id.as_str().unwrap()).is_ok());
            }
        }
    }

    #[test]
    fn preserves_existing_uri_schemes_including_uuid_urns() {
        let identifiers = [
            "mbid:0517db23-5491-51e6-a76c-079e884463d9",
            "urn:uuid:0517db23-5491-51e6-a76c-079e884463d9",
            "https://musicbrainz.org/artist/0517db23-5491-51e6-a76c-079e884463d9",
        ];
        for id in identifiers {
            let artists =
                artists_from_json(Some(json!([{ "artistName": "Artist", "artistMbId": id }])));
            assert_eq!(serde_json::to_value(artists).unwrap()[0]["artistMbId"], id);
        }
    }

    #[test]
    fn invalid_artist_ids_do_not_drop_names_or_other_artists() {
        let artists = artists_from_json(Some(json!([
            { "artistName": "Malformed ID", "artistMbId": "not a URI", "role": "guest" },
            { "artistName": "Wrong ID type", "artistMbId": 42 },
            { "artistMbId": "mbid:0517db23-5491-51e6-a76c-079e884463d9" },
            { "artistName": "Valid artist", "artistMbId": "urn:artist:example" }
        ])));
        let output = serde_json::to_value(artists).unwrap();
        assert_eq!(output.as_array().unwrap().len(), 3);
        assert_eq!(output[0]["artistName"], "Malformed ID");
        assert_eq!(output[0]["role"], "guest");
        assert!(output[0].get("artistMbId").is_none());
        assert!(output[1].get("artistMbId").is_none());
        assert_eq!(output[2]["artistMbId"], "urn:artist:example");
    }

    #[test]
    fn missing_artist_json_is_an_empty_list() {
        assert!(artists_from_json(None).is_empty());
        assert!(artists_from_json(Some(json!(null))).is_empty());
    }

    #[test]
    fn legacy_music_service_domains_serialize_as_https_uris() {
        for domain in ["last.fm", "open.spotify.com", "music.example-service.org"] {
            let play = PlayView::builder()
                .track_name("Legacy listen")
                .artists(Vec::new())
                .music_service_uri(music_service_uri(Some(domain.to_string())))
                .build();
            let output = serde_json::to_value(play).unwrap();
            assert_eq!(output["musicServiceUri"], format!("https://{domain}"));
            assert!(Uri::parse(output["musicServiceUri"].as_str().unwrap()).is_ok());
        }
    }

    #[test]
    fn music_service_uri_preserves_existing_uri_schemes() {
        for value in [
            "https://open.spotify.com/track/example",
            "local:manual",
            "custom:service",
        ] {
            let uri = music_service_uri(Some(value.to_string())).unwrap();
            assert_eq!(uri.as_str(), value);
        }
    }

    #[test]
    fn unusable_optional_music_services_are_omitted_from_play_output() {
        for value in [
            "",
            "   ",
            "not a domain",
            "localhost",
            "last..fm",
            "-bad.fm",
            "bad-.fm",
            "last.fm/path",
        ] {
            let play = PlayView::builder()
                .track_name("Legacy listen")
                .artists(Vec::new())
                .music_service_uri(music_service_uri(Some(value.to_string())))
                .build();
            let output = serde_json::to_value(play).unwrap();
            assert!(
                output.get("musicServiceUri").is_none(),
                "must omit {value:?}"
            );
        }
        assert!(music_service_uri(None).is_none());
    }
}
