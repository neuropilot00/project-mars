-- Live battles have a renewable authority lease; existing battles remain untouched.
ALTER TABLE fleet_battles ADD COLUMN IF NOT EXISTS live_lease_token uuid;
ALTER TABLE fleet_battles ADD COLUMN IF NOT EXISTS live_lease_expires_at timestamptz;
ALTER TABLE fleet_battles ADD COLUMN IF NOT EXISTS live_slot_acquired boolean NOT NULL DEFAULT false;
