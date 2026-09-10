use async_trait::async_trait;
use jacquard_common::from_json_value;
use jacquard_common::types::string::{AtUri, Did};
use types::fm_teal::feed::{Artist, PlayView};

use super::{
    mbid_uri, mini_profile,
    pg::PgDataSource,
    stats::{decode_latest_cursor, encode_latest_cursor, LatestPlaysCursor},
    uri_value, utc_to_atrium_datetime,
};

pub struct ActorFeedPage {
    pub plays: Vec<PlayView>,
    pub cursor: Option<String>,
}

#[async_trait]
pub trait FeedPlayRepo: Send + Sync {
    async fn get_feed_play(&self, identity: &str) -> anyhow::Result<Option<PlayView>>;
    async fn get_actor_feed(
        &self,
        author_did: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<ActorFeedPage>;
    async fn get_feed_plays_for_profile(
        &self,
        identities: &[String],
    ) -> anyhow::Result<Vec<PlayView>>;
}

#[async_trait]
impl FeedPlayRepo for PgDataSource {
    async fn get_feed_play(&self, uri: &str) -> anyhow::Result<Option<PlayView>> {
        let row = sqlx::query!(
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
            LEFT JOIN play_to_artists_extended as ptae ON p.uri = ptae.play_uri
            LEFT JOIN artists_extended as ae ON ptae.artist_id = ae.id
            WHERE p.uri = $1
            GROUP BY p.uri, p.did, p.rkey, p.cid, p.isrc, p.duration, p.track_name, p.played_time,
                     p.processed_time, p.release_mbid, p.release_name, p.recording_mbid,
                     p.submission_client_agent, p.music_service_base_domain, p.origin_url,
                     profile.did, profile.handle, profile.display_name, profile.avatar
            ORDER BY p.processed_time desc
            "#,
            uri
        )
        .fetch_optional(&self.db)
        .await?;

        let Some(row) = row else {
            return Ok(None);
        };

        let artists: Vec<Artist> = match row.artists {
            Some(value) => from_json_value::<Vec<Artist>>(value).unwrap_or_default(),
            None => vec![],
        };

        Ok(Some(PlayView {
            track_name: row.track_name.clone().into(),
            author: mini_profile(
                row.profile_did,
                row.profile_handle,
                row.profile_display_name,
                row.profile_avatar,
            ),
            uri: AtUri::try_from(row.uri.clone()).ok(),
            cid: Some(row.cid.clone().into()),
            author_did: Did::new_owned(&row.did).ok(),
            rkey: Some(row.rkey.clone().into()),
            track_mb_id: row.recording_mbid.map(mbid_uri),
            recording_mb_id: row.recording_mbid.map(mbid_uri),
            duration: row.duration.map(|d| d as i64),
            artists,
            release_name: row.release_name.clone().map(|s| s.into()),
            release_mb_id: row.release_mbid.map(mbid_uri),
            isrc: row.isrc.map(|s| s.into()),
            origin_uri: row.origin_url.map(uri_value),
            music_service_uri: row.music_service_base_domain.map(uri_value),
            submission_client_agent: row.submission_client_agent.map(|s| s.into()),
            played_time: row
                .played_time
                .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
            extra_data: Default::default(),
        }))
    }

