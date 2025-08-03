use async_trait::async_trait;
use types::fm::teal::alpha::feed::defs::PlayViewData;
use types::fm::teal::alpha::stats::defs::{ArtistViewData, ReleaseViewData};

use super::{pg::PgDataSource, utc_to_atrium_datetime};

#[async_trait]
pub trait StatsRepo: Send + Sync {
    async fn get_top_artists(&self, limit: Option<i32>) -> anyhow::Result<Vec<ArtistViewData>>;
    async fn get_top_releases(&self, limit: Option<i32>) -> anyhow::Result<Vec<ReleaseViewData>>;
    async fn get_user_top_artists(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ArtistViewData>>;
    async fn get_user_top_releases(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ReleaseViewData>>;
    async fn get_latest(&self, limit: Option<i32>) -> anyhow::Result<Vec<PlayViewData>>;
}

#[async_trait]
impl StatsRepo for PgDataSource {
    async fn get_top_artists(&self, limit: Option<i32>) -> anyhow::Result<Vec<ArtistViewData>> {
        let limit = limit.unwrap_or(50).min(100) as i64;

        let rows = sqlx::query!(
            r#"
            SELECT
                pta.artist_mbid as mbid,
                pta.artist_name as name,
                COUNT(*) as play_count
            FROM plays p
            INNER JOIN play_to_artists pta ON p.uri = pta.play_uri
            WHERE pta.artist_mbid IS NOT NULL
              AND pta.artist_name IS NOT NULL
            GROUP BY pta.artist_mbid, pta.artist_name
            ORDER BY play_count DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            if let Some(name) = row.name {
                result.push(ArtistViewData {
                    mbid: row.mbid.to_string(),
                    name,
                    play_count: row.play_count.unwrap_or(0),
                });
            }
        }

        Ok(result)
    }

    async fn get_top_releases(&self, limit: Option<i32>) -> anyhow::Result<Vec<ReleaseViewData>> {
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
                result.push(ReleaseViewData {
                    mbid: mbid.to_string(),
                    name,
                    play_count: row.play_count.unwrap_or(0),
                });
            }
        }

        Ok(result)
    }

    async fn get_user_top_artists(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ArtistViewData>> {
        let limit = limit.unwrap_or(50).min(100) as i64;

        let rows = sqlx::query!(
            r#"
            SELECT
                pta.artist_mbid as mbid,
                pta.artist_name as name,
                COUNT(*) as play_count
            FROM plays p
            INNER JOIN play_to_artists pta ON p.uri = pta.play_uri
            WHERE p.did = $1
              AND pta.artist_mbid IS NOT NULL
              AND pta.artist_name IS NOT NULL
            GROUP BY pta.artist_mbid, pta.artist_name
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
            if let Some(name) = row.name {
                result.push(ArtistViewData {
                    mbid: row.mbid.to_string(),
                    name,
                    play_count: row.play_count.unwrap_or(0),
                });
            }
        }

        Ok(result)
    }

    async fn get_user_top_releases(
        &self,
        did: &str,
        limit: Option<i32>,
    ) -> anyhow::Result<Vec<ReleaseViewData>> {
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
                result.push(ReleaseViewData {
                    mbid: mbid.to_string(),
                    name,
                    play_count: row.play_count.unwrap_or(0),
                });
            }
        }

        Ok(result)
    }

    async fn get_latest(&self, limit: Option<i32>) -> anyhow::Result<Vec<PlayViewData>> {
        let limit = limit.unwrap_or(50).min(100) as i64;

        let rows = sqlx::query!(
            r#"
            SELECT
                uri, did, rkey, cid, isrc, duration, track_name, played_time, processed_time,
                release_mbid, release_name, recording_mbid, submission_client_agent,
                music_service_base_domain, origin_url,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'artist_mbid', pta.artist_mbid,
                      'artist_name', pta.artist_name
                    )
                  ) FILTER (WHERE pta.artist_name IS NOT NULL),
                  '[]'
                ) AS artists
            FROM plays p
            LEFT JOIN play_to_artists as pta ON p.uri = pta.play_uri
            GROUP BY uri, did, rkey, cid, isrc, duration, track_name, played_time, processed_time,
                     release_mbid, release_name, recording_mbid, submission_client_agent,
                     music_service_base_domain, origin_url
            ORDER BY processed_time DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            let artists: Vec<types::fm::teal::alpha::feed::defs::Artist> = match row.artists {
                Some(value) => serde_json::from_value(value).unwrap_or_default(),
                None => vec![],
            };

            result.push(PlayViewData {
                track_name: row.track_name.clone(),
                track_mb_id: row.recording_mbid.map(|u| u.to_string()),
                recording_mb_id: row.recording_mbid.map(|u| u.to_string()),
                duration: row.duration.map(|d| d as i64),
                artists,
                release_name: row.release_name.clone(),
                release_mb_id: row.release_mbid.map(|u| u.to_string()),
                isrc: row.isrc,
                origin_url: row.origin_url,
                music_service_base_domain: row.music_service_base_domain,
                submission_client_agent: row.submission_client_agent,
                played_time: row
                    .played_time
                    .map(|dt| utc_to_atrium_datetime(crate::repos::time_to_chrono_utc(dt))),
            });
        }

        Ok(result)
    }
}
