ALTER TABLE profiles
ADD COLUMN stats_default_period TEXT;

ALTER TABLE profiles
ADD CONSTRAINT chk_profiles_stats_default_period
CHECK (
    stats_default_period IS NULL
    OR stats_default_period IN ('7days', '30days', '90days', '180days', '365days', 'all')
);

CREATE INDEX idx_plays_did_played_time_uri
ON plays (did, played_time DESC, uri);

CREATE INDEX idx_plays_did_release_played_time
ON plays (did, release_mbid, played_time DESC)
WHERE release_mbid IS NOT NULL;

CREATE INDEX idx_plays_did_recording_played_time
ON plays (did, recording_mbid, played_time DESC)
WHERE recording_mbid IS NOT NULL;
