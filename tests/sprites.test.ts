/**
 * Sprite extraction fidelity.
 *
 * The per-device module split moved ~1,700 lines of traced SVG and its
 * terminal coordinates out of `js/lab/sprites.js` mechanically, precisely so
 * that no coordinate would be retyped. This test proves the move was
 * faithful: for every device it renders the SVG from the NEW registry and
 * from the ORIGINAL `js/lab/sprites.js`, and asserts they are byte-identical.
 *
 * It also pins the count of terminals per device, because the extractor could
 * in principle drop one silently — and a dropped terminal is exactly the
 * class of bug this whole refactor exists to eliminate.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EQUIPMENT } from '../src/devices/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Load the original sprites.js and hand back its registry.
 *
 * The file is an IIFE that attaches to `window` (or `globalThis` on a
 * browserless host). Evaluating it here is the only way to reach the
 * original sprite functions for a side-by-side comparison.
 */
function loadLegacySprites(): Record<string, any> {
  const src = readFileSync(join(root, 'js/lab/sprites.js'), 'utf8');
  const g: any = globalThis;
  // The IIFE ends with `(typeof window !== 'undefined' ? window : globalThis)`,
  // so on Node it attaches to globalThis. Run it and read the result back.
  // eslint-disable-next-line no-new-func
  new Function(src)();
  return g.EEE.Sprites.EQUIPMENT;
}

describe('sprite extraction fidelity', () => {
  const legacy = loadLegacySprites();

  const kinds = Object.keys(EQUIPMENT);

  it('covers every palette kind the legacy registry defined', () => {
    const legacyKinds = Object.keys(legacy).sort();
    expect(kinds.sort()).toEqual(legacyKinds);
  });

  for (const kind of kinds) {
    describe(kind, () => {
      it('renders byte-identical SVG to the original', () => {
        const next = EQUIPMENT[kind].sprite();
        const prev = legacy[kind].sprite();
        expect(next).toBe(prev);
      });

      it('carries the same terminal names in the same order', () => {
        const next = EQUIPMENT[kind].layout.terms.map((t) => t.k);
        const prev = legacy[kind].layout.terms.map((t: any) => t.k);
        expect(next).toEqual(prev);
      });

      it('carries the same terminal coordinates', () => {
        const next = EQUIPMENT[kind].layout.terms.map((t) => [t.x, t.y]);
        const prev = legacy[kind].layout.terms.map((t: any) => [t.x, t.y]);
        expect(next).toEqual(prev);
      });

      it('keeps its panel dimensions', () => {
        expect(EQUIPMENT[kind].layout.w).toBe(legacy[kind].layout.w);
        expect(EQUIPMENT[kind].layout.h).toBe(legacy[kind].layout.h);
      });
    });
  }
});
