
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => console.error('PG error:', err.message));

async function q(text, params) {
  return pool.query(text, params);
}

async function migrate() {
  console.log('🔧 Running migrations...');

  await q(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    image TEXT,
    country TEXT,
    material TEXT,
    origin TEXT,
    manufacture_date TEXT,
    carbon_footprint REAL,
    water_usage REAL,
    energy_usage REAL,
    recyclability INTEGER,
    repairability INTEGER,
    current_owner TEXT,
    status TEXT DEFAULT 'active',
    life_score INTEGER DEFAULT 75,
    price_new REAL DEFAULT 0,
    warranty_months INTEGER DEFAULT 12,
    purchase_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS chain_events (
    id SERIAL PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor TEXT,
    location TEXT,
    notes TEXT,
    event_hash TEXT,
    prev_hash TEXT,
    block_number INTEGER,
    tx_hash TEXT,
    anchored_at TIMESTAMPTZ,
    timestamp TIMESTAMPTZ DEFAULT NOW()
  )`);

  await q(`CREATE TABLE IF NOT EXISTS future_scenarios (
    id SERIAL PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    scenario_name TEXT,
    years_ahead INTEGER,
    health_score INTEGER,
    resale_value REAL,
    carbon_saved REAL,
    recommendation TEXT
  )`);

  await q(`CREATE TABLE IF NOT EXISTS decisions (
    id SERIAL PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    option_name TEXT,
    cost REAL,
    carbon REAL,
    lifespan_years INTEGER,
    satisfaction INTEGER,
    score REAL
  )`);

  await q(`CREATE TABLE IF NOT EXISTS repair_shops (
    id SERIAL PRIMARY KEY,
    name TEXT,
    category TEXT,
    location TEXT,
    rating REAL,
    reviews INTEGER,
    price REAL,
    eta TEXT,
    certified BOOLEAN
  )`);

  await q(`CREATE TABLE IF NOT EXISTS impact_ledger (
    id SERIAL PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action TEXT,
    carbon_saved REAL,
    water_saved REAL,
    waste_diverted REAL,
    points INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
  )`);

  await q(`CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_chain_product ON chain_events(product_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_ledger_user ON impact_ledger(user_id)`);

  console.log('✅ Migrations complete');
}

module.exports = { pool, q, migrate };

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}