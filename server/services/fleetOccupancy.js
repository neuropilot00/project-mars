// Shared fleet occupancy guards for systems that temporarily reserve a fleet.

function normalizeFleetIds(fleetIds) {
  return [...new Set((fleetIds || []).map(value => {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('INVALID_FLEET_ID');
    if (!['string', 'number', 'bigint'].includes(typeof value)) throw new Error('INVALID_FLEET_ID');
    const text = String(value);
    if (!/^\d+$/.test(text) || text.length > 19) throw new Error('INVALID_FLEET_ID');
    const id = BigInt(text);
    if (id <= 0n || id > 9223372036854775807n) throw new Error('INVALID_FLEET_ID');
    return id.toString();
  }))];
}

async function getActiveMiningFleetIds(client, fleetIds) {
  const ids = normalizeFleetIds(fleetIds);
  if (!ids.length) return [];

  try {
    const { rows } = await client.query(
      `SELECT DISTINCT fleet_id
         FROM ship_mining_jobs
        WHERE fleet_id = ANY($1::bigint[])
          AND status = 'mining'`,
      [ids]
    );
    return rows.map(row => String(row.fleet_id));
  } catch (err) {
    if (err && err.code === '42P01') return [];
    throw err;
  }
}

async function getActiveCargoFleetIds(client, fleetIds) {
  const ids = normalizeFleetIds(fleetIds);
  if (!ids.length) return [];
  // Optional during rolling migration; querying a missing table inside a TX
  // would abort the caller's transaction even if its 42P01 error were caught.
  const table = await client.query("SELECT to_regclass('public.frontier_cargo') AS name");
  if (!table.rows[0]?.name) return [];
  const { rows } = await client.query(
    "SELECT DISTINCT fleet_id FROM frontier_cargo WHERE fleet_id = ANY($1::bigint[]) AND status = 'moving'", [ids]
  );
  return rows.map(row => String(row.fleet_id));
}

async function assertFleetsNotMining(client, fleetIds, errorMessage = 'FLEET_MINING') {
  const miningIds = await getActiveMiningFleetIds(client, fleetIds);
  if (miningIds.length) {
    const err = new Error(errorMessage);
    err.meta = { fleet_ids: miningIds };
    throw err;
  }
  const cargoIds = await getActiveCargoFleetIds(client, fleetIds);
  if (cargoIds.length) {
    const err = new Error('FLEET_TRANSPORTING');
    err.meta = { fleet_ids: cargoIds };
    throw err;
  }
}

module.exports = {
  getActiveMiningFleetIds,
  getActiveCargoFleetIds,
  assertFleetsNotMining,
};
