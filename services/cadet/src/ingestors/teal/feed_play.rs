use anyhow::anyhow;
use async_trait::async_trait;
use jacquard_common::{
    types::{string::Datetime, value},
    IntoStatic,
};
use rocketman::{ingestion::LexiconIngestor, types::event::Event};
use serde_json::Value;
use sqlx::{types::Uuid, PgPool};

use super::assemble_at_uri;

#[derive(Debug, Clone)]
struct FuzzyMatchCandidate {
    artist_id: i32,
    name: String,
    confidence: f64,
}

struct MusicBrainzCleaner;

impl MusicBrainzCleaner {
    /// List of common "guff" words found in parentheses that should be removed
    const GUFF_WORDS: &'static [&'static str] = &[
        "a cappella",
        "acoustic",
        "bonus",
        "censored",
        "clean",
        "club",
        "clubmix",
        "composition",
        "cut",
        "dance",
        "demo",
        "dialogue",
        "dirty",
        "edit",
        "excerpt",
        "explicit",
        "extended",
        "feat",
        "featuring",
        "ft",
        "instrumental",
        "interlude",
        "intro",
        "karaoke",
        "live",
        "long",
        "main",
        "maxi",
        "megamix",
        "mix",
        "mono",
        "official",
        "orchestral",
        "original",
        "outro",
        "outtake",
        "outtakes",
        "piano",
        "quadraphonic",
        "radio",
        "rap",
        "re-edit",
        "reedit",
        "refix",
        "rehearsal",
        "reinterpreted",
        "released",
        "release",
        "remake",
        "remastered",
        "remaster",
        "master",
        "remix",
        "remixed",
        "remode",
        "reprise",
        "rework",
        "reworked",
        "rmx",
        "session",
        "short",
        "single",
        "skit",
        "stereo",
        "studio",
        "take",
        "takes",
        "tape",
        "track",
        "tryout",
        "uncensored",
        "unknown",
        "unplugged",
        "untitled",
        "version",
        "ver",
        "video",
        "vocal",
        "vs",
        "with",
        "without",
    ];

    /// Clean artist name by removing common variations and guff
    fn clean_artist_name(name: &str) -> String {
        let mut cleaned = name.trim().to_string();

        // Remove common featuring patterns
        if let Some(pos) = cleaned.to_lowercase().find(" feat") {
            cleaned = cleaned[..pos].trim().to_string();
        }
        if let Some(pos) = cleaned.to_lowercase().find(" ft.") {
            cleaned = cleaned[..pos].trim().to_string();
        }
        if let Some(pos) = cleaned.to_lowercase().find(" featuring") {
            cleaned = cleaned[..pos].trim().to_string();
        }

        // Remove parenthetical content if it looks like guff
        if let Some(start) = cleaned.find('(') {
            if let Some(end) = cleaned.find(')') {
                let paren_content = &cleaned[start + 1..end].to_lowercase();
                if Self::is_likely_guff(paren_content) {
                    cleaned = format!("{}{}", &cleaned[..start], &cleaned[end + 1..])
                        .trim()
                        .to_string();
                }
            }
        }

        // Remove brackets with guff
        if let Some(start) = cleaned.find('[') {
            if let Some(end) = cleaned.find(']') {
                let bracket_content = &cleaned[start + 1..end].to_lowercase();
                if Self::is_likely_guff(bracket_content) {
                    cleaned = format!("{}{}", &cleaned[..start], &cleaned[end + 1..])
                        .trim()
                        .to_string();
                }
            }
        }

        // Remove common prefixes/suffixes
        if cleaned.to_lowercase().starts_with("the ") && cleaned.len() > 4 {
            let without_the = &cleaned[4..];
            if !without_the.trim().is_empty() {
                return without_the.trim().to_string();
            }
        }

        cleaned.trim().to_string()
    }

    /// Clean track name by removing common variations and guff
    fn clean_track_name(name: &str) -> String {
        let mut cleaned = name.trim().to_string();

        // Remove parenthetical content if it looks like guff
        if let Some(start) = cleaned.find('(') {
            if let Some(end) = cleaned.find(')') {
                let paren_content = &cleaned[start + 1..end].to_lowercase();
                if Self::is_likely_guff(paren_content) {
                    cleaned = format!("{}{}", &cleaned[..start], &cleaned[end + 1..])
                        .trim()
                        .to_string();
                }
            }
        }

        // Remove featuring artists from track titles
        if let Some(pos) = cleaned.to_lowercase().find(" feat") {
            cleaned = cleaned[..pos].trim().to_string();
        }
        if let Some(pos) = cleaned.to_lowercase().find(" ft.") {
            cleaned = cleaned[..pos].trim().to_string();
        }

        cleaned.trim().to_string()
    }

    /// Check if parenthetical content is likely "guff" that should be removed
    fn is_likely_guff(content: &str) -> bool {
        let content_lower = content.to_lowercase();
        let words: Vec<&str> = content_lower.split_whitespace().collect();

        // If most words are guff words, consider it guff
        let guff_word_count = words
            .iter()
            .filter(|word| Self::GUFF_WORDS.contains(word))
            .count();

        // Also check for years (19XX or 20XX)
        let has_year = content_lower.chars().collect::<String>().contains("19")
            || content_lower.contains("20");

        // Consider it guff if >50% are guff words, or if it contains years, or if it's short and common
        guff_word_count > words.len() / 2
            || has_year
            || (words.len() <= 2
                && Self::GUFF_WORDS
                    .iter()
                    .any(|&guff| content_lower.contains(guff)))
    }

    /// Normalize text for comparison (remove special chars, lowercase, etc.)
    fn normalize_for_comparison(text: &str) -> String {
        text.chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>()
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ")
    }
}

pub struct PlayIngestor {
    sql: PgPool,
}

