-- minipanel database schema

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(255) NOT NULL,
  device_id VARCHAR(255),
  user_id VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity_map (
  device_id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_event_name ON events (event_name);
CREATE INDEX IF NOT EXISTS idx_events_timestamp   ON events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_device_id   ON events (device_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id     ON events (user_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_user_id ON identity_map (user_id);
