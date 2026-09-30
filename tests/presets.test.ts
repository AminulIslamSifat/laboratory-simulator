/**
 * Preset wiring integrity.
 *
 * Every preset's wires are checked against the terminal lists its devices
 * actually declare. The netlist DROPS a wire whose endpoint is a terminal no
 * model has, silently and with no error - so a preset that names a jack the
 * panel does not paint produces a dead bench with no explanation.
 *
 * This test exists because exactly that had happened: the 3φ motor presets
 * wired B1 / B2 / C2 and the 1φ motor presets wired Run / Aux2, none of which
 * are painted. Eight wires across three benches never reached the solver.
 */

import { describe, it, expect } from 'vitest';
import { PRESETS } from '../src/ui/presets.js';
import { DEVICE_KINDS } from '../src/devices/index.js';

/**
 * A minimal stand-in for the Lab the presets are written against.
 *
 * Only the surface a preset touches is implemented: devices, place(), clear(),
 * wiring.add(), titleEl and fitView(). A preset that reaches for anything else
 * will fail loudly here rather than silently do nothing.
 */
function fakeLab(): any {
  let seq = 0;
  const lab: any = {
    devices: [],
    wires: [],
    titleEl: { textContent: '' },
    clear() { this.devices = []; this.wires = []; },
    fitView() {},
    place(kind: string, x = 0, y = 0, rot = 0) {
      const Ctor = DEVICE_KINDS[kind];
      if (!Ctor) throw new Error('unknown kind ' + kind);
      const model = new (Ctor as new () => unknown)();
      const entry = { id: kind + '_' + ++seq, kind, x, y, rot, model };
      this.devices.push(entry);
      return entry;
    },
    /**
     * Mirror of `Lab.loadBench`, reduced to what this test observes.
     *
     * The real one also re-points DOM nodes and rebuilds the netlist; here the
     * only thing that matters is that a device keeps its SAVED id (so wires
     * resolve) and that the wires land. Kept deliberately dumb — if the real
     * loadBench ever stops preserving ids, that is a different test's job to
     * catch, and faking the machinery here would hide it.
     */
    loadBench(data: { devices: Array<Record<string, any>>; wires: Array<Record<string, any>> }) {
      this.clear();
      for (const d of data.devices) {
        const entry = this.place(d.kind, d.x, d.y, d.rot || 0);
        entry.id = d.id;
        entry.model.id = d.id;
        if (d.state) entry.state = d.state;
      }
      for (const w of data.wires) {
        this.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
      }
    },
    wiring: {
      add(aDev: string, aTerm: string, bDev: string, bTerm: string) {
        lab.wires.push({ aDev, aTerm, bDev, bTerm });
        return { id: 'w' + lab.wires.length, aDev, aTerm, bDev, bTerm };
      }
    }
  };
  return lab;
}

describe('preset wiring', () => {
  for (const [key, preset] of Object.entries(PRESETS)) {
    it(key + ' builds and every wire lands on a real terminal', () => {
      const lab = fakeLab();
      preset.build(lab);
      if (preset.setup) preset.setup(lab);

      type Entry = { id: string; kind: string; model: { terminals?: Record<string, number> } };
      const byId = new Map<string, Entry>(
        (lab.devices as Entry[]).map((d) => [d.id, d])
      );
      const bad: string[] = [];
      for (const w of lab.wires as Array<{ aDev: string; aTerm: string; bDev: string; bTerm: string }>) {
        const A = byId.get(w.aDev);
        const B = byId.get(w.bDev);
        if (!A || !B) { bad.push(`${w.aDev}:${w.aTerm} -> ${w.bDev}:${w.bTerm} (missing device)`); continue; }
        const at = A.model.terminals ?? {};
        const bt = B.model.terminals ?? {};
        if (!(w.aTerm in at)) bad.push(`${A.kind}:${w.aTerm} — no such terminal`);
        if (!(w.bTerm in bt)) bad.push(`${B.kind}:${w.bTerm} — no such terminal`);
      }
      expect(bad).toEqual([]);
    });
  }

  it('the sandbox preset places nothing', () => {
    const lab = fakeLab();
    PRESETS.sandbox.build(lab);
    expect(lab.devices).toHaveLength(0);
  });

  it('every non-sandbox preset places at least one device and wires something', () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (key === 'sandbox') continue;
      const lab = fakeLab();
      preset.build(lab);
      expect(lab.devices.length, key + ' placed no devices').toBeGreaterThan(0);
    }
  });
});