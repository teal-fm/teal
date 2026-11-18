-- Track upstream ATProto account hosting state observed by Cadet.

CREATE TABLE account_states (
    did TEXT PRIMARY KEY,
    active BOOLEAN NOT NULL,
    status TEXT,
    event_time TIMESTAMP WITH TIME ZONE,
    seq BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_account_states_active ON account_states (active);
CREATE INDEX idx_account_states_status ON account_states (status);
