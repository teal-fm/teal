-- Emoji reactions on plays and posts, and up to four favourite releases per profile.

CREATE TABLE social_reactions (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    subject_uri TEXT NOT NULL,
    subject_cid TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (did, subject_uri, emoji)
);

CREATE INDEX idx_social_reactions_subject_emoji ON social_reactions (subject_uri, emoji);
CREATE INDEX idx_social_reactions_did_created_at ON social_reactions (did, created_at DESC);

ALTER TABLE profiles ADD COLUMN favorites JSONB;
