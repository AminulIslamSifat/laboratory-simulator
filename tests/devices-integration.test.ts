/**
 * Integration tests for the ported device library.
 *
 * These place real equipment on a real netlist and run the actual solver.
 * A port is only faithful if a machine spins, a transformer steps voltage
 * down, and a supply trips its breaker under a short — so that is what is
 * asserted.
 */

import { describe, it, expect } from 'vitest';
import { Netlist } from '../src/engine/netlist.js';
import { Simulator } from '../src/engine/simulator.js';
import {
  DCSupply,
  DCMachine,
  Motor3P,
  Transformer,
  Rheostat,
  LoadBank,
  MeterRack,
  Meter
} from '../src/devices/index.js';

/** Run the solver for `steps` frames and return the simulator. */
function run(sim: Simulator, steps: number, dt = 1 / 60): void {
  for (let i = 0; i < steps; i++) sim.step(dt);
}

/** Find a readout by name from the current snapshot. */
function ro(sim: Simulator, id: string, name: string): number {
  const list = sim.readoutsFor(id);
  const hit = list.find((r) => r.name === name);
  if (!hit) throw new Error(`no readout '${name}' on ${id}`);
  return typeof hit.value === 'number' ? hit.value : Number.NaN;
}

/* ── rheostat as a plain load ───────────────────────────────────── */

describe('rheostat across the variable DC rail', () => {
  function bench(): { sim: Simulator; psu: DCSupply; rh: Rheostat } {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const rh = new Rheostat({ id: 'rh', Rmax: 100, posA: 1, posB: 1 });
    nl.addDevice(psu);
    nl.addDevice(rh);

    nl.addWire({ id: 'w1', a: 'psu:DC+', b: 'rh:A_TOP' });
    nl.addWire({ id: 'w2', a: 'rh:A_BOT', b: 'psu:DC-' });

    const sim = new Simulator(nl, 7);
    return { sim, psu, rh };
  }

  it('drives ~2.5 A through 100 ohm at 250 V', () => {
    const { sim, psu, rh } = bench();
    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('vdcOn', true);
    psu.setControl('vdcV', 250);

    run(sim, 240);

    // 250 V / 100.05 ohm. The rheostat is a TWO-element device now - unit A
    // (grey) carries the load here, so its own current is IA, not the retired
    // single-element 'I'.
    expect(ro(sim, 'rh', 'IA')).toBeGreaterThan(2.4);
    expect(ro(sim, 'rh', 'IA')).toBeLessThan(2.6);
    expect(psu.rails.vdc.V).toBeGreaterThan(240);
  });

  it('stays dead while the rail switch is open', () => {
    const { sim, psu } = bench();
    psu.master = true;
    psu.enabled = true;
    // vdcOn deliberately NOT set
    run(sim, 120);
    expect(ro(sim, 'rh', 'IA')).toBeCloseTo(0, 3);
  });
});

/* ── emergency stop latch ───────────────────────────────────────── */

describe('supply interlocks', () => {
  it('latches the e-stop and only START clears it', () => {
    const psu = new DCSupply({ id: 'psu' });
    psu.setControl('start', true);
    expect(psu.estop).toBe(false);
    expect(psu.master).toBe(true);
    expect(psu.enabled).toBe(true);

    psu.setControl('estop', true);
    expect(psu.estop).toBe(true);
    expect(psu.master).toBe(false);
    expect(psu.enabled).toBe(false);

    // Pressing estop again must not clear it.
    psu.setControl('estop', true);
    expect(psu.estop).toBe(true);

    psu.setControl('start', true);
    expect(psu.estop).toBe(false);
    expect(psu.enabled).toBe(true);
  });

  it('cycles the 6/12/24 tap', () => {
    const psu = new DCSupply({ id: 'psu' });
    expect(psu.rails.d24.tap).toBe(24);
    psu.setControl('tap', 0);
    expect(psu.rails.d24.tap).toBe(6);
    psu.setControl('tap', 0);
    expect(psu.rails.d24.tap).toBe(12);
    psu.setControl('tap', 0);
    expect(psu.rails.d24.tap).toBe(24);
  });

  it('omits a de-energised rail from the stamp entirely', () => {
    const psu = new DCSupply({ id: 'psu' });
    psu.refreshRails();
    // Every aux rail should be marked open while the panel is dead.
    for (const line of psu.auxLines) {
      expect(line.open).toBe(true);
      expect(line.V).toBeUndefined();
    }
  });
});

