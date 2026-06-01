use async_trait::async_trait;
use jacquard_common::from_json_value;
use jacquard_common::types::string::{AtUri, Did};
use types::fm_teal::alpha::feed::PlayView;
use types::fm_teal::alpha::music::{AlbumSummary, AlbumView, ArtistView, TrackSummary};
use uuid::Uuid;

use super::stats::{LatestPlaysCursor, decode_latest_cursor, encode_latest_cursor};
use super::{mbid_uri, mini_profile, pg::PgDataSource, utc_to_atrium_datetime};

pub struct AlbumPage {
    pub album: AlbumView,
    pub plays: Vec<PlayView>,
    pub cursor: Option<String>,
}

#[async_trait]
pub trait MusicRepo: Send + Sync {
    async fn get_artist(
        &self,
        mbid: Option<&str>,
        name: Option<&str>,
    ) -> anyhow::Result<ArtistView>;
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
               OR ($1::uuid IS NULL AND LOWER(ae.name) = LOWER($2))
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
            SELECT
                p.release_mbid AS "mbid!",
                MAX(p.release_name) AS "name!",
                COUNT(DISTINCT p.uri) AS "play_count!"
            FROM plays p
            INNER JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
            WHERE ptae.artist_id = $1
              AND p.release_mbid IS NOT NULL
              AND p.release_name IS NOT NULL
            GROUP BY p.release_mbid
            ORDER BY MAX(p.played_time) DESC NULLS LAST, MAX(p.release_name)
            "#,
            artist.id
        )
        .fetch_all(&self.db)
        .await?;

        let artist_name = artist.name;
        let artist_mbid = artist.mbid.map(mbid_uri);
        let albums = rows
            .into_iter()
            .map(|row| AlbumSummary {
                artist_mbid: artist_mbid.clone(),
                artist_name: artist_name.clone().into(),
                mbid: mbid_uri(row.mbid),
                name: row.name.into(),
                play_count: row.play_count,
                extra_data: Default::default(),
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
        .await?
        .ok_or_else(|| anyhow::anyhow!("album not found"))?;

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
            SELECT DISTINCT ON (COALESCE(recording_mbid::text, LOWER(track_name)))
                uri,
                recording_mbid,
                track_name,
                artist_name,
                COUNT(*) OVER (
                    PARTITION BY COALESCE(recording_mbid::text, LOWER(track_name))
                ) AS "play_count!"
            FROM track_plays
            ORDER BY COALESCE(recording_mbid::text, LOWER(track_name)), processed_time DESC, uri
            "#,
            mbid
        )
        .fetch_all(&self.db)
        .await?;

        let mut tracks = track_rows
            .into_iter()
            .filter_map(|row| {
                Some(TrackSummary {
                    uri: AtUri::try_from(row.uri).ok()?,
                    recording_mbid: row.recording_mbid.map(mbid_uri),
                    name: row.track_name.into(),
                    artist_name: row.artist_name?.into(),
                    play_count: row.play_count,
                    extra_data: Default::default(),
                })
            })
            .collect::<Vec<_>>();
        tracks.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

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
                .and_then(|value| {
                    from_json_value::<Vec<types::fm_teal::alpha::feed::Artist>>(value).ok()
                })
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
                origin_url: row.origin_url.map(Into::into),
                music_service_base_domain: row.music_service_base_domain.map(Into::into),
                submission_client_agent: row.submission_client_agent.map(Into::into),
                played_time: row
                    .played_time
                    .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
                extra_data: Default::default(),
            });
        }

        Ok(AlbumPage {
            album: AlbumView {
                artist_mbid: album_row.artist_mbid.map(mbid_uri),
                artist_name: album_row.artist_name.into(),
                mbid: mbid_uri(album_row.mbid),
                name: album_row.name.into(),
                play_count: album_row.play_count,
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
