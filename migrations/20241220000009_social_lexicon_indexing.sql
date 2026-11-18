-- Index Teal profile status and social lexicon records.

CREATE TABLE profile_statuses (
    did TEXT PRIMARY KEY,
    uri TEXT NOT NULL UNIQUE,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    completed_onboarding TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profile_statuses_completed_onboarding
    ON profile_statuses (completed_onboarding);

CREATE TABLE social_posts (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    text TEXT NOT NULL,
    track JSONB NOT NULL,
    reply_root_uri TEXT,
    reply_root_cid TEXT,
    reply_parent_uri TEXT,
    reply_parent_cid TEXT,
    facets JSONB,
    langs TEXT[],
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_social_posts_did_created_at ON social_posts (did, created_at DESC);
CREATE INDEX idx_social_posts_created_at ON social_posts (created_at DESC);
CREATE INDEX idx_social_posts_reply_parent_uri ON social_posts (reply_parent_uri);
CREATE INDEX idx_social_posts_reply_root_uri ON social_posts (reply_root_uri);

CREATE TABLE social_likes (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    subject_uri TEXT NOT NULL,
    subject_cid TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (did, subject_uri)
);

CREATE INDEX idx_social_likes_subject_uri ON social_likes (subject_uri);
CREATE INDEX idx_social_likes_did_created_at ON social_likes (did, created_at DESC);

CREATE TABLE social_reposts (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    subject_uri TEXT NOT NULL,
    subject_cid TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (did, subject_uri)
);

CREATE INDEX idx_social_reposts_subject_uri ON social_reposts (subject_uri);
CREATE INDEX idx_social_reposts_did_created_at ON social_reposts (did, created_at DESC);

CREATE TABLE social_playlists (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    description_facets JSONB,
    authors TEXT[] NOT NULL,
    cover_cid TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_social_playlists_did_created_at ON social_playlists (did, created_at DESC);
CREATE INDEX idx_social_playlists_authors ON social_playlists USING GIN (authors);

CREATE TABLE social_playlist_items (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    playlist_uri TEXT NOT NULL,
    playlist_cid TEXT NOT NULL,
    track JSONB NOT NULL,
    item_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_social_playlist_items_playlist_order
    ON social_playlist_items (playlist_uri, item_order, created_at);
CREATE INDEX idx_social_playlist_items_did_created_at
    ON social_playlist_items (did, created_at DESC);

CREATE TABLE social_badges (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    description_facets JSONB,
    image_cid TEXT NOT NULL,
    creator TEXT NOT NULL,
    badge_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_social_badges_creator_created_at ON social_badges (creator, created_at DESC);
CREATE INDEX idx_social_badges_type ON social_badges (badge_type);

CREATE TABLE social_badge_assignments (
    uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    badge_uri TEXT NOT NULL,
    badge_cid TEXT NOT NULL,
    assignee TEXT NOT NULL,
    assigner TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    record JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (badge_uri, assignee)
);

CREATE INDEX idx_social_badge_assignments_assignee
    ON social_badge_assignments (assignee, created_at DESC);
CREATE INDEX idx_social_badge_assignments_badge_uri
    ON social_badge_assignments (badge_uri);

CREATE TABLE social_subject_counts (
    subject_uri TEXT PRIMARY KEY,
    like_count INTEGER NOT NULL DEFAULT 0,
    repost_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    playlist_item_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE social_notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_did TEXT NOT NULL,
    actor_did TEXT NOT NULL,
    reason TEXT NOT NULL,
    record_uri TEXT NOT NULL,
    subject_uri TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (recipient_did, reason, record_uri)
);

CREATE INDEX idx_social_notifications_recipient_created_at
    ON social_notifications (recipient_did, created_at DESC);

CREATE TABLE indexed_record_facets (
    record_uri TEXT NOT NULL,
    source_field TEXT NOT NULL,
    facets JSONB NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (record_uri, source_field)
);

CREATE TABLE indexed_record_blobs (
    record_uri TEXT NOT NULL,
    source_field TEXT NOT NULL,
    cid TEXT NOT NULL,
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (record_uri, source_field)
);
