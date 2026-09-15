use std::collections::{BTreeMap, HashMap};
use std::time::Duration as StdDuration;

use async_trait::async_trait;
use jacquard_common::deps::smol_str::SmolStr;
use jacquard_common::from_json_value;
use jacquard_common::types::string::{AtUri, AtprotoStr, Did};
use jacquard_common::types::value::Data;
use serde::Deserialize;
use types::fm_teal::feed::PlayView;
use types::fm_teal::music::{
    AlbumSummary, AlbumSummaryReleaseType, AlbumView, ArtistListenerView, ArtistView, TrackSummary,
};
use uuid::Uuid;

use super::stats::{
    decode_latest_cursor, decode_offset_cursor, encode_latest_cursor, encode_offset_cursor,
    LatestPlaysCursor,
};
use super::{mbid_uri, mini_profile, pg::PgDataSource, uri_value, utc_to_atrium_datetime};

pub struct AlbumPage {
    pub album: AlbumView,
    pub plays: Vec<PlayView>,
    pub cursor: Option<String>,
}

pub struct ArtistListenersPage {
    pub listeners: Vec<ArtistListenerView>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtistListenersPeriod {
    All,
    ThirtyDays,
    SevenDays,
}

impl ArtistListenersPeriod {
    fn parse(period: Option<&str>) -> anyhow::Result<Self> {
        match period.unwrap_or("all") {
            "all" => Ok(Self::All),
            "30days" => Ok(Self::ThirtyDays),
            "7days" => Ok(Self::SevenDays),
            other => anyhow::bail!("unsupported period: {other}"),
        }
    }

    fn condition_sql(self) -> &'static str {
        match self {
            Self::All => "",
            Self::ThirtyDays => "AND p.played_time >= NOW() - INTERVAL '30 days'",
            Self::SevenDays => "AND p.played_time >= NOW() - INTERVAL '7 days'",
        }
    }
}

