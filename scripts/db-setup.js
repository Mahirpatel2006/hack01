// Run: node scripts/db-setup.js
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'hackbase',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

const SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── AUTH TABLES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255)  NOT NULL,
    password_hash TEXT          NOT NULL,
    full_name     VARCHAR(255)  NOT NULL,
    role          VARCHAR(20)   NOT NULL DEFAULT 'staff',
    avatar_url    TEXT,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_role_check CHECK (role IN ('manager', 'staff'))
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users (role);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- role column handled separately in setup() below

CREATE TABLE IF NOT EXISTS otp_codes (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) NOT NULL,
    code       CHAR(6)      NOT NULL CHECK (code ~ '^[0-9]{6}$'),
    expires_at TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    used       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_email      ON otp_codes (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_codes (expires_at);

CREATE TABLE IF NOT EXISTS sessions (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti        TEXT         NOT NULL,
    ip_address INET,
    user_agent TEXT,
    revoked    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ  NOT NULL,
    CONSTRAINT sessions_jti_unique UNIQUE (jti)
);

CREATE INDEX IF NOT EXISTS idx_sessions_jti        ON sessions (jti);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at DESC);

-- ─── INVENTORY TABLES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS warehouses (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  sku         TEXT    NOT NULL UNIQUE,
  uom         TEXT    NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  reorder_qty INTEGER NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku      ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS stocks (
  id           SERIAL  PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  UNIQUE(product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stocks_product   ON stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_stocks_warehouse ON stocks(warehouse_id);

CREATE TABLE IF NOT EXISTS receipts (
  id           SERIAL  PRIMARY KEY,
  supplier     TEXT    NOT NULL,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  receipt_date TIMESTAMPTZ DEFAULT NOW(),
  status       TEXT    NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'validated')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_status    ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_warehouse ON receipts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created   ON receipts(created_at DESC);

DROP TRIGGER IF EXISTS trg_receipts_updated_at ON receipts;
CREATE TRIGGER trg_receipts_updated_at BEFORE UPDATE ON receipts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS receipt_items (
  id           SERIAL  PRIMARY KEY,
  receipt_id   INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  received_qty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deliveries (
  id         SERIAL PRIMARY KEY,
  customer   TEXT   NOT NULL,
  status     TEXT   NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'validated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status  ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created ON deliveries(created_at DESC);

CREATE TABLE IF NOT EXISTS delivery_items (
  id           SERIAL  PRIMARY KEY,
  delivery_id  INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS transfers (
  id                SERIAL  PRIMARY KEY,
  from_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  to_warehouse_id   INTEGER NOT NULL REFERENCES warehouses(id),
  status            TEXT    NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'completed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_status  ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON transfers(created_at DESC);

DROP TRIGGER IF EXISTS trg_transfers_updated_at ON transfers;
CREATE TRIGGER trg_transfers_updated_at BEFORE UPDATE ON transfers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS transfer_items (
  id              SERIAL  PRIMARY KEY,
  transfer_id     INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  transferred_qty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS adjustments (
  id           SERIAL  PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjustments_product ON adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_created ON adjustments(created_at DESC);

-- ─── STOCK MOVES LEDGER ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_moves (
  id           SERIAL  PRIMARY KEY,
  move_type    TEXT    NOT NULL CHECK (move_type IN ('receipt','delivery','transfer_out','transfer_in','adjustment')),
  ref_id       INTEGER NOT NULL,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  delta        INTEGER NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moves_product   ON stock_moves(product_id);
CREATE INDEX IF NOT EXISTS idx_moves_warehouse ON stock_moves(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_moves_type      ON stock_moves(move_type);
CREATE INDEX IF NOT EXISTS idx_moves_created   ON stock_moves(created_at DESC);
`

async function setup() {
  const client = await pool.connect()
  try {
    console.log('🔗 Connecting to PostgreSQL...')
    console.log(`   Host:     ${process.env.DB_HOST || 'localhost'}`)
    console.log(`   Database: ${process.env.DB_NAME || 'hackbase'}`)
    console.log('')

    // Phase A: Add role column to existing users table (safe if already exists)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'staff'`)
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`)
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('manager', 'staff'))`)

    // Phase B: Main schema
    await client.query(SQL)

    console.log('✅ Auth:      users (+role), otp_codes, sessions')
    console.log('✅ Inventory: categories, warehouses, products, stocks')
    console.log('✅ Ops:       receipts, deliveries, transfers, adjustments')
    console.log('✅ Ledger:    stock_moves')
    console.log('✅ Indexes & triggers created')
    console.log('')
    console.log('🚀 Done! Run: npm run dev')
  } catch (err) {
    console.error('❌ Setup failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

setup()