    async fn get_actor_feed(
        &self,
        author_did: &str,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<ActorFeedPage> {
        let limit = limit.unwrap_or(20).clamp(1, 50) as i64;
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
            LEFT JOIN play_to_artists_extended as ptae ON p.uri = ptae.play_uri
            LEFT JOIN artists_extended as ae ON ptae.artist_id = ae.id
            WHERE p.did = $1
              AND ($2::timestamptz IS NULL OR (p.processed_time, p.uri) < ($2, $3))
            GROUP BY p.uri, p.did, p.rkey, p.cid, p.isrc, p.duration, p.track_name, p.played_time,
                     p.processed_time, p.release_mbid, p.release_name, p.recording_mbid,
                     p.submission_client_agent, p.music_service_base_domain, p.origin_url,
                     profile.did, profile.handle, profile.display_name, profile.avatar
            ORDER BY p.processed_time DESC, p.uri DESC
            LIMIT $4
            "#,
            author_did,
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

            let artists: Vec<Artist> = match row.artists {
                Some(value) => from_json_value::<Vec<Artist>>(value).unwrap_or_default(),
                None => vec![],
            };

            plays.push(PlayView {
                track_name: row.track_name.clone().into(),
                author: mini_profile(
                    row.profile_did,
                    row.profile_handle,
                    row.profile_display_name,
                    row.profile_avatar,
                ),
                uri: AtUri::try_from(row.uri.clone()).ok(),
                cid: Some(row.cid.clone().into()),
                author_did: Did::new_owned(&row.did).ok(),
                rkey: Some(row.rkey.clone().into()),
                track_mb_id: row.recording_mbid.map(mbid_uri),
                recording_mb_id: row.recording_mbid.map(mbid_uri),
                duration: row.duration.map(|d| d as i64),
                artists,
                release_name: row.release_name.clone().map(|s| s.into()),
                release_mb_id: row.release_mbid.map(mbid_uri),
                isrc: row.isrc.map(|s| s.into()),
                origin_uri: row.origin_url.map(uri_value),
                music_service_uri: row.music_service_base_domain.map(uri_value),
                submission_client_agent: row.submission_client_agent.map(|s| s.into()),
                played_time: row
                    .played_time
                    .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
                extra_data: Default::default(),
            });
        }

        Ok(ActorFeedPage {
            plays,
            cursor: if has_more {
                next_cursor.as_ref().map(encode_latest_cursor).transpose()?
            } else {
                None
            },
        })
    }

    async fn get_feed_plays_for_profile(
        &self,
        identities: &[String],
    ) -> anyhow::Result<Vec<PlayView>> {
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
            LEFT JOIN play_to_artists_extended as ptae ON p.uri = ptae.play_uri
            LEFT JOIN artists_extended as ae ON ptae.artist_id = ae.id
            WHERE p.did = ANY($1)
            GROUP BY p.uri, p.did, p.rkey, p.cid, p.isrc, p.duration, p.track_name, p.played_time,
                     p.processed_time, p.release_mbid, p.release_name, p.recording_mbid,
                     p.submission_client_agent, p.music_service_base_domain, p.origin_url,
                     profile.did, profile.handle, profile.display_name, profile.avatar
            ORDER BY p.processed_time desc
            "#,
            identities
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            // Deserialize artists JSON array into Vec<Artist>
            let artists: Vec<Artist> = match row.artists {
                Some(value) => from_json_value::<Vec<Artist>>(value).unwrap_or_default(),
                None => vec![],
            };

            result.push(PlayView {
                track_name: row.track_name.clone().into(),
                author: mini_profile(
                    row.profile_did,
                    row.profile_handle,
                    row.profile_display_name,
                    row.profile_avatar,
                ),
                uri: AtUri::try_from(row.uri.clone()).ok(),
                cid: Some(row.cid.clone().into()),
                author_did: Did::new_owned(&row.did).ok(),
                rkey: Some(row.rkey.clone().into()),
                track_mb_id: row.recording_mbid.map(mbid_uri),
                recording_mb_id: row.recording_mbid.map(mbid_uri),
                duration: row.duration.map(|d| d as i64),
                artists,
                release_name: row.release_name.clone().map(|s| s.into()),
                release_mb_id: row.release_mbid.map(mbid_uri),
                isrc: row.isrc.map(|s| s.into()),
                origin_uri: row.origin_url.map(uri_value),
                music_service_uri: row.music_service_base_domain.map(uri_value),
                submission_client_agent: row.submission_client_agent.map(|s| s.into()),
                played_time: row
                    .played_time
                    .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
                extra_data: Default::default(),
            });
        }

        Ok(result)
    }
}
