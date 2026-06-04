use async_trait::async_trait;
use anyhow::anyhow;
use base64::Engine;
use jacquard_common::from_json_value;
use jacquard_common::types::string::{AtUri, Did};
use serde::{Deserialize, Serialize};
use sqlx::types::Uuid;
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
    encode_cursor(cursor)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatsPeriod {
    SevenDays,
    ThirtyDays,
}

impl StatsPeriod {
    fn parse(period: Option<&str>) -> anyhow::Result<Self> {
        match period.unwrap_or("30days") {
            "7days" => Ok(Self::SevenDays),
            "30days" => Ok(Self::ThirtyDays),
            other => Err(anyhow!("unsupported period: {other}")),
        }
    }

    fn interval_sql(self) -> &'static str {
        match self {
            Self::SevenDays => "INTERVAL '7 days'",
            Self::ThirtyDays => "INTERVAL '30 days'",
        }
    }
}

#[derive(Deserialize, Serialize)]
pub(crate) struct OffsetCursor {
    pub offset: i64,
}

pub struct UserTopArtistsPage {
    pub artists: Vec<ArtistView>,
    pub cursor: Option<String>,
}

pub struct UserTopReleasesPage {
    pub releases: Vec<ReleaseView>,
    pub cursor: Option<String>,
}

fn normalize_limit(limit: Option<i32>) -> i64 {
    limit.unwrap_or(50).clamp(1, 100) as i64
}

fn decode_offset_cursor(cursor: Option<&str>) -> anyhow::Result<i64> {
    Ok(cursor
        .map(|cursor| decode_cursor::<OffsetCursor>(cursor).map(|cursor| cursor.offset.max(0)))
        .transpose()?
        .unwrap_or(0))
}

fn encode_offset_cursor(offset: i64) -> anyhow::Result<String> {
    encode_cursor(&OffsetCursor { offset })
}

fn decode_cursor<T>(cursor: &str) -> anyhow::Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(cursor)?;
    Ok(serde_json::from_slice(&bytes)?)
}

fn encode_cursor<T>(cursor: &T) -> anyhow::Result<String>
where
    T: Serialize,
{
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(serde_json::to_vec(cursor)?))
}

