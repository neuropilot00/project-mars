const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ── Schema initialization ──
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        wallet_address VARCHAR(42) PRIMARY KEY,
        usdt_balance DECIMAL(20,6) DEFAULT 0,
        pp_balance DECIMAL(20,6) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(42) NOT NULL,
        amount DECIMAL(20,6) NOT NULL,
        pp_bonus DECIMAL(20,6) NOT NULL,
        chain VARCHAR(10) NOT NULL,
        tx_hash VARCHAR(66) UNIQUE NOT NULL,
        block_number BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pixels (
        lat DECIMAL(8,2) NOT NULL,
        lng DECIMAL(8,2) NOT NULL,
        owner VARCHAR(42),
        price DECIMAL(20,6) DEFAULT 0.1,
        claim_id INT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lat, lng)
      );

      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        owner VARCHAR(42) NOT NULL,
        center_lat DECIMAL(8,2) NOT NULL,
        center_lng DECIMAL(8,2) NOT NULL,
        width INT NOT NULL,
        height INT NOT NULL,
        image_url TEXT,
        link_url TEXT,
        total_paid DECIMAL(20,6) NOT NULL,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit','claim','hijack','swap','withdraw','withdraw_all')),
        from_wallet VARCHAR(42),
        to_wallet VARCHAR(42),
        usdt_amount DECIMAL(20,6) DEFAULT 0,
        pp_amount DECIMAL(20,6) DEFAULT 0,
        fee DECIMAL(20,6) DEFAULT 0,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_pixels_owner ON pixels(owner);
      CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(owner);
      CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_wallet);
      CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);
    console.log('[DB] Schema initialized');
  } finally {
    client.release();
  }
}

// ── Helper: ensure user exists ──
async function ensureUser(client, wallet) {
  await client.query(
    `INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO NOTHING`,
    [wallet.toLowerCase()]
  );
}

module.exports = { pool, initDB, ensureUser };