fn clean(
    record: &types::fm_teal::alpha::feed::play::Play<'_>,
) -> types::fm_teal::alpha::feed::play::Play<'static> {
    let mut cleaned = record.clone();

    // Clean artist MBIDs inside artists vector, if present
    if let Some(artists) = &mut cleaned.artists {
        for artist in artists.iter_mut() {
            if let Some(mbid) = &artist.artist_mb_id {
                if mbid.is_empty() {
                    artist.artist_mb_id = None;
                }
            }
        }
    }

    // // Clean artist_mb_ids vector, if present
    // if let Some(mbids) = &mut cleaned.artist_mb_ids {
    //     for mbid in mbids.iter_mut() {
    //         if mbid.is_empty() {
    //             *mbid = "";
    //         }
    //     }
    // }

    // Clean release_mb_id
    if let Some(release_mbid) = &cleaned.release_mb_id {
        if release_mbid.is_empty() {
            cleaned.release_mb_id = None;
        }
    }

    // Clean recording_mb_id
    if let Some(recording_mbid) = &cleaned.recording_mb_id {
        if recording_mbid.is_empty() {
            cleaned.recording_mb_id = None;
        }
    }

    cleaned.into_static()
}

impl PlayIngestor {
    pub fn new(sql: PgPool) -> Self {
        Self { sql }
    }

    /// Batch consolidate synthetic artists that match existing MusicBrainz artists
    pub async fn consolidate_synthetic_artists(
        &self,
        min_confidence: f64,
    ) -> anyhow::Result<usize> {
        tracing::info!(
            "🔄 Starting batch consolidation of synthetic artists with confidence >= {:.2}",
            min_confidence
        );

        let consolidation_candidates = sqlx::query!(
            r#"
            SELECT DISTINCT
                ae1.id as synthetic_id,
                ae1.name as synthetic_name,
                ae2.id as target_id,
                ae2.name as target_name,
                ae2.mbid as target_mbid,
                similarity(LOWER(TRIM(ae1.name)), LOWER(TRIM(ae2.name))) as similarity_score
            FROM artists_extended ae1
            CROSS JOIN artists_extended ae2
            WHERE ae1.id != ae2.id
            AND ae1.mbid_type = 'synthetic'
            AND ae2.mbid_type = 'musicbrainz'
            AND similarity(LOWER(TRIM(ae1.name)), LOWER(TRIM(ae2.name))) >= $1
            ORDER BY similarity_score DESC
            "#,
            min_confidence as f32
        )
        .fetch_all(&self.sql)
        .await?;

        let mut consolidated_count = 0;

        for candidate in consolidation_candidates {
            let synthetic_id = candidate.synthetic_id;
            let target_id = candidate.target_id;
            let similarity = candidate.similarity_score.unwrap_or(0.0) as f64;

            // Double-check with our improved similarity calculation
            let calculated_similarity =
                Self::calculate_similarity(&candidate.synthetic_name, &candidate.target_name, true);

            let final_confidence = similarity.max(calculated_similarity);

            if final_confidence >= min_confidence {
                // Move all play relationships from synthetic artist to MusicBrainz artist
                let moved_plays = sqlx::query!(
                    r#"
                    UPDATE play_to_artists_extended
                    SET artist_id = $1, artist_name = $2
                    WHERE artist_id = $3
                    AND NOT EXISTS (
                        SELECT 1 FROM play_to_artists_extended existing
                        WHERE existing.play_uri = play_to_artists_extended.play_uri
                        AND existing.artist_id = $1
                    )
                    "#,
                    target_id,
                    candidate.target_name,
                    synthetic_id
                )
                .execute(&self.sql)
                .await?;

                // Remove duplicate relationships that couldn't be moved
                sqlx::query!(
                    "DELETE FROM play_to_artists_extended WHERE artist_id = $1",
                    synthetic_id
                )
                .execute(&self.sql)
                .await?;

                // Remove the synthetic artist
                sqlx::query!("DELETE FROM artists_extended WHERE id = $1", synthetic_id)
                    .execute(&self.sql)
                    .await?;

                consolidated_count += 1;

                tracing::info!(
                    "✅ Consolidated '{}' → '{}' (confidence: {:.2}, moved {} plays)",
                    candidate.synthetic_name,
                    candidate.target_name,
                    final_confidence,
                    moved_plays.rows_affected()
                );
            }
        }

        // Refresh materialized views after consolidation
        if consolidated_count > 0 {
            tracing::info!("🔄 Refreshing materialized views after consolidation");
            sqlx::query!("REFRESH MATERIALIZED VIEW mv_artist_play_counts;")
                .execute(&self.sql)
                .await?;
        }

        tracing::info!(
            "🎉 Batch consolidation complete: {} artists consolidated",
            consolidated_count
        );
        Ok(consolidated_count)
    }

