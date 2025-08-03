-- Migration to support artists without MusicBrainz IDs
-- This allows the system to comply with the Teal lexicon where only trackName is required

-- Add a field to plays table to store raw artist names for records without MBIDs
ALTER TABLE plays ADD COLUMN artist_names_raw JSONB;

-- Create a new artists table that doesn't require MBID as primary key
CREATE TABLE artists_extended (
    id SERIAL PRIMARY KEY,
    mbid UUID UNIQUE, -- Optional MusicBrainz ID
    name TEXT NOT NULL,
    name_normalized TEXT GENERATED ALWAYS AS (LOWER(TRIM(name))) STORED,
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX idx_artists_extended_mbid ON artists_extended (mbid) WHERE mbid IS NOT NULL;
CREATE INDEX idx_artists_extended_name_normalized ON artists_extended (name_normalized);
CREATE UNIQUE INDEX idx_artists_extended_name_unique ON artists_extended (name_normalized) WHERE mbid IS NULL;

-- Create a new junction table that can handle both MBID and non-MBID artists
CREATE TABLE play_to_artists_extended (
    play_uri TEXT NOT NULL REFERENCES plays(uri),
    artist_id INTEGER NOT NULL REFERENCES artists_extended(id),
    artist_name TEXT NOT NULL, -- Denormalized for performance
    PRIMARY KEY (play_uri, artist_id)
);

CREATE INDEX idx_play_to_artists_extended_artist ON play_to_artists_extended (artist_id);

-- Migrate existing data from old tables to new structure
INSERT INTO artists_extended (mbid, name, play_count)
SELECT mbid, name, play_count FROM artists;

INSERT INTO play_to_artists_extended (play_uri, artist_id, artist_name)
SELECT
    pta.play_uri,
    ae.id,
    pta.artist_name
FROM play_to_artists pta
JOIN artists_extended ae ON ae.mbid = pta.artist_mbid;

-- Update materialized views to use new structure
DROP MATERIALIZED VIEW IF EXISTS mv_artist_play_counts;
CREATE MATERIALIZED VIEW mv_artist_play_counts AS
SELECT
    ae.id AS artist_id,
    ae.mbid AS artist_mbid,
    ae.name AS artist_name,
    COUNT(p.uri) AS play_count
FROM
    artists_extended ae
    LEFT JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
    LEFT JOIN plays p ON p.uri = ptae.play_uri
GROUP BY
    ae.id, ae.mbid, ae.name;

CREATE UNIQUE INDEX idx_mv_artist_play_counts_new ON mv_artist_play_counts (artist_id);

-- Update other materialized views that reference artists
DROP MATERIALIZED VIEW IF EXISTS mv_top_artists_30days;
CREATE MATERIALIZED VIEW mv_top_artists_30days AS
SELECT
    ae.id AS artist_id,
    ae.mbid AS artist_mbid,
    ae.name AS artist_name,
    COUNT(p.uri) AS play_count
FROM artists_extended ae
INNER JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
INNER JOIN plays p ON p.uri = ptae.play_uri
WHERE p.played_time >= NOW() - INTERVAL '30 days'
GROUP BY ae.id, ae.mbid, ae.name
ORDER BY COUNT(p.uri) DESC;

DROP MATERIALIZED VIEW IF EXISTS mv_top_artists_for_user_30days;
CREATE MATERIALIZED VIEW mv_top_artists_for_user_30days AS
SELECT
    prof.did,
    ae.id AS artist_id,
    ae.mbid AS artist_mbid,
    ae.name AS artist_name,
    COUNT(p.uri) AS play_count
FROM artists_extended ae
INNER JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
INNER JOIN plays p ON p.uri = ptae.play_uri
INNER JOIN profiles prof ON prof.did = p.did
WHERE p.played_time >= NOW() - INTERVAL '30 days'
GROUP BY prof.did, ae.id, ae.mbid, ae.name
ORDER BY COUNT(p.uri) DESC;

DROP MATERIALIZED VIEW IF EXISTS mv_top_artists_for_user_7days;
CREATE MATERIALIZED VIEW mv_top_artists_for_user_7days AS
SELECT
    prof.did,
    ae.id AS artist_id,
    ae.mbid AS artist_mbid,
    ae.name AS artist_name,
    COUNT(p.uri) AS play_count
FROM artists_extended ae
INNER JOIN play_to_artists_extended ptae ON ae.id = ptae.artist_id
INNER JOIN plays p ON p.uri = ptae.play_uri
INNER JOIN profiles prof ON prof.did = p.did
WHERE p.played_time >= NOW() - INTERVAL '7 days'
GROUP BY prof.did, ae.id, ae.mbid, ae.name
ORDER BY COUNT(p.uri) DESC;

-- Comment explaining the migration strategy
COMMENT ON TABLE artists_extended IS 'Extended artists table that supports both MusicBrainz and non-MusicBrainz artists. Uses serial ID as primary key with optional MBID.';
COMMENT ON TABLE play_to_artists_extended IS 'Junction table linking plays to artists using the new artists_extended table structure.';
COMMENT ON COLUMN plays.artist_names_raw IS 'Raw artist names as JSON array for plays without MusicBrainz data, used as fallback when artist relationships cannot be established.';
