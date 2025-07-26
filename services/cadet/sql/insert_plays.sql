-- insert a play into the db

-- sanity check - insert artists if missing based on data from play
-- COULD BE INCORRECT SO send a signal to update data based on musicbrainz data somehow
INSERT INTO artists (mbid, name) VALUES
('95015b4c-1aef-4e28-9d36-c9546c194f0c', 'Bad Suns')
ON CONFLICT (mbid) DO NOTHING;

INSERT INTO releases (mbid, name) VALUES
('ed416bdc-bfe4-4050-9ac4-5c5d7df55dbd', 'Lovefool')
ON CONFLICT (mbid) DO NOTHING;

INSERT INTO recordings (mbid, name) VALUES
('35093485-858e-4588-aab5-1db9f99616f8', 'Lovefool')
ON CONFLICT (mbid) DO NOTHING;

-- our main insert
INSERT INTO plays (
    uri, cid, did, rkey, isrc, duration, track_name, played_time,
    processed_time, release_mbid, release_name, recording_mbid,
    submission_client_agent, music_service_base_domain
) VALUES (
    'at://did:plc:k644h4rq5bjfzcetgsa6tuby/fm.teal.alpha.feed.play/3liubcmz4sy2a',
    'bafyreialbenvvxzje463gg3l7zgv52motum2nx32in5fvosmay527wc2vy',
    'did:plc:k644h4rq5bjfzcetgsa6tuby',
    '3liubcmz4sy2a',
    'USEP42442001',
    183,
    'Lovefool',
    '2025-02-23T16:35:52.628Z'::TIMESTAMP WITH TIME ZONE,
    NOW(),
    'ed416bdc-bfe4-4050-9ac4-5c5d7df55dbd',
    'Lovefool',
    '35093485-858e-4588-aab5-1db9f99616f8',
    'tealtracker/0.0.1b',
    null
);
s
-- insert plays into join table
INSERT INTO play_to_artists (play_uri, artist_mbid, artist_name) VALUES
(
    'at://did:plc:k644h4rq5bjfzcetgsa6tuby/fm.teal.alpha.feed.play/3liubcmz4sy2a',
    '95015b4c-1aef-4e28-9d36-c9546c194f0c',
    'Bad Suns'
)
ON CONFLICT (play_uri, artist_mbid) DO NOTHING;


-- Refreshing all materialized views concurrently
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_play_counts;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_release_play_counts;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recording_play_counts;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_play_count;

-- check materialised views
SELECT * FROM mv_artist_play_counts;
SELECT * FROM mv_release_play_counts;
SELECT * FROM mv_recording_play_counts;
SELECT * FROM mv_global_play_count;
