-- Migration to add discriminant fields for track and release variants
-- This enables proper handling of different versions while maintaining grouping capabilities

-- Add discriminant fields to plays table
ALTER TABLE plays ADD COLUMN track_discriminant TEXT;
ALTER TABLE plays ADD COLUMN release_discriminant TEXT;

-- Add discriminant field to releases table
ALTER TABLE releases ADD COLUMN discriminant TEXT;

-- Add discriminant field to recordings table
ALTER TABLE recordings ADD COLUMN discriminant TEXT;

-- Create indexes for efficient searching and filtering
CREATE INDEX idx_plays_track_discriminant ON plays (track_discriminant);
CREATE INDEX idx_plays_release_discriminant ON plays (release_discriminant);
CREATE INDEX idx_releases_discriminant ON releases (discriminant);
CREATE INDEX idx_recordings_discriminant ON recordings (discriminant);

-- Create composite indexes for grouping by base name + discriminant
CREATE INDEX idx_plays_track_name_discriminant ON plays (track_name, track_discriminant);
CREATE INDEX idx_plays_release_name_discriminant ON plays (release_name, release_discriminant);

-- Update materialized views to include discriminant information
DROP MATERIALIZED VIEW IF EXISTS mv_release_play_counts;
CREATE MATERIALIZED VIEW mv_release_play_counts AS
SELECT
    r.mbid AS release_mbid,
    r.name AS release_name,
    r.discriminant AS release_discriminant,
    COUNT(p.uri) AS play_count
FROM
    releases r
    LEFT JOIN plays p ON p.release_mbid = r.mbid
GROUP BY
    r.mbid, r.name, r.discriminant;

CREATE UNIQUE INDEX idx_mv_release_play_counts_discriminant ON mv_release_play_counts (release_mbid);

DROP MATERIALIZED VIEW IF EXISTS mv_recording_play_counts;
CREATE MATERIALIZED VIEW mv_recording_play_counts AS
SELECT
    rec.mbid AS recording_mbid,
    rec.name AS recording_name,
    rec.discriminant AS recording_discriminant,
    COUNT(p.uri) AS play_count
FROM
    recordings rec
    LEFT JOIN plays p ON p.recording_mbid = rec.mbid
GROUP BY
    rec.mbid, rec.name, rec.discriminant;

CREATE UNIQUE INDEX idx_mv_recording_play_counts_discriminant ON mv_recording_play_counts (recording_mbid);

-- Create views for analyzing track/release variants
CREATE VIEW track_variants AS
SELECT
    track_name,
    track_discriminant,
    COUNT(*) AS play_count,
    COUNT(DISTINCT did) AS unique_listeners,
    COUNT(DISTINCT recording_mbid) AS unique_recordings
FROM plays
WHERE track_name IS NOT NULL
GROUP BY track_name, track_discriminant
ORDER BY track_name, play_count DESC;

CREATE VIEW release_variants AS
SELECT
    release_name,
    release_discriminant,
    COUNT(*) AS play_count,
    COUNT(DISTINCT did) AS unique_listeners,
    COUNT(DISTINCT release_mbid) AS unique_releases
FROM plays
WHERE release_name IS NOT NULL
GROUP BY release_name, release_discriminant
ORDER BY release_name, play_count DESC;

-- Create function to extract potential discriminants from existing names
CREATE OR REPLACE FUNCTION extract_discriminant(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    discriminant_patterns TEXT[] := ARRAY[
        '\(([^)]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus).*?)\)',
        '\[([^]]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus).*?)\]',
        '\{([^}]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus).*?)\}'
    ];
    pattern TEXT;
    match_result TEXT;
BEGIN
    -- Try each pattern to find discriminant information
    FOREACH pattern IN ARRAY discriminant_patterns
    LOOP
        SELECT substring(name_text FROM pattern) INTO match_result;
        IF match_result IS NOT NULL AND length(trim(match_result)) > 0 THEN
            RETURN trim(match_result);
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get base name without discriminant
CREATE OR REPLACE FUNCTION get_base_name(name_text TEXT) RETURNS TEXT AS $$
DECLARE
    cleanup_patterns TEXT[] := ARRAY[
        '\s*\([^)]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus).*?\)\s*',
        '\s*\[[^]]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus).*?\]\s*',
        '\s*\{[^}]*(?:deluxe|remaster|remastered|extended|acoustic|live|radio|edit|version|remix|demo|instrumental|explicit|clean|bonus).*?\}\s*'
    ];
    pattern TEXT;
    result_text TEXT := name_text;
BEGIN
    -- Remove discriminant patterns to get base name
    FOREACH pattern IN ARRAY cleanup_patterns
    LOOP
        result_text := regexp_replace(result_text, pattern, ' ', 'gi');
    END LOOP;

    -- Clean up extra whitespace
    result_text := regexp_replace(trim(result_text), '\s+', ' ', 'g');

    RETURN result_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comments explaining the discriminant system
COMMENT ON COLUMN plays.track_discriminant IS 'Distinguishing information for track variants (e.g., "Acoustic Version", "Live at Wembley", "Radio Edit")';
COMMENT ON COLUMN plays.release_discriminant IS 'Distinguishing information for release variants (e.g., "Deluxe Edition", "Remastered", "2023 Remaster")';
COMMENT ON COLUMN releases.discriminant IS 'Distinguishing information for release variants to enable proper grouping';
COMMENT ON COLUMN recordings.discriminant IS 'Distinguishing information for recording variants to enable proper grouping';

COMMENT ON VIEW track_variants IS 'Shows all variants of tracks with their play counts and unique listeners';
COMMENT ON VIEW release_variants IS 'Shows all variants of releases with their play counts and unique listeners';

COMMENT ON FUNCTION extract_discriminant IS 'Extracts discriminant information from track/release names for migration purposes';
COMMENT ON FUNCTION get_base_name IS 'Returns the base name without discriminant information for grouping purposes';
