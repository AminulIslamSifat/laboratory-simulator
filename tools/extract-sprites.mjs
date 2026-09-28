#!/usr/bin/env node
/**
 * ONE-SHOT sprite extractor for the per-device module split.
 *
 * Reads js/lab/sprites.js VERBATIM and writes:
 *
 *   src/devices/<dir>/sprite.ts   - the SVG function(s) for one device
 *   src/devices/<dir>/layout.ts   - the EQUIPMENT registry entry for that device
 *   src/devices/index.ts          - the assembled EquipmentRegistry
 *
 * Why a script and not copy-paste: the sprites are 2,200 lines of traced panel
 * art whose jacks sit on exact pixel coordinates. Retyping them by hand is
 * exactly where the previous drift bugs came from (B1/B2 pasted into the
 * motor entry from the transformer). The extractor preserves every coordinate
 * byte-for-byte.
 *
 * Delete after the split is verified and committed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'js/lab/sprites.js'), 'utf8');
const lines = src.split('\n');

/* device map: registry kind -> destination folder + sprite fn + export const */
const DEVICES = [
  { kind: 'dc_machine',               dir: 'dc-machine',   sprite: 'spriteDCMachine',              export: 'dcMachine' },
  { kind: 'async_motor_3p',           dir: 'motor-3p',     sprite: 'spriteAsyncMotor3P',           export: 'motor3p' },
  { kind: 'async_motor_1p',           dir: 'motor-1p',     sprite: 'spriteAsyncMotor1P',           export: 'motor1p' },
  { kind: 'single_phase_transformer', dir: 'transformer',  sprite: 'spriteSinglePhaseTransformer', export: 'transformer' },
  { kind: 'sync_gen',                 dir: 'sync-gen',     sprite: 'spriteSyncGen',                export: 'syncGen' },
  { kind: 'rheostat',                 dir: 'rheostat',     sprite: 'spriteRheostat',               export: 'rheostat' },
  { kind: 'power_supply',             dir: 'power-supply', sprite: 'spritePowerSupply',            export: 'powerSupply' },
  { kind: 'load_bank',                dir: 'load-bank',    sprite: 'spriteLoadBank',               export: 'loadBank' },
  { kind: 'meter',                    dir: 'meter',        sprite: 'spriteMeter',                  export: 'meter' },
  { kind: 'coupling',                 dir: 'coupling',     sprite: 'spriteCoupling',               export: 'coupling' },
  { kind: 'meter_rack',               dir: 'meter-rack',   sprite: 'spriteMeterRack',              export: 'meterRack' }
];

/* rack sub-sprites live beside spriteMeterRack, unexported */
const RACK_SUBSPRITES = [
  'spriteVIPSModule', 'spriteSYNCSCOPY', 'spriteMINSSCOPY', 'spriteVIPS2',
  'spriteOutletBay', 'spriteAAPower', 'spriteDINMeters', 'spriteOutletR2',
  'spriteCounter', 'spriteIWYBay', 'spriteAZ68_R3', 'spriteAZ67_R3',
  'spriteBenchBay', 'spriteIWYBay_R4', 'spriteAZ68_R4', 'spriteAZ67_R4'
];

/* every top-level sprite fn, in source order, and whether it is exported */
const ALL_FNS = [
  { name: 'spriteDCMachine',              exp: true },
  { name: 'spriteAsyncMotor3P',           exp: true },
  { name: 'spriteAsyncMotor1P',           exp: true },
  { name: 'spriteSyncGen',                exp: true },
  { name: 'spriteCoupling',               exp: true },
  { name: 'spriteRheostat',               exp: true },
  { name: 'spritePowerSupply',            exp: true },
  { name: 'spriteMeter',                  exp: true },
  { name: 'spriteLoadBank',               exp: true },
  ...RACK_SUBSPRITES.map((n) => ({ name: n, exp: false })),
  { name: 'spriteMeterRack',              exp: true },
  { name: 'spriteSinglePhaseTransformer', exp: true }
];

const DIR_FNS = {
  'dc-machine':   ['spriteDCMachine'],
  'motor-3p':     ['spriteAsyncMotor3P'],
  'motor-1p':     ['spriteAsyncMotor1P'],
  'sync-gen':     ['spriteSyncGen'],
  'coupling':     ['spriteCoupling'],
  'rheostat':     ['spriteRheostat'],
  'power-supply': ['spritePowerSupply'],
  'meter':        ['spriteMeter'],
  'load-bank':    ['spriteLoadBank'],
  'meter-rack':   ['spriteMeterRack', ...RACK_SUBSPRITES],
  'transformer':  ['spriteSinglePhaseTransformer']
};

/* ---- locate a function and its closing brace -------------------- */

function findFnLine(name) {
  const prefix = 'function ' + name + '(';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(prefix)) return i;
  }
  return -1;
}

/**
 * Return the index of the line that closes a function starting at `start`.
 *
 * Every sprite in this codebase is formatted with its closing brace at
 * column 0 — either on its own line, or as the last character of a one-line
 * body. Brace-counting was tried first and failed: the sprites emit SVG by
 * string concatenation, so `'{'` inside a literal is data, not structure,
 * and any scanner that ignores quoting counts them wrong.
 *
 * The formatting is a stronger contract than the brace math. It is also
 * what Prettier enforces on this tree, so it is stable.
 */
