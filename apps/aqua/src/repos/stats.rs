use async_trait::async_trait;
use jacquard_common::from_json_value;
use jacquard_common::types::string::{AtUri, Did};
use serde::{Deserialize, Serialize};
use types::fm_teal::alpha::feed::PlayView;
use types::fm_teal::alpha::stats::{ArtistView, ReleaseView};

use super::{mbid_uri, mini_profile, pg::PgDataSource, utc_to_atrium_datetime};

pub struct LatestPlaysPage {
    pub plays: Vec<PlayView>,
    pub cursor: Option<String>,
}

#[derive(Deserialize, Serialize)]
pub(crate) struct LatestPlaysCursor {
    pub processed_time: String,
    pub uri: String,
}

pub(crate) fn decode_latest_cursor(
    cursor: Option<&str>,
) -> anyhow::Result<Option<LatestPlaysCursor>> {
    cursor
        .map(|cursor| {
            let bytes =
                base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, cursor)?;
            Ok(serde_json::from_slice(&bytes)?)
        })
        .transpose()
}

pub(crate) fn encode_latest_cursor(cursor: &LatestPlaysCursor) -> anyhow::Result<String> {
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        serde_json::to_vec(cursor)?,
    ))
}

#[async_trait]
pub trait StatsRepo: Send + Sync {
    async fn get_top_artists(&self, limit: Option<i32>) -> anyhow::Result<Vec<ArtistView>>;
    async fn get_top_releases(&self, limit: Option<i32>) -> anyhow::Result<Vec<ReleaseView>>;
    async fn get_user_top_artists(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ArtistView>>;
    async fn get_user_top_releases(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ReleaseView>>;
    async fn get_latest(
        &self,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<LatestPlaysPage>;
}

#[async_trait]
impl StatsRepo for PgDataSource {
    async fn get_top_artists(&self, limit: Option<i32>) -> anyhow::Result<Vec<ArtistView>> {
        let limit = limit.unwrap_or(50).min(100) as i64;

        let rows = sqlx::query!(
            r#"
            SELECT
                ae.mbid,
                ptae.artist_name as name,
                COUNT(*) as play_count
            FROM plays p
            INNER JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
            INNER JOIN artists_extended ae ON ptae.artist_id = ae.id
            WHERE ptae.artist_name IS NOT NULL
            GROUP BY ae.mbid, ptae.artist_name
            ORDER BY play_count DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            result.push(ArtistView {
                mbid: row.mbid.map(mbid_uri),
                name: Some(row.name.into()),
                play_count: Some(row.play_count.unwrap_or(0)),
                extra_data: Default::default(),
            });
        }

        Ok(result)
    }

    async fn get_top_releases(&self, limit: Option<i32>) -> anyhow::Result<Vec<ReleaseView>> {
        let limit = limit.unwrap_or(50).min(100) as i64;

        let rows = sqlx::query!(
            r#"
            SELECT
                p.release_mbid as mbid,
                p.release_name as name,
                COUNT(*) as play_count
            FROM plays p
            WHERE p.release_mbid IS NOT NULL
              AND p.release_name IS NOT NULL
            GROUP BY p.release_mbid, p.release_name
            ORDER BY play_count DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            if let (Some(mbid), Some(name)) = (row.mbid, row.name) {
                result.push(ReleaseView {
                    mbid: Some(mbid_uri(mbid)),
                    name: Some(name.into()),
                    play_count: Some(row.play_count.unwrap_or(0)),
                    extra_data: Default::default(),
                });
            }
        }

        Ok(result)
    }

    async fn get_user_top_artists(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ArtistView>> {
        let limit = limit.unwrap_or(50).min(100) as i64;

        let rows = sqlx::query!(
            r#"
            SELECT
                ae.mbid,
                ptae.artist_name as name,
                COUNT(*) as play_count
            FROM plays p
            INNER JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
            INNER JOIN artists_extended ae ON ptae.artist_id = ae.id
            WHERE p.did = $1
              AND ptae.artist_name IS NOT NULL
            GROUP BY ae.mbid, ptae.artist_name
            ORDER BY play_count DESC
            LIMIT $2
            "#,
            did,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            result.push(ArtistView {
                mbid: row.mbid.map(mbid_uri),
                name: Some(row.name.into()),
                play_count: Some(row.play_count.unwrap_or(0)),
                extra_data: Default::default(),
            });
        }

        Ok(result)
    }

    async fn get_user_top_releases(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ReleaseView>> {
        let limit = limit.unwrap_or(50).min(100) as i64;

        let rows = sqlx::query!(
            r#"
            SELECT
                p.release_mbid as mbid,
                p.release_name as name,
                COUNT(*) as play_count
            FROM plays p
            WHERE p.did = $1
              AND p.release_mbid IS NOT NULL
              AND p.release_name IS NOT NULL
            GROUP BY p.release_mbid, p.release_name
            ORDER BY play_count DESC
            LIMIT $2
            "#,
            did,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            if let (Some(mbid), Some(name)) = (row.mbid, row.name) {
                result.push(ReleaseView {
                    mbid: Some(mbid_uri(mbid)),
                    name: Some(name.into()),
                    play_count: Some(row.play_count.unwrap_or(0)),
                    extra_data: Default::default(),
                });
            }
        }

        Ok(result)
    }

    async fn get_latest(
        &self,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<LatestPlaysPage> {
        let limit = limit.unwrap_or(50).min(100) as i64;
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
            WHERE ($1::timestamptz IS NULL OR (p.processed_time, p.uri) < ($1, $2))
            GROUP BY p.uri, p.did, p.rkey, p.cid, p.isrc, p.duration, p.track_name, p.played_time,
                     p.processed_time, p.release_mbid, p.release_name, p.recording_mbid,
                     p.submission_client_agent, p.music_service_base_domain, p.origin_url,
                     profile.did, profile.handle, profile.display_name, profile.avatar
            ORDER BY p.processed_time DESC
            LIMIT $3
            "#,
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
            let artists = match row.artists {
                Some(value) => from_json_value::<Vec<types::fm_teal::alpha::feed::Artist>>(value)
                    .unwrap_or_default(),
                None => vec![],
            };

            plays.push(PlayView {
                track_name: row.track_name.into(),
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
                artists: artists.into_iter().map(|a| a.to_owned()).collect(),
                release_name: row.release_name.map(|s| s.into()),
                release_mb_id: row.release_mbid.map(mbid_uri),
                isrc: row.isrc.map(|s| s.into()),
                origin_url: row.origin_url.map(|s| s.into()),
                music_service_base_domain: row.music_service_base_domain.map(|s| s.into()),
                submission_client_agent: row.submission_client_agent.map(|s| s.into()),
                played_time: row
                    .played_time
                    .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
                extra_data: Default::default(),
            });
        }

        Ok(LatestPlaysPage {
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
    use super::{LatestPlaysCursor, decode_latest_cursor, encode_latest_cursor};

    #[test]
    fn latest_cursor_round_trips() -> anyhow::Result<()> {
        let cursor = LatestPlaysCursor {
            processed_time: "2026-05-31T22:53:52Z".to_string(),
            uri: "at://did:plc:listener/fm.teal.alpha.feed.play/3example".to_string(),
        };
        let encoded = encode_latest_cursor(&cursor)?;
        let decoded = decode_latest_cursor(Some(&encoded))?.expect("cursor should decode");

        assert_eq!(decoded.processed_time, cursor.processed_time);
        assert_eq!(decoded.uri, cursor.uri);
        Ok(())
    }

    #[test]
    fn latest_cursor_rejects_invalid_values() {
        assert!(decode_latest_cursor(Some("not-a-cursor")).is_err());
    }
}
