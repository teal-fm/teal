CREATE TABLE IF NOT EXISTS status_actors (
    did TEXT PRIMARY KEY,
    handle TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_actors_handle ON status_actors (handle);

CREATE TABLE IF NOT EXISTS status_stream_cursor (
    id BOOLEAN PRIMARY KEY CHECK (id),
    cursor BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_replay_progress (
    id BOOLEAN PRIMARY KEY CHECK (id),
    sealed_tip BIGINT NOT NULL,
    after_seq BIGINT NOT NULL
);
