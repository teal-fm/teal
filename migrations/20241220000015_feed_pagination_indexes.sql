-- Keep appview feed pagination on index scans as the plays corpus grows.
CREATE INDEX IF NOT EXISTS idx_plays_latest_sort
    ON plays ((COALESCE(played_time, processed_time)) DESC, uri DESC);

CREATE INDEX IF NOT EXISTS idx_plays_did_processed_time_uri
    ON plays (did, processed_time DESC, uri DESC);