function findCloseLine(start) {
  // One-liner: the whole body lives on the declaration line.
  if (lines[start].trimEnd().endsWith('}')) return start;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '}') return i;
  }
  return -1;
}

/* ---- sprite files --------------------------------------------- */

const IMPORT_HEADER = [
  '/* eslint-disable */',
  '// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.',
  '// Do not hand-edit during the split - re-run the extractor instead.',
  '// After the split is verified and committed this file is the source.',
  '',
  "import { esc, jack, label, txt, screw, panel, warningStrip, shade,",
  "  _rr, _cc, _tt, _lv, _screw, _screws, _jack, _socket, _lamp, _led,",
  "  _btnRed, _db9, _outlet, _lcdBezel, _lcdBlue, _iwy, _lu } from '../_shared/svg.js';",
  ''
].join('\n');

let totalSpriteLines = 0;
for (const [dir, names] of Object.entries(DIR_FNS)) {
  const parts = [];
  for (const name of names) {
    const start = findFnLine(name);
    if (start < 0) throw new Error('fn not found: ' + name);
    const end = findCloseLine(start);
    if (end < 0) throw new Error('close not found: ' + name);
    let body = lines.slice(start, end + 1).join('\n');
    const meta = ALL_FNS.find((f) => f.name === name);
    if (meta && meta.exp) {
      // Plain string surgery, not a regex. A RegExp built from a string
      // needs a literal backslash to escape the paren, and this file is
      // generated by tooling that has already dropped that backslash twice.
      const decl = 'function ' + name + '(';
      const exp = 'export function ' + name + '(';
      if (body.startsWith(decl)) body = exp + body.slice(decl.length);
    }
    if (name === 'spriteMeter') {
      const before = 'export function spriteMeter(opts)';
      const after = 'export function spriteMeter(opts: { mode: string })';
      if (body.startsWith(before)) body = after + body.slice(before.length);
    }
    parts.push(body);
  }
  const outDir = join(root, 'src/devices', dir);
  mkdirSync(outDir, { recursive: true });
  const out = IMPORT_HEADER + parts.join('\n\n') + '\n';
  writeFileSync(join(outDir, 'sprite.ts'), out);
  const n = out.split('\n').length;
  totalSpriteLines += n;
  console.log('  sprite.ts   src/devices/' + dir + '/sprite.ts   (' + n + ' lines)');
}

/* ---- registry entries ----------------------------------------- */

let regStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^const EQUIPMENT = \{$/.test(lines[i])) { regStart = i; break; }
}
if (regStart < 0) throw new Error('EQUIPMENT registry not found');

const entries = {};
{
  let i = regStart + 1;
  while (i < lines.length) {
    const m = lines[i].match(/^  ([a-z_0-9]+): \{$/);
    if (!m) {
      if (lines[i] === '};') break;
      i++;
      continue;
    }
    const kind = m[1];
    const buf = [lines[i]];
    let depth = 1, j = i + 1;
    for (; j < lines.length && depth > 0; j++) {
      buf.push(lines[j]);
      for (const c of lines[j]) {
        if (c === '{') depth++;
        else if (c === '}') depth--;
      }
    }
    entries[kind] = buf.join('\n');
    i = j;
  }
}

console.log('');
for (const dev of DEVICES) {
  const text = entries[dev.kind];
  if (!text) { console.warn('  ! no registry entry for ' + dev.kind); continue; }
  const layout =
    "import { " + dev.sprite + " } from './sprite.js';\n" +
    "import type { EquipmentEntry } from '../_shared/types.js';\n\n" +
    "/** " + dev.kind + " - panel layout, terminals and front-panel controls. */\n" +
    "export const " + dev.export + ": EquipmentEntry = " + text + ";\n";
  writeFileSync(join(root, 'src/devices', dev.dir, 'layout.ts'), layout);
  console.log('  layout.ts   src/devices/' + dev.dir + '/layout.ts');
}

/* ---- assembled registry --------------------------------------- */

const idx = [
  '/**',
  ' * Equipment registry.',
  ' *',
  ' * One entry per palette kind. Each device folder owns one device completely:',
  ' * the SVG it paints (`sprite.ts`) and the layout the lab needs to drop',
  ' * clickable dots on printed jacks and route front-panel controls',
  ' * (`layout.ts`). The device model will move in beside them so the terminal',
  ' * list stops being a thing anyone has to remember to sync.',
  ' */',
  ''
];
for (const dev of DEVICES) idx.push("import { " + dev.export + " } from './" + dev.dir + "/layout.js';");
idx.push("import type { EquipmentRegistry } from './_shared/types.js';");
idx.push('');
idx.push('/** Every palette kind the lab can place. */');
idx.push('export const EQUIPMENT: EquipmentRegistry = {');
for (const dev of DEVICES) idx.push('  ' + dev.kind + ': ' + dev.export + ',');
idx.push('};');
writeFileSync(join(root, 'src/devices', 'index.ts'), idx.join('\n') + '\n');

console.log('');
console.log('  index.ts    src/devices/index.ts');
console.log('');
console.log('extracted ' + totalSpriteLines + ' sprite lines across ' + Object.keys(DIR_FNS).length + ' devices.');
