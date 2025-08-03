-- Migration to add fuzzy text matching capabilities
-- This enables better artist name matching using trigram similarity

-- Enable pg_trgm extension for trigram similarity matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for efficient trigram matching on artist names
CREATE INDEX idx_artists_extended_name_trgm ON artists_extended USING gin (name gin_trgm_ops);
CREATE INDEX idx_artists_extended_name_normalized_trgm ON artists_extended USING gin (name_normalized gin_trgm_ops);

-- Create a function to calculate comprehensive artist similarity
CREATE OR REPLACE FUNCTION calculate_artist_similarity(
    input_name TEXT,
    existing_name TEXT,
    input_album TEXT DEFAULT NULL,
    existing_album TEXT DEFAULT NULL
) RETURNS FLOAT AS $$
DECLARE
    name_similarity FLOAT;
    album_similarity FLOAT := 0.0;
    final_score FLOAT;
BEGIN
    -- Calculate trigram similarity for artist names
    name_similarity := similarity(LOWER(TRIM(input_name)), LOWER(TRIM(existing_name)));

    -- Boost for exact matches after normalization
    IF LOWER(TRIM(regexp_replace(input_name, '[^a-zA-Z0-9\s]', '', 'g'))) =
       LOWER(TRIM(regexp_replace(existing_name, '[^a-zA-Z0-9\s]', '', 'g'))) THEN
        name_similarity := GREATEST(name_similarity, 0.95);
    END IF;

    -- Factor in album similarity if both are provided
    IF input_album IS NOT NULL AND existing_album IS NOT NULL THEN
        album_similarity := similarity(LOWER(TRIM(input_album)), LOWER(TRIM(existing_album)));
        -- Weight: 80% name, 20% album
        final_score := (name_similarity * 0.8) + (album_similarity * 0.2);
    ELSE
        final_score := name_similarity;
    END IF;

    RETURN final_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a view for fuzzy artist matching with confidence scores
CREATE VIEW fuzzy_artist_matches AS
SELECT DISTINCT
    ae1.id as query_artist_id,
    ae1.name as query_artist_name,
    ae1.mbid_type as query_mbid_type,
    ae2.id as match_artist_id,
    ae2.name as match_artist_name,
    ae2.mbid as match_mbid,
    ae2.mbid_type as match_mbid_type,
    similarity(LOWER(TRIM(ae1.name)), LOWER(TRIM(ae2.name))) as name_similarity,
    CASE
        WHEN ae2.mbid_type = 'musicbrainz' THEN 'upgrade_to_mb'
        WHEN ae1.mbid_type = 'musicbrainz' AND ae2.mbid_type = 'synthetic' THEN 'consolidate_to_mb'
        ELSE 'merge_synthetic'
    END as match_action
FROM artists_extended ae1
CROSS JOIN artists_extended ae2
WHERE ae1.id != ae2.id
AND similarity(LOWER(TRIM(ae1.name)), LOWER(TRIM(ae2.name))) > 0.8
AND (
    ae1.mbid_type = 'synthetic' OR ae2.mbid_type = 'musicbrainz'
);

-- Add comments
COMMENT ON EXTENSION pg_trgm IS 'Trigram extension for fuzzy text matching';
COMMENT ON INDEX idx_artists_extended_name_trgm IS 'GIN index for trigram similarity on artist names';
COMMENT ON FUNCTION calculate_artist_similarity IS 'Calculates similarity score between artists considering name and optional album context';
COMMENT ON VIEW fuzzy_artist_matches IS 'Shows potential artist matches with confidence scores and recommended actions';

-- Create a function to suggest artist consolidations
CREATE OR REPLACE FUNCTION suggest_artist_consolidations(min_similarity FLOAT DEFAULT 0.9)
RETURNS TABLE(
    action TEXT,
    synthetic_artist TEXT,
    target_artist TEXT,
    similarity_score FLOAT,
    synthetic_plays INTEGER,
    target_plays INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fam.match_action as action,
        fam.query_artist_name as synthetic_artist,
        fam.match_artist_name as target_artist,
        fam.name_similarity as similarity_score,
        (SELECT COUNT(*)::INTEGER FROM play_to_artists_extended WHERE artist_id = fam.query_artist_id) as synthetic_plays,
        (SELECT COUNT(*)::INTEGER FROM play_to_artists_extended WHERE artist_id = fam.match_artist_id) as target_plays
    FROM fuzzy_artist_matches fam
    WHERE fam.name_similarity >= min_similarity
    AND fam.match_action = 'upgrade_to_mb'
    ORDER BY fam.name_similarity DESC, synthetic_plays DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION suggest_artist_consolidations IS 'Returns suggestions for consolidating synthetic artists with MusicBrainz artists based on similarity';
