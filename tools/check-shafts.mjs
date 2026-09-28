/**
 * Shaft-port alignment check.
 *
 * Every rotating machine paints a flange and declares a mechanical SHAFT
 * terminal so a Coupling can snap to it. Two things have to hold, and both
 * have silently broken before:
 *
 *   1. The flange must fit INSIDE the sprite's viewBox. A flange drawn past
 *      the edge is clipped by the SVG, so it renders as a detached blob
 *      while the terminal dot sits on empty space.
 *
 *   2. The SHAFT terminal, converted from viewBox space to device space, must
 *      land on the flange CENTRE. Off by more than a pixel or two and the
 *      coupling snaps to the wrong spot.
 *
 * This used to parse one 2,200-line sprites.js. The per-device split moved
 * each sprite and layout into its own folder, so it now reads the specific
 * files for each machine. The check itself is unchanged.
 *
 * Run: node tools/check-shafts.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Each machine: its device folder, sprite function, layout export and the
 * mechanical terminal name. Both files are read from disk so this check
 * cannot drift from the drawing it verifies.
 */
const MACHINES = [
  { name: 'DCMachine', dir: 'dc-machine', fn: 'spriteDCMachine',      layout: 'dcMachine', term: 'SHAFT' },
  { name: 'Motor3P',   dir: 'motor-3p',   fn: 'spriteAsyncMotor3P',   layout: 'motor3p',   term: 'SHAFT' },
  { name: 'Motor1P',   dir: 'motor-1p',   fn: 'spriteAsyncMotor1P',   layout: 'motor1p',   term: 'SHAFT' },
  { name: 'SyncGen',   dir: 'sync-gen',   fn: 'spriteSyncGen',        layout: 'syncGen',   term: 'SHAFT' }
];

function readDevice(dir, kind) {
  return readFileSync(join(root, 'src/devices', dir, kind), 'utf8');
}

/** Slice a function body out by brace matching. */
function fnBody(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error('unbalanced braces in ' + name);
}

/** Pull the layout box from the device's layout file. */
function layoutOf(src) {
  const m = src.match(/w:\s*([\d.]+),\s*h:\s*([\d.]+)/);
  if (!m) throw new Error('no layout w/h');
  return [Number(m[1]), Number(m[2])];
}

/**
 * Pull a terminal's coordinate out of a layout file.
 *
 * Locates the `k: '<term>'` marker by plain indexOf, then reads the x and y
 * that follow. No regex: a RegExp built from a string needs a doubled
 * backslash for every `\s` and `\d`, and those doubled backslashes have been
 * eaten by the tool transport more than once. String methods cannot be.
 */
function termOf(src, term) {
  const marker = "k: '" + term + "'";
  const at = src.indexOf(marker);
  if (at < 0) throw new Error('no ' + term + ' terminal');
  const tail = src.slice(at, at + 200);

  const xAt = tail.indexOf('x:');
  const yAt = tail.indexOf('y:');
  if (xAt < 0 || yAt < 0) throw new Error(term + ' terminal has no x/y');

  const x = Number(tail.slice(xAt + 2).trim().split(/[,}]/)[0]);
  const y = Number(tail.slice(yAt + 2).trim().split(/[,}]/)[0]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(term + ' terminal has a non-numeric x/y');
  }
  return [x, y];
}

let bad = 0;
console.log('machine'.padEnd(12), 'flange->device'.padEnd(20), 'term'.padEnd(14), 'err'.padEnd(9), 'viewBox');
console.log('-'.repeat(78));

for (const m of MACHINES) {
  let spriteSrc, layoutSrc;
  try {
    spriteSrc = readDevice(m.dir, 'sprite.ts');
    layoutSrc = readDevice(m.dir, 'layout.ts');
  } catch (err) {
    console.log(m.name.padEnd(12), 'MISSING FILE: ' + err.message);
    bad++;
    continue;
  }

  const body = fnBody(spriteSrc, m.fn);

  const vb = body.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!vb) {
    console.log(m.name.padEnd(12), 'NO VIEWBOX');
    bad++;
    continue;
  }
  const [vx, vy, vw, vh] = vb.slice(1).map(Number);

  // The shaft centre is the data-spin group's transform-origin — the point
  // the render loop rotates the rotor about, so it IS the shaft by definition.
  const spin = body.match(/data-spin[^>]*transform-origin="([\d.]+) ([\d.]+)"/);
  if (!spin) {
    console.log(m.name.padEnd(12), 'NO SPIN GROUP');
    bad++;
    continue;
  }
  const fx = Number(spin[1]);
  const fy = Number(spin[2]);

  // Largest circle centred on the shaft, for the clipping test. SyncGen paints
  // its shaft as a rounded rect, so fall back to a rect half-extent.
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

  const [w, h] = layoutOf(layoutSrc);
  const [tx, ty] = termOf(layoutSrc, m.term);

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
    ('(' + dx.toFixed(1) + ',' + dy.toFixed(1) + ')').padEnd(20),
    ('(' + tx + ',' + ty + ')').padEnd(14),
    (err.toFixed(2) + 'px').padEnd(9),
    inside ? 'ok' : ('CLIPPED r=' + right + '>' + (vx + vw))
  );
}

console.log('-'.repeat(78));
if (bad) {
  console.log('\n' + bad + ' machine(s) with a clipped flange or a misplaced shaft terminal.');
  process.exit(1);
}
console.log('\nAll shaft flanges are inside their viewBox and every SHAFT terminal sits on the flange centre.');
