// Run: node scripts/db-migrate.js
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'hackbase',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

const MIGRATION_SQL = `
-- Restore locations table
CREATE TABLE IF NOT EXISTS locations (
  id           SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations(warehouse_id);

-- Update products and warehouses with basic management fields
ALTER TABLE products  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE products  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS location    TEXT DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add location_id columns back to operation tables
ALTER TABLE receipts   ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE transfers  ADD COLUMN IF NOT EXISTS from_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE transfers  ADD COLUMN IF NOT EXISTS to_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;

-- Ensure indices for new columns
CREATE INDEX IF NOT EXISTS idx_receipts_location   ON receipts(location_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_location ON deliveries(location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_loc  ON transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_loc    ON transfers(to_location_id);

-- Update status checks
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_status_check;
ALTER TABLE receipts ADD CONSTRAINT receipts_status_check
  CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled', 'validated'));

ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
  CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled', 'validated'));

ALTER TABLE transfers DROP CONSTRAINT IF EXISTS transfers_status_check;
ALTER TABLE transfers ADD CONSTRAINT transfers_status_check
  CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled', 'completed'));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locations_updated_at ON locations;
CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON warehouses;
CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('🚀 Running database migrations...')
    await client.query(MIGRATION_SQL)
    console.log('✅ Migration successful!')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
