CREATE TABLE IF NOT EXISTS status_actors (
    did TEXT PRIMARY KEY,
    handle TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Keep the latest observed owner for each handle. Break timestamp ties by DID
-- so this cleanup is deterministic before the unique index is added.
DELETE FROM status_actors
WHERE did IN (
    SELECT did
    FROM (
        SELECT
            did,
            ROW_NUMBER() OVER (
                PARTITION BY handle
                ORDER BY updated_at DESC, did DESC
            ) AS row_number
        FROM status_actors
    ) AS ranked
    WHERE row_number > 1
);

DROP INDEX IF EXISTS idx_status_actors_handle;
CREATE UNIQUE INDEX idx_status_actors_handle ON status_actors (handle);

CREATE TABLE IF NOT EXISTS status_stream_cursor (
    id BOOLEAN PRIMARY KEY CHECK (id),
    cursor BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_replay_progress (
    id BOOLEAN PRIMARY KEY CHECK (id),
    sealed_tip BIGINT NOT NULL,
    after_seq BIGINT NOT NULL
);
