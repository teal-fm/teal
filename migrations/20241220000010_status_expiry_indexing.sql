-- Make actor status visibility/indexing explicit.

ALTER TABLE statii
    ADD COLUMN status_time TIMESTAMP WITH TIME ZONE,
    ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

UPDATE statii
SET
    status_time = (record->>'time')::timestamptz,
    expires_at = COALESCE(
        (record->>'expiry')::timestamptz,
        (record->>'time')::timestamptz + INTERVAL '10 minutes'
    )
WHERE record ? 'time';

CREATE INDEX idx_statii_did_visible_latest
    ON statii (did, expires_at, status_time DESC, indexed_at DESC);
