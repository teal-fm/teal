-- Migration to support synthetic MBIDs for artists without MusicBrainz data
-- This ensures all artists have some form of ID while maintaining uniqueness

-- Enable UUID extension for v5 UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add a column to track MBID type (musicbrainz, synthetic, unknown)
ALTER TABLE artists_extended ADD COLUMN mbid_type TEXT DEFAULT 'unknown' NOT NULL;

-- Add check constraint for valid MBID types
ALTER TABLE artists_extended ADD CONSTRAINT chk_mbid_type
    CHECK (mbid_type IN ('musicbrainz', 'synthetic', 'unknown'));

-- Update existing records to set proper MBID type
UPDATE artists_extended SET mbid_type = 'musicbrainz' WHERE mbid IS NOT NULL;

-- Drop the unique constraint on name_normalized for null MBIDs since we'll handle duplicates differently
DROP INDEX IF EXISTS idx_artists_extended_name_unique;

-- Add index for efficient querying by MBID type
CREATE INDEX idx_artists_extended_mbid_type ON artists_extended (mbid_type);

-- Create a view to easily work with different artist types
CREATE VIEW artists_with_type AS
SELECT
    id,
    mbid,
    name,
    mbid_type,
    play_count,
    created_at,
    updated_at,
    -- For synthetic MBIDs, we can show the source name used for generation
    CASE
        WHEN mbid_type = 'synthetic' THEN 'Generated from: ' || name
        WHEN mbid_type = 'musicbrainz' THEN 'MusicBrainz: ' || mbid::text
        ELSE 'No MBID available'
    END as mbid_info
FROM artists_extended;

-- Update materialized views to include MBID type information
DROP MATERIALIZED VIEW IF EXISTS mv_artist_play_counts;
CREATE MATERIALIZED VIEW mv_artist_play_counts AS
SELECT
    ae.id AS artist_id,
    ae.mbid AS artist_mbid,
    ae.name AS artist_name,
    ae.mbid_type,
    COUNT(p.uri) AS play_count
FROM
    artists_extended ae
    LEFT JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
    LEFT JOIN plays p ON p.uri = ptae.play_uri
GROUP BY
    ae.id, ae.mbid, ae.name, ae.mbid_type;

CREATE UNIQUE INDEX idx_mv_artist_play_counts_with_type ON mv_artist_play_counts (artist_id);

-- Add comments explaining the synthetic MBID system
COMMENT ON COLUMN artists_extended.mbid_type IS 'Type of MBID: musicbrainz (real), synthetic (generated), or unknown (legacy data)';
COMMENT ON COLUMN artists_extended.mbid IS 'MusicBrainz ID (for musicbrainz type) or synthetic UUID (for synthetic type)';
COMMENT ON VIEW artists_with_type IS 'View that provides human-readable information about artist MBID sources';

-- Add a function to generate synthetic MBIDs
CREATE OR REPLACE FUNCTION generate_synthetic_mbid(artist_name TEXT) RETURNS UUID AS $$
DECLARE
    namespace_uuid UUID := '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; -- DNS namespace
    result_uuid UUID;
BEGIN
    -- Generate deterministic UUID v5 based on artist name
    SELECT uuid_generate_v5(namespace_uuid, artist_name) INTO result_uuid;
    RETURN result_uuid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_synthetic_mbid IS 'Generates a deterministic UUID v5 for artist names without MusicBrainz IDs';
