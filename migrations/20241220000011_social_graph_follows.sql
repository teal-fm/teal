-- Index Teal social graph follow records.

CREATE TABLE social_follows (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    subject_did TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (did, subject_did)
);

CREATE INDEX idx_social_follows_subject_created_at
    ON social_follows (subject_did, created_at DESC);

CREATE INDEX idx_social_follows_did_created_at
    ON social_follows (did, created_at DESC);
