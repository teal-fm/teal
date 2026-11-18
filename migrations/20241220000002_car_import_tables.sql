-- CAR import functionality tables
-- For handling AT Protocol CAR file imports and processing

-- Tracks uploaded CAR files that are queued for processing
CREATE TABLE IF NOT EXISTS car_import_requests (
    import_id TEXT PRIMARY KEY,
    car_data_base64 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    file_size_bytes INTEGER,
    block_count INTEGER,
    extracted_records_count INTEGER DEFAULT 0
);

CREATE INDEX idx_car_import_requests_status ON car_import_requests (status);
CREATE INDEX idx_car_import_requests_created_at ON car_import_requests (created_at);

-- Tracks raw IPLD blocks extracted from CAR files
CREATE TABLE IF NOT EXISTS car_blocks (
    cid TEXT PRIMARY KEY,
    import_id TEXT NOT NULL REFERENCES car_import_requests(import_id),
    block_data BYTEA NOT NULL,
    decoded_successfully BOOLEAN DEFAULT FALSE,
    collection_type TEXT, -- e.g., 'fm.teal.alpha.feed.play', 'commit', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_car_blocks_import_id ON car_blocks (import_id);
CREATE INDEX idx_car_blocks_collection_type ON car_blocks (collection_type);

-- Tracks records extracted from CAR imports that were successfully processed
CREATE TABLE IF NOT EXISTS car_extracted_records (
    id SERIAL PRIMARY KEY,
    import_id TEXT NOT NULL REFERENCES car_import_requests(import_id),
    cid TEXT NOT NULL REFERENCES car_blocks(cid),
    collection_type TEXT NOT NULL,
    record_uri TEXT, -- AT URI if applicable (e.g., for play records)
    synthetic_did TEXT, -- DID assigned for CAR imports (e.g., 'car-import:123')
    rkey TEXT,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_notes TEXT
);

CREATE INDEX idx_car_extracted_records_import_id ON car_extracted_records (import_id);
CREATE INDEX idx_car_extracted_records_collection_type ON car_extracted_records (collection_type);
CREATE INDEX idx_car_extracted_records_record_uri ON car_extracted_records (record_uri);

-- Tracks import metadata and commit information
CREATE TABLE IF NOT EXISTS car_import_metadata (
    import_id TEXT NOT NULL REFERENCES car_import_requests(import_id),
    metadata_key TEXT NOT NULL,
    metadata_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (import_id, metadata_key)
);

CREATE INDEX idx_car_import_metadata_key ON car_import_metadata (metadata_key);