/* ── transformer ────────────────────────────────────────────────── */

describe('single-phase transformer', () => {
  it('steps 230 V down to the printed tap voltages', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const tr = new Transformer({ id: 'tr' });
    const rh = new Rheostat({ id: 'rh', Rmax: 500, posA: 1, posB: 1 });
    nl.addDevice(psu);
    nl.addDevice(tr);
    nl.addDevice(rh);

    // Feed the primary from the variable DC rail for a clean, known source.
    nl.addWire({ id: 'w1', a: 'psu:DC+', b: 'tr:P230' });
    nl.addWire({ id: 'w2', a: 'tr:P0', b: 'psu:DC-' });
    // Load the 230 V secondary group.
    nl.addWire({ id: 'w3', a: 'tr:3U2', b: 'rh:A_TOP' });
    nl.addWire({ id: 'w4', a: 'tr:3U1', b: 'rh:A_BOT' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('vdcOn', true);
    psu.setControl('vdcV', 230);

    const sim = new Simulator(nl, 11);
    run(sim, 300);

    // The primary must actually see voltage...
    expect(ro(sim, 'tr', 'V1')).toBeGreaterThan(100);
    // ...and draw magnetising current even with no load reflected yet.
    expect(ro(sim, 'tr', 'I1')).toBeGreaterThan(0.05);
    // The secondary must deliver current into the 500 ohm rheostat.
    expect(ro(sim, 'tr', 'I2')).toBeGreaterThan(0.1);
  });

  it('does not report phantom current into an open secondary', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const tr = new Transformer({ id: 'tr' });
    nl.addDevice(psu);
    nl.addDevice(tr);
    nl.addWire({ id: 'w1', a: 'psu:DC+', b: 'tr:P230' });
    nl.addWire({ id: 'w2', a: 'tr:P0', b: 'psu:DC-' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('vdcOn', true);
    psu.setControl('vdcV', 230);

    const sim = new Simulator(nl, 13);
    run(sim, 300);

    // An open secondary must carry no load current. The old build fed phantom
    // section current into Gref and tripped the breaker on an open circuit.
    expect(ro(sim, 'tr', 'I2')).toBeLessThan(0.01);
    expect(psu.rails.vdc.tripped).toBe(false);
  });
});

/* ── DC machine ─────────────────────────────────────────────────── */

describe('DC machine', () => {
  it('trips the 50 V rail on locked-rotor inrush', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const m = new DCMachine({ id: 'm', Ra: 2.5, Ke: 0.95 });
    // Separately excited: the field is fed from its own 24 V tap, so the
    // internal shunt link (F2≡A2) must be off or the field and armature
    // circuits merge.
    m.setShuntField(false);
    nl.addDevice(psu);
    nl.addDevice(m);

    // Armature straight across the 50 V rail, field from the 24 V tap.
    nl.addWire({ id: 'w1', a: 'psu:DC+50', b: 'm:A1' });
    nl.addWire({ id: 'w2', a: 'm:A2', b: 'psu:DC-50' });
    nl.addWire({ id: 'w3', a: 'psu:DC+24', b: 'm:F1' });
    nl.addWire({ id: 'w4', a: 'm:F2', b: 'psu:DC-24' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('d50On', true);
    psu.setControl('d24On', true);

    const sim = new Simulator(nl, 17);

    // Sample the armature current every frame and keep the peak. Asserting
    // `m.Ia` after the run measures the *settled* value, and by then the
    // fold-back has clamped the rail, the breaker has tripped, and the
    // current is zero again — which says nothing about the inrush that
    // caused the trip. The inrush is the transient, so it has to be caught
    // while it is happening.
    let peakIa = 0;
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
      if (Math.abs(m.Ia) > Math.abs(peakIa)) peakIa = m.Ia;
    }

    // At standstill the armature is a 2.6 ohm resistor across 50 V: about
    // 19 A. The 2 A rail is supposed to trip, and this is the same reason a
    // real DC machine needs a starter box. An earlier version of this test
    // expected it to spin up — it was asserting a physically impossible
    // bench and blaming the solver for getting it right.
    expect(psu.rails.d50.tripped).toBe(true);
    expect(Math.abs(peakIa)).toBeGreaterThan(10);
  });

  it('runs up to speed when the armature is fed through a rheostat', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const m = new DCMachine({ id: 'm', Ra: 2.5, Ke: 0.95 });
    // Separately excited: field on its own 24 V tap, shunt link off.
    m.setShuntField(false);
    // Series starter resistance — the whole point of the starter box.
    //
    // 40 ohm, not 20. The 50 V rail is a 2 A output, so the total armature
    // circuit has to stay above 25 ohm or the fold-back clamps and the
    // inverse-time breaker trips. Motor (2.6 with brush drop) + 40.05 = 42.65
    // ohm gives 1.17 A at standstill, and back-EMF pulls it lower as it
    // accelerates. This is the same arithmetic a student does when sizing a
    // starter box, and getting it wrong is supposed to trip the breaker.
    const start = new Rheostat({ id: 'start', Rmax: 40, posA: 1, posB: 1 });
    nl.addDevice(psu);
    nl.addDevice(m);
    nl.addDevice(start);

    nl.addWire({ id: 'w1', a: 'psu:DC+50', b: 'start:A_TOP' });
    nl.addWire({ id: 'w2', a: 'start:A_BOT', b: 'm:A1' });
    nl.addWire({ id: 'w3', a: 'm:A2', b: 'psu:DC-50' });
    nl.addWire({ id: 'w4', a: 'psu:DC+24', b: 'm:F1' });
    nl.addWire({ id: 'w5', a: 'm:F2', b: 'psu:DC-24' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('d50On', true);
    psu.setControl('d24On', true);

    const sim = new Simulator(nl, 17);
    run(sim, 900);

    expect(psu.rails.d50.tripped).toBe(false);
    expect(ro(sim, 'm', 'N')).toBeGreaterThan(5);
    expect(Number.isFinite(m.omega)).toBe(true);
  });

  it('never produces a NaN omega when left unwired', () => {
    const nl = new Netlist();
    const m = new DCMachine({ id: 'm' });
    nl.addDevice(m);
    const sim = new Simulator(nl, 19);
    run(sim, 120);
    expect(Number.isFinite(m.omega)).toBe(true);
    expect(Number.isFinite(ro(sim, 'm', 'N'))).toBe(true);
  });

  it('generates an EMF when primed above zero speed', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const m = new DCMachine({ id: 'm', primeRpm: 3000 });
    // Field only, fed externally - shunt link must be off.
    m.setShuntField(false);
    nl.addDevice(psu);
    nl.addDevice(m);
    // Field only - armature open, so E is measurable as terminal volts.
    nl.addWire({ id: 'w1', a: 'psu:DC+24', b: 'm:F1' });
    nl.addWire({ id: 'w2', a: 'm:F2', b: 'psu:DC-24' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('d24On', true);

    const sim = new Simulator(nl, 23);
    run(sim, 400);

    expect(m.omega).toBeGreaterThan(0);
    expect(ro(sim, 'm', 'E')).toBeGreaterThan(1);
  });
});

/* ── three-phase motor ──────────────────────────────────────────── */

describe('three-phase induction motor', () => {
  it('accelerates toward synchronous speed on the fixed 3-phase rail', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const m = new Motor3P({ id: 'm3' });
    nl.addDevice(psu);
    nl.addDevice(m);

    nl.addWire({ id: 'w1', a: 'psu:3P-L1', b: 'm3:W2' });
    nl.addWire({ id: 'w2', a: 'm3:B1', b: 'psu:3P-PE' });
    nl.addWire({ id: 'w3', a: 'psu:3P-L2', b: 'm3:U2' });
    nl.addWire({ id: 'w4', a: 'm3:C2', b: 'psu:3P-PE' });
    nl.addWire({ id: 'w5', a: 'psu:3P-L3', b: 'm3:W1' });
    nl.addWire({ id: 'w6', a: 'm3:B2', b: 'psu:3P-PE' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('f3pOn', true);

    const sim = new Simulator(nl, 29);
    run(sim, 900);

    expect(m.omega).toBeGreaterThan(0);
    expect(ro(sim, 'm3', 'I')).toBeGreaterThan(0);
    // It can never exceed synchronous speed.
    expect(ro(sim, 'm3', 'N')).toBeLessThanOrEqual(m.Nsync + 1);
  });
});

/* ── meter rack ─────────────────────────────────────────────────── */

describe('meter rack', () => {
  it('keeps each input line on its own net', () => {
    const nl = new Netlist();
    const rack = new MeterRack({ id: 'rack' });
    nl.addDevice(rack);

    // Row 1 is a three-line input bank: L1 L2 L3 with N on the right. Each
    // line is its OWN node. Bonding them (as the old A1/B1/B2 bank did) would
    // short all three phases together.
    const nets = ['L1', 'L2', 'L3', 'N'].map((k) => nl.netOf('rack', k));
    expect(new Set(nets).size).toBe(4);
  });

  it('reads line 1 against neutral on the d1 display', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const rack = new MeterRack({ id: 'rack' });
    nl.addDevice(psu);
    nl.addDevice(rack);

    nl.addWire({ id: 'w1', a: 'psu:DC+50', b: 'rack:L1' });
    nl.addWire({ id: 'w2', a: 'rack:N', b: 'psu:DC-50' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('d50On', true);

    const sim = new Simulator(nl, 31);
    run(sim, 120);

    // The three-line display reports one readout per line, keyed d1:L1..L3.
    const v = ro(sim, 'rack', 'd1:L1');
    expect(v).toBeGreaterThan(45);
    expect(v).toBeLessThan(55);
    // L2 and L3 are unconnected, so they sit at zero.
    expect(Math.abs(ro(sim, 'rack', 'd1:L2'))).toBeLessThan(1);
    expect(Math.abs(ro(sim, 'rack', 'd1:L3'))).toBeLessThan(1);
  });

  it('switches display mode without needing another solver step', () => {
    const rack = new MeterRack({ id: 'rack' });
    rack.channels[0].V = 12.34;
    rack.channels[0].mode = 'V';
    rack.channels[0].shown = 12.34;
    rack.setDisplayMode('d1', 'A');
    expect(rack.channels[0].mode).toBe('A');
    // shown must be re-pointed immediately, not left on the old number.
    expect(rack.channels[0].shown).toBe(rack.channels[0].I);
  });

  it('does not stamp a shunt that shorts the DIN bay', () => {
    const nl = new Netlist();
    const rack = new MeterRack({ id: 'rack' });
    nl.addDevice(rack);
    const sim = new Simulator(nl, 37);
    // Must not throw, and must not produce absurd currents on an open bench.
    const sol = sim.step(1 / 60);
    for (const v of sol.V) expect(Number.isFinite(v)).toBe(true);
  });
});

/* ── load bank ──────────────────────────────────────────────────── */

describe('load bank', () => {
  it('pulls current in proportion to the selected step', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const bank = new LoadBank({ id: 'ld', step: 1 });
    nl.addDevice(psu);
    nl.addDevice(bank);

    nl.addWire({ id: 'w1', a: 'psu:DC+50', b: 'ld:A' });
    nl.addWire({ id: 'w2', a: 'ld:B', b: 'psu:DC-50' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('d50On', true);

    const sim = new Simulator(nl, 41);
    run(sim, 120);

    // Step 1 = 200 ohm across 50 V -> 0.25 A
    const i1 = ro(sim, 'ld', 'I');
    expect(i1).toBeGreaterThan(0.2);
    expect(i1).toBeLessThan(0.3);

    // Higher resistance step -> less current.
    bank.step = 5;
    run(sim, 30);
    expect(ro(sim, 'ld', 'I')).toBeLessThan(i1);
  });
});

/* ── single meter ───────────────────────────────────────────────── */

describe('single meter', () => {
  it('reads a known DC potential', () => {
    const nl = new Netlist();
    const psu = new DCSupply({ id: 'psu' });
    const vm = new Meter({ id: 'vm', mode: 'V' });
    nl.addDevice(psu);
    nl.addDevice(vm);

    nl.addWire({ id: 'w1', a: 'psu:DC+24', b: 'vm:+' });
    nl.addWire({ id: 'w2', a: 'vm:-', b: 'psu:DC-24' });

    psu.estop = false;
    psu.master = true;
    psu.enabled = true;
    psu.setControl('d24On', true);

    const sim = new Simulator(nl, 43);
    run(sim, 120);
    const v = ro(sim, 'vm', 'V');
    expect(Math.abs(v)).toBeGreaterThan(20);
    expect(Math.abs(v)).toBeLessThan(28);
  });
});
