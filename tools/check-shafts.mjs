/**
 * Shaft-port alignment check.
 *
 * Every rotating machine paints a flange on its right (or left) face and
 * declares a mechanical SHAFT terminal so a Coupling can snap to it. Two
 * things have to hold, and both have silently broken before:
 *
 *   1. The flange must fit INSIDE the sprite's viewBox. A flange drawn past
 *      the edge is clipped by the SVG, so it renders as a detached blob
 *      floating outside the panel while the terminal dot sits on empty space.
 *      The 3-phase motor had its whole shaft at x=1000..1250 in a viewBox
 *      only 896 wide — completely invisible, terminal marking nothing.
 *
 *   2. The SHAFT terminal, converted from viewBox space to device space, must
 *      land on the flange CENTRE. Off by more than a pixel or two and the
 *      coupling snaps to the wrong spot.
 *
 * Run: node tools/check-shafts.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'js/lab/sprites.js'), 'utf8');

/**
 * Each machine: the sprite function, the device-space layout box, the flange
 * centre in viewBox coordinates, the flange radius, and the terminal name.
 * Flange coordinates are read back out of the sprite source so this file
 * cannot drift from the drawing it checks.
 */
const MACHINES = [
  { name: 'DCMachine', fn: 'spriteDCMachine', term: 'SHAFT' },
  { name: 'Motor3P', fn: 'spriteAsyncMotor3P', term: 'SHAFT' },
  { name: 'Motor1P', fn: 'spriteAsyncMotor1P', term: 'SHAFT' },
  { name: 'SyncGen', fn: 'spriteSyncGen', term: 'SHAFT' }
];

/** Slice a function body out by brace matching. */
function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/** Pull the layout box from the registry entry that uses this sprite. */
function layoutOf(src, fn) {
  const at = src.indexOf(`sprite: ${fn}`);
  if (at < 0) throw new Error(`no registry entry for ${fn}`);
  const tail = src.slice(at, at + 400);
  const m = tail.match(/w:\s*([\d.]+),\s*h:\s*([\d.]+)/);
  if (!m) throw new Error(`no layout w/h for ${fn}`);
  return [Number(m[1]), Number(m[2])];
}

/** Pull the SHAFT terminal coordinate from the registry entry. */
function termOf(src, fn) {
  const at = src.indexOf(`sprite: ${fn}`);
  const tail = src.slice(at, at + 1200);
  const m = tail.match(/k:\s*'SHAFT',\s*x:\s*([\d.]+),\s*y:\s*([\d.]+)/);
  if (!m) throw new Error(`no SHAFT terminal for ${fn}`);
  return [Number(m[1]), Number(m[2])];
}

let bad = 0;
console.log('machine'.padEnd(12), 'flange->device'.padEnd(20), 'term'.padEnd(14), 'err'.padEnd(9), 'viewBox');
console.log('-'.repeat(78));

for (const m of MACHINES) {
  const body = fnBody(src, m.fn);

  // viewBox: `viewBox="minX minY width height"`
  const vb = body.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!vb) {
    console.log(m.name.padEnd(12), 'NO VIEWBOX');
    bad++;
    continue;
  }
  const [vx, vy, vw, vh] = vb.slice(1).map(Number);

  // The shaft centre is the `data-spin` group's transform-origin. That is the
  // point the render loop actually rotates the rotor about, so it IS the shaft
  // by definition — no guessing from circle sizes.
  //
  // A previous version of this check picked the largest circle in the body,
  // which grabbed the machine's nameplate disc (r=50 at 676,552) instead of
  // the flange and reported a 143px error on a machine that was correct.
  const spin = body.match(/data-spin[^>]*transform-origin="([\d.]+) ([\d.]+)"/);
  if (!spin) {
    console.log(m.name.padEnd(12), 'NO SPIN GROUP');
    bad++;
    continue;
  }
  const fx = Number(spin[1]);
  const fy = Number(spin[2]);

  // Radius for the clipping test: the largest circle centred on the shaft.
  // SyncGen paints its shaft as a rounded rect rather than a circle, so fall
  // back to a small nominal radius when nothing matches.
  let fr = 0;
  for (const c of body.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)) {
    if (Math.abs(Number(c[1]) - fx) < 0.5 && Math.abs(Number(c[2]) - fy) < 0.5) {
      fr = Math.max(fr, Number(c[3]));
    }
  }
  if (fr === 0) {
    for (const r of body.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
      const cx = Number(r[1]) + Number(r[3]) / 2;
      const cy = Number(r[2]) + Number(r[4]) / 2;
      if (Math.abs(cx - fx) < 2 && Math.abs(cy - fy) < 2) {
        fr = Math.max(fr, Math.max(Number(r[3]), Number(r[4])) / 2);
      }
    }
  }
  const [w, h] = layoutOf(src, m.fn);
  const [tx, ty] = termOf(src, m.fn);

  const dx = ((fx - vx) * w) / vw;
  const dy = ((fy - vy) * h) / vh;
  const err = Math.hypot(dx - tx, dy - ty);

  const right = fx + fr;
  const left = fx - fr;
  const bottom = fy + fr;
  const top = fy - fr;
  const inside = left >= vx && right <= vx + vw && top >= vy && bottom <= vy + vh;

  const ok = inside && err <= 2;
  if (!ok) bad++;

  console.log(
    m.name.padEnd(12),
    `(${dx.toFixed(1)},${dy.toFixed(1)})`.padEnd(20),
    `(${tx},${ty})`.padEnd(14),
    `${err.toFixed(2)}px`.padEnd(9),
    inside ? 'ok' : `CLIPPED r=${right}>${vx + vw}`
  );
}

console.log('-'.repeat(78));
if (bad) {
  console.log(`\n${bad} machine(s) with a clipped flange or a misplaced shaft terminal.`);
  process.exit(1);
}
console.log('\nAll shaft flanges are inside their viewBox and every SHAFT terminal sits on the flange centre.');
