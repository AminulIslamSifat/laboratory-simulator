/**
 * A device's model and its panel must agree about terminals.
 *
 * This is the permanent guard against the drift class that started the whole
 * refactor: a jack drawn on the panel that no model declared, or a model
 * reading a jack that was never painted. Either way a wire lands on a name
 * the netlist has no node for, the connection is dropped in silence, and the
 * bench sits dead with no error anywhere.
 *
 * `tools/check-terminals.mjs` caught this by parsing source text. Now that
 * the model, sprite and layout for a device live in one folder, the check can
 * use the real objects — which is both stronger and shorter.
 */

import { describe, it, expect } from 'vitest';
import { EQUIPMENT, DEVICE_KINDS } from '../src/devices/index.js';

type HasTerminals = { terminals?: Record<string, number> };

describe('model terminals match panel layout', () => {
  for (const [kind, entry] of Object.entries(EQUIPMENT)) {
    it(kind, () => {
      const Ctor = DEVICE_KINDS[kind] as unknown as new () => HasTerminals;
      const dev = new Ctor();
      const model = Object.keys(dev.terminals ?? {}).sort();
      const drawn = entry.layout.terms.map((t) => t.k).sort();
      expect(model).toEqual(drawn);
    });
  }
});
