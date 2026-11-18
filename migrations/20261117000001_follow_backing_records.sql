-- A repository can hold several follow records for the same subject.
-- social_follows keeps one row per (did, subject_did); this table keeps every
-- record behind it, so deleting one of them leaves the follow while another
-- remains.
CREATE TABLE social_follow_records (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    subject_did TEXT NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_social_follow_records_pair
    ON social_follow_records (did, subject_did);

INSERT INTO social_follow_records (uri, did, subject_did)
SELECT uri, did, subject_did FROM social_follows
ON CONFLICT (uri) DO NOTHING;
