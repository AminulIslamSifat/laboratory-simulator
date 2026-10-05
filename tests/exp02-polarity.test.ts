/**
 * Exp 02 polarity - the two presets must actually READ additive/subtractive.
 *
 * The wiring-integrity test proves every wire lands on a terminal the device
 * declares. That is necessary but not sufficient: a bench can be fully wired
 * and still give the wrong verdict if the strap or the probe sits on the
 * wrong tap. This runs each preset through the real solver and asserts on the
 * two numbers a student reads off the panel.
 *
 *   DIN face (d3) -> the source, Va, in series with the primary
 *   AA face  (d2) -> the resultant, Vc, across the open ends
 *
 *   additive     Vc > Va
 *   subtractive  Vc < Va
 *
 * Both presets must also keep the supply alive - a bench that trips its
 * breaker reads zero everywhere and looks identical to a dead one.
 */

import { describe, it, expect } from 'vitest';
import { PRESETS } from '../src/ui/presets.js';
import { DEVICE_KINDS } from '../src/devices/index.js';
import { Netlist } from '../src/engine/netlist.js';
import { Simulator } from '../src/engine/simulator.js';
import type { Device } from '../src/engine/types.js';

/**
 * Minimal Lab stand-in, matching the one in presets.test.ts.
 *
 * The one thing it must get right that the wiring test does not care about:
 * the entry id and the model id have to be the SAME string, because a preset
 * writes its wires against the entry id while the netlist files the device
 * under the model id. Let those drift and every wire resolves to nothing.
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
      const entry: any = { id: kind + '_' + ++seq, kind, x, y, rot, model };
      (model as { id: string }).id = entry.id;
      this.devices.push(entry);
      return entry;
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

/** Build a preset, run it, and hand back what the two row-2 faces read. */
function runPreset(name: string) {
  const lab = fakeLab();
  const preset = (PRESETS as Record<string, any>)[name];
  if (!preset) throw new Error('no preset ' + name);
  preset.build(lab);
  preset.setup(lab);

  const nl = new Netlist();
  for (const d of lab.devices) nl.addDevice(d.model as Device);
  let n = 0;
  for (const w of lab.wires) {
    nl.addWire({ id: 'w' + ++n, a: w.aDev + ':' + w.aTerm, b: w.bDev + ':' + w.bTerm });
  }

  const psuDoc = lab.devices.find((d: any) => d.kind === 'power_supply');
  const psu = nl.devices.get(psuDoc.id) as any;
  const sim = new Simulator(nl, 7);
  let sol = sim.step(1 / 60);
  for (let i = 0; i < 400; i++) {
    // The app's loop re-arms the supply every frame; a preset left stopped
    // would otherwise read dead here and in the browser alike.
    psu.enabled = true;
    sol = sim.step(1 / 60);
  }

  const rack = lab.devices.find((d: any) => d.kind === 'meter_rack');
  const ro = (nm: string): number => {
    const h = sim.readoutsFor(rack.id).find((r) => r.name === nm);
    return h ? Number(h.value) : NaN;
  };
  return {
    va: ro('d3'), vc: ro('d2'),
    warn: psu.warn as string,
    tripped: psu.rails.vac.tripped as boolean,
    wires: lab.wires.length
  };
}

describe('exp02 polarity presets', () => {
  it('additive reads Vc > Va', () => {
    const r = runPreset('exp02_polarity_additive');
    console.log('  additive: Va=' + r.va.toFixed(2) + '  Vc=' + r.vc.toFixed(2) + '  (' + r.wires + ' wires)');
    expect(r.tripped, 'supply tripped: ' + r.warn).toBe(false);
    expect(r.va).toBeGreaterThan(10);
    expect(r.vc).toBeGreaterThan(r.va);
  });

  it('subtractive reads Vc < Va', () => {
    const r = runPreset('exp02_polarity_subtractive');
    console.log('  subtractive: Va=' + r.va.toFixed(2) + '  Vc=' + r.vc.toFixed(2) + '  (' + r.wires + ' wires)');
    expect(r.tripped, 'supply tripped: ' + r.warn).toBe(false);
    expect(r.va).toBeGreaterThan(10);
    expect(r.vc).toBeLessThan(r.va);
  });

  it('both put the source on the same face, so only Vc moves', () => {
    const a = runPreset('exp02_polarity_additive');
    const s = runPreset('exp02_polarity_subtractive');
    // Same supply setting, same primary loop -> the source reading must match
    // between the two benches. If it does not, one of them is wired wrong.
    expect(Math.abs(a.va - s.va)).toBeLessThan(1);
  });
});
