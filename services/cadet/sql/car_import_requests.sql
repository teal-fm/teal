-- CAR Import Requests Table
-- Tracks uploaded CAR files that are queued for processing

CREATE TABLE IF NOT EXISTS car_import_requests (
    import_id TEXT PRIMARY KEY,
    car_data_base64 TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for status lookups
CREATE INDEX IF NOT EXISTS idx_car_import_requests_status ON car_import_requests(status);

-- Index for temporal queries  
CREATE INDEX IF NOT EXISTS idx_car_import_requests_created_at ON car_import_requests(created_at);