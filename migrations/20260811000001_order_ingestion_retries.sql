-- Keep at most one retry for each logical record and retain commit ordering.

ALTER TABLE ingestion_retry_events
    ADD COLUMN event_time_us BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN event_rev TEXT NOT NULL DEFAULT '';

ALTER TABLE ingestion_retry_events
    DROP CONSTRAINT ingestion_retry_events_event_key_key;

DELETE FROM ingestion_retry_events older
USING ingestion_retry_events newer
WHERE older.id < newer.id
  AND older.did = newer.did
  AND older.collection = newer.collection
  AND older.rkey = newer.rkey;

UPDATE ingestion_retry_events
SET event_key = did || ':' || collection || ':' || rkey;

ALTER TABLE ingestion_retry_events
    ADD CONSTRAINT ingestion_retry_events_event_key_key UNIQUE (event_key);
