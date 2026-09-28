/**
 * Terminal-name cross-check.
 *
 * The device models declare the terminals they understand; `sprites.js`
 * declares the jacks it draws. Those two sets have to agree, and the two
 * ways they can disagree are NOT equally bad:
 *
 *   drawn but not declared  -> a user CAN wire to that jack. The netlist
 *                             drops the wire silently because the terminal
 *                             was never a node, the device never sees it,
 *                             and the bench sits dead with no error.
 *                             THIS IS A BUG.
 *
 *   declared but not drawn  -> nobody can reach it. Inert. Worth knowing
 *                             about, but it cannot hurt a student.
 *
 * Only the first kind fails the build.
 *
 * Run: node tools/check-terminals.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* -- sprite kind -> the class that implements it ------------------ */

const KIND_TO_CLASS = {
  dc_machine: ['dc.ts', 'DCMachine'],
  async_motor_3p: ['motor3p.ts', 'Motor3P'],
  async_motor_1p: ['motor1p.ts', 'Motor1P'],
  single_phase_transformer: ['transformer.ts', 'Transformer'],
  sync_gen: ['syncgen.ts', 'SyncGen'],
  rheostat: ['passive.ts', 'Rheostat'],
  power_supply: ['supply.ts', 'DCSupply'],
  load_bank: ['passive.ts', 'LoadBank'],
  meter: ['passive.ts', 'Meter'],
  coupling: ['passive.ts', 'Coupling'],
  meter_rack: ['meterrack.ts', 'MeterRack']
};

/** Ports that carry torque, not current - never in the electrical set. */
const MECH = new Set(['SHAFT', 'MA', 'MB']);

/* -- read the sprite registry ------------------------------------ */

const spriteSrc = readFileSync(join(root, 'js/lab/sprites.js'), 'utf8');

function spriteTerms() {
  const out = {};
  const entries = spriteSrc.split(/\n  ([a-z_0-9]+): \{\n/);
  for (let i = 1; i < entries.length; i += 2) {
    const name = entries[i];
    const body = entries[i + 1] ?? '';
    const m = body.match(/terms:\s*\[([\s\S]*?)\]\s*\}/);
    if (!m) continue;
    out[name] = [...m[1].matchAll(/k:\s*'([^']+)'/g)].map((t) => t[1]);
  }
  return out;
}

/* -- read a class's declared terminals --------------------------- */

const srcCache = new Map();
function deviceSrc(file) {
  if (!srcCache.has(file)) {
    srcCache.set(file, readFileSync(join(root, 'src/engine/devices', file), 'utf8'));
  }
  return srcCache.get(file);
}

/** Slice out one `export class Name { ... }` body by brace matching. */
function classBody(src, cls) {
  const start = src.indexOf(`export class ${cls}`);
  if (start < 0) throw new Error(`class ${cls} not found`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces for ${cls}`);
}

/**
 * All `<key>: 1` object-literal keys inside a fragment.
 *
 * Keys may be bare identifiers (`A1`, `DC+24`), quoted identifiers that
 * start with a digit (`'2U1'`, `'3P-L1'`), or quoted symbols (`'+'`, `'-'`).
 * An earlier version of this regex demanded a leading letter and silently
 * skipped the quoted ones — which reported seven perfectly-declared
 * transformer taps as missing. A checker that cries wolf is worse than no
 * checker, so it reads all three shapes now.
 */
function keysIn(fragment) {
  const out = [];
  for (const m of fragment.matchAll(/'([^']+)'\s*:\s*1/g)) out.push(m[1]);
  for (const m of fragment.matchAll(/(?:^|[,{\s])([A-Za-z_][\w+\-]*)\s*:\s*1/g)) {
    out.push(m[1]);
  }
  return out;
}

function declaredTerms(file, cls) {
  const src = deviceSrc(file);
  const body = classBody(src, cls);
  const found = new Set();

  // `readonly terminals = { ... };`
  for (const m of body.matchAll(/readonly terminals[^=]*=\s*\{([^}]*)\}/g)) {
    for (const k of keysIn(m[1])) found.add(k);
  }

  // `this.terminals = <expr>;` - may hold several object literals (the
  // meter picks V or A by mode, so both branches have to be read).
  for (const m of body.matchAll(/this\.terminals\s*=\s*([^;]+);/g)) {
    const expr = m[1];
    if (expr.includes('SUPPLY_TERMINALS')) {
      const block = src.match(/export const SUPPLY_TERMINALS[^=]*=\s*\{([^}]*)\}/);
      if (block) for (const k of keysIn(block[1])) found.add(k);
      continue;
    }
    for (const lit of expr.matchAll(/\{([^}]*)\}/g)) {
      for (const k of keysIn(lit[1])) found.add(k);
    }
  }

  // MeterRack assembles its terminals from channel arrays at runtime.
  if (cls === 'MeterRack') {
    for (const m of body.matchAll(/(?:pos|neg|seriesPos|seriesNeg)\s*[:=]\s*\[([^\]]*)\]/g)) {
      for (const k of m[1].matchAll(/'([^']+)'/g)) found.add(k[1]);
    }
  }

  for (const k of MECH) found.delete(k);
  return [...found];
}

/* -- diff -------------------------------------------------------- */

const sprite = spriteTerms();
const broken = [];
const inert = [];

console.log('sprite kind'.padEnd(26), 'drawn', 'decl', '  verdict');
console.log('-'.repeat(72));

for (const [kind, [file, cls]] of Object.entries(KIND_TO_CLASS)) {
  const drawn = (sprite[kind] ?? []).filter((k) => !MECH.has(k));
  const decl = declaredTerms(file, cls);

  const unreachable = drawn.filter((k) => !decl.includes(k));
  const inertDecl = decl.filter((k) => !drawn.includes(k));

  const notes = [];
  if (unreachable.length) {
    notes.push(`BUG - model missing: ${unreachable.join(', ')}`);
    broken.push({ kind, missing: unreachable });
  }
  if (inertDecl.length) {
    notes.push(`inert - sprite missing: ${inertDecl.join(', ')}`);
    inert.push({ kind, extra: inertDecl });
  }

  console.log(
    kind.padEnd(26),
    String(drawn.length).padStart(5),
    String(decl.length).padStart(4),
    '  ' + (notes.join('  |  ') || 'ok')
  );
}

console.log('-'.repeat(72));
if (inert.length) {
  console.log(`\n${inert.length} device(s) declare terminals the sprite never draws - unreachable, harmless.`);
}
if (broken.length) {
  console.log(`\n${broken.length} device(s) draw jacks the model does not declare - wires there are dropped.`);
  process.exit(1);
}
console.log('\nNo unreachable jacks. Every drawn terminal has a model behind it.');
