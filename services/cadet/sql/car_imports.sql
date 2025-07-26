-- CAR Import Tables
-- These tables track CAR file imports and store IPLD blocks

-- Main CAR imports tracking table
CREATE TABLE IF NOT EXISTS car_imports (
    import_id VARCHAR PRIMARY KEY,
    root_cids TEXT[] NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    blocks_processed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT
);

-- Individual IPLD blocks from CAR files
CREATE TABLE IF NOT EXISTS car_blocks (
    cid VARCHAR PRIMARY KEY,
    block_data BYTEA NOT NULL,
    import_id VARCHAR NOT NULL REFERENCES car_imports(import_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extracted records from CAR imports (linking to existing data)
CREATE TABLE IF NOT EXISTS car_extracted_records (
    id SERIAL PRIMARY KEY,
    import_id VARCHAR NOT NULL REFERENCES car_imports(import_id),
    source_cid VARCHAR NOT NULL,
    collection VARCHAR NOT NULL,
    record_uri VARCHAR, -- AT URI if applicable
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_car_imports_status ON car_imports(status);
CREATE INDEX IF NOT EXISTS idx_car_imports_created_at ON car_imports(created_at);
CREATE INDEX IF NOT EXISTS idx_car_blocks_import_id ON car_blocks(import_id);
CREATE INDEX IF NOT EXISTS idx_car_extracted_records_import_id ON car_extracted_records(import_id);
CREATE INDEX IF NOT EXISTS idx_car_extracted_records_collection ON car_extracted_records(collection);