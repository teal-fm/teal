use async_trait::async_trait;
use jacquard_common::types::string::AtUri;
use types::fm_teal::{
    actor::MiniProfileView,
    search::SongResult,
    stats::{ArtistView, ReleaseView},
};

use super::{mbid_uri, mini_profile, pg::PgDataSource};

pub struct SearchResults {
    pub users: Vec<MiniProfileView>,
    pub songs: Vec<SongResult>,
    pub artists: Vec<ArtistView>,
    pub albums: Vec<ReleaseView>,
}

#[async_trait]
pub trait SearchRepo: Send + Sync {
    async fn search(&self, query: &str, limit: Option<i32>) -> anyhow::Result<SearchResults>;
}

#[async_trait]
impl SearchRepo for PgDataSource {
    async fn search(&self, query: &str, limit: Option<i32>) -> anyhow::Result<SearchResults> {
        let limit = limit.unwrap_or(8).clamp(1, 25) as i64;
        let pattern = format!("%{query}%");
        let prefix = format!("{query}%");

        let user_rows = sqlx::query!(
            r#"
            SELECT did, handle, display_name, avatar
            FROM profiles
            WHERE display_name ILIKE $1 OR handle ILIKE $1
            ORDER BY
                CASE
                    WHEN LOWER(handle) = LOWER($2) OR LOWER(display_name) = LOWER($2) THEN 0
                    WHEN handle ILIKE $3 OR display_name ILIKE $3 THEN 1
                    ELSE 2
                END,
                display_name NULLS LAST,
                handle NULLS LAST
            LIMIT $4
            "#,
            pattern,
            query,
            prefix,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let users = user_rows
            .into_iter()
            .filter_map(|row| mini_profile(Some(row.did), row.handle, row.display_name, row.avatar))
            .collect();

        let song_rows = sqlx::query!(
            r#"
            WITH matched AS (
                SELECT
                    p.uri,
                    p.track_name,
                    p.release_name,
                    p.release_mbid,
                    p.processed_time,
                    COALESCE(
                        STRING_AGG(DISTINCT ptae.artist_name, ', ' ORDER BY ptae.artist_name),
                        'Unknown artist'
                    ) AS artist_name,
                    COUNT(*) OVER (
                        PARTITION BY LOWER(p.track_name), COALESCE(p.recording_mbid::text, '')
                    ) AS play_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY LOWER(p.track_name), COALESCE(p.recording_mbid::text, '')
                        ORDER BY p.processed_time DESC, p.uri
                    ) AS row_number
                FROM plays p
                LEFT JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
                WHERE p.track_name ILIKE $1
                GROUP BY p.uri, p.track_name, p.release_name, p.release_mbid, p.processed_time,
                         p.recording_mbid
            )
            SELECT uri, track_name, release_name, release_mbid, artist_name, play_count
            FROM matched
            WHERE row_number = 1
            ORDER BY
                CASE
                    WHEN LOWER(track_name) = LOWER($2) THEN 0
                    WHEN track_name ILIKE $3 THEN 1
                    ELSE 2
                END,
                play_count DESC,
                track_name
            LIMIT $4
            "#,
            pattern,
            query,
            prefix,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let songs = song_rows
            .into_iter()
            .filter_map(|row| {
                Some(SongResult {
                    uri: AtUri::try_from(row.uri).ok()?,
                    track_name: row.track_name.into(),
                    artist_name: row.artist_name?.into(),
                    release_name: row.release_name.map(Into::into),
                    release_mb_id: row.release_mbid.map(mbid_uri),
                    play_count: row.play_count?,
                    extra_data: Default::default(),
                })
            })
            .collect();

        let artist_rows = sqlx::query!(
            r#"
            SELECT ae.mbid, ae.name, COUNT(ptae.play_uri) AS play_count
            FROM artists_extended ae
            LEFT JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
            WHERE ae.name ILIKE $1
            GROUP BY ae.id, ae.mbid, ae.name
            ORDER BY
                CASE
                    WHEN LOWER(ae.name) = LOWER($2) THEN 0
                    WHEN ae.name ILIKE $3 THEN 1
                    ELSE 2
                END,
                play_count DESC,
                ae.name
            LIMIT $4
            "#,
            pattern,
            query,
            prefix,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let artists = artist_rows
            .into_iter()
            .map(|row| ArtistView {
                mbid: row.mbid.map(mbid_uri),
                name: Some(row.name.into()),
                play_count: Some(row.play_count.unwrap_or(0)),
                extra_data: Default::default(),
            })
            .collect();

        let album_rows = sqlx::query!(
            r#"
            SELECT r.mbid, r.name, COUNT(p.uri) AS play_count
            FROM releases r
            LEFT JOIN plays p ON r.mbid = p.release_mbid
            WHERE r.name ILIKE $1
            GROUP BY r.mbid, r.name
            ORDER BY
                CASE
                    WHEN LOWER(r.name) = LOWER($2) THEN 0
                    WHEN r.name ILIKE $3 THEN 1
                    ELSE 2
                END,
                play_count DESC,
                r.name
            LIMIT $4
            "#,
            pattern,
            query,
            prefix,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let albums = album_rows
            .into_iter()
            .map(|row| ReleaseView {
                mbid: Some(mbid_uri(row.mbid)),
                name: Some(row.name.into()),
                play_count: Some(row.play_count.unwrap_or(0)),
                extra_data: Default::default(),
            })
            .collect();

        Ok(SearchResults {
            users,
            songs,
            artists,
            albums,
        })
    }
}
