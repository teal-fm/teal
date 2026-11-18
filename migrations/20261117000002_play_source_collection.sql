-- The collection a play row was last written from. Plays from the legacy
-- fm.teal.alpha.feed.play collection are stored under the stable URI, and many
-- listens exist in both collections (a live alpha scrobble plus a later stable
-- import), so Cadet uses this to let the stable record win. NULL marks rows
-- indexed before this column existed; they keep the old last-write-wins rule.
ALTER TABLE plays ADD COLUMN source_collection TEXT;
