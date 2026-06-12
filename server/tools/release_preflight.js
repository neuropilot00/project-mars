#!/usr/bin/env node
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

const baseUrl = (process.argv[2] || process.env.TARGET_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
let pass = 0;
let fail = 0;

function log(label, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'}  ${label}${extra ? '  ' + extra : ''}`);
  if (ok) pass += 1;
  else fail += 1;
}

function requestJson(url, options = {}) {
  return requestRaw(url, options).then((res) => {
    try {
      const json = res.body ? JSON.parse(res.body) : null;
      return { ...res, json };
    } catch (error) {
      throw new Error(`invalid JSON from ${url}: ${error.message}`);
    }
  });
}

function requestRaw(url, options = {}) {
  const client = url.startsWith('https://') ? https : http;
  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : null;
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error(`timeout fetching ${url}`)));
    if (body) req.write(body);
    req.end();
  });
}

function fetchJson(url) {
  return requestJson(url);
}

async function expectBlocked(label, path, options = {}) {
  try {
    const res = await requestJson(`${baseUrl}${path}`, options);
    const ok = res.statusCode === 401 || res.statusCode === 403;
    log(label, ok, `status=${res.statusCode}`);
  } catch (error) {
    log(label, false, error.message);
  }
}

async function expectStaticOk(label, path) {
  try {
    const res = await requestRaw(`${baseUrl}${path}`);
    const ok = res.statusCode === 200 && res.body.length > 0;
    log(label, ok, `status=${res.statusCode} bytes=${res.body.length}`);
  } catch (error) {
    log(label, false, error.message);
  }
}

