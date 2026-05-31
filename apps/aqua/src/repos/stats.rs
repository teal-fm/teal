use async_trait::async_trait;
use jacquard_common::from_json_value;
use jacquard_common::types::string::{AtUri, Did};
use types::fm_teal::alpha::feed::PlayView;
use types::fm_teal::alpha::stats::{ArtistView, ReleaseView};

use super::{mbid_uri, pg::PgDataSource, utc_to_atrium_datetime};

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
    async fn get_latest(&self, limit: Option<i32>) -> anyhow::Result<Vec<PlayView>>;
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

    async fn get_latest(&self, limit: Option<i32>) -> anyhow::Result<Vec<PlayView>> {
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
                      'artistMbId', ae.mbid,
                      'artistName', ptae.artist_name
                    )
                  ) FILTER (WHERE ptae.artist_name IS NOT NULL),
                  '[]'
                ) AS artists
            FROM plays p
            LEFT JOIN play_to_artists_extended as ptae ON p.uri = ptae.play_uri
            LEFT JOIN artists_extended as ae ON ptae.artist_id = ae.id
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
            let artists = match row.artists {
                Some(value) => from_json_value::<Vec<types::fm_teal::alpha::feed::Artist>>(value)
                    .unwrap_or_default(),
                None => vec![],
            };

            result.push(PlayView {
                track_name: row.track_name.into(),
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

        Ok(result)
    }
}