    /// Find and consolidate duplicate releases/albums (requires matching artist context)
    pub async fn consolidate_duplicate_releases(
        &self,
        min_confidence: f64,
    ) -> anyhow::Result<usize> {
        tracing::info!(
            "🔄 Starting release consolidation with confidence >= {:.2} (requires artist context)",
            min_confidence
        );

        // Find releases that have similar names AND share at least one artist
        let release_candidates = sqlx::query!(
            r#"
            SELECT DISTINCT
                r1.mbid as release1_mbid,
                r1.name as release1_name,
                r2.mbid as release2_mbid,
                r2.name as release2_name,
                similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) as similarity_score,
                COUNT(DISTINCT ptae1.artist_id) as shared_artists
            FROM releases r1
            CROSS JOIN releases r2
            INNER JOIN plays p1 ON p1.release_mbid = r1.mbid
            INNER JOIN plays p2 ON p2.release_mbid = r2.mbid
            INNER JOIN play_to_artists_extended ptae1 ON p1.uri = ptae1.play_uri
            INNER JOIN play_to_artists_extended ptae2 ON p2.uri = ptae2.play_uri
            WHERE r1.mbid != r2.mbid
            AND similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) >= $1
            AND ptae1.artist_id = ptae2.artist_id  -- Same artist
            AND (
                (r1.discriminant IS NULL AND r2.discriminant IS NULL) OR
                (LOWER(TRIM(COALESCE(r1.discriminant, ''))) = LOWER(TRIM(COALESCE(r2.discriminant, ''))))
            )  -- Same or no discriminants
            GROUP BY r1.mbid, r1.name, r2.mbid, r2.name, similarity_score
            HAVING COUNT(DISTINCT ptae1.artist_id) > 0  -- At least one shared artist
            ORDER BY similarity_score DESC, shared_artists DESC
            "#,
            min_confidence as f32
        )
        .fetch_all(&self.sql)
        .await?;

        let mut consolidated_count = 0;

        for candidate in release_candidates {
            let similarity = candidate.similarity_score.unwrap_or(0.0) as f64;
            let shared_artists = candidate.shared_artists.unwrap_or(0);

            // Use MusicBrainz-style cleaning for better matching
            let cleaned_similarity = Self::calculate_similarity(
                &candidate.release1_name,
                &candidate.release2_name,
                false, // is_artist = false for releases
            );

            let final_confidence = similarity.max(cleaned_similarity);

            // Require high confidence AND shared artists for album consolidation
            if final_confidence >= min_confidence && shared_artists > 0 {
                // Choose the release with more plays as the canonical one
                let r1_plays: i64 = sqlx::query_scalar!(
                    "SELECT COUNT(*) FROM plays WHERE release_mbid = $1",
                    candidate.release1_mbid
                )
                .fetch_one(&self.sql)
                .await?
                .unwrap_or(0);

                let r2_plays: i64 = sqlx::query_scalar!(
                    "SELECT COUNT(*) FROM plays WHERE release_mbid = $1",
                    candidate.release2_mbid
                )
                .fetch_one(&self.sql)
                .await?
                .unwrap_or(0);

                let (keep_mbid, remove_mbid, keep_name) = if r1_plays >= r2_plays {
                    (
                        candidate.release1_mbid,
                        candidate.release2_mbid,
                        candidate.release1_name.clone(),
                    )
                } else {
                    (
                        candidate.release2_mbid,
                        candidate.release1_mbid,
                        candidate.release2_name.clone(),
                    )
                };

                // Update plays to use the canonical release
                let updated_plays = sqlx::query!(
                    "UPDATE plays SET release_mbid = $1, release_name = $2 WHERE release_mbid = $3",
                    keep_mbid,
                    keep_name,
                    remove_mbid
                )
                .execute(&self.sql)
                .await?;

                // Remove the duplicate release
                sqlx::query!("DELETE FROM releases WHERE mbid = $1", remove_mbid)
                    .execute(&self.sql)
                    .await?;

                consolidated_count += 1;

                tracing::info!(
                    "✅ Consolidated releases: '{}' → '{}' (confidence: {:.2}, {} shared artists, updated {} plays)",
                    if r1_plays >= r2_plays {
                        &candidate.release2_name
                    } else {
                        &candidate.release1_name
                    },
                    keep_name,
                    final_confidence,
                    shared_artists,
                    updated_plays.rows_affected()
                );
            }
        }

        tracing::info!(
            "🎉 Release consolidation complete: {} releases consolidated",
            consolidated_count
        );
        Ok(consolidated_count)
    }

    /// Find and consolidate duplicate recordings/tracks (requires matching artist context)
    pub async fn consolidate_duplicate_recordings(
        &self,
        min_confidence: f64,
    ) -> anyhow::Result<usize> {
        tracing::info!(
            "🔄 Starting recording consolidation with confidence >= {:.2} (requires artist context)",
            min_confidence
        );

        // Find recordings that have similar names AND share at least one artist
        let recording_candidates = sqlx::query!(
            r#"
            SELECT DISTINCT
                r1.mbid as recording1_mbid,
                r1.name as recording1_name,
                r2.mbid as recording2_mbid,
                r2.name as recording2_name,
                similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) as similarity_score,
                COUNT(DISTINCT ptae1.artist_id) as shared_artists
            FROM recordings r1
            CROSS JOIN recordings r2
            INNER JOIN plays p1 ON p1.recording_mbid = r1.mbid
            INNER JOIN plays p2 ON p2.recording_mbid = r2.mbid
            INNER JOIN play_to_artists_extended ptae1 ON p1.uri = ptae1.play_uri
            INNER JOIN play_to_artists_extended ptae2 ON p2.uri = ptae2.play_uri
            WHERE r1.mbid != r2.mbid
            AND similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) >= $1
            AND ptae1.artist_id = ptae2.artist_id  -- Same artist
            AND (
                (r1.discriminant IS NULL AND r2.discriminant IS NULL) OR
                (LOWER(TRIM(COALESCE(r1.discriminant, ''))) = LOWER(TRIM(COALESCE(r2.discriminant, ''))))
            )  -- Same or no discriminants
            GROUP BY r1.mbid, r1.name, r2.mbid, r2.name, similarity_score
            HAVING COUNT(DISTINCT ptae1.artist_id) > 0  -- At least one shared artist
            ORDER BY similarity_score DESC, shared_artists DESC
            "#,
            min_confidence as f32
        )
        .fetch_all(&self.sql)
        .await?;

        let mut consolidated_count = 0;

        for candidate in recording_candidates {
            let similarity = candidate.similarity_score.unwrap_or(0.0) as f64;
            let shared_artists = candidate.shared_artists.unwrap_or(0);

            // Use MusicBrainz-style cleaning for track names
            let cleaned_similarity = Self::calculate_similarity(
                &candidate.recording1_name,
                &candidate.recording2_name,
                false, // is_artist = false for recordings
            );

            let final_confidence = similarity.max(cleaned_similarity);

            // Require high confidence AND shared artists for track consolidation
            if final_confidence >= min_confidence && shared_artists > 0 {
                // Choose the recording with more plays as canonical
                let r1_plays: i64 = sqlx::query_scalar!(
                    "SELECT COUNT(*) FROM plays WHERE recording_mbid = $1",
                    candidate.recording1_mbid
                )
                .fetch_one(&self.sql)
                .await?
                .unwrap_or(0);

                let r2_plays: i64 = sqlx::query_scalar!(
                    "SELECT COUNT(*) FROM plays WHERE recording_mbid = $1",
                    candidate.recording2_mbid
                )
                .fetch_one(&self.sql)
                .await?
                .unwrap_or(0);

                let (keep_mbid, remove_mbid, keep_name) = if r1_plays >= r2_plays {
                    (
                        candidate.recording1_mbid,
                        candidate.recording2_mbid,
                        candidate.recording1_name.clone(),
                    )
                } else {
                    (
                        candidate.recording2_mbid,
                        candidate.recording1_mbid,
                        candidate.recording2_name.clone(),
                    )
                };

                // Update plays to use the canonical recording
                let updated_plays = sqlx::query!(
                    "UPDATE plays SET recording_mbid = $1 WHERE recording_mbid = $2",
                    keep_mbid,
                    remove_mbid
                )
                .execute(&self.sql)
                .await?;

                // Remove the duplicate recording
                sqlx::query!("DELETE FROM recordings WHERE mbid = $1", remove_mbid)
                    .execute(&self.sql)
                    .await?;

                consolidated_count += 1;

                tracing::info!(
                    "✅ Consolidated recordings: '{}' → '{}' (confidence: {:.2}, {} shared artists, updated {} plays)",
                    if r1_plays >= r2_plays {
                        &candidate.recording2_name
                    } else {
                        &candidate.recording1_name
                    },
                    keep_name,
                    final_confidence,
                    shared_artists,
                    updated_plays.rows_affected()
                );
            }
        }

        tracing::info!(
            "🎉 Recording consolidation complete: {} recordings consolidated",
            consolidated_count
        );
        Ok(consolidated_count)
    }

    /// Preview consolidation candidates to show what would be merged
    pub async fn preview_consolidation_candidates(
        &self,
        min_confidence: f64,
    ) -> anyhow::Result<()> {
        tracing::info!(
            "🔍 Previewing consolidation candidates (confidence >= {:.2})",
            min_confidence
        );

        // Preview artist consolidations
        let artist_candidates = sqlx::query!(
            r#"
            SELECT DISTINCT
                ae1.name as synthetic_name,
                ae2.name as target_name,
                similarity(LOWER(TRIM(ae1.name)), LOWER(TRIM(ae2.name))) as similarity_score,
                COUNT(ptae1.play_uri) as synthetic_plays,
                COUNT(ptae2.play_uri) as target_plays
            FROM artists_extended ae1
            CROSS JOIN artists_extended ae2
            LEFT JOIN play_to_artists_extended ptae1 ON ae1.id = ptae1.artist_id
            LEFT JOIN play_to_artists_extended ptae2 ON ae2.id = ptae2.artist_id
            WHERE ae1.id != ae2.id
            AND ae1.mbid_type = 'synthetic'
            AND ae2.mbid_type = 'musicbrainz'
            AND similarity(LOWER(TRIM(ae1.name)), LOWER(TRIM(ae2.name))) >= $1
            GROUP BY ae1.id, ae1.name, ae2.id, ae2.name, similarity_score
            ORDER BY similarity_score DESC
            LIMIT 10
            "#,
            min_confidence as f32
        )
        .fetch_all(&self.sql)
        .await?;

        if !artist_candidates.is_empty() {
            tracing::info!("🎯 Artist consolidation candidates:");
            for candidate in artist_candidates {
                tracing::info!(
                    "   '{}' → '{}' (confidence: {:.2}, {} + {} plays)",
                    candidate.synthetic_name,
                    candidate.target_name,
                    candidate.similarity_score.unwrap_or(0.0),
                    candidate.synthetic_plays.unwrap_or(0),
                    candidate.target_plays.unwrap_or(0)
                );
            }
        }

        // Preview release consolidations (with artist context)
        let release_candidates = sqlx::query!(
            r#"
            SELECT DISTINCT
                r1.name as release1_name,
                r2.name as release2_name,
                similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) as similarity_score,
                COUNT(DISTINCT ptae1.artist_id) as shared_artists,
                STRING_AGG(DISTINCT ae.name, ', ') as artist_names
            FROM releases r1
            CROSS JOIN releases r2
            INNER JOIN plays p1 ON p1.release_mbid = r1.mbid
            INNER JOIN plays p2 ON p2.release_mbid = r2.mbid
            INNER JOIN play_to_artists_extended ptae1 ON p1.uri = ptae1.play_uri
            INNER JOIN play_to_artists_extended ptae2 ON p2.uri = ptae2.play_uri
            INNER JOIN artists_extended ae ON ptae1.artist_id = ae.id
            WHERE r1.mbid != r2.mbid
            AND similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) >= $1
            AND ptae1.artist_id = ptae2.artist_id
            GROUP BY r1.mbid, r1.name, r2.mbid, r2.name, similarity_score
            HAVING COUNT(DISTINCT ptae1.artist_id) > 0
            ORDER BY similarity_score DESC
            LIMIT 5
            "#,
            min_confidence as f32
        )
        .fetch_all(&self.sql)
        .await?;

        if !release_candidates.is_empty() {
            tracing::info!("💿 Release consolidation candidates (with artist context):");
            for candidate in release_candidates {
                tracing::info!(
                    "   '{}' ↔ '{}' (confidence: {:.2}, {} shared artists: {})",
                    candidate.release1_name,
                    candidate.release2_name,
                    candidate.similarity_score.unwrap_or(0.0),
                    candidate.shared_artists.unwrap_or(0),
                    candidate.artist_names.unwrap_or_default()
                );
            }
        }

        // Preview recording consolidations (with artist context)
        let recording_candidates = sqlx::query!(
            r#"
            SELECT DISTINCT
                r1.name as recording1_name,
                r2.name as recording2_name,
                similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) as similarity_score,
                COUNT(DISTINCT ptae1.artist_id) as shared_artists,
                STRING_AGG(DISTINCT ae.name, ', ') as artist_names
            FROM recordings r1
            CROSS JOIN recordings r2
            INNER JOIN plays p1 ON p1.recording_mbid = r1.mbid
            INNER JOIN plays p2 ON p2.recording_mbid = r2.mbid
            INNER JOIN play_to_artists_extended ptae1 ON p1.uri = ptae1.play_uri
            INNER JOIN play_to_artists_extended ptae2 ON p2.uri = ptae2.play_uri
            INNER JOIN artists_extended ae ON ptae1.artist_id = ae.id
            WHERE r1.mbid != r2.mbid
            AND similarity(LOWER(TRIM(r1.name)), LOWER(TRIM(r2.name))) >= $1
            AND ptae1.artist_id = ptae2.artist_id
            GROUP BY r1.mbid, r1.name, r2.mbid, r2.name, similarity_score
            HAVING COUNT(DISTINCT ptae1.artist_id) > 0
            ORDER BY similarity_score DESC
            LIMIT 5
            "#,
            min_confidence as f32
        )
        .fetch_all(&self.sql)
        .await?;

        if !recording_candidates.is_empty() {
            tracing::info!("🎵 Recording consolidation candidates (with artist context):");
            for candidate in recording_candidates {
                tracing::info!(
                    "   '{}' ↔ '{}' (confidence: {:.2}, {} shared artists: {})",
                    candidate.recording1_name,
                    candidate.recording2_name,
                    candidate.similarity_score.unwrap_or(0.0),
                    candidate.shared_artists.unwrap_or(0),
                    candidate.artist_names.unwrap_or_default()
                );
            }
        }

        Ok(())
    }

    /// Run full batch consolidation for all entity types
    pub async fn run_full_consolidation(&self) -> anyhow::Result<()> {
        tracing::info!("🚀 Starting full batch consolidation process");

        // First, preview what we would consolidate
        self.preview_consolidation_candidates(0.92).await?;

        let artist_count = self.consolidate_synthetic_artists(0.92).await?;
        let release_count = self.consolidate_duplicate_releases(0.92).await?;
        let recording_count = self.consolidate_duplicate_recordings(0.92).await?;

        tracing::info!(
            "🎉 Full consolidation complete! Artists: {}, Releases: {}, Recordings: {}",
            artist_count,
            release_count,
            recording_count
        );

        Ok(())
    }

    /// Generate a synthetic MBID for artists without MusicBrainz data using database function
    async fn generate_synthetic_mbid(&self, artist_name: &str) -> anyhow::Result<Uuid> {
        let result = sqlx::query_scalar!("SELECT generate_synthetic_mbid($1)", artist_name)
            .fetch_one(&self.sql)
            .await?;

        result.ok_or_else(|| anyhow!("Failed to generate synthetic MBID"))
    }

    /// Generate a fallback artist name for tracks without any artist information
    fn generate_fallback_artist(track_name: &str) -> String {
        format!(
            "Unknown Artist ({})",
            track_name.chars().take(20).collect::<String>()
        )
    }

    /// Normalize text for fuzzy matching with MusicBrainz-style cleaning
    fn normalize_text(text: &str, is_artist: bool) -> String {
        let cleaned = if is_artist {
            MusicBrainzCleaner::clean_artist_name(text)
        } else {
            MusicBrainzCleaner::clean_track_name(text)
        };

        MusicBrainzCleaner::normalize_for_comparison(&cleaned)
    }

    /// Calculate string similarity with MusicBrainz-style cleaning
    fn calculate_similarity(s1: &str, s2: &str, is_artist: bool) -> f64 {
        let s1_norm = Self::normalize_text(s1, is_artist);
        let s2_norm = Self::normalize_text(s2, is_artist);

        if s1_norm == s2_norm {
            return 1.0;
        }

        if s1_norm.is_empty() || s2_norm.is_empty() {
            return 0.0;
        }

        // Calculate basic similarity
        let max_len = s1_norm.len().max(s2_norm.len()) as f64;
        let min_len = s1_norm.len().min(s2_norm.len()) as f64;

        // Character-based similarity
        let common_chars = s1_norm
            .chars()
            .zip(s2_norm.chars())
            .filter(|(a, b)| a == b)
            .count() as f64;

        // Word-based similarity boost
        let s1_words: std::collections::HashSet<&str> = s1_norm.split_whitespace().collect();
        let s2_words: std::collections::HashSet<&str> = s2_norm.split_whitespace().collect();
        let common_words = s1_words.intersection(&s2_words).count() as f64;
        let total_words = s1_words.union(&s2_words).count() as f64;

        let word_similarity = if total_words > 0.0 {
            common_words / total_words
        } else {
            0.0
        };
        let char_similarity = common_chars / max_len;

        // Boost for very similar lengths (helps with minor differences)
        let length_factor = if max_len > 0.0 {
            min_len / max_len
        } else {
            0.0
        };

        // Weighted combination: 50% word similarity, 30% char similarity, 20% length factor
        (word_similarity * 0.5) + (char_similarity * 0.3) + (length_factor * 0.2)
    }

    /// Find existing artists that fuzzy match the given name
    async fn find_fuzzy_artist_matches(
        &self,
        artist_name: &str,
        _track_name: &str,
        _album_name: Option<&str>,
    ) -> anyhow::Result<Vec<FuzzyMatchCandidate>> {
        let normalized_name = Self::normalize_text(artist_name, true);

        // Search for artists with similar names using trigram similarity
        let candidates = sqlx::query!(
            r#"
            SELECT
                ae.id,
                ae.name
            FROM artists_extended ae
            WHERE ae.mbid_type = 'musicbrainz'
            AND (
                LOWER(TRIM(ae.name)) = $1
                OR LOWER(TRIM(ae.name)) LIKE '%' || $1 || '%'
                OR $1 LIKE '%' || LOWER(TRIM(ae.name)) || '%'
                OR similarity(LOWER(TRIM(ae.name)), $1) > 0.6
            )
            ORDER BY similarity(LOWER(TRIM(ae.name)), $1) DESC
            LIMIT 10
            "#,
            normalized_name
        )
        .fetch_all(&self.sql)
        .await
        .unwrap_or_default();

        let mut matches = Vec::new();

        for candidate in candidates {
            let name_similarity = Self::calculate_similarity(artist_name, &candidate.name, true);

            // Base confidence from name similarity
            let mut confidence = name_similarity;

            // Boost confidence for exact matches after normalization
            if Self::normalize_text(artist_name, true)
                == Self::normalize_text(&candidate.name, true)
            {
                confidence = confidence.max(0.95);
            }

            // Additional boost for cleaned matches
            let cleaned_input = MusicBrainzCleaner::clean_artist_name(artist_name);
            let cleaned_candidate = MusicBrainzCleaner::clean_artist_name(&candidate.name);
            if MusicBrainzCleaner::normalize_for_comparison(&cleaned_input)
                == MusicBrainzCleaner::normalize_for_comparison(&cleaned_candidate)
            {
                confidence = confidence.max(0.9);
            }

            // Lower threshold since we have better cleaning now
            if confidence >= 0.8 {
                matches.push(FuzzyMatchCandidate {
                    artist_id: candidate.id,
                    name: candidate.name,
                    confidence,
                });
            }
        }

        // Sort by confidence descending
        matches.sort_by(|a, b| {
            b.confidence
                .partial_cmp(&a.confidence)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(matches)
    }

    /// Try to match an artist to existing MusicBrainz data using fuzzy matching
    async fn find_or_create_artist_with_fuzzy_matching(
        &self,
        artist_name: &str,
        mbid: Option<&str>,
        track_name: &str,
        album_name: Option<&str>,
    ) -> anyhow::Result<i32> {
        // If we already have an MBID, use it directly
        if let Some(mbid) = mbid {
            return self.insert_artist_extended(Some(mbid), artist_name).await;
        }

        // Try fuzzy matching against existing MusicBrainz artists
        let matches = self
            .find_fuzzy_artist_matches(artist_name, track_name, album_name)
            .await?;

        if let Some(best_match) = matches.first() {
            // Use high confidence threshold for automatic matching
            if best_match.confidence >= 0.92 {
                tracing::info!(
                    "🔗 Fuzzy matched '{}' to existing artist '{}' (confidence: {:.2})",
                    artist_name,
                    best_match.name,
                    best_match.confidence
                );

                // Update the existing artist name if the new one seems more complete
                if artist_name.len() > best_match.name.len() && best_match.confidence >= 0.95 {
                    sqlx::query!(
                        "UPDATE artists_extended SET name = $1, updated_at = NOW() WHERE id = $2",
                        artist_name,
                        best_match.artist_id
                    )
                    .execute(&self.sql)
                    .await?;
                }

                return Ok(best_match.artist_id);
            } else if best_match.confidence >= 0.85 {
                tracing::debug!(
                    "🤔 Potential match for '{}' -> '{}' (confidence: {:.2}) but below auto-match threshold",
                    artist_name,
                    best_match.name,
                    best_match.confidence
                );
            }
        }

        // No good match found, create synthetic artist
        self.insert_artist_extended(None, artist_name).await
    }

    /// Inserts or updates an artist in the database using the extended table.
    /// Returns the internal ID of the artist.
    async fn insert_artist_extended(&self, mbid: Option<&str>, name: &str) -> anyhow::Result<i32> {
        if let Some(mbid) = mbid {
            let artist_uuid = Uuid::parse_str(mbid)?;
            let res = sqlx::query!(
                r#"
                    INSERT INTO artists_extended (mbid, name, mbid_type) VALUES ($1, $2, 'musicbrainz')
                    ON CONFLICT (mbid) DO UPDATE SET
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    RETURNING id;
                "#,
                artist_uuid,
                name
            )
            .fetch_one(&self.sql)
            .await?;
            Ok(res.id)
        } else {
            // Artist without MBID - generate synthetic MBID
            let synthetic_uuid = self.generate_synthetic_mbid(name).await?;

            let res = sqlx::query!(
                r#"
                    INSERT INTO artists_extended (mbid, name, mbid_type) VALUES ($1, $2, 'synthetic')
                    ON CONFLICT (mbid) DO UPDATE SET
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    RETURNING id;
                "#,
                synthetic_uuid,
                name
            )
            .fetch_one(&self.sql)
            .await?;
            Ok(res.id)
        }
    }

    /// Inserts or updates a release in the database.
    /// Returns the Uuid of the release.
    async fn insert_release(&self, mbid: &str, name: &str) -> anyhow::Result<Uuid> {
        let release_uuid = Uuid::parse_str(mbid)?;

        // Extract discriminant from release name for new releases
        // Prioritize edition-specific patterns for better quality
        let discriminant = self
            .extract_edition_discriminant_from_db(name)
            .await
            .or_else(|| {
                futures::executor::block_on(async { self.extract_discriminant_from_db(name).await })
            });

        let res = sqlx::query!(
            r#"
                INSERT INTO releases (mbid, name, discriminant) VALUES ($1, $2, $3)
                ON CONFLICT (mbid) DO UPDATE SET
                    name = EXCLUDED.name,
                    discriminant = COALESCE(EXCLUDED.discriminant, releases.discriminant)
                RETURNING mbid;
            "#,
            release_uuid,
            name,
            discriminant
        )
        .fetch_all(&self.sql)
        .await?;

        if !res.is_empty() {
            // TODO: send request to async scrape data from local MB instance
        }

        Ok(release_uuid)
    }

    /// Inserts or updates a recording in the database.
    /// Returns the Uuid of the recording.
    async fn insert_recording(&self, mbid: &str, name: &str) -> anyhow::Result<Uuid> {
        let recording_uuid = Uuid::parse_str(mbid)?;

        // Extract discriminant from recording name for new recordings
        // Prioritize edition-specific patterns for better quality
        let discriminant = self
            .extract_edition_discriminant_from_db(name)
            .await
            .or_else(|| {
                futures::executor::block_on(async { self.extract_discriminant_from_db(name).await })
            });

        let res = sqlx::query!(
            r#"
                INSERT INTO recordings (mbid, name, discriminant) VALUES ($1, $2, $3)
                ON CONFLICT (mbid) DO UPDATE SET
                    name = EXCLUDED.name,
                    discriminant = COALESCE(EXCLUDED.discriminant, recordings.discriminant)
                RETURNING mbid;
            "#,
            recording_uuid,
            name,
            discriminant
        )
        .fetch_all(&self.sql)
        .await?;

        if !res.is_empty() {
            // TODO: send request to async scrape data from local MB instance
        }

        Ok(recording_uuid)
    }

    /// Extract discriminant from name using database function
    async fn extract_discriminant_from_db(&self, name: &str) -> Option<String> {
        sqlx::query_scalar!("SELECT extract_discriminant($1)", name)
            .fetch_one(&self.sql)
            .await
            .ok()
            .flatten()
    }

    /// Extract edition-specific discriminant from name using database function
    async fn extract_edition_discriminant_from_db(&self, name: &str) -> Option<String> {
        sqlx::query_scalar!("SELECT extract_edition_discriminant($1)", name)
            .fetch_one(&self.sql)
            .await
            .ok()
            .flatten()
    }

    // /// Get base name without discriminant using database function
    // async fn get_base_name_from_db(&self, name: &str) -> String {
    //     sqlx::query_scalar!("SELECT get_base_name($1)", name)
    //         .fetch_one(&self.sql)
    //         .await
    //         .ok()
    //         .flatten()
    //         .unwrap_or_else(|| name.to_string())
    // }

    pub async fn insert_play(
        &self,
        play_record: &types::fm_teal::alpha::feed::play::Play<'_>,
        uri: &str,
        cid: &str,
        did: &str,
        rkey: &str,
    ) -> anyhow::Result<()> {
        dbg!("ingesting", play_record);
        let play_record = clean(play_record);
        let mut parsed_artists: Vec<(i32, String)> = vec![];
        let mut artist_names_raw: Vec<String> = vec![];

        if let Some(ref artists) = &play_record.artists {
            for artist in artists {
                let artist_name = artist.artist_name.clone();
                artist_names_raw.push(artist_name.as_str().to_owned());
                let artist_mbid = artist.artist_mb_id.as_deref();

                let artist_id = self
                    .find_or_create_artist_with_fuzzy_matching(
                        &artist_name,
                        artist_mbid,
                        &play_record.track_name,
                        play_record.release_name.as_deref(),
                    )
                    .await?;
                parsed_artists.push((artist_id, artist_name.as_str().to_owned()));
            }
        } else if let Some(artist_names) = &play_record.artist_names {
            for (index, artist_name) in artist_names.iter().enumerate() {
                artist_names_raw.push(artist_name.as_str().to_owned());

                let artist_mbid_opt = if let Some(ref mbid_list) = play_record.artist_mb_ids {
                    mbid_list.get(index).map(|s| s.as_str())
                } else {
                    None
                };

                let artist_id = self
                    .find_or_create_artist_with_fuzzy_matching(
                        artist_name,
                        artist_mbid_opt,
                        &play_record.track_name,
                        play_record.release_name.as_deref(),
                    )
                    .await?;
                parsed_artists.push((artist_id, artist_name.as_str().to_owned()));
            }
        } else {
            // No artist information provided - create a fallback artist
            let fallback_artist_name = Self::generate_fallback_artist(&play_record.track_name);
            artist_names_raw.push(fallback_artist_name.clone());

            let artist_id = self
                .find_or_create_artist_with_fuzzy_matching(
                    &fallback_artist_name,
                    None,
                    &play_record.track_name,
                    play_record.release_name.as_deref(),
                )
                .await?;
            parsed_artists.push((artist_id, fallback_artist_name));
        }

        // Insert release if missing
        let release_mbid_opt = if let Some(release_mbid) = &play_record.release_mb_id {
            if let Some(release_name) = &play_record.release_name {
                Some(self.insert_release(release_mbid, release_name).await?)
            } else {
                None
            }
        } else {
            None
        };

        // Insert recording if missing
        let recording_mbid_opt = if let Some(recording_mbid) = &play_record.recording_mb_id {
            let recording_name = play_record.track_name.clone();
            Some(
                self.insert_recording(recording_mbid, &recording_name)
                    .await?,
            )
        } else {
            None
        };

        let played_time = play_record.played_time.clone().unwrap_or(Datetime::now());
        let time_datetime =
            time::OffsetDateTime::from_unix_timestamp(played_time.as_ref().timestamp())
                .unwrap_or_else(|_| time::OffsetDateTime::now_utc());

        // Extract discriminants from lexicon fields or infer from names
        // First try lexicon fields, then extract from names with preference for edition-specific patterns
        // TODO: Enable when types are updated with discriminant fields
        // let track_discriminant = play_record.track_discriminant.clone().or_else(|| {
        let track_discriminant = {
            // Try edition-specific patterns first, then general patterns
            futures::executor::block_on(async {
                self.extract_edition_discriminant_from_db(&play_record.track_name)
                    .await
                    .or_else(|| {
                        futures::executor::block_on(async {
                            self.extract_discriminant_from_db(&play_record.track_name)
                                .await
                        })
                    })
            })
        };

        // let release_discriminant = play_record.release_discriminant.clone().or_else(|| {
        let release_discriminant = {
            if let Some(release_name) = &play_record.release_name {
                futures::executor::block_on(async {
                    // Try edition-specific patterns first, then general patterns
                    self.extract_edition_discriminant_from_db(release_name)
                        .await
                        .or_else(|| {
                            futures::executor::block_on(async {
                                self.extract_discriminant_from_db(release_name).await
                            })
                        })
                })
            } else {
                None
            }
        };

        // Our main insert into plays with raw artist names and discriminants
        let artist_names_json = if !artist_names_raw.is_empty() {
            Some(serde_json::to_value(&artist_names_raw)?)
        } else {
            None
        };

        sqlx::query!(
            r#"
                    INSERT INTO plays (
                        uri, cid, did, rkey, isrc, duration, track_name, played_time,
                        processed_time, release_mbid, release_name, recording_mbid,
                        submission_client_agent, music_service_base_domain, artist_names_raw,
                        track_discriminant, release_discriminant
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8,
                        NOW(), $9, $10, $11, $12, $13, $14, $15, $16
                    ) ON CONFLICT(uri) DO UPDATE SET
                        isrc = EXCLUDED.isrc,
                        duration = EXCLUDED.duration,
                        track_name = EXCLUDED.track_name,
                        played_time = EXCLUDED.played_time,
                        processed_time = EXCLUDED.processed_time,
                        release_mbid = EXCLUDED.release_mbid,
                        release_name = EXCLUDED.release_name,
                        recording_mbid = EXCLUDED.recording_mbid,
                        submission_client_agent = EXCLUDED.submission_client_agent,
                        music_service_base_domain = EXCLUDED.music_service_base_domain,
                        artist_names_raw = EXCLUDED.artist_names_raw,
                        track_discriminant = EXCLUDED.track_discriminant,
                        release_discriminant = EXCLUDED.release_discriminant;
                "#,
            uri,
            cid,
            did,
            rkey,
            play_record.isrc.as_ref().map(|s| s.as_ref()),
            play_record.duration.map(|d| d as i32),
            play_record.track_name.as_ref(),
            time_datetime,
            release_mbid_opt,
            play_record.release_name.as_ref().map(|s| s.as_ref()),
            recording_mbid_opt,
            play_record
                .submission_client_agent
                .as_ref()
                .map(|s| s.as_ref()),
            play_record
                .music_service_base_domain
                .as_ref()
                .map(|s| s.as_ref()),
            artist_names_json,
            track_discriminant,
            release_discriminant
        )
        .execute(&self.sql)
        .await?;

        // Insert plays into the extended join table (supports all artists)
        for (artist_id, artist_name) in &parsed_artists {
            sqlx::query!(
                    r#"
                        INSERT INTO play_to_artists_extended (play_uri, artist_id, artist_name) VALUES
                        ($1, $2, $3)
                        ON CONFLICT (play_uri, artist_id) DO NOTHING;
                    "#,
                    uri,
                    artist_id,
                    artist_name
                )
                .execute(&self.sql)
                .await?;
        }

        // Refresh materialized views concurrently (if needed, consider if this should be done less frequently)
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_artist_play_counts;")
            .execute(&self.sql)
            .await?;
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_release_play_counts;")
            .execute(&self.sql)
            .await?;
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_recording_play_counts;")
            .execute(&self.sql)
            .await?;
        sqlx::query!("REFRESH MATERIALIZED VIEW mv_global_play_count;")
            .execute(&self.sql)
            .await?;

        // // Optionally check materialised views (consider removing in production for performance)
        // // For debugging purposes, can keep for now
        // if cfg!(debug_assertions) {
        //     // Conditionally compile debug checks
        //     let artist_counts = sqlx::query!("SELECT * FROM mv_artist_play_counts;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_artist_play_counts: {:?}", artist_counts);

        //     let release_counts = sqlx::query!("SELECT * FROM mv_release_play_counts;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_release_play_counts: {:?}", release_counts);

        //     let recording_counts = sqlx::query!("SELECT * FROM mv_recording_play_counts;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_recording_play_counts: {:?}", recording_counts);

        //     let global_count = sqlx::query!("SELECT * FROM mv_global_play_count;")
        //         .fetch_all(&self.sql)
        //         .await?;
        //     dbg!("mv_global_play_count: {:?}", global_count);
        // }

        Ok(())
    }

    async fn remove_play(&self, uri: &str) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM play_to_artists WHERE play_uri = $1", uri)
            .execute(&self.sql)
            .await?;
        sqlx::query!("DELETE FROM plays WHERE uri = $1", uri)
            .execute(&self.sql)
            .await?;
        Ok(())
    }
}

#[async_trait]
impl LexiconIngestor for PlayIngestor {
    async fn ingest(&self, message: Event<Value>) -> anyhow::Result<()> {
        if let Some(commit) = &message.commit {
            if let Some(ref record) = &commit.record {
                let data = &value::Data::from_json(record).to_owned()?;
                let record: types::fm_teal::alpha::feed::play::Play = value::from_data(data)?;
                if let Some(ref commit) = message.commit {
                    if let Some(ref cid) = commit.cid {
                        // TODO: verify cid
                        self.insert_play(
                            &record,
                            &assemble_at_uri(&message.did, &commit.collection, &commit.rkey),
                            cid,
                            &message.did,
                            &commit.rkey,
                        )
                        .await?;
                    }
                }
            } else {
                println!("{}: Message {} deleted", message.did, commit.rkey);
                self.remove_play(&message.did).await?;
            }
        } else {
            return Err(anyhow!("Message has no commit"));
        }
        Ok(())
    }
}
