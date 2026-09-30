/**
 * Physics realism audit — drives real benches through the real solver and
 * prints what a student would read, so numbers can be checked against a lab
 * notebook. Deliberately a vitest file (not a node script) so it runs through
 * the same TS pipeline as the app.
 *
 * Run: npx vitest run tools/audit-realism.test.ts --reporter=basic
 */

import { describe, it } from 'vitest';
import { Netlist } from '../src/engine/netlist.js';
import { Simulator } from '../src/engine/simulator.js';
import {
  DCSupply, DCMachine, Motor3P, Transformer, Rheostat,
  LoadBank, SyncGen, Coupling, Meter
} from '../src/devices/index.js';

function run(sim: Simulator, steps: number, dt = 1 / 60): void {
  for (let i = 0; i < steps; i++) sim.step(dt);
}

function ro(sim: Simulator, id: string, name: string): number {
  const hit = sim.readoutsFor(id).find((r) => r.name === name);
  return hit && typeof hit.value === 'number' ? hit.value : NaN;
}

function bench() {
  const p = new DCSupply({ id: 'psu' });
  p.estop = false;
  p.master = true;
  p.enabled = true;
  return p;
}

const n = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : 'NaN');

function show(title: string, rows: string[]): void {
  console.log('\n\u2550\u2550 ' + title + ' \u2550\u2550');
  for (const r of rows) console.log('  ' + r);
}