#[async_trait]
pub trait StatsRepo: Send + Sync {
    async fn get_top_artists(&self, limit: Option<i32>) -> anyhow::Result<Vec<ArtistView>>;
    async fn get_top_releases(&self, limit: Option<i32>) -> anyhow::Result<Vec<ReleaseView>>;
    async fn get_user_top_artists(
        &self,
        actor: &str,
        period: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<UserTopArtistsPage>;
    async fn get_user_top_releases(
        &self,
        actor: &str,
        period: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<UserTopReleasesPage>;
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
        actor: &str,
        period: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<UserTopArtistsPage> {
        let did = self.resolve_actor_to_did(actor).await?;
        let period = StatsPeriod::parse(period)?;
        let limit = normalize_limit(limit);
        let offset = decode_offset_cursor(cursor)?;
        let query_limit = limit + 1;
        let sql = format!(
            r#"
            SELECT
                ae.mbid,
                ptae.artist_name as name,
                COUNT(*)::bigint as play_count
            FROM plays p
            INNER JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
            INNER JOIN artists_extended ae ON ptae.artist_id = ae.id
            WHERE p.did = $1
              AND p.played_time >= NOW() - {}
              AND ptae.artist_name IS NOT NULL
            GROUP BY ae.mbid, ptae.artist_name
            ORDER BY play_count DESC, ptae.artist_name ASC, ae.mbid ASC
            LIMIT $2 OFFSET $3
            "#,
            period.interval_sql()
        );

        let rows = sqlx::query_as::<_, (Option<Uuid>, String, i64)>(&sql)
            .bind(did)
            .bind(query_limit)
            .bind(offset)
        .fetch_all(&self.db)
        .await?;

        let has_more = rows.len() > limit as usize;
        let mut artists = Vec::with_capacity(rows.len().min(limit as usize));
        for (mbid, name, play_count) in rows.into_iter().take(limit as usize) {
            artists.push(ArtistView {
                mbid: mbid.map(mbid_uri),
                name: Some(name.into()),
                play_count: Some(play_count),
                extra_data: Default::default(),
            });
        }

        Ok(UserTopArtistsPage {
            artists,
            cursor: if has_more {
                Some(encode_offset_cursor(offset + limit)?)
            } else {
                None
            },
        })
    }

    async fn get_user_top_releases(
        &self,
        actor: &str,
        period: Option<&str>,
        limit: Option<i32>,
        cursor: Option<&str>,
    ) -> anyhow::Result<UserTopReleasesPage> {
        let did = self.resolve_actor_to_did(actor).await?;
        let period = StatsPeriod::parse(period)?;
        let limit = normalize_limit(limit);
        let offset = decode_offset_cursor(cursor)?;
        let query_limit = limit + 1;
        let sql = format!(
            r#"
            SELECT
                p.release_mbid as mbid,
                p.release_name as name,
                COUNT(*)::bigint as play_count
            FROM plays p
            WHERE p.did = $1
              AND p.played_time >= NOW() - {}
              AND p.release_mbid IS NOT NULL
              AND p.release_name IS NOT NULL
            GROUP BY p.release_mbid, p.release_name
            ORDER BY play_count DESC, p.release_name ASC, p.release_mbid ASC
            LIMIT $2 OFFSET $3
            "#,
            period.interval_sql()
        );

        let rows = sqlx::query_as::<_, (Option<Uuid>, Option<String>, i64)>(&sql)
            .bind(did)
            .bind(query_limit)
            .bind(offset)
        .fetch_all(&self.db)
        .await?;

        let has_more = rows.len() > limit as usize;
        let mut releases = Vec::with_capacity(rows.len().min(limit as usize));
        for (mbid, name, play_count) in rows.into_iter().take(limit as usize) {
            if let (Some(mbid), Some(name)) = (mbid, name) {
                releases.push(ReleaseView {
                    mbid: Some(mbid_uri(mbid)),
                    name: Some(name.into()),
                    play_count: Some(play_count),
                    extra_data: Default::default(),
                });
            }
        }

        Ok(UserTopReleasesPage {
            releases,
            cursor: if has_more {
                Some(encode_offset_cursor(offset + limit)?)
            } else {
                None
            },
        })
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

impl PgDataSource {
    async fn resolve_actor_to_did(&self, actor: &str) -> anyhow::Result<String> {
        if actor.starts_with("did:") {
            return Ok(actor.to_string());
        }

        if let Some(row) = sqlx::query_as::<_, (String,)>(
            "SELECT did FROM profiles WHERE LOWER(handle) = LOWER($1) LIMIT 1",
        )
        .bind(actor.trim_start_matches("at://"))
        .fetch_optional(&self.db)
        .await?
        {
            return Ok(row.0);
        }

        let url = format!(
            "https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={}",
            url::form_urlencoded::byte_serialize(actor.as_bytes()).collect::<String>()
        );
        let response: serde_json::Value = reqwest::get(&url).await?.json().await?;
        response
            .get("did")
            .and_then(|did| did.as_str())
            .map(ToString::to_string)
            .ok_or_else(|| anyhow!("could not resolve actor handle: {actor}"))
    }
}

#[cfg(test)]
mod tests {
    use super::{
        LatestPlaysCursor, OffsetCursor, StatsPeriod, decode_latest_cursor, decode_offset_cursor,
        encode_latest_cursor, encode_offset_cursor, normalize_limit,
    };

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

    #[test]
    fn offset_cursor_round_trips() -> anyhow::Result<()> {
        let encoded = encode_offset_cursor(100)?;
        assert_eq!(decode_offset_cursor(Some(&encoded))?, 100);
        Ok(())
    }

    #[test]
    fn offset_cursor_defaults_and_clamps_negative_values() -> anyhow::Result<()> {
        assert_eq!(decode_offset_cursor(None)?, 0);
        let encoded = super::encode_cursor(&OffsetCursor { offset: -10 })?;
        assert_eq!(decode_offset_cursor(Some(&encoded))?, 0);
        Ok(())
    }

    #[test]
    fn stats_period_accepts_only_lexicon_values() {
        assert_eq!(StatsPeriod::parse(None).unwrap(), StatsPeriod::ThirtyDays);
        assert_eq!(
            StatsPeriod::parse(Some("7days")).unwrap(),
            StatsPeriod::SevenDays
        );
        assert!(StatsPeriod::parse(Some("all")).is_err());
    }

    #[test]
    fn stats_limit_is_bounded() {
        assert_eq!(normalize_limit(None), 50);
        assert_eq!(normalize_limit(Some(-5)), 1);
        assert_eq!(normalize_limit(Some(500)), 100);
    }
}
