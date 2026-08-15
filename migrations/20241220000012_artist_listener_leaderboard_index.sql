CREATE INDEX idx_play_to_artists_extended_artist_play
ON play_to_artists_extended (artist_id, play_uri);
