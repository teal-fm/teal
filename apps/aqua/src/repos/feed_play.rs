use async_trait::async_trait;
use types::fm::teal::alpha::feed::defs::{Artist, PlayViewData};

use super::{pg::PgDataSource, utc_to_atrium_datetime};

#[async_trait]
pub trait FeedPlayRepo: Send + Sync {
    async fn get_feed_play(&self, identity: &str) -> anyhow::Result<Option<PlayViewData>>;
    async fn get_feed_plays_for_profile(
        &self,
        identities: &[String],
    ) -> anyhow::Result<Vec<PlayViewData>>;
}

#[async_trait]
impl FeedPlayRepo for PgDataSource {
    async fn get_feed_play(&self, uri: &str) -> anyhow::Result<Option<PlayViewData>> {
        let row = sqlx::query!(
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
            FROM plays
            LEFT JOIN play_to_artists as pta ON uri = pta.play_uri
            WHERE uri = $1
            GROUP BY uri, did, rkey, cid, isrc, duration, track_name, played_time, processed_time,
                     release_mbid, release_name, recording_mbid, submission_client_agent,
                     music_service_base_domain, origin_url
            ORDER BY processed_time desc
            "#,
            &uri.to_string()
        )
        .fetch_one(&self.db)
        .await?;

        let artists: Vec<Artist> = match row.artists {
            Some(value) => serde_json::from_value(value).unwrap_or_default(),
            None => vec![],
        };

        Ok(Some(PlayViewData {
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
        }))
    }

    async fn get_feed_plays_for_profile(
        &self,
        identities: &[String],
    ) -> anyhow::Result<Vec<PlayViewData>> {
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
            FROM plays
            LEFT JOIN play_to_artists as pta ON uri = pta.play_uri
            WHERE did = ANY($1)
            GROUP BY uri, did, rkey, cid, isrc, duration, track_name, played_time, processed_time,
                     release_mbid, release_name, recording_mbid, submission_client_agent,
                     music_service_base_domain, origin_url
            ORDER BY processed_time desc
            "#,
            identities
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(rows.len());
        for row in rows {
            // Deserialize artists JSON array into Vec<Artist>
            let artists: Vec<Artist> = match row.artists {
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