describe('physics realism audit', () => {
  it('1. DC motor separately excited, started through a rheostat', () => {
    const nl = new Netlist();
    const p = bench();
    const m = new DCMachine({ id: 'm' });
    const rh = new Rheostat({ id: 'rh', Rmax: 500, posA: 1, posB: 0 });
    nl.addDevice(p); nl.addDevice(m); nl.addDevice(rh);
    nl.addWire({ id: 'f1', a: 'psu:DC+24', b: 'm:F1' });
    nl.addWire({ id: 'f2', a: 'm:F2', b: 'psu:DC-24' });
    // Armature through the starting rheostat, exactly as the lab manual says.
    // Direct-on-line would be a 77 A locked-rotor inrush on 200 V - real, and
    // the breaker correctly trips on it, but no student ever does that.
    nl.addWire({ id: 'a1', a: 'psu:DC+', b: 'rh:A_TOP' });
    nl.addWire({ id: 'a2', a: 'rh:A_BOT', b: 'm:A1' });
    nl.addWire({ id: 'a3', a: 'm:A2', b: 'psu:DC-' });
    p.setControl('d24On', true);
    p.setControl('vdcOn', true);
    p.setControl('vdcV', 200);
    const sim = new Simulator(nl, 1);
    run(sim, 900);
    // Wind the starter down as the motor comes up to speed.
    rh.posA = 0.2;
    run(sim, 600);
    const Vt = ro(sim, 'm', 'Vt'), Ia = ro(sim, 'm', 'Ia'), If = ro(sim, 'm', 'If');
    const E = ro(sim, 'm', 'E'), N = ro(sim, 'm', 'N'), T = ro(sim, 'm', 'T');
    const phi = 0.05 + 0.95 * Math.tanh(If / 0.1);
    show('1. DC MOTOR', [
      `Vt=${n(Vt, 1)}V  Ia=${n(Ia)}A  If=${n(If, 4)}A`,
      `E=${n(E, 1)}V  N=${n(N, 0)}rpm  T=${n(T)}Nm`,
      `back-EMF: Vt - Ia*(Ra+brush) = ${n(Vt - Ia * 2.6, 1)}V  (should ~= E=${n(E, 1)}V)`,
      `speed from E: E/(Ke*phi) = ${n((E / (0.95 * phi)) * 60 / (2 * Math.PI), 0)}rpm  (readout N=${n(N, 0)})`,
      `Pmech=T*w=${n(T * N * 2 * Math.PI / 60, 1)}W   E*Ia=${n(E * Ia, 1)}W`
    ]);
  });

  it('2. DC motor coupled to sync generator (shaft lock)', () => {
    const nl = new Netlist();
    const p = bench();
    const m = new DCMachine({ id: 'm' });
    const g = new SyncGen({ id: 'g' });
    const c = new Coupling({ id: 'c' });
    const rh = new Rheostat({ id: 'rh', Rmax: 500, posA: 1, posB: 0 });
    nl.addDevice(p); nl.addDevice(m); nl.addDevice(g); nl.addDevice(c); nl.addDevice(rh);
    nl.addWire({ id: 'f1', a: 'psu:DC+24', b: 'm:F1' });
    nl.addWire({ id: 'f2', a: 'm:F2', b: 'psu:DC-24' });
    nl.addWire({ id: 'a1', a: 'psu:DC+', b: 'rh:A_TOP' });
    nl.addWire({ id: 'a2', a: 'rh:A_BOT', b: 'm:A1' });
    nl.addWire({ id: 'a3', a: 'm:A2', b: 'psu:DC-' });
    nl.addWire({ id: 'g1', a: 'psu:DC+24', b: 'g:F1' });
    nl.addWire({ id: 'g2', a: 'g:F2', b: 'psu:DC-24' });
    nl.addWire({ id: 's1', a: 'm:SHAFT', b: 'c:MA' });
    nl.addWire({ id: 's2', a: 'c:MB', b: 'g:SHAFT' });
    p.setControl('d24On', true);
    p.setControl('vdcOn', true);
    p.setControl('vdcV', 220);
    c._mechA = 'm'; c._mechB = 'g';
    const sim = new Simulator(nl, 2);
    run(sim, 900);
    rh.posA = 0.2;
    run(sim, 600);
    const Nm = ro(sim, 'm', 'N'), Ng = ro(sim, 'g', 'N');
    show('2. COUPLED MOTOR-GENERATOR', [
      `motor  N=${n(Nm, 0)}rpm  Ia=${n(ro(sim, 'm', 'Ia'))}A  T=${n(ro(sim, 'm', 'T'))}Nm`,
      `gen    N=${n(Ng, 0)}rpm  Ia=${n(ro(sim, 'g', 'Ia'))}A  E=${n(ro(sim, 'g', 'E'), 1)}V  If=${n(ro(sim, 'g', 'If'), 4)}A`,
      `coupling T=${n(ro(sim, 'c', 'T'))}Nm  state=${sim.readoutsFor('c').find((r) => r.name === 'st')?.value}`,
      `|N_motor - N_gen| = ${n(Math.abs(Nm - Ng), 2)}rpm  ${Math.abs(Nm - Ng) < 1 ? 'OK shafts locked' : 'BAD shafts diverged'}`,
      `primeRpm defaults: m=${(m as unknown as { primeRpm: number }).primeRpm} g=${(g as unknown as { primeRpm: number }).primeRpm} (both must be 0 - neither self-drives)`
    ]);
  });

  it('3. coupled set driving a load bank (power balance)', () => {
    const nl = new Netlist();
    const p = bench();
    const m = new DCMachine({ id: 'm' });
    const g = new SyncGen({ id: 'g' });
    const c = new Coupling({ id: 'c' });
    const ld = new LoadBank({ id: 'ld', step: 1 });
    const rh = new Rheostat({ id: 'rh', Rmax: 500, posA: 1, posB: 0 });
    nl.addDevice(p); nl.addDevice(m); nl.addDevice(g); nl.addDevice(c); nl.addDevice(ld); nl.addDevice(rh);
    nl.addWire({ id: 'f1', a: 'psu:DC+24', b: 'm:F1' });
    nl.addWire({ id: 'f2', a: 'm:F2', b: 'psu:DC-24' });
    nl.addWire({ id: 'a1', a: 'psu:DC+', b: 'rh:A_TOP' });
    nl.addWire({ id: 'a2', a: 'rh:A_BOT', b: 'm:A1' });
    nl.addWire({ id: 'a3', a: 'm:A2', b: 'psu:DC-' });
    nl.addWire({ id: 'g1', a: 'psu:DC+24', b: 'g:F1' });
    nl.addWire({ id: 'g2', a: 'g:F2', b: 'psu:DC-24' });
    nl.addWire({ id: 's1', a: 'm:SHAFT', b: 'c:MA' });
    nl.addWire({ id: 's2', a: 'c:MB', b: 'g:SHAFT' });
    nl.addWire({ id: 'l1', a: 'g:U1', b: 'ld:A' });
    nl.addWire({ id: 'l2', a: 'ld:B', b: 'g:U2' });
    p.setControl('d24On', true);
    p.setControl('vdcOn', true);
    p.setControl('vdcV', 220);
    c._mechA = 'm'; c._mechB = 'g';
    const sim = new Simulator(nl, 3);
    run(sim, 900);
    rh.posA = 0.2;
    run(sim, 600);
    const gIa = ro(sim, 'g', 'Ia'), gE = ro(sim, 'g', 'E'), ldI = ro(sim, 'ld', 'I');
    show('3. COUPLED SET + 200ohm LOAD ON ONE PHASE', [
      `gen E=${n(gE, 1)}V  Ia=${n(gIa)}A   load I=${n(ldI)}A`,
      `load power I^2*R = ${n(ldI * ldI * 200, 2)}W`,
      `motor N=${n(ro(sim, 'm', 'N'), 0)}rpm  Ia=${n(ro(sim, 'm', 'Ia'))}A  T=${n(ro(sim, 'm', 'T'))}Nm`,
      `gen   N=${n(ro(sim, 'g', 'N'), 0)}rpm`,
      `power flow: motor electrical in -> shaft -> gen electrical out. Motor Ia should RISE vs case 2.`
    ]);
  });

  it('4. transformer taps under load', () => {
    const nl = new Netlist();
    const p = bench();
    const tr = new Transformer({ id: 'tr' });
    const rh = new Rheostat({ id: 'rh', Rmax: 500, posA: 1, posB: 1 });
    nl.addDevice(p); nl.addDevice(tr); nl.addDevice(rh);
    nl.addWire({ id: 'w1', a: 'psu:DC+', b: 'tr:P230' });
    nl.addWire({ id: 'w2', a: 'tr:P0', b: 'psu:DC-' });
    nl.addWire({ id: 'w3', a: 'tr:3U2', b: 'rh:A_TOP' });
    nl.addWire({ id: 'w4', a: 'tr:3U1', b: 'rh:A_BOT' });
    p.setControl('vdcOn', true);
    p.setControl('vdcV', 230);
    const sim = new Simulator(nl, 4);
    run(sim, 400);
    const V1 = ro(sim, 'tr', 'V1');
    show('4. TRANSFORMER (500ohm on the 230V secondary group)', [
      `primary  V1=${n(V1, 1)}V  I1=${n(ro(sim, 'tr', 'I1'))}A`,
      `secondary I2=${n(ro(sim, 'tr', 'I2'))}A  P2=${n(ro(sim, 'tr', 'P2'), 1)}W`,
      `tap 3U2-3U3 open-circuit EMF at V1=${n(V1, 1)}V: ${n(115 / 230 * V1, 1)}V (nameplate 115V)`,
      `secondary load 500ohm draws ${n(230 / 500)}A at rated 230V; reads ${n(ro(sim, 'tr', 'I2'))}A`,
      `ratio V2/V1 = 1.0 for the 3U2-3U1 (230V) group; check I2*500 ~= section EMF`
    ]);
  });

  it('5. three-phase induction motor run-up and slip', () => {
    const nl = new Netlist();
    const p = bench();
    const m = new Motor3P({ id: 'm3' });
    nl.addDevice(p); nl.addDevice(m);
    nl.addWire({ id: 'w1', a: 'psu:3P-L1', b: 'm3:W2' });
    nl.addWire({ id: 'w2', a: 'm3:B1', b: 'psu:3P-PE' });
    nl.addWire({ id: 'w3', a: 'psu:3P-L2', b: 'm3:U2' });
    nl.addWire({ id: 'w4', a: 'm3:C2', b: 'psu:3P-PE' });
    nl.addWire({ id: 'w5', a: 'psu:3P-L3', b: 'm3:W1' });
    nl.addWire({ id: 'w6', a: 'm3:B2', b: 'psu:3P-PE' });
    p.setControl('f3pOn', true);
    const sim = new Simulator(nl, 5);
    run(sim, 1200);
    const N = ro(sim, 'm3', 'N'), s = ro(sim, 'm3', 's'), I = ro(sim, 'm3', 'I'), T = ro(sim, 'm3', 'T');
    show('5. 3-PHASE INDUCTION MOTOR (400V fixed rail)', [
      `N=${n(N, 0)}rpm  Ns=${(120 * 50) / 2}rpm (p=2, 50Hz)  slip=${n(s, 4)}  I=${n(I)}A  T=${n(T)}Nm`,
      `no-load slip should be small (0.2-2%); full-load slip 3-5% -> ${s >= 0 && s < 0.02 ? 'OK' : 'OFF'}`,
      `line current vs nameplate 1.5A: ${n(I)}A`
    ]);
  });

  it('6. hard short must trip the breaker', () => {
    const nl = new Netlist();
    const p = bench();
    const rh = new Rheostat({ id: 'rh', Rmax: 0.001, posA: 0, posB: 0 });
    nl.addDevice(p); nl.addDevice(rh);
    nl.addWire({ id: 'w1', a: 'psu:DC+', b: 'rh:A_TOP' });
    nl.addWire({ id: 'w2', a: 'rh:A_BOT', b: 'psu:DC-' });
    p.setControl('vdcOn', true);
    p.setControl('vdcV', 250);
    const sim = new Simulator(nl, 6);
    run(sim, 300);
    show('6. HARD SHORT (~0.1ohm across 250V rail)', [
      `rail V=${n(p.rails.vdc.V, 1)}V  I=${n(p.rails.vdc.I, 2)}A  tripped=${p.rails.vdc.tripped}`,
      `${p.rails.vdc.tripped ? 'OK breaker tripped' : 'BAD breaker never tripped'}`
    ]);
  });

  it('7. voltmeter reading the 50V tap', () => {
    const nl = new Netlist();
    const p = bench();
    const vm = new Meter({ id: 'vm', mode: 'V' });
    nl.addDevice(p); nl.addDevice(vm);
    nl.addWire({ id: 'w1', a: 'psu:DC+50', b: 'vm:+' });
    nl.addWire({ id: 'w2', a: 'vm:-', b: 'psu:DC-50' });
    p.setControl('d50On', true);
    const sim = new Simulator(nl, 7);
    run(sim, 120);
    const r = ro(sim, 'vm', 'V');
    show('7. VOLTMETER', [`reading=${n(r)}V  true=50V  ${Math.abs(r - 50) < 1 ? 'OK' : 'BAD'}`]);
  });
});
