import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres',
});

export async function initDb(): Promise<void> {
  // Check if tables already exist before trying to create them.
  // CREATE TABLE IF NOT EXISTS still requires ownership privileges on
  // existing tables in some Postgres configurations (e.g. Supabase).
  const { rows } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('events', 'identity_map')
  `);
  const existing = new Set(rows.map((r: { table_name: string }) => r.table_name));

  if (!existing.has('events')) {
    await pool.query(`
      CREATE TABLE events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_name VARCHAR(255) NOT NULL,
        device_id VARCHAR(255),
        user_id VARCHAR(255),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        properties JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  if (!existing.has('identity_map')) {
    await pool.query(`
      CREATE TABLE identity_map (
        device_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  // Indexes — also require ownership if they don't exist yet.
  // Skip failures silently when tables are owned by another role.
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_events_event_name ON events (event_name)`,
    `CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_events_device_id ON events (device_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_user_id ON events (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_identity_map_user_id ON identity_map (user_id)`,
  ];
  for (const ddl of indexes) {
    try { await pool.query(ddl); } catch { /* index may already exist or role lacks ownership */ }
  }
}

export default pool;