async function main() {
  console.log(`TARGET_URL=${baseUrl}`);

  try {
    execSync('npm run smoke:db', { stdio: 'inherit' });
    log('smoke:db', true);
  } catch (error) {
    log('smoke:db', false, `exit=${error.status || 1}`);
  }

  try {
    const health = await fetchJson(`${baseUrl}/health`);
    const ok = health.statusCode === 200 && health.json && health.json.status === 'ok' && health.json.database === 'ok';
    log('/health returns 200 + ok database', ok, `status=${health.statusCode} body=${JSON.stringify(health.json)}`);
  } catch (error) {
    log('/health returns 200 + ok database', false, error.message);
  }

  try {
    const config = await fetchJson(`${baseUrl}/api/config`);
    const ok = config.statusCode === 200 && config.json && typeof config.json === 'object';
    const keys = ok ? Object.keys(config.json).slice(0, 5).join(',') : '';
    log('/api/config responds', ok, `status=${config.statusCode}${keys ? ` keys=${keys}` : ''}`);
  } catch (error) {
    log('/api/config responds', false, error.message);
  }

  try {
    const adminStats = await fetchJson(`${baseUrl}/admin/api/stats`);
    const ok = adminStats.statusCode === 401 || adminStats.statusCode === 403;
    log('/admin/api/stats blocks unauthenticated access', ok, `status=${adminStats.statusCode}`);
  } catch (error) {
    log('/admin/api/stats blocks unauthenticated access', false, error.message);
  }

  try {
    const campaignEditor = await fetchJson(`${baseUrl}/admin/api/campaign-editor/chapters`);
    const ok = campaignEditor.statusCode === 401 || campaignEditor.statusCode === 403;
    log('/admin/api/campaign-editor/chapters blocks unauthenticated access', ok, `status=${campaignEditor.statusCode}`);
  } catch (error) {
    log('/admin/api/campaign-editor/chapters blocks unauthenticated access', false, error.message);
  }

  await expectBlocked('/api/fleets blocks unauthenticated access', '/api/fleets');
  await expectBlocked('/api/transport/start blocks unauthenticated access', '/api/transport/start', {
    method: 'POST',
    body: { originSectorId: 1, destSectorId: 2, cargoGp: 1 }
  });
  await expectBlocked('/api/gp/transfer blocks unauthenticated access', '/api/gp/transfer', {
    method: 'POST',
    body: { to: '0x0000000000000000000000000000000000000000', amount: 1 }
  });
  await expectBlocked('/api/shop/use blocks unauthenticated access', '/api/shop/use', {
    method: 'POST',
    body: { itemCode: 'test' }
  });
  await expectBlocked('/api/territory/:id/harvest blocks unauthenticated access', '/api/territory/1/harvest', {
    method: 'POST',
    body: {}
  });
  await expectBlocked('/api/user/auctions blocks unauthenticated access', '/api/user/auctions?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/bounty/my-bounties blocks unauthenticated access', '/api/bounty/my-bounties?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/bounty/on-me blocks unauthenticated access', '/api/bounty/on-me?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/betting/mine blocks unauthenticated access', '/api/betting/mine?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/gp/activity blocks unauthenticated access', '/api/gp/activity?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/gp/transfers blocks unauthenticated access', '/api/gp/transfers?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/notifications blocks unauthenticated access', '/api/notifications?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/status/my blocks unauthenticated access', '/api/status/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/shield/my-shields blocks unauthenticated access', '/api/shield/my-shields?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/rental/my blocks unauthenticated access', '/api/rental/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/expeditions/my blocks unauthenticated access', '/api/expeditions/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/claims/my blocks unauthenticated access', '/api/claims/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/branding/my blocks unauthenticated access', '/api/branding/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/spells/my blocks unauthenticated access', '/api/spells/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/tiers/my blocks unauthenticated access', '/api/tiers/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/tournaments/my blocks unauthenticated access', '/api/tournaments/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/vip/my blocks unauthenticated access', '/api/vip/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/lottery/my-tickets blocks unauthenticated access', '/api/lottery/my-tickets?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/staking/my-stakes blocks unauthenticated access', '/api/staking/my-stakes?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/duels/my blocks unauthenticated access', '/api/duels/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/duels/pending blocks unauthenticated access', '/api/duels/pending?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/wager/my blocks unauthenticated access', '/api/wager/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/raffles/my blocks unauthenticated access', '/api/raffles/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/alliances/my blocks unauthenticated access', '/api/alliances/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/prestige/my blocks unauthenticated access', '/api/prestige/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/tdesc/my blocks unauthenticated access', '/api/tdesc/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/upgrades/my-upgrades blocks unauthenticated access', '/api/upgrades/my-upgrades?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/monuments/my-monuments blocks unauthenticated access', '/api/monuments/my-monuments?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/guild/my blocks unauthenticated access', '/api/guild/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/guild/invites blocks unauthenticated access', '/api/guild/invites?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/guild/:id/requests blocks unauthenticated access', '/api/guild/1/requests?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/guild/:id/search-users blocks unauthenticated access', '/api/guild/1/search-users?wallet=0x0000000000000000000000000000000000000000&q=test');
  await expectBlocked('/api/guild/chat/:guildId blocks unauthenticated access', '/api/guild/chat/1?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/transport/my blocks unauthenticated access', '/api/transport/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/quests blocks unauthenticated access', '/api/quests?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/stats/career blocks unauthenticated access', '/api/stats/career?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/season/rewards blocks unauthenticated access', '/api/season/rewards?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/season/pass blocks unauthenticated access', '/api/season/pass?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/mining/my blocks unauthenticated access', '/api/mining/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/capsule/my blocks unauthenticated access', '/api/capsule/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/tribute/my blocks unauthenticated access', '/api/tribute/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/broadcasts/my blocks unauthenticated access', '/api/broadcasts/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/tevt/my blocks unauthenticated access', '/api/tevt/my?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/crafting/log blocks unauthenticated access', '/api/crafting/log?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/profile blocks unauthenticated access', '/api/profile?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/profile/history blocks unauthenticated access', '/api/profile/history?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/vtag/get blocks unauthenticated access', '/api/vtag/get?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/achievements blocks unauthenticated access', '/api/achievements?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/onboarding/status blocks unauthenticated access', '/api/onboarding/status?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/user/resources blocks unauthenticated access', '/api/user/resources?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/user/job blocks unauthenticated access', '/api/user/job?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/user/job/change-status blocks unauthenticated access', '/api/user/job/change-status?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/shop/inventory blocks unauthenticated access', '/api/shop/inventory?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/shop/active-effects blocks unauthenticated access', '/api/shop/active-effects?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/items/instances blocks unauthenticated access', '/api/items/instances?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/enhance/info/:instanceId blocks unauthenticated access', '/api/enhance/info/1?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/cosmetic/equipped blocks unauthenticated access', '/api/cosmetic/equipped?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/marketplace/my-listings blocks unauthenticated access', '/api/marketplace/my-listings?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/fleet-battles blocks unauthenticated access', '/api/fleet-battles?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/user/titles blocks unauthenticated access', '/api/user/titles?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/daily/status blocks unauthenticated access', '/api/daily/status?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/daily/missions blocks unauthenticated access', '/api/daily/missions?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/daily/streak blocks unauthenticated access', '/api/daily/streak?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/user/my-territories blocks unauthenticated access', '/api/user/my-territories?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/missions/pads blocks unauthenticated access', '/api/missions/pads?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/missions/preview blocks unauthenticated access', '/api/missions/preview?wallet=0x0000000000000000000000000000000000000000&type=exploration&originClaimId=1&lat=0&lng=0');
  await expectBlocked('/api/missions/active blocks unauthenticated access', '/api/missions/active?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/arena/mines/active blocks unauthenticated access', '/api/arena/mines/active?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/arena/coinflip/history blocks unauthenticated access', '/api/arena/coinflip/history?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/arena/hilo/active blocks unauthenticated access', '/api/arena/hilo/active?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/battles/history blocks unauthenticated access', '/api/battles/history?wallet=0x0000000000000000000000000000000000000000');
  await expectBlocked('/api/sector-defs/:code/entry-check blocks unauthenticated access', '/api/sector-defs/alpha/entry-check?wallet=0x0000000000000000000000000000000000000000');

  await expectStaticOk('/assets/tactical-lab-v11.html serves', '/assets/tactical-lab-v11.html?v=preflight');
  await expectStaticOk('/assets/ships/top/mcc_frg.png serves', '/assets/ships/top/mcc_frg.png?v=preflight');
  await expectStaticOk('/assets/textures/battlefields/mars_mining_site_topdown.png serves', '/assets/textures/battlefields/mars_mining_site_topdown.png?v=preflight');

  console.log(`\n📊  ${pass} passed / ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('fatal:', error);
  process.exit(2);
});
