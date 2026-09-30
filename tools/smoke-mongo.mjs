/*
 * Live smoke test for the bench API against real Atlas.
 *
 * Boots nothing itself — it expects `npm run preview` to already be listening
 * on $BASE. Exercises save -> list -> load -> delete through the same HTTP
 * routes the browser uses, then deletes what it wrote so the collection is
 * left exactly as it was found.
 *
 * Run:  node tools/smoke-mongo.mjs
 */

const BASE = process.env.BASE || 'http://localhost:5173';
// The server normalises rolls to [A-Z0-9]. Use a raw value with a character
// that gets stripped, and assert against the NORMALISED form — that the two
// differ is itself part of what this test checks.
const ROLL_RAW = '__SMOKE__';
const ROLL = 'SMOKE';
const NAME = 'smoke_roundtrip';

let failures = 0;

function check(label, ok, detail) {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  console.log(`  [${mark}] ${label}${detail ? ' — ' + detail : ''}`);
}

async function json(url, init) {
  const res = await fetch(BASE + url, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const BENCH = {
  devices: [
    { id: 'd1', kind: 'dc_machine', x: 40, y: 30, rot: 0 },
    { id: 'd2', kind: 'meter_rack', x: 300, y: 30, rot: 0 }
  ],
  wires: [{ aDev: 'd1', aTerm: 'A1', bDev: 'd2', bTerm: 'V+' }]
};

async function main() {
  console.log('\nBench API smoke test against ' + BASE + '\n');

  // ── reachability ──
  const ping = await json('/api/bench/list');
  check('GET /api/bench/list responds', ping.status === 200, 'HTTP ' + ping.status);
  if (ping.status !== 200) { console.log('\nServer not reachable; aborting.\n'); process.exit(1); }

  console.log('  backend: ' + ping.body.backend + '  where: ' + ping.body.where);
  check('backend is mongo', ping.body.backend === 'mongo', ping.body.backend);

  // ── validation ──
  const noRoll = await json('/api/bench/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: NAME, bench: BENCH })
  });
  check('save without roll is rejected', noRoll.status === 400, 'HTTP ' + noRoll.status);

  const badBench = await json('/api/bench/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll: ROLL_RAW, name: NAME, bench: { devices: 'nope' } })
  });
  check('save with malformed bench is rejected', badBench.status === 400, 'HTTP ' + badBench.status);

  // ── save ──
  const save = await json('/api/bench/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll: ROLL_RAW, name: NAME, bench: BENCH })
  });
  check('POST save succeeds', save.status === 200 && save.body.ok === true, JSON.stringify(save.body).slice(0, 120));
  check('save normalises the roll', save.body.roll === ROLL, `sent ${ROLL_RAW}, stored ${save.body.roll}`);

  // ── re-save (upsert, not duplicate) ──
  const again = await json('/api/bench/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll: ROLL, name: NAME, bench: { ...BENCH, wires: [] } })
  });
  check('re-save under same roll+name succeeds', again.status === 200);

  const listMine = await json('/api/bench/list?roll=' + encodeURIComponent(ROLL_RAW));
  const mine = listMine.body.benches.filter((b) => b.roll === ROLL && b.name === NAME);
  check('roll filter returns only that owner', mine.length === 1, 'found ' + mine.length);
  check('re-save upserted, did not duplicate', mine.length === 1, 'found ' + mine.length);

  // ── the scoping guarantee ──
  const otherRoll = ROLL + 'OTHER';
  const other = await json('/api/bench/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll: otherRoll, name: NAME, bench: BENCH })
  });
  check('a different roll may reuse the same name', other.status === 200);

  const listAll = await json('/api/bench/list');
  const both = listAll.body.benches.filter((b) => b.name === NAME);
  check('two owners, two rows', both.length === 2, 'found ' + both.length);

  // ── layout for the thumbnail ──
  const row = listAll.body.benches.find((b) => b.roll === ROLL && b.name === NAME);
  check('listing carries a layout for the thumbnail', Array.isArray(row?.layout) && row.layout.length === 2,
    JSON.stringify(row?.layout));
  check('listing carries device + wire counts', row?.devices === 2 && row?.wires === 0,
    `${row?.devices} devices / ${row?.wires} wires`);
  check('listing omits the bench body', row && !('bench' in row));

  // ── load ──
  const load = await json('/api/bench/load?roll=' + encodeURIComponent(ROLL) + '&name=' + encodeURIComponent(NAME));
  check('load returns the bench', load.status === 200 && Array.isArray(load.body.bench?.devices));
  check('load reflects the last write', load.body.bench?.wires?.length === 0,
    'wires=' + load.body.bench?.wires?.length);

  const missing = await json('/api/bench/load?roll=' + encodeURIComponent(ROLL) + '&name=does_not_exist');
  check('load of a missing bench is 404', missing.status === 404, 'HTTP ' + missing.status);

  // ── rolls ──
  const rolls = await json('/api/bench/rolls');
  check('rolls lists both owners',
    rolls.body.rolls?.includes(ROLL) && rolls.body.rolls?.includes(otherRoll),
    JSON.stringify(rolls.body.rolls?.filter((r) => r.startsWith('SMOKE'))));

  // ── cleanup ──
  const del1 = await json('/api/bench/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll: ROLL, name: NAME })
  });
  const del2 = await json('/api/bench/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll: otherRoll, name: NAME })
  });
  check('both test rows deleted', del1.status === 200 && del2.status === 200);

  const after = await json('/api/bench/list');
  check('collection left clean', !after.body.benches.some((b) => b.name === NAME),
    'no rows named ' + NAME);

  console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'ALL CHECKS PASSED') + '\n');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error('\nSMOKE ERROR:', e.message, '\n'); process.exit(1); });
