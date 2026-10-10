#!/usr/bin/env node
// Exercise the shipped consent UI functions without a browser or DB.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '../../assets/battle-hub-modal.js'), 'utf8');
const slice = src.slice(src.indexOf('function duelFleetDetails'), src.indexOf('// Commander Actions — pre-battle directives'));
const ctx = {
  battleHubState: { listCache: {} }, getMyWallet: () => 'defender', tl: en => en,
  escapeHtml: s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
  getAuthHeaders: () => ({}), bhLoad: () => {}, showFactionToast: () => {},
};
vm.createContext(ctx);
vm.runInContext(slice, ctx);
const invite = {
  id: '1', defender_wallet: 'defender', inviter_fleet_id: '11', defender_fleet_id: '22',
  expires_at: new Date().toISOString(), terms_token: 'token', loss_terms: { policy: [] },
  fleet_snapshot: [
    { id:'11', name:'<img src=x onerror=alert(1)>', ships:[{ id:'111', ship_type_code:'mcc_dst', current_hp:99, max_hp:100 }] },
    { id:'22', name:'B', ships:[] },
  ],
};
const html = ctx.renderDuelInvitation(invite);
assert.ok(!html.includes('<img'));
assert.ok(html.includes("respondDuelInvitation('1','accept')"));
assert.equal((html.match(/min-height:44px/g) || []).length, 2);
assert.ok(html.includes('permanently destroyed'));
assert.ok(html.includes('99/100'));
let calls = 0;
ctx.battleHubState.duelInvitations = [invite];
ctx.gameConfirm = async opts => {
  assert.ok(opts.body.includes('permanently destroyed'));
  assert.ok(opts.body.includes('99/100'));
  return false;
};
ctx.fetch = async () => { calls++; };
(async () => {
  await ctx.respondDuelInvitation('1', 'accept');
  assert.equal(calls, 0);
  ctx.gameConfirm = async () => true;
  ctx.fetch = async (url, opts) => {
    calls++;
    assert.ok(url.endsWith('/1/accept'));
    const body = JSON.parse(opts.body);
    assert.equal(body.accept_loss_terms, true);
    assert.equal(body.terms_token, 'token');
    return { ok:true, json:async () => ({}) };
  };
  await ctx.respondDuelInvitation('1', 'accept');
  assert.equal(calls, 1);
  invite.mode='standard_v1';
  invite.loss_terms={permanent_ship_loss_possible:false,standard:{fleet_budgets:[{fleet_id:'11',ships:1,catalog_budget:500}],catalog:[{code:'mcc_dst',base_hp:60000,base_atk:34,base_def:14,role:'brawler'}]}};
  const standardHtml=ctx.renderDuelInvitation(invite);
  assert.ok(standardHtml.includes('500/5000'));
  assert.ok(standardHtml.includes('Base HP 60000'));
  assert.ok(standardHtml.includes('No permanent loss, charges, rewards or OPS progress'));
  assert.ok(!standardHtml.includes('99/100'));
  ctx.gameConfirm=async opts=>{
    assert.equal(opts.title,'Accept standard fleet duel');
    assert.equal(opts.confirmText,'Accept standard rules');
    assert.ok(opts.body.includes('500/5000'));
    assert.ok(opts.body.includes('parts are disabled only in simulation'));
    return true;
  };
  await ctx.respondDuelInvitation('1','accept');
  assert.equal(calls,2);
  ctx.getMyWallet = () => 'inviter';
  assert.ok(!ctx.renderDuelInvitation(invite).includes('<button'));
  console.log('PASS consent UI: escaped fleets, ordinary loss risk, standard catalog budget/base HP/no-loss rules, 44px buttons, cancel sends no request, exact terms acceptance, inviter has no accept action');
})().catch(e => { console.error(e); process.exitCode = 1; });