#[async_trait]
pub trait MusicRepo: Send + Sync {
    async fn get_artist(
        &self,
        mbid: Option<&str>,
        name: Option<&str>,
    ) -> anyhow::Result<ArtistView>;
    async fn get_artist_listeners(
        &self,
        mbid: Option<&str>,
        name: Option<&str>,
        period: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<ArtistListenersPage>;
    async fn get_album(
        &self,
        mbid: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<AlbumPage>;
}

fn parse_mbid(mbid: &str) -> anyhow::Result<Uuid> {
    Ok(Uuid::parse_str(mbid.strip_prefix("mbid:").unwrap_or(mbid))?)
}

#[derive(Debug, Default)]
struct MusicBrainzTrackOrder {
    by_recording_mbid: HashMap<Uuid, (i32, i32)>,
    by_title: HashMap<String, (i32, i32)>,
    canonical_recording_by_title: HashMap<String, Uuid>,
}

impl MusicBrainzTrackOrder {
    fn position_for(&self, recording_mbid: Option<Uuid>, title: &str) -> Option<(i32, i32)> {
        recording_mbid
            .and_then(|mbid| self.by_recording_mbid.get(&mbid).copied())
            .or_else(|| self.by_title.get(&normalize_track_title(title)).copied())
    }
}

#[derive(Debug, Clone)]
struct CanonicalAlbumTrack {
    recording_mbid: Option<Uuid>,
    name: String,
    artist_name: Option<String>,
}

#[derive(Debug, Default)]
struct MusicBrainzReleaseData {
    order: MusicBrainzTrackOrder,
    tracks: Vec<CanonicalAlbumTrack>,
    artist: Option<(Uuid, String)>,
    title: Option<String>,
    release_group_mbid: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzRelease {
    title: Option<String>,
    #[serde(rename = "release-group")]
    release_group: Option<MusicBrainzReleaseGroup>,
    #[serde(rename = "artist-credit", default)]
    artist_credit: Vec<MusicBrainzArtistCredit>,
    #[serde(default)]
    media: Vec<MusicBrainzMedium>,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzArtistCredit {
    artist: MusicBrainzArtist,
}

#[derive(Debug, Deserialize, Clone)]
struct MusicBrainzArtist {
    id: Uuid,
    name: String,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzArtistReleases {
    #[serde(rename = "release-count", default)]
    release_count: usize,
    #[serde(rename = "release-offset", default)]
    release_offset: usize,
    #[serde(default)]
    releases: Vec<MusicBrainzArtistRelease>,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzArtistRelease {
    id: Uuid,
    #[serde(rename = "release-group")]
    release_group: Option<MusicBrainzReleaseGroup>,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzReleaseGroup {
    id: Option<Uuid>,
    #[serde(rename = "primary-type")]
    primary_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzMedium {
    position: Option<i32>,
    #[serde(default)]
    tracks: Vec<MusicBrainzTrack>,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzTrack {
    position: Option<i32>,
    title: Option<String>,
    #[serde(rename = "artist-credit", default)]
    artist_credit: Vec<MusicBrainzArtistCredit>,
    recording: Option<MusicBrainzRecording>,
}

#[derive(Debug, Deserialize)]
struct MusicBrainzRecording {
    id: Option<Uuid>,
}

#[derive(Debug)]
struct AlbumTrack {
    uri: Option<String>,
    recording_mbid: Option<Uuid>,
    name: String,
    artist_name: String,
    play_count: i64,
}

fn normalize_track_title(title: &str) -> String {
    title.trim().to_lowercase()
}

fn normalize_release_type(primary_type: Option<&str>) -> &'static str {
    match primary_type {
        Some("Album") => "album",
        Some("Single") => "single",
        Some("EP") => "ep",
        _ => "other",
    }
}

async fn fetch_musicbrainz_release(
    release_mbid: Uuid,
) -> anyhow::Result<MusicBrainzReleaseData> {
    let url =
        format!(
            "https://musicbrainz.org/ws/2/release/{release_mbid}?inc=artist-credits+recordings+release-groups&fmt=json"
        );
    let release = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(3))
        .user_agent("teal-aqua/0.1 (https://teal.fm)")
        .build()?
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json::<MusicBrainzRelease>()
        .await?;

    let release_artist = release
        .artist_credit
        .first()
        .map(|credit| (credit.artist.id, credit.artist.name.clone()));

    let release_group_mbid = release
        .release_group
        .and_then(|release_group| release_group.id);
    let mut data = MusicBrainzReleaseData {
        artist: release_artist,
        title: release.title,
        release_group_mbid,
        ..Default::default()
    };
    for (medium_index, medium) in release.media.into_iter().enumerate() {
        let medium_position = medium.position.unwrap_or((medium_index + 1) as i32);
        for (track_index, track) in medium.tracks.into_iter().enumerate() {
            let track_position = track.position.unwrap_or((track_index + 1) as i32);
            let artist_name = track
                .artist_credit
                .first()
                .map(|credit| credit.artist.name.clone())
                .or_else(|| data.artist.as_ref().map(|(_, name)| name.clone()));
            let recording_mbid = track.recording.and_then(|recording| recording.id);
            if let Some(recording_mbid) = recording_mbid {
                data.order
                    .by_recording_mbid
                    .entry(recording_mbid)
                    .or_insert((medium_position, track_position));
            }
            if let Some(title) = track.title {
                if let Some(recording_mbid) = recording_mbid {
                    data.order
                        .canonical_recording_by_title
                        .entry(normalize_track_title(&title))
                        .or_insert(recording_mbid);
                }
                data.order
                    .by_title
                    .entry(normalize_track_title(&title))
                    .or_insert((medium_position, track_position));
                data.tracks.push(CanonicalAlbumTrack {
                    recording_mbid,
                    name: title,
                    artist_name,
                });
            }
        }
    }

    Ok(data)
}

async fn fetch_artist_release_types(artist_mbid: Uuid) -> anyhow::Result<HashMap<Uuid, String>> {
    const PAGE_SIZE: usize = 100;

    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(3))
        .user_agent("teal-aqua/0.1 (https://teal.fm)")
        .build()?;

    let mut release_types = HashMap::new();
    let mut offset = 0;

    loop {
        let url = format!(
            "https://musicbrainz.org/ws/2/release?artist={artist_mbid}&inc=release-groups&fmt=json&limit={PAGE_SIZE}&offset={offset}"
        );
        let page = client
            .get(url)
            .send()
            .await?
            .error_for_status()?
            .json::<MusicBrainzArtistReleases>()
            .await?;
        let page_len = page.releases.len();

        release_types.extend(page.releases.into_iter().map(|release| {
            (
                release.id,
                normalize_release_type(
                    release
                        .release_group
                        .and_then(|group| group.primary_type)
                        .as_deref(),
                )
                .to_string(),
            )
        }));

        if page_len == 0 {
            break;
        }

        let next_offset = page.release_offset + page_len;
        if page_len < PAGE_SIZE || (page.release_count > 0 && next_offset >= page.release_count) {
            break;
        }
        offset = next_offset;
    }

    Ok(release_types)
}

fn sort_tracks_by_release_order(tracks: &mut [AlbumTrack], order: &MusicBrainzTrackOrder) {
    tracks.sort_by(|a, b| {
        match (
            order.position_for(a.recording_mbid, &a.name),
            order.position_for(b.recording_mbid, &b.name),
        ) {
            (Some(a_position), Some(b_position)) => a_position
                .cmp(&b_position)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
}

fn merge_album_tracks(
    release: &MusicBrainzReleaseData,
    observed_tracks: Vec<AlbumTrack>,
) -> Vec<AlbumTrack> {
    let mut merged = release
        .tracks
        .iter()
        .map(|track| AlbumTrack {
            uri: None,
            recording_mbid: track.recording_mbid,
            name: track.name.clone(),
            artist_name: track
                .artist_name
                .clone()
                .unwrap_or_else(|| "Unknown artist".to_string()),
            play_count: 0,
        })
        .collect::<Vec<_>>();

    let index_by_recording = merged
        .iter()
        .enumerate()
        .filter_map(|(index, track)| track.recording_mbid.map(|mbid| (mbid, index)))
        .collect::<HashMap<_, _>>();
    let index_by_title = merged
        .iter()
        .enumerate()
        .map(|(index, track)| (normalize_track_title(&track.name), index))
        .collect::<HashMap<_, _>>();

    let mut unmatched = Vec::new();
    for observed in observed_tracks {
        let index = observed
            .recording_mbid
            .and_then(|mbid| index_by_recording.get(&mbid).copied())
            .or_else(|| {
                index_by_title
                    .get(&normalize_track_title(&observed.name))
                    .copied()
            });
        match index {
            Some(index) => {
                let target = &mut merged[index];
                target.play_count += observed.play_count;
                if target.uri.is_none() {
                    target.uri = observed.uri;
                }
                if target.recording_mbid.is_none() {
                    target.recording_mbid = observed.recording_mbid;
                }
            }
            None => unmatched.push(observed),
        }
    }

    merged.extend(unmatched);
    merged
}

#[async_trait]
impl MusicRepo for PgDataSource {
    async fn get_artist(
        &self,
        mbid: Option<&str>,
        name: Option<&str>,
    ) -> anyhow::Result<ArtistView> {
        let mbid = mbid.map(parse_mbid).transpose()?;
        if mbid.is_none() && name.is_none_or(str::is_empty) {
            anyhow::bail!("mbid or name is required");
        }

        let artist = sqlx::query!(
            r#"
            SELECT ae.id, ae.mbid, ae.name, COUNT(DISTINCT ptae.play_uri) AS play_count
            FROM artists_extended ae
            LEFT JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
            WHERE ($1::uuid IS NOT NULL AND ae.mbid = $1)
               OR (
                   $1::uuid IS NULL
                   AND (
                       LOWER(ae.name) = LOWER($2)
                       OR TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(ae.name), '[^a-z0-9]+', '-', 'g')) = LOWER($2)
                   )
               )
            GROUP BY ae.id, ae.mbid, ae.name
            ORDER BY play_count DESC
            LIMIT 1
            "#,
            mbid,
            name
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("artist not found"))?;

        let rows = sqlx::query!(
            r#"
            WITH release_variants AS (
                SELECT
                    LOWER(p.release_name) AS normalized_name,
                    p.release_mbid AS mbid,
                    MAX(p.release_name) AS name,
                    COUNT(DISTINCT p.uri) AS play_count,
                    MAX(p.played_time) AS last_played
                FROM plays p
                INNER JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
                WHERE ptae.artist_id = $1
                  AND p.release_mbid IS NOT NULL
                  AND p.release_name IS NOT NULL
                GROUP BY LOWER(p.release_name), p.release_mbid
            )
            ,release_usage AS (
                SELECT
                    release_variants.*,
                    COUNT(*) OVER (PARTITION BY mbid) AS release_name_count
                FROM release_variants
            )
            ,selected_releases AS (
                SELECT DISTINCT ON (normalized_name)
                    normalized_name,
                    mbid,
                    name,
                    SUM(play_count) OVER (PARTITION BY normalized_name)::bigint AS play_count,
                    MAX(last_played) OVER (PARTITION BY normalized_name) AS last_played
                FROM release_usage
                ORDER BY normalized_name,
                    (release_name_count = 1) DESC,
                    release_usage.play_count DESC,
                    last_played DESC NULLS LAST,
                    mbid
            )
            SELECT mbid AS "mbid!", name AS "name!", play_count AS "play_count!"
            FROM selected_releases
            ORDER BY last_played DESC NULLS LAST, name
            "#,
            artist.id
        )
        .fetch_all(&self.db)
        .await?;

        let artist_name = artist.name;
        let release_types = match artist.mbid {
            Some(artist_mbid) => fetch_artist_release_types(artist_mbid)
                .await
                .unwrap_or_default(),
            None => HashMap::new(),
        };
        let artist_mbid = artist.mbid.map(mbid_uri);
        let albums = rows
            .into_iter()
            .map(|row| AlbumSummary {
                artist_mbid: artist_mbid.clone(),
                artist_name: artist_name.clone().into(),
                mbid: mbid_uri(row.mbid),
                name: row.name.into(),
                play_count: row.play_count,
                release_type: Some(AlbumSummaryReleaseType::from_value(SmolStr::new(
                    release_types
                        .get(&row.mbid)
                        .map(String::as_str)
                        .unwrap_or("other"),
                ))),
                extra_data: Some(BTreeMap::from([(
                    SmolStr::new_static("releaseType"),
                    Data::String(AtprotoStr::new(SmolStr::new(
                        release_types
                            .get(&row.mbid)
                            .map(String::as_str)
                            .unwrap_or("other"),
                    ))),
                )])),
            })
            .collect();

        Ok(ArtistView {
            albums,
            mbid: artist_mbid,
            name: artist_name.into(),
            play_count: artist.play_count.unwrap_or(0),
            extra_data: Default::default(),
        })
    }

    async fn get_artist_listeners(
        &self,
        mbid: Option<&str>,
        name: Option<&str>,
        period: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<ArtistListenersPage> {
        let mbid = mbid.map(parse_mbid).transpose()?;
        if mbid.is_none() && name.is_none_or(str::is_empty) {
            anyhow::bail!("mbid or name is required");
        }

        let artist_id = sqlx::query_as::<_, (i32,)>(
            r#"
            SELECT ae.id
            FROM artists_extended ae
            LEFT JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
            WHERE ($1::uuid IS NOT NULL AND ae.mbid = $1)
               OR (
                   $1::uuid IS NULL
                   AND (
                       LOWER(ae.name) = LOWER($2)
                       OR TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(ae.name), '[^a-z0-9]+', '-', 'g')) = LOWER($2)
                   )
               )
            GROUP BY ae.id
            ORDER BY COUNT(DISTINCT ptae.play_uri) DESC
            LIMIT 1
            "#,
        )
        .bind(mbid)
        .bind(name)
        .fetch_optional(&self.db)
        .await?
        .ok_or_else(|| anyhow::anyhow!("artist not found"))?
        .0;

        let period = ArtistListenersPeriod::parse(period)?;
        let limit = limit.unwrap_or(50).clamp(1, 100) as i64;
        let offset = decode_offset_cursor(cursor)?;
        let query_limit = limit + 1;
        let sql = format!(
            r#"
            SELECT
                p.did,
                prof.handle,
                prof.display_name,
                prof.avatar,
                COUNT(DISTINCT p.uri)::bigint AS play_count
            FROM plays p
            INNER JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
            LEFT JOIN profiles prof ON prof.did = p.did
            WHERE ptae.artist_id = $1
              {}
            GROUP BY p.did, prof.handle, prof.display_name, prof.avatar
            ORDER BY play_count DESC, p.did ASC
            LIMIT $2 OFFSET $3
            "#,
            period.condition_sql()
        );

        let rows =
            sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, i64)>(
                &sql,
            )
            .bind(artist_id)
            .bind(query_limit)
            .bind(offset)
            .fetch_all(&self.db)
            .await?;

        let has_more = rows.len() > limit as usize;
        let mut listeners = Vec::with_capacity(rows.len().min(limit as usize));
        for (did, handle, display_name, avatar, play_count) in rows.into_iter().take(limit as usize)
        {
            if let Some(actor) = mini_profile(Some(did), handle, display_name, avatar) {
                listeners.push(ArtistListenerView {
                    actor,
                    play_count,
                    extra_data: Default::default(),
                });
            }
        }

        Ok(ArtistListenersPage {
            listeners,
            cursor: if has_more {
                Some(encode_offset_cursor(offset + limit)?)
            } else {
                None
            },
        })
    }

    async fn get_album(
        &self,
        mbid: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<AlbumPage> {
        let mbid = parse_mbid(mbid)?;
        let limit = limit.unwrap_or(30).clamp(1, 100) as i64;
        let query_limit = limit + 1;
        let cursor = decode_latest_cursor(cursor)?;
        let cursor_time = cursor
            .as_ref()
            .map(|cursor| {
                time::OffsetDateTime::parse(
                    &cursor.processed_time,
                    &time::format_description::well_known::Rfc3339,
                )
            })
            .transpose()?;

        let album_row = sqlx::query!(
            r#"
            SELECT
                p.release_mbid AS "mbid!",
                COALESCE(MAX(p.release_name), 'Unknown release') AS "name!",
                COUNT(DISTINCT p.uri) AS "play_count!",
                COALESCE(
                    (ARRAY_AGG(ptae.artist_name ORDER BY ptae.artist_name)
                        FILTER (WHERE ptae.artist_name IS NOT NULL))[1],
                    'Unknown artist'
                ) AS "artist_name!",
                (ARRAY_AGG(ae.mbid ORDER BY ptae.artist_name)
                    FILTER (WHERE ae.mbid IS NOT NULL))[1] AS artist_mbid
            FROM plays p
            LEFT JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
            LEFT JOIN artists_extended ae ON ptae.artist_id = ae.id
            WHERE p.release_mbid = $1
            GROUP BY p.release_mbid
            "#,
            mbid
        )
        .fetch_optional(&self.db)
        .await?;

        let musicbrainz = fetch_musicbrainz_release(mbid).await.unwrap_or_default();
        if album_row.is_none() && musicbrainz.title.is_none() {
            anyhow::bail!("album not found");
        }

        let track_rows = sqlx::query!(
            r#"
            WITH track_plays AS (
                SELECT
                    p.uri,
                    p.recording_mbid,
                    p.track_name,
                    p.processed_time,
                    COALESCE(
                        STRING_AGG(DISTINCT ptae.artist_name, ', ' ORDER BY ptae.artist_name),
                        'Unknown artist'
                    ) AS artist_name
                FROM plays p
                LEFT JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
                WHERE p.release_mbid = $1
                GROUP BY p.uri, p.recording_mbid, p.track_name, p.processed_time
            )
            SELECT DISTINCT ON (LOWER(track_name))
                uri,
                recording_mbid,
                track_name,
                artist_name,
                COUNT(*) OVER (
                    PARTITION BY LOWER(track_name)
                ) AS "play_count!"
            FROM track_plays
            ORDER BY LOWER(track_name), processed_time DESC, uri
            "#,
            mbid
        )
        .fetch_all(&self.db)
        .await?;

        let mut observed_tracks = track_rows
            .into_iter()
            .filter_map(|row| {
                Some(AlbumTrack {
                    uri: Some(row.uri),
                    recording_mbid: row.recording_mbid,
                    name: row.track_name,
                    artist_name: row.artist_name?,
                    play_count: row.play_count,
                })
            })
            .collect::<Vec<_>>();
        for track in &mut observed_tracks {
            if let Some(recording_mbid) = musicbrainz
                .order
                .canonical_recording_by_title
                .get(&normalize_track_title(&track.name))
            {
                track.recording_mbid = Some(*recording_mbid);
            }
        }

        let mut tracks = merge_album_tracks(&musicbrainz, observed_tracks);
        sort_tracks_by_release_order(&mut tracks, &musicbrainz.order);
        let tracks = tracks
            .into_iter()
            .map(|track| TrackSummary {
                uri: track.uri.and_then(|uri| AtUri::try_from(uri).ok()),
                recording_mbid: track.recording_mbid.map(mbid_uri),
                name: track.name.into(),
                artist_name: track.artist_name.into(),
                play_count: track.play_count,
                extra_data: Default::default(),
            })
            .collect();

        let rows = sqlx::query!(
            r#"
            SELECT
                p.uri, p.did, p.rkey, p.cid, p.isrc, p.duration, p.track_name, p.played_time,
                p.processed_time, p.release_mbid, p.release_name, p.recording_mbid,
                p.submission_client_agent, p.music_service_base_domain, p.origin_url,
                profile.did AS "profile_did?", profile.handle AS profile_handle,
                profile.display_name AS profile_display_name, profile.avatar AS profile_avatar,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'artistMbId', ae.mbid,
                      'artistName', ptae.artist_name
                    )
                  ) FILTER (WHERE ptae.artist_name IS NOT NULL),
                  '[]'
                ) AS artists
            FROM plays p
            LEFT JOIN profiles profile ON p.did = profile.did
            LEFT JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
            LEFT JOIN artists_extended ae ON ptae.artist_id = ae.id
            WHERE p.release_mbid = $1
              AND ($2::timestamptz IS NULL OR (p.processed_time, p.uri) < ($2, $3))
            GROUP BY p.uri, p.did, p.rkey, p.cid, p.isrc, p.duration, p.track_name, p.played_time,
                     p.processed_time, p.release_mbid, p.release_name, p.recording_mbid,
                     p.submission_client_agent, p.music_service_base_domain, p.origin_url,
                     profile.did, profile.handle, profile.display_name, profile.avatar
            ORDER BY p.processed_time DESC, p.uri DESC
            LIMIT $4
            "#,
            mbid,
            cursor_time,
            cursor.as_ref().map(|cursor| cursor.uri.as_str()),
            query_limit
        )
        .fetch_all(&self.db)
        .await?;

        let has_more = rows.len() > limit as usize;
        let mut plays = Vec::with_capacity(rows.len().min(limit as usize));
        let mut next_cursor = None;
        for row in rows.into_iter().take(limit as usize) {
            next_cursor = Some(LatestPlaysCursor {
                processed_time: row
                    .processed_time
                    .unwrap_or_else(time::OffsetDateTime::now_utc)
                    .format(&time::format_description::well_known::Rfc3339)?,
                uri: row.uri.clone(),
            });
            let artists = row
                .artists
                .and_then(|value| from_json_value::<Vec<types::fm_teal::feed::Artist>>(value).ok())
                .unwrap_or_default();

            plays.push(PlayView {
                track_name: row.track_name.into(),
                author: mini_profile(
                    row.profile_did,
                    row.profile_handle,
                    row.profile_display_name,
                    row.profile_avatar,
                ),
                uri: AtUri::try_from(row.uri).ok(),
                cid: Some(row.cid.into()),
                author_did: Did::new_owned(&row.did).ok(),
                rkey: Some(row.rkey.into()),
                track_mb_id: row.recording_mbid.map(mbid_uri),
                recording_mb_id: row.recording_mbid.map(mbid_uri),
                duration: row.duration.map(i64::from),
                artists: artists
                    .into_iter()
                    .map(|artist| artist.to_owned())
                    .collect(),
                release_name: row.release_name.map(Into::into),
                release_mb_id: row.release_mbid.map(mbid_uri),
                isrc: row.isrc.map(Into::into),
                origin_uri: row.origin_url.map(uri_value),
                music_service_uri: row.music_service_base_domain.map(uri_value),
                submission_client_agent: row.submission_client_agent.map(Into::into),
                played_time: row
                    .played_time
                    .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
                extra_data: Default::default(),
            });
        }

        let album_play_count = album_row.as_ref().map(|row| row.play_count).unwrap_or(0);
        let album_name = album_row
            .as_ref()
            .map(|row| row.name.clone())
            .or_else(|| musicbrainz.title.clone())
            .unwrap_or_else(|| "Unknown release".to_string());
        let artist_mbid = musicbrainz
            .artist
            .as_ref()
            .map(|(artist_mbid, _)| mbid_uri(*artist_mbid))
            .or_else(|| {
                album_row
                    .as_ref()
                    .and_then(|row| row.artist_mbid.map(mbid_uri))
            });
        let artist_name = musicbrainz
            .artist
            .as_ref()
            .map(|(_, artist_name)| artist_name.clone())
            .or_else(|| album_row.as_ref().map(|row| row.artist_name.clone()))
            .unwrap_or_else(|| "Unknown artist".to_string());

        Ok(AlbumPage {
            album: AlbumView {
                artist_mbid,
                artist_name: artist_name.into(),
                mbid: mbid_uri(mbid),
                release_group_mbid: musicbrainz.release_group_mbid.map(mbid_uri),
                name: album_name.into(),
                play_count: album_play_count,
                tracks,
                extra_data: Default::default(),
            },
            plays,
            cursor: if has_more {
                next_cursor.as_ref().map(encode_latest_cursor).transpose()?
            } else {
                None
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{
        merge_album_tracks, normalize_release_type, sort_tracks_by_release_order, AlbumTrack,
        ArtistListenersPeriod, CanonicalAlbumTrack, MusicBrainzArtistReleases, MusicBrainzRelease,
        MusicBrainzReleaseData, MusicBrainzTrackOrder,
    };
    use serde_json::json;
    use uuid::Uuid;

    fn observed_track(name: &str, recording_mbid: Option<Uuid>) -> AlbumTrack {
        AlbumTrack {
            uri: Some(format!("at://did:plc:test/fm.teal.feed.play/{name}")),
            recording_mbid,
            name: name.to_string(),
            artist_name: "Test Artist".to_string(),
            play_count: 1,
        }
    }

    fn canonical_track(
        name: &str,
        recording_mbid: Option<Uuid>,
        position: (i32, i32),
    ) -> (CanonicalAlbumTrack, MusicBrainzTrackOrder) {
        let mut order = MusicBrainzTrackOrder::default();
        if let Some(recording_mbid) = recording_mbid {
            order.by_recording_mbid.insert(recording_mbid, position);
        }
        order
            .by_title
            .insert(super::normalize_track_title(name), position);
        (
            CanonicalAlbumTrack {
                recording_mbid,
                name: name.to_string(),
                artist_name: Some("Test Artist".to_string()),
            },
            order,
        )
    }

    fn release_with_tracks(
        tracks: Vec<(CanonicalAlbumTrack, MusicBrainzTrackOrder)>,
    ) -> MusicBrainzReleaseData {
        let mut release = MusicBrainzReleaseData::default();
        for (track, order) in tracks {
            release.tracks.push(track);
            release.order.by_title.extend(order.by_title);
            release.order.by_recording_mbid.extend(order.by_recording_mbid);
            release
                .order
                .canonical_recording_by_title
                .extend(order.canonical_recording_by_title);
        }
        release
    }

    #[test]
    fn sorts_album_tracks_by_musicbrainz_recording_position() {
        let first = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        let second = Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap();
        let mut order = MusicBrainzTrackOrder::default();
        order.by_recording_mbid.insert(first, (1, 1));
        order.by_recording_mbid.insert(second, (1, 2));

        let mut tracks = vec![
            observed_track("Second Song", Some(second)),
            observed_track("First Song", Some(first)),
        ];

        sort_tracks_by_release_order(&mut tracks, &order);

        assert_eq!(tracks[0].name, "First Song");
        assert_eq!(tracks[1].name, "Second Song");
    }

    #[test]
    fn sorts_album_tracks_by_musicbrainz_title_when_recording_mbid_is_missing() {
        let mut order = MusicBrainzTrackOrder::default();
        order.by_title.insert("opener".to_string(), (1, 1));
        order.by_title.insert("closer".to_string(), (1, 2));

        let mut tracks = vec![
            observed_track("Closer", None),
            observed_track("Opener", None),
        ];

        sort_tracks_by_release_order(&mut tracks, &order);

        assert_eq!(tracks[0].name, "Opener");
        assert_eq!(tracks[1].name, "Closer");
    }

    #[test]
    fn falls_back_to_alphabetical_order_for_unmatched_tracks() {
        let order = MusicBrainzTrackOrder::default();
        let mut tracks = vec![observed_track("Zulu", None), observed_track("Alpha", None)];

        sort_tracks_by_release_order(&mut tracks, &order);

        assert_eq!(tracks[0].name, "Alpha");
        assert_eq!(tracks[1].name, "Zulu");
    }

    #[test]
    fn includes_unplayed_canonical_tracks_with_zero_plays() {
        let played = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        let unplayed = Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap();
        let release = release_with_tracks(vec![
            canonical_track("Opener", Some(played), (1, 1)),
            canonical_track("B-Side", Some(unplayed), (1, 2)),
        ]);

        let mut tracks = merge_album_tracks(&release, vec![observed_track("Opener", Some(played))]);
        sort_tracks_by_release_order(&mut tracks, &release.order);

        assert_eq!(tracks.len(), 2);
        assert_eq!(tracks[0].name, "Opener");
        assert_eq!(tracks[0].play_count, 1);
        assert!(tracks[0].uri.is_some());
        assert_eq!(tracks[1].name, "B-Side");
        assert_eq!(tracks[1].play_count, 0);
        assert!(tracks[1].uri.is_none());
    }

    #[test]
    fn matches_observed_plays_to_canonical_tracks_by_title_case_insensitively() {
        let recording = Uuid::parse_str("00000000-0000-0000-0000-000000000003").unwrap();
        let release = release_with_tracks(vec![canonical_track(
            "Ice in My OJ",
            Some(recording),
            (1, 1),
        )]);

        let tracks = merge_album_tracks(
            &release,
            vec![observed_track("Ice In My OJ", Some(recording))],
        );

        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].play_count, 1);
        assert!(tracks[0].uri.is_some());
    }

    #[test]
    fn keeps_observed_tracks_missing_from_musicbrainz() {
        let release = release_with_tracks(vec![canonical_track("Album Cut", None, (1, 1))]);

        let tracks = merge_album_tracks(&release, vec![observed_track("Bonus Track", None)]);

        assert_eq!(tracks.len(), 2);
        assert!(tracks.iter().any(|track| track.name == "Bonus Track"));
    }

    #[test]
    fn merges_duplicate_play_counts_onto_one_canonical_track() {
        let recording = Uuid::parse_str("00000000-0000-0000-0000-000000000004").unwrap();
        let release = release_with_tracks(vec![canonical_track("Repeat", Some(recording), (1, 1))]);

        let mut first = observed_track("Repeat", Some(recording));
        first.play_count = 2;
        let mut second = observed_track("Repeat", Some(recording));
        second.play_count = 3;

        let tracks = merge_album_tracks(&release, vec![first, second]);

        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].play_count, 5);
    }

    #[test]
    fn artist_listeners_period_accepts_lexicon_values() {
        assert_eq!(
            ArtistListenersPeriod::parse(None).unwrap(),
            ArtistListenersPeriod::All
        );
        assert_eq!(
            ArtistListenersPeriod::parse(Some("all")).unwrap(),
            ArtistListenersPeriod::All
        );
        assert_eq!(
            ArtistListenersPeriod::parse(Some("30days")).unwrap(),
            ArtistListenersPeriod::ThirtyDays
        );
        assert_eq!(
            ArtistListenersPeriod::parse(Some("7days")).unwrap(),
            ArtistListenersPeriod::SevenDays
        );
        assert!(ArtistListenersPeriod::parse(Some("90days")).is_err());
    }

    #[test]
    fn maps_musicbrainz_release_group_types_without_treating_unknowns_as_albums() {
        assert_eq!(normalize_release_type(Some("Album")), "album");
        assert_eq!(normalize_release_type(Some("Single")), "single");
        assert_eq!(normalize_release_type(Some("EP")), "ep");
        assert_eq!(normalize_release_type(Some("Other")), "other");
        assert_eq!(normalize_release_type(None), "other");
    }

    #[test]
    fn parses_musicbrainz_release_group_id_for_canonical_cover_art() {
        let release: MusicBrainzRelease = serde_json::from_value(json!({
            "id": "a5e766b8-650c-40ce-a19f-3dc3c865a3e2",
            "title": "Ego Death at a Bachelorette Party",
            "release-group": {
                "id": "15c3b397-9652-4537-a14b-7eb8489092ff",
                "primary-type": "Album"
            },
            "artist-credit": [],
            "media": []
        }))
        .unwrap();

        assert_eq!(
            release.release_group.and_then(|group| group.id),
            Some(Uuid::parse_str("15c3b397-9652-4537-a14b-7eb8489092ff").unwrap())
        );
    }

    #[test]
    fn deserializes_musicbrainz_release_pagination_metadata() {
        let page: MusicBrainzArtistReleases = serde_json::from_value(json!({
            "release-count": 222,
            "release-offset": 200,
            "releases": [{
                "id": "260b6184-8828-48eb-945c-bc4cb6fc34ca",
                "release-group": {"primary-type": "Album"}
            }]
        }))
        .unwrap();

        assert_eq!(page.release_count, 222);
        assert_eq!(page.release_offset, 200);
        assert_eq!(page.releases.len(), 1);
    }
}
