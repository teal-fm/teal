-- Deduplicate plays by (did, cid) - keep the record with the earliest rkey
-- This addresses the issue where the same play content (CID) was stored under multiple rkeys

-- Create temp table with URIs to delete
CREATE TEMP TABLE uris_to_delete AS
WITH duplicates AS (
    SELECT uri,
           ROW_NUMBER() OVER (PARTITION BY did, cid ORDER BY rkey ASC) as rn
    FROM plays
)
SELECT uri FROM duplicates WHERE rn > 1;

-- Delete from related tables first
DELETE FROM play_to_artists_extended WHERE play_uri IN (SELECT uri FROM uris_to_delete);
DELETE FROM play_to_artists WHERE play_uri IN (SELECT uri FROM uris_to_delete);
-- Then delete from plays
DELETE FROM plays WHERE uri IN (SELECT uri FROM uris_to_delete);

-- Drop the temporary table
DROP TABLE uris_to_delete;

-- Add unique constraint to prevent future duplicates
ALTER TABLE plays ADD CONSTRAINT uq_plays_did_cid UNIQUE (did, cid);
