// Shared fleet occupancy guards for systems that temporarily reserve a fleet.

async function getActiveMiningFleetIds(client, fleetIds) {
  const ids = [...new Set((fleetIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length) return [];

  try {
    const { rows } = await client.query(
      `SELECT DISTINCT fleet_id
         FROM ship_mining_jobs
        WHERE fleet_id = ANY($1::bigint[])
          AND status = 'mining'`,
      [ids]
    );
    return rows.map(row => Number(row.fleet_id));
  } catch (err) {
    if (err && err.code === '42P01') return [];
    throw err;
  }
}

async function assertFleetsNotMining(client, fleetIds, errorMessage = 'FLEET_MINING') {
  const miningIds = await getActiveMiningFleetIds(client, fleetIds);
  if (miningIds.length) {
    const err = new Error(errorMessage);
    err.meta = { fleet_ids: miningIds };
    throw err;
  }
}

module.exports = {
  getActiveMiningFleetIds,
  assertFleetsNotMining,
};
