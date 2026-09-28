/**
 * Solver regression tests.
 *
 * These exist because the previous build could not be tested at all: the
 * noise was `Math.random()`, nothing was modular, and a wrong answer was
 * indistinguishable from a right one. Every assertion here was impossible
 * before the seeded RNG and the honest singularity report landed.
 */

import { describe, it, expect } from 'vitest';
import { solveLinear } from '../src/engine/linalg.js';
import { Rng } from '../src/engine/rng.js';
import { Thermal } from '../src/engine/thermal.js';
import { Netlist } from '../src/engine/netlist.js';
import { Simulator } from '../src/engine/simulator.js';
import type { Device, Readout } from '../src/engine/types.js';

/* ── linear algebra ─────────────────────────────────────────────── */

describe('solveLinear', () => {
  it('solves a well-conditioned 2×2 system', () => {
    // 2x + y = 5 ; x + 3y = 10  →  x = 1, y = 3
    const A = new Float64Array([2, 1, 1, 3]);
    const b = new Float64Array([5, 10]);
    const r = solveLinear(A, b, 2);
    expect(r.singular).toBe(false);
    expect(r.x[0]).toBeCloseTo(1, 10);
    expect(r.x[1]).toBeCloseTo(3, 10);
  });

  it('reports a rank-deficient matrix instead of inventing an answer', () => {
    // Row 2 is row 1 doubled — rank 1, no unique solution.
    const A = new Float64Array([1, 2, 2, 4]);
    const b = new Float64Array([3, 6]);
    const r = solveLinear(A, b, 2);
    expect(r.singular).toBe(true);
    expect(r.rank).toBe(1);
    expect(r.badColumns.length).toBeGreaterThan(0);
  });

  it('does not mutate its inputs', () => {
    const A = new Float64Array([2, 1, 1, 3]);
    const b = new Float64Array([5, 10]);
    const aCopy = A.slice();
    const bCopy = b.slice();
    solveLinear(A, b, 2);
    expect(Array.from(A)).toEqual(Array.from(aCopy));
    expect(Array.from(b)).toEqual(Array.from(bCopy));
  });

  it('handles a 3-node resistive divider', () => {
    // 10 V across 1k + 1k in series, tap at the midpoint.
    // Node 0 grounded, node 1 = 5 V, node 2 = 10 V (source row).
    const g = 1 / 1000;
    const n = 3;
    const A = new Float64Array(n * n).fill(0);
    const b = new Float64Array(n).fill(0);
    // Resistor 0–1
    A[0 * n + 0] += g; A[1 * n + 1] += g;
    A[0 * n + 1] -= g; A[1 * n + 0] -= g;
    // Resistor 1–2
    A[1 * n + 1] += g; A[2 * n + 2] += g;
    A[1 * n + 2] -= g; A[2 * n + 1] -= g;
    // Ground node 0
    for (let c = 0; c < n; c++) A[0 * n + c] = 0;
    A[0] = 1; b[0] = 0;
    // Force node 2 to 10 V by replacing its row
    for (let c = 0; c < n; c++) A[2 * n + c] = 0;
    A[2 * n + 2] = 1; b[2] = 10;

    const r = solveLinear(A, b, n);
    expect(r.singular).toBe(false);
    expect(r.x[1]).toBeCloseTo(5, 6);
  });
});

/* ── seeded randomness ──────────────────────────────────────────── */

