'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../../assets/tactical-lab-v11.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
function view(mode = 'battle') {
  const fleet = { dbFleetId: '11', side: 'atk', ships: [{ dbShipId: '111', tid: 'dummy', type: { code: 'dummy' }, hp: 100, dead: false, x: 0, y: 0, isFlagship: true }, { tid: 'ghost', type: { code: 'ghost' }, hp: 100, dead: false }] };
  const ctx = { fleets: [fleet], ships: fleet.ships.slice(), W: 460, H: 600, SHIPS: { dummy: {} }, battleScaleConfig() { throw new Error('LOCAL_SIMULATION'); }, mkShip: (code, side, x, y, owner, flag) => ({ tid: code, type: { code }, side, x, y, isFlagship: flag }) };
  vm.createContext(ctx); vm.runInContext("const TL_MODE='" + mode + "';", ctx);
  for (const [start, end] of [['function objectiveMapPoint(', 'function renderObjectiveBanner('], ['function syncServerShips(', 'function fleetRoleText('], ['function updateFleets(', 'function fire(']]) vm.runInContext(script.slice(script.indexOf(start), script.indexOf(end)), ctx);
  return { ctx, fleet };
}
test('real client projects server ship position, facing and damage into canvas space', () => {
  const { ctx, fleet } = view();
  ctx.syncServerShips({ ships: [{ fid: '11', id: '111', x: 1000, y: 440, facing: 1.5, code: 'dummy', ff: 1, hp: 65, maxHp: 100 }] });
  assert.equal(fleet.ships[0].x, 460); assert.ok(Math.abs(fleet.ships[0].y - 401.2) < 1e-9); assert.equal(fleet.ships[0].facing, 1.5); assert.equal(fleet.ships[0].hp, 65);
  assert.equal(fleet.ships[1].dead, true, 'unmatched locally generated hull is not a live server ship');
  for (let i = 0; i < 20; i++) ctx.updateFleets(16);
  assert.equal(fleet.ships[0].x, 460); assert.ok(Math.abs(fleet.ships[0].y - 401.2) < 1e-9); assert.equal(fleet.ships[0].hp, 65);
});
test('late join can create a visual instance for a server hull, then removes it only from later full snapshot', () => {
  const { ctx, fleet } = view();
  const hull = { fid: '11', id: '999', x: 300, y: 220, code: 'dummy', hp: 90, maxHp: 100 };
  ctx.syncServerShips({ ships: [hull] });
  const ship = fleet.ships.find(s => s.dbShipId === '999');
  assert.ok(ship); assert.equal(ship.hp, 90); assert.equal(ship.dead, false); assert.equal(ctx.ships.includes(ship), true);
  ctx.syncServerShips({ ships: [] }); assert.equal(ship.dead, true);
});
test('sandbox still advances its existing local simulation', () => {
  const { ctx } = view('sandbox'); assert.throws(() => ctx.updateFleets(16), /LOCAL_SIMULATION/);
});
test('battle loop never invokes local random fire or decides its own winner', () => {
  new vm.Script(script);
  assert.match(script, /if\(TL_MODE!=='battle'\)ships\.forEach\(sh=>/);
  assert.match(script, /if\(TL_MODE==='sandbox'&&!battleOver&&\(af===0\|\|df===0\)/);
  assert.match(script, /_wsEndPayload = m;battleOver=true;advanceBattleClock\(0\)/);
});
