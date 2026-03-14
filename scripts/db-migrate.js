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
ALTER TABLE products  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE products  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS location    TEXT DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON warehouses;
CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON deliveries;
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE receipts    ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE deliveries  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE transfers   ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE adjustments ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE adjustments ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted    ON products(deleted_at)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_active     ON products(is_active)    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_warehouses_deleted  ON warehouses(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_created_by   ON receipts(created_by);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_by ON deliveries(created_by);
CREATE INDEX IF NOT EXISTS idx_transfers_created_by  ON transfers(created_by);
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY, user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, table_name TEXT NOT NULL, record_id TEXT,
  old_data JSONB, new_data JSONB, ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table   ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read    ON notifications(user_id, read) WHERE read = FALSE;
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('🔗 Connecting to PostgreSQL...')
    await client.query(MIGRATION_SQL)
    console.log('✅ Migration v2 complete!')
    console.log('   +deleted_at, +is_active, +location on products/warehouses')
    console.log('   +created_by on all operation tables')
    console.log('   +audit_logs, +notifications tables')
    console.log('\n🚀 Run: npm run dev')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
