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
 *
 * ── DIVERGED SPRITES ────────────────────────────────────────────────
 *
 * The migration is verified and committed; the per-device sprite.ts files are
 * now the source of truth and `js/lab/sprites.js` is a frozen historical
 * reference. Two sprites have since been changed ON PURPOSE, so byte-identity
 * no longer holds for them:
 *
 *   coupling  - added a [data-spin] index mark on the barrel, so a rigid
 *               coupling visibly turns at the shared shaft speed.
 *   meter     - the LCD reading was a painted constant ('220.0' / '1.400');
 *               it is now bound with data-live/data-live-unit so the panel
 *               shows its own measurement instead of a fixed number.
 *
 * Those two are checked against a STRUCTURAL contract below instead: they
 * must still render, and they must still expose the dynamic hooks the render
 * loop depends on. Everything else keeps the strict byte comparison, so an
 * accidental change to a traced coordinate still fails loudly.
 *
 * If a future change intentionally alters another sprite, add it to
 * DIVERGED with a one-line reason. Do not delete the byte check wholesale.
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

  /**
   * Sprites deliberately changed after the extraction. Keyed by palette kind,
   * value is the human reason. See the header note.
   */
  const DIVERGED: Record<string, string> = {
    coupling: 'added a data-spin index mark so the barrel turns',
    meter: 'LCD reading bound to data-live instead of a painted constant',
    // Both AZ-VIPS bays paint a full A1/B1/B2/D + R/D2/C jack bank, but the
    // model only ever read the Bay 2 names, so every jack on Bay 4 was dead
    // and its display had no readout to bind to. Bay 4 now has its own
    // terminals, mode switches and live LCD, so byte-identity cannot hold.
    meter_rack: 'Bay 4 AZ-VIPS bank wired up + live LCD added'
  };

  for (const kind of kinds) {
    describe(kind, () => {
      if (DIVERGED[kind]) {
        it('renders a well-formed SVG (diverged: ' + DIVERGED[kind] + ')', () => {
          const svg = EQUIPMENT[kind].sprite();
          expect(svg.startsWith('<svg ')).toBe(true);
          expect(svg.endsWith('</svg>')).toBe(true);
          // Every element must be a tag the browser will actually parse; a
          // stray unescaped '<' would otherwise only show up at runtime.
          expect(svg).not.toMatch(/<\s*</);
        });

        it('exposes the dynamic hooks the render loop needs', () => {
          const svg = EQUIPMENT[kind].sprite();
          if (kind === 'coupling') {
            // The render loop finds the rotor by this attribute and reads the
            // origin from the same element - both must be present.
            expect(svg).toContain('data-spin="1"');
            expect(svg).toMatch(/data-spin="1"[^>]*transform-origin="[\d.]+ [\d.]+"/);
          }
          if (kind === 'meter') {
            // Value and unit nodes, keyed the way Meter.readouts() names them.
            expect(svg).toContain('data-live="V"');
            expect(svg).toContain('data-live-unit="V"');
            // And it must NOT still carry the old painted constant.
            expect(svg).not.toContain('>220.0<');
          }
          if (kind === 'meter_rack') {
            // The two AZ-VIPS bays report all three input lines at once, so
            // each carries three value nodes keyed d1:L1 / d1:L2 / d1:L3
            // (and the 'b' bank for Bay 4). d3/d4 stay single-readout.
            for (const id of ['d1:L1', 'd1:L2', 'd1:L3', 'd2b:L1b', 'd2b:L2b', 'd2b:L3b']) {
              expect(svg).toContain('data-live="' + id + '"');
              expect(svg).toContain('data-live-unit="' + id + '"');
            }
            for (const id of ['d3', 'd4']) {
              expect(svg).toContain('data-live="' + id + '"');
              expect(svg).toContain('data-live-unit="' + id + '"');
            }
          }
        });
      } else {
        it('renders byte-identical SVG to the original', () => {
          const next = EQUIPMENT[kind].sprite();
          const prev = legacy[kind].sprite();
          expect(next).toBe(prev);
        });
      }

      // Terminal parity is only meaningful while a device still matches its
      // legacy layout. A diverged device has, by definition, added or moved
      // terminals, so comparing its list to the frozen original is comparing
      // a correct panel to a buggy one. For those, `terminal-layout.test.ts`
      // is the check that matters: it proves every declared terminal is
      // actually painted by the sprite.
      if (!DIVERGED[kind]) {
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
      } else {
        it('has no duplicate terminal names', () => {
          const names = EQUIPMENT[kind].layout.terms.map((t) => t.k);
          expect(new Set(names).size).toBe(names.length);
        });
      }

      it('keeps its panel dimensions', () => {
        expect(EQUIPMENT[kind].layout.w).toBe(legacy[kind].layout.w);
        expect(EQUIPMENT[kind].layout.h).toBe(legacy[kind].layout.h);
      });
    });
  }
});
