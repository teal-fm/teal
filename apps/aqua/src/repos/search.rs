use async_trait::async_trait;
use jacquard_common::types::string::AtUri;
use types::fm_teal::alpha::{
    actor::MiniProfileView,
    search::SongResult,
    stats::{ArtistView, ReleaseView},
};

use super::{mbid_uri, mini_profile, pg::PgDataSource};

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

pub struct SearchResults {
    pub users: Vec<MiniProfileView>,
    pub songs: Vec<SongResult>,
    pub artists: Vec<ArtistView>,
    pub albums: Vec<ReleaseView>,
}

#[async_trait]
pub trait SearchRepo: Send + Sync {
    async fn search(
        &self,
        query: &str,
        limit: Option<i32>,
        actor: Option<&str>,
    ) -> anyhow::Result<SearchResults>;
}

#[async_trait]
impl SearchRepo for PgDataSource {
    async fn search(
        &self,
        query: &str,
        limit: Option<i32>,
        actor: Option<&str>,
    ) -> anyhow::Result<SearchResults> {
        let limit = limit.unwrap_or(8).clamp(1, 25) as i64;
        let escaped_query = escape_like(query);
        let pattern = format!("%{escaped_query}%");
        let prefix = format!("{escaped_query}%");

        let user_rows = sqlx::query!(
            r#"
            SELECT did, handle, display_name, avatar
            FROM profiles
            WHERE display_name ILIKE $1 ESCAPE E'\\' OR handle ILIKE $1 ESCAPE E'\\'
            ORDER BY
                CASE
                    WHEN LOWER(handle) = LOWER($2) OR LOWER(display_name) = LOWER($2) THEN 0
                    WHEN handle ILIKE $3 ESCAPE E'\\' OR display_name ILIKE $3 ESCAPE E'\\' THEN 1
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
            WITH grouped AS (
                SELECT
                    p.uri,
                    p.track_name,
                    p.release_name,
                    p.release_mbid,
                    p.recording_mbid,
                    p.processed_time,
                    COALESCE(
                        STRING_AGG(DISTINCT ptae.artist_name, ', ' ORDER BY ptae.artist_name),
                        'Unknown artist'
                    ) AS artist_name,
                    COALESCE(
                        STRING_AGG(DISTINCT LOWER(ptae.artist_name), chr(31) ORDER BY LOWER(ptae.artist_name)),
                        ''
                    ) AS artist_key
                FROM plays p
                LEFT JOIN play_to_artists_extended ptae ON p.uri = ptae.play_uri
                WHERE p.track_name ILIKE $1 ESCAPE E'\\'
                  AND ($5::text IS NULL OR p.did = $5)
                GROUP BY p.uri, p.track_name, p.release_name, p.release_mbid, p.processed_time,
                         p.recording_mbid
            ), matched AS (
                SELECT
                    uri,
                    track_name,
                    release_name,
                    release_mbid,
                    recording_mbid,
                    processed_time,
                    artist_name,
                    COUNT(*) OVER (
                        PARTITION BY LOWER(track_name), COALESCE(recording_mbid::text, artist_key)
                    ) AS play_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY LOWER(track_name), COALESCE(recording_mbid::text, artist_key)
                        ORDER BY processed_time DESC, uri
                    ) AS row_number
                FROM grouped
            )
            SELECT uri, track_name, release_name, release_mbid, recording_mbid, artist_name, play_count
            FROM matched
            WHERE row_number = 1
            ORDER BY
                CASE
                    WHEN LOWER(track_name) = LOWER($2) THEN 0
                    WHEN track_name ILIKE $3 ESCAPE E'\\' THEN 1
                    ELSE 2
                END,
                play_count DESC,
                track_name
            LIMIT $4
            "#,
            pattern,
            query,
            prefix,
            limit,
            actor
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
                    recording_mb_id: row.recording_mbid.map(mbid_uri),
                    play_count: row.play_count?,
                    extra_data: Default::default(),
                })
            })
            .collect();

        let artist_rows = sqlx::query!(
            r#"
            SELECT ae.mbid, ae.name, COUNT(DISTINCT p.uri) AS play_count
            FROM artists_extended ae
            LEFT JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
            LEFT JOIN plays p ON p.uri = ptae.play_uri
            WHERE ae.name ILIKE $1 ESCAPE E'\\'
              AND ($5::text IS NULL OR p.did = $5)
            GROUP BY ae.id, ae.mbid, ae.name
            ORDER BY
                CASE
                    WHEN LOWER(ae.name) = LOWER($2) THEN 0
                    WHEN ae.name ILIKE $3 ESCAPE E'\\' THEN 1
                    ELSE 2
                END,
                play_count DESC,
                ae.name
            LIMIT $4
            "#,
            pattern,
            query,
            prefix,
            limit,
            actor
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
            SELECT r.mbid, r.name, COUNT(DISTINCT p.uri) AS play_count
            FROM releases r
            LEFT JOIN plays p ON r.mbid = p.release_mbid
            WHERE r.name ILIKE $1 ESCAPE E'\\'
              AND ($5::text IS NULL OR p.did = $5)
            GROUP BY r.mbid, r.name
            ORDER BY
                CASE
                    WHEN LOWER(r.name) = LOWER($2) THEN 0
                    WHEN r.name ILIKE $3 ESCAPE E'\\' THEN 1
                    ELSE 2
                END,
                play_count DESC,
                r.name
            LIMIT $4
            "#,
            pattern,
            query,
            prefix,
            limit,
            actor
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

#[cfg(test)]
mod tests {
    use super::escape_like;

    #[test]
    fn escapes_like_wildcards_and_escape_characters() {
        assert_eq!(escape_like(r"100%_ready\now"), r"100\%\_ready\\now");
    }
}
