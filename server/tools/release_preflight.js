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

function fetchJson(url) {
  const client = url.startsWith('https://') ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          resolve({ statusCode: res.statusCode, json, body });
        } catch (error) {
          reject(new Error(`invalid JSON from ${url}: ${error.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error(`timeout fetching ${url}`)));
  });
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

  console.log(`\n📊  ${pass} passed / ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('fatal:', error);
  process.exit(2);
});
