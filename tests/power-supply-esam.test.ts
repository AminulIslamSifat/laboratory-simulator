import { describe, it, expect } from 'vitest';
import { DCSupply } from '../src/devices/power-supply/model.js';

/**
 * Regression: the power-supply ESAM displays were blank.
 *
 * The sprite draws each ESAM with `dispId` m1/m2 (see esam() in sprite.ts)
 * and emits `data-live="m1"` / `data-live="m2"`. But readouts() only emitted
 * rail-named keys (vdcV, vacV, ...), so the binder's byName.get('m1') missed
 * and no ESAM ever updated. These keys must exist.
 */
describe('power supply ESAM readout keys', () => {
  it('emits m1/m2 keys the sprite listens for, with a mode-appropriate unit', () => {
    const ps = new DCSupply({ id: 'ps' });
    const byName = new Map(ps.readouts().map((r) => [r.name, r]));

    // Exactly what the sprite's _lv()/_lu() nodes bind.
    expect(byName.has('m1')).toBe(true);
    expect(byName.has('m2')).toBe(true);

    // Default mode is V, so the unit must be volts.
    expect(byName.get('m1')!.unit).toBe('V');
    expect(byName.get('m2')!.unit).toBe('V');

    // Flipping a channel to A must change the unit on the next read.
    ps.setDisplayMode('m1', 'A');
    const after = new Map(ps.readouts().map((r) => [r.name, r]));
    expect(after.get('m1')!.unit).toBe('A');
  });
});