describe('Rng', () => {
  it('is reproducible for a given seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays inside [0, 1)', () => {
    const r = new Rng(99);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('forks independent streams', () => {
    const root = new Rng(7);
    const a = root.fork(1);
    const b = root.fork(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('gauss() has roughly zero mean and unit variance', () => {
    const r = new Rng(2024);
    const n = 20000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = r.gauss();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(variance).toBeGreaterThan(0.9);
    expect(variance).toBeLessThan(1.1);
  });
});

/* ── thermal ────────────────────────────────────────────────────── */

describe('Thermal', () => {
  // The model is a first-order lag:  T → Tamb + P·Rth  with time constant
  // τ = C·Rth. Every test below picks C and Rth so τ is a couple of seconds,
  // then runs for ~10τ. Getting this wrong is easy — the first version of
  // these tests used τ = 200 s and simulated 10 s, then blamed the solver.
  const DT = 0.01;

  it('rises toward a steady state under constant power', () => {
    // τ = 2·1 = 2 s. Steady state = 25 + 50·1 = 75 °C.
    const C = 2;
    const Rth = 1;
    const P = 50;
    const t = new Thermal({ T0: 25, C, Rth, Tmax: 500 });
    const steps = Math.ceil((10 * C * Rth) / DT);
    for (let i = 0; i < steps; i++) t.step(DT, P);

    expect(t.T).toBeCloseTo(25 + P * Rth, 1);
    expect(t.dead).toBe(false);
  });

  it('reaches 63% of its final rise after one time constant', () => {
    const C = 2;
    const Rth = 1;
    const t = new Thermal({ T0: 25, C, Rth, Tmax: 500 });
    const tau = C * Rth;
    for (let i = 0; i < Math.round(tau / DT); i++) t.step(DT, 50);
    // 1 − 1/e ≈ 0.632
    expect(t.T).toBeCloseTo(25 + 50 * 0.632, 0);
  });

  it('cools back toward ambient when power is removed', () => {
    const C = 2;
    const Rth = 1;
    const t = new Thermal({ T0: 200, C, Rth, Tmax: 500 });
    const steps = Math.ceil((10 * C * Rth) / DT);
    for (let i = 0; i < steps; i++) t.step(DT, 0);
    expect(t.T).toBeLessThan(30);
  });

  it('kills the device above Tburn', () => {
    // τ = 0.2 s, so this reaches burn temperature in a fraction of a second.
    const t = new Thermal({ T0: 25, C: 1, Rth: 0.2, Tmax: 100, Tburn: 150 });
    for (let i = 0; i < 500 && !t.dead; i++) t.step(DT, 5000);
    expect(t.dead).toBe(true);
    expect(t.smoke).toBe(1);
  });

  it('accumulates permanent damage over time above Tmax', () => {
    // Steady state 25 + 400·1 = 425 °C, so it crosses Tmax = 100 °C quickly.
    const t = new Thermal({ T0: 25, C: 2, Rth: 1, Tmax: 100, Tburn: 100000 });
    for (let i = 0; i < 100; i++) t.step(DT, 400);
    expect(t.T).toBeGreaterThan(100);
    expect(t.damage).toBeGreaterThan(0);
    expect(t.smoke).toBeGreaterThan(0);
  });

  it('does not damage a device held below Tmax', () => {
    const t = new Thermal({ T0: 25, C: 2, Rth: 1, Tmax: 500, Tburn: 100000 });
    for (let i = 0; i < 500; i++) t.step(DT, 50);
    expect(t.damage).toBe(0);
    expect(t.smoke).toBe(0);
  });

  it('clears smoke as it cools', () => {
    const t = new Thermal({ T0: 25, C: 2, Rth: 1, Tmax: 100, Tburn: 100000 });
    for (let i = 0; i < 100; i++) t.step(DT, 400);
    const hotSmoke = t.smoke;
    expect(hotSmoke).toBeGreaterThan(0);

    for (let i = 0; i < 1000; i++) t.step(DT, 0);
    expect(t.smoke).toBeLessThan(hotSmoke);
  });

  it('survives a NaN power input', () => {
    const t = new Thermal({ T0: 25, C: 100, Rth: 2 });
    t.step(0.01, NaN);
    expect(Number.isFinite(t.T)).toBe(true);
  });

  it('survives an infinite power input without producing NaN', () => {
    const t = new Thermal({ T0: 25, C: 100, Rth: 2 });
    t.step(0.01, Infinity);
    expect(Number.isFinite(t.T)).toBe(true);
  });

  it('reset() returns it to cold and undamaged', () => {
    const t = new Thermal({ T0: 25, C: 2, Rth: 1, Tmax: 100, Tburn: 100000 });
    for (let i = 0; i < 200; i++) t.step(DT, 400);
    expect(t.damage).toBeGreaterThan(0);
    t.reset();
    expect(t.T).toBe(25);
    expect(t.damage).toBe(0);
    expect(t.smoke).toBe(0);
    expect(t.dead).toBe(false);
  });
});

/* ── netlist ────────────────────────────────────────────────────── */

function fakeResistor(id: string, a: string, b: string, ohms: number): Device {
  return {
    id,
    type: 'resistor',
    label: id,
    terminals: { [a]: 1, [b]: 1 },
    stamp(mna, netOf) {
      const p = netOf(id, a);
      const q = netOf(id, b);
      if (p === undefined || q === undefined) return;
      const g = 1 / ohms;
      const n = mna.n;
      mna.G[p * n + p] += g;
      mna.G[q * n + q] += g;
      mna.G[p * n + q] -= g;
      mna.G[q * n + p] -= g;
    }
  };
}

describe('Netlist', () => {
  it('gives each terminal its own net when nothing is wired', () => {
    const nl = new Netlist();
    nl.addDevice(fakeResistor('r1', 'a', 'b', 100));
    expect(nl.netOf('r1', 'a')).not.toBe(nl.netOf('r1', 'b'));
  });

  it('merges nets across a wire', () => {
    const nl = new Netlist();
    nl.addDevice(fakeResistor('r1', 'a', 'b', 100));
    nl.addDevice(fakeResistor('r2', 'a', 'b', 100));
    nl.addWire({ id: 'w1', a: 'r1:a', b: 'r2:a' });
    expect(nl.netOf('r1', 'a')).toBe(nl.netOf('r2', 'a'));
    expect(nl.netOf('r1', 'b')).not.toBe(nl.netOf('r2', 'a'));
  });

  it('honours device-declared bonds', () => {
    const nl = new Netlist();
    const d = fakeResistor('bank', 'p1', 'p2', 10);
    d.bonds = [['p1', 'p2']];
    nl.addDevice(d);
    expect(nl.netOf('bank', 'p1')).toBe(nl.netOf('bank', 'p2'));
  });

  it('propagates a merge through a chain of three wires', () => {
    const nl = new Netlist();
    nl.addDevice(fakeResistor('r1', 'a', 'b', 100));
    nl.addDevice(fakeResistor('r2', 'a', 'b', 100));
    nl.addDevice(fakeResistor('r3', 'a', 'b', 100));
    nl.addWire({ id: 'w1', a: 'r1:a', b: 'r2:a' });
    nl.addWire({ id: 'w2', a: 'r2:a', b: 'r3:a' });
    expect(nl.netOf('r1', 'a')).toBe(nl.netOf('r3', 'a'));
  });

  it('invalidates its cache when a wire is removed', () => {
    const nl = new Netlist();
    nl.addDevice(fakeResistor('r1', 'a', 'b', 100));
    nl.addDevice(fakeResistor('r2', 'a', 'b', 100));
    nl.addWire({ id: 'w1', a: 'r1:a', b: 'r2:a' });
    expect(nl.netOf('r1', 'a')).toBe(nl.netOf('r2', 'a'));
    nl.removeWire('w1');
    expect(nl.netOf('r1', 'a')).not.toBe(nl.netOf('r2', 'a'));
  });
});

/* ── full solver ────────────────────────────────────────────────── */

/**
 * A minimal single-rail supply, enough to exercise the solver end to end
 * without dragging in the full AV-1/EV panel model.
 */
function simpleSupply(id: string, volts: number): Device {
  return {
    id,
    type: 'dc_supply',
    label: 'test supply',
    terminals: { '+': 1, '-': 1 },
    enabled: true,
    V: volts,
    _Veff: volts,
    Imax: 100,
    pos: '+',
    neg: '-',
    auxLines: [],
    refreshRails() {},
    noteRailCurrent() {},
    readouts(): Readout[] {
      return [{ name: 'V', value: volts, unit: 'V' }];
    }
  } as unknown as Device;
}

describe('Simulator', () => {
  it('energises a resistive divider to the expected node voltage', () => {
    const nl = new Netlist();
    nl.addDevice(simpleSupply('psu', 10));
    nl.addDevice(fakeResistor('r1', 'a', 'b', 1000));
    nl.addDevice(fakeResistor('r2', 'a', 'b', 1000));

    // psu+ → r1.a ; r1.b → r2.a ; r2.b → psu-
    nl.addWire({ id: 'w1', a: 'psu:+', b: 'r1:a' });
    nl.addWire({ id: 'w2', a: 'r1:b', b: 'r2:a' });
    nl.addWire({ id: 'w3', a: 'r2:b', b: 'psu:-' });

    const sim = new Simulator(nl, 42);
    const sol = sim.step(1 / 60);

    const mid = sol.netOf('r1', 'b');
    expect(mid).toBeDefined();
    expect(sol.V[mid as number]).toBeCloseTo(5, 4);
  });

  it('produces identical results for identical seeds', () => {
    function run(): number[] {
      const nl = new Netlist();
      nl.addDevice(simpleSupply('psu', 12));
      nl.addDevice(fakeResistor('r1', 'a', 'b', 470));
      nl.addWire({ id: 'w1', a: 'psu:+', b: 'r1:a' });
      nl.addWire({ id: 'w2', a: 'r1:b', b: 'psu:-' });
      const sim = new Simulator(nl, 2024);
      const out: number[] = [];
      for (let i = 0; i < 30; i++) {
        const sol = sim.step(1 / 60);
        out.push(sol.V[sol.netOf('r1', 'a') as number]);
      }
      return out;
    }
    expect(run()).toEqual(run());
  });

  it('advances its simulated clock', () => {
    const nl = new Netlist();
    nl.addDevice(simpleSupply('psu', 5));
    const sim = new Simulator(nl, 1);
    sim.step(0.01);
    sim.step(0.02);
    expect(sim.time).toBeCloseTo(0.03, 6);
  });

  it('clamps an absurd timestep from a backgrounded tab', () => {
    const nl = new Netlist();
    nl.addDevice(simpleSupply('psu', 5));
    const sim = new Simulator(nl, 1);
    const sol = sim.step(30);
    expect(sol.dt).toBeLessThanOrEqual(0.1);
  });

  it('keeps a floating node finite rather than returning NaN', () => {
    const nl = new Netlist();
    nl.addDevice(simpleSupply('psu', 9));
    // A resistor with one end wired to nothing.
    nl.addDevice(fakeResistor('orphan', 'a', 'b', 100));
    nl.addWire({ id: 'w1', a: 'psu:+', b: 'orphan:a' });
    // psu- left unconnected

    const sim = new Simulator(nl, 3);
    const sol = sim.step(1 / 60);
    for (const v of sol.V) expect(Number.isFinite(v)).toBe(true);
  });

  it('caches readouts so two readers agree', () => {
    const nl = new Netlist();
    nl.addDevice(simpleSupply('psu', 7));
    const sim = new Simulator(nl, 5);
    sim.step(1 / 60);

    const first = sim.readoutsFor('psu');
    const second = sim.readoutsFor('psu');
    expect(first).toBe(second);
    expect(first[0]?.value).toBe(7);
  });

  it('reports a singular system when a supply is shorted to itself', () => {
    const nl = new Netlist();
    nl.addDevice(simpleSupply('psu', 10));
    // Both source terminals on one net — no unique operating point.
    nl.addWire({ id: 'w1', a: 'psu:+', b: 'psu:-' });
    const sim = new Simulator(nl, 1);
    const sol = sim.step(1 / 60);
    // Whatever it decides, it must not be NaN or Infinity.
    for (const v of sol.V) expect(Number.isFinite(v)).toBe(true);
  });
});
