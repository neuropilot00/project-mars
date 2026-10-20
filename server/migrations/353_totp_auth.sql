-- Optional new username+authenticator accounts. No existing user is enrolled.
-- Runtime requires TOTP_AUTH_ENABLED=true and a 32-byte base64 TOTP_ENCRYPTION_KEY.
CREATE TABLE IF NOT EXISTS totp_identities (
  username VARCHAR(24) PRIMARY KEY CHECK (username ~ '^[a-z0-9_]{4,24}$'),
  wallet_address VARCHAR(42) UNIQUE NOT NULL REFERENCES users(wallet_address),
  encrypted_secret TEXT,
  last_counter BIGINT NOT NULL DEFAULT -1,
  recovery_hashes JSONB NOT NULL CHECK (jsonb_typeof(recovery_hashes)='array'),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version>0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','recovering')),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  failed_daily_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_daily_count BETWEEN 0 AND 5),
  failed_window_start TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status <> 'active' OR encrypted_secret IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS totp_enrollments (
  enrollment_hash CHAR(64) PRIMARY KEY CHECK (enrollment_hash ~ '^[a-f0-9]{64}$'),
  secret_hash CHAR(64) NOT NULL CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  username VARCHAR(24) NOT NULL CHECK (username ~ '^[a-z0-9_]{4,24}$'),
  encrypted_secret TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('signup','recovery')),
  wallet_address VARCHAR(42),
  target_version INTEGER,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','verified','used','locked')),
  verified_counter BIGINT,
  pending_recovery_hashes JSONB,
  confirmation_hash CHAR(64),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (kind <> 'recovery' OR (wallet_address IS NOT NULL AND target_version IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS totp_enrollments_expiry ON totp_enrollments(expires_at);
-- Username is intentionally NOT unique in pending enrollments. Only final
-- totp_identities INSERT claims it atomically; no pending request reserves it.
-- No raw seed, recovery code, JWT, IP, email, or password is stored in these tables.
