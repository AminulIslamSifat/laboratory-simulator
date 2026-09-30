import { describe, it, expect } from 'vitest';
import { MeterRack } from '../src/devices/meter-rack/model.js';

/**
 * Regression: the second AZ-VIPS display (d2b) was permanently blank.
 *
 * The sprite binds its three live nodes to `d2b:L1b`, `d2b:L2b`, `d2b:L3b`
 * (its real terminal names), but `readouts()` keyed every three-line channel
 * with a hardcoded ['L1','L2','L3'] - so it emitted `d2b:L1`, `d2b:L2`,
 * `d2b:L3`. The sprite lookup `byName.get('d2b:L1b')` missed, and the display
 * never updated no matter how it was wired. d1 only worked because its
 * terminals happen to be spelled like the literal.
 */
describe('meter rack d2b readout keys', () => {
  it('emits keys matching the sprite data-live names', () => {
    const r = new MeterRack({ id: 'rack' });
    for (const c of r.channels) {
      if (c.lines) { c.Vline = [100, 200, 300]; c.V = 100; }
    }
    const names = r.readouts().map((x) => x.name);

    expect(names).toContain('d2b:L1b');
    expect(names).toContain('d2b:L2b');
    expect(names).toContain('d2b:L3b');

    expect(names).toContain('d1:L1');
    expect(names).toContain('d1:L2');
    expect(names).toContain('d1:L3');

    expect(names).not.toContain('d2b:L1');
    expect(names).not.toContain('d2b:L2');
    expect(names).not.toContain('d2b:L3');
  });
});