#!/usr/bin/env node
/**
 * Post-process tools/extract-sprites.mjs output into compiling TypeScript.
 *
 * The extractor moves SVG and layout data VERBATIM — that is deliberate,
 * because the traced panel coordinates are the whole point and retyping a
 * single one is how terminals drifted in the first place. "Verbatim" and
 * "compiles" are not the same thing, though, and this script bridges them.
 *
 * Four things it fixes, all of them artefacts of the move rather than bugs
 * in the art:
 *
 *   1. `svgOpen` is used by the load-bank sprite but the extractor's import
 *      header predates that helper. Add it everywhere — unused imports cost
 *      nothing here (`noUnusedLocals` is off) and pruning them per file is a
 *      job for the next pass.
 *
 *   2. Inner helper functions inside sprites carry no type annotations
 *      (`function head(cx, y, lines, size, weight) {`). They were fine under
 *      `checkJs: false`; `strict: true` rejects them. Annotate every param
 *      `: any` — the helpers are local closures called only from the sprite
 *      that defines them, so the annotation is honest about what is known.
 *
 *   3. Layout entries ended with `},;` — the registry's inter-entry comma,
 *      then the extractor's statement terminator. Normalise to a single `};`.
 *
 *   4. `dial` and `select` control types were added to `ControlSpec` by hand.
 *      Nothing here to do; noted so the reader knows why they are allowed.
 *
 * Run after every extractor pass. Both scripts are deleted once the split is
 * committed — at that point the per-device files are the source.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const devicesRoot = join(root, 'src/devices');

/** Every device directory under src/devices, excluding the shared module. */
function deviceDirs() {
  const out = [];
  for (const e of readdirSync(devicesRoot, { withFileTypes: true })) {
    if (e.isDirectory() && e.name !== '_shared') out.push(e.name);
  }
  return out;
}

/**
 * Make one parameter optional and typed.
 *
 * OPTIONAL, not required. The first version emitted `x: any`, which turned
 * every previously-implicit-optional argument into a mandatory one and
 * produced 40 "Expected 5 arguments, but got 4" errors — the sprite authors
 * routinely call these helpers with fewer arguments than the signature lists
 * and let a body default fill in the rest.
 *
 * A param that already carries a default (`x = 1`) is left alone: TypeScript
 * forbids combining `?` with a default.
 */
function annotateParam(p) {
  const t = p.trim();
  if (t === '') return '';
  if (t.includes('=')) return t;
  const colon = t.indexOf(':');
  if (colon < 0) return t + '?: any';
  const name = t.slice(0, colon).trim();
  const type = t.slice(colon + 1).trim();
  return (name.endsWith('?') ? name : name + '?') + ': ' + type;
}

/**
 * Type and optionalise every parameter of a two-space-indented function
 * declaration line.
 *
 * Pure string surgery — no regex. A regex literal here needs a literal
 * backslash to escape a paren, and that backslash did not survive being
 * written through the tool transport. String methods have no such problem.
 *
 * The trailing `{` may or may not be preceded by a space (`) {` vs `){`),
 * so the check is on the last non-space character rather than an exact suffix.
 */
function annotateHelper(line) {
  const PREFIX = '  function ';
  if (!line.startsWith(PREFIX)) return line;
  if (!line.trimEnd().endsWith('{')) return line;

  const open = line.indexOf('(', PREFIX.length);
  if (open < 0) return line;
  const close = line.lastIndexOf(')');
  if (close < open) return line;

  const name = line.slice(PREFIX.length, open).trim();
  if (name === '') return line;

  const raw = line.slice(open + 1, close);
  if (raw.trim() === '') return PREFIX + name + '() {';

  const params = raw.split(',').map(annotateParam).filter((p) => p !== '');
  return PREFIX + name + '(' + params.join(', ') + ') {';
}

/**
 * Every export of src/devices/_shared/svg.ts, in stable order.
 *
 * Used to rebuild each sprite's import line from what that file actually
 * references. The extractor emits one fixed header and cannot know which
 * helpers a given sprite calls, so it missed `svgOpen` in load-bank and
 * `JACK_COLOR` in power-supply.
 */
const SVG_EXPORTS = [
  'esc', 'svgOpen', 'shade', 'JACK_COLOR', 'jack', 'label', 'txt',
  'screw', 'panel', 'warningStrip',
  '_rr', '_cc', '_tt', '_lv', '_screw', '_screws', '_jack', '_socket',
  '_lamp', '_led', '_btnRed', '_db9', '_outlet', '_lcdBezel', '_lcdBlue',
  '_iwy', '_lu'
];

const IMPORT_MARKER = "} from '../_shared/svg.js';";

/**
 * Rewrite the svg.js import to exactly what the body uses.
 *
 * Splits the file at the import statement, scans the REMAINDER for each
 * export name, then re-emits one line. Scanning the remainder — not the
 * whole file — is the fix for the first version's bug: checking the whole
 * file found `svgOpen` in the sprite BODY and concluded the import was
 * already present.
 *
 * Over-importing is harmless here (`noUnusedLocals` is off); under-importing
 * breaks the build, so the filter errs toward including.
 */
function rebuildImports(text) {
  const start = text.indexOf('import {');
  const end = text.indexOf(IMPORT_MARKER);
  if (start < 0 || end < start) return text;

  const body = text.slice(0, start) + text.slice(end + IMPORT_MARKER.length);
  const used = SVG_EXPORTS.filter((name) => body.includes(name));
  const line = 'import { ' + used.join(', ') + " } from '../_shared/svg.js';";
  return text.slice(0, start) + line + text.slice(end + IMPORT_MARKER.length);
}

/**
 * Normalise a layout file's tail to a single `};` statement terminator.
 *
 * Strip any trailing `;`, then any trailing `,`, then require `}`. Handling
 * it as three independent steps means it does not matter which combination
 * the extractor emitted this run.
 */
function normaliseTail(text) {
  let t = text.trimEnd();
  if (t.endsWith(';')) t = t.slice(0, -1).trimEnd();
  if (t.endsWith(',')) t = t.slice(0, -1).trimEnd();
  if (!t.endsWith('}')) {
    throw new Error('layout file does not end in a closing brace: ' + t.slice(-60));
  }
  return t + ';';
}

let spritesFixed = 0;
let layoutsFixed = 0;

for (const name of deviceDirs()) {
  const dir = join(devicesRoot, name);

  /* ---- sprite.ts ---- */
  try {
    const f = join(dir, 'sprite.ts');
    let text = readFileSync(f, 'utf8');

    // Rebuild the import from what the BODY references. The previous check
    // tested the whole file, found `svgOpen` used in the sprite body, and
    // concluded the import was already there — which is why load-bank still
    // failed to resolve it.
    text = rebuildImports(text);
    text = text.split('\n').map(annotateHelper).join('\n');

    writeFileSync(f, text);
    spritesFixed++;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  /* ---- layout.ts ---- */
  try {
    const f = join(dir, 'layout.ts');
    const text = readFileSync(f, 'utf8');
    writeFileSync(f, normaliseTail(text) + '\n');
    layoutsFixed++;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

console.log('fixup: ' + spritesFixed + ' sprite files, ' + layoutsFixed + ' layout files');
