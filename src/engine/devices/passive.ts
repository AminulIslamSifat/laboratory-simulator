/**
 * Passive bench equipment: rheostat, load bank, shaft coupling, single meter.
 *
 * None of these produce an EMF; they are conductance, inertia, or observation.
 */

import { Thermal } from '../thermal.js';
import type { Device, Machine, Mna, NetOf, Readout, Solution } from '../types.js';
import { uid } from '../uid.js';
import { netDiff, stampConductance } from './util.js';

/* ── Rheostat ───────────────────────────────────────────────────── */

export interface RheostatOptions {
  id?: string;
  label?: string;
  terminals?: Record<string, number>;
  tA?: string;
  tB?: string;
  Rmax?: number;
  pos?: number;
}

export class Rheostat implements Device {
  readonly id: string;
  readonly type = 'rheostat';
  readonly label: string;

  // The sprite paints two jacks on unit A: A_TOP (the wiper output) and
  // A_BOT (the base terminal). Read those names, not legacy '1'/'2' - the
  // terminal override replaces `terminals` with the sprite's term list, so
  // '1'/'2' never exist and stamp() would silently bail.
  terminals: Record<string, number>;
  tA: string;
  tB: string;
  Rmax: number;
  pos: number;
  I = 0;

  readonly thermal = new Thermal({ C: 300, Rth: 3, Tmax: 200, Tburn: 350 });

  constructor(opts: RheostatOptions = {}) {
    this.id = opts.id ?? uid('rh');
    this.label = opts.label ?? 'Rheostat';
    this.terminals = opts.terminals ?? { A_TOP: 1, A_BOT: 1, B_TOP: 1, B_YEL: 1, B_RED: 1 };
    this.tA = opts.tA ?? 'A_TOP';
    this.tB = opts.tB ?? 'A_BOT';
    this.Rmax = opts.Rmax ?? 500;
    this.pos = opts.pos ?? 0.5;
  }

  get R(): number {
    return this.Rmax * this.pos + 0.05;
  }

  stamp(mna: Mna, netOf: NetOf): void {
    stampConductance(mna, netOf(this.id, this.tA), netOf(this.id, this.tB), 1 / this.R);
  }

  update(dt: number, _sol: Solution): void {
    const v = netDiff(_sol, this.id, this.tA, this.tB);
    const a = _sol.netOf(this.id, this.tA);
    const b = _sol.netOf(this.id, this.tB);
    this.I = a !== undefined && b !== undefined ? Math.abs(v) / this.R : 0;
    this.thermal.step(dt, this.I * this.I * this.R);
  }

  readouts(): Readout[] {
    return [
      { name: 'R', value: this.R, unit: 'ohm' },
      { name: 'I', value: this.I, unit: 'A' },
      { name: 'T', value: this.thermal.T, unit: 'C', warn: this.thermal.T > 150 }
    ];
  }
}

/* ── Load bank ──────────────────────────────────────────────────── */

export interface LoadBankOptions {
  id?: string;
  label?: string;
  Rsteps?: number[];
  step?: number;
}

export class LoadBank implements Device {
  readonly id: string;
  readonly type = 'load_bank';
  readonly label: string;
  readonly terminals = { A: 1, B: 1 };

  Rsteps: number[];
  step: number;
  I = 0;

  readonly thermal = new Thermal({ C: 500, Rth: 4, Tmax: 250, Tburn: 400 });

  constructor(opts: LoadBankOptions = {}) {
    this.id = opts.id ?? uid('ld');
    this.label = opts.label ?? 'Load Bank';
    this.Rsteps = opts.Rsteps ?? [200, 300, 400, 600, 1200];
    this.step = opts.step ?? 1;
  }

  get R(): number {
    return this.step === 0 ? Infinity : (this.Rsteps[this.step - 1] ?? Infinity);
  }

  stamp(mna: Mna, netOf: NetOf): void {
    if (this.step === 0) return;
    stampConductance(mna, netOf(this.id, 'A'), netOf(this.id, 'B'), 1 / this.R);
  }

  update(dt: number, sol: Solution): void {
    this.I = this.step > 0 ? netDiff(sol, this.id, 'A', 'B') / this.R : 0;
    if (this.step > 0 && Number.isFinite(this.R)) {
      this.thermal.step(dt, this.I * this.I * this.R);
    }
  }

  readouts(): Readout[] {
    return [
      { name: 'R', value: this.R, unit: 'ohm' },
      { name: 'I', value: this.I, unit: 'A' },
      { name: 'T', value: this.thermal.T, unit: 'C', warn: this.thermal.T > 200 }
    ];
  }
}

/* ── Shaft coupling ─────────────────────────────────────────────── */

/**
 * A rigid mechanical link between two machines.
 *
 * Purely mechanical: no electrical stamp, and the ports never appear in the
 * MNA matrix. `_mechA` / `_mechB` name the two machines, resolved by the
 * wiring layer when a shaft port is connected. The simulator's mechanical
 * pass then forces the pair to a shared angular velocity.
 *
 * This is what turns a motor-driven generator from a scripted `primeRpm` into
 * an actual coupled pair.
 */
export class Coupling implements Machine {
  readonly id: string;
  readonly type = 'coupling';
  readonly label: string;
  readonly terminals: Record<string, number> = {};

  /** Mechanical port names, painted on the sprite. */
  readonly mechA: string;
  readonly mechB: string;

  /** Loss coefficient for the speed-mismatch torque. */
  joint: number;
  /** Torque at which the coupling slips rather than locking. */
  Tmax: number;
  slipped = false;
  T = 0;

  // A coupling has no rotor, but the mechanical pass requires the Machine
  // shape. Zero inertia means it never dominates a shared speed.
  readonly J = 0;
  omega = 0;
  primeRpm = 0;
  _coupled = false;

  /** Ids of the machines on each port, set by the wiring layer. */
  _mechA: string | null = null;
  _mechB: string | null = null;

  constructor(opts: { id?: string; label?: string; mechA?: string; mechB?: string; joint?: number; Tmax?: number } = {}) {
    this.id = opts.id ?? uid('cp');
    this.label = opts.label ?? 'Shaft Coupling';
    this.mechA = opts.mechA ?? 'MA';
    this.mechB = opts.mechB ?? 'MB';
    this.joint = opts.joint ?? 0.0002;
    this.Tmax = opts.Tmax ?? 40;
  }

  update(dt: number, _sol: Solution): void {
    // The velocity equalisation runs in the solver's mechanical pass, not
    // here, because it needs both coupled machines in hand. This only decays
    // the reported coupling torque.
    this.T *= Math.max(0, 1 - dt * 4);
  }

  readouts(): Readout[] {
    return [
      { name: 'T', value: Math.abs(this.T), unit: 'N m', warn: this.slipped },
      { name: 'st', value: this.slipped ? 'SLIP' : 'LOCK', unit: '', warn: this.slipped }
    ];
  }
}

/* ── Single meter ───────────────────────────────────────────────── */

export interface MeterOptions {
  id?: string;
  mode?: 'V' | 'A';
  label?: string;
  Range?: number;
  noise?: number;
}

export class Meter implements Device {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  terminals: Record<string, number>;
  mode: 'V' | 'A';
  Range: number;
  reading = 0;
  overload = false;
  noise: number;
  shunt = 0.01;

  constructor(opts: MeterOptions = {}) {
    this.id = opts.id ?? uid('met');
    this.mode = opts.mode ?? 'V';
    this.type = this.mode === 'A' ? 'ammeter' : 'voltmeter';
    this.label = opts.label ?? (this.mode === 'V' ? 'Voltmeter' : 'Ammeter');
    this.terminals = this.mode === 'V' ? { '+': 1, '-': 1 } : { in: 1, out: 1 };
    this.Range = opts.Range ?? (this.mode === 'V' ? 300 : 10);
    this.noise = opts.noise ?? 0.004;
  }

  private get posTerm(): string {
    return this.mode === 'V' ? '+' : 'in';
  }

  private get negTerm(): string {
    return this.mode === 'V' ? '-' : 'out';
  }

  stamp(mna: Mna, netOf: NetOf): void {
    const R = this.mode === 'V' ? 1e6 : this.shunt;
    stampConductance(mna, netOf(this.id, this.posTerm), netOf(this.id, this.negTerm), 1 / R);
  }

  update(_dt: number, sol: Solution): void {
    const a = sol.netOf(this.id, this.posTerm);
    const b = sol.netOf(this.id, this.negTerm);
    if (a === undefined || b === undefined) {
      this.reading = 0;
      return;
    }
    const raw = (sol.V[a] ?? 0) - (sol.V[b] ?? 0);
    const trueVal = this.mode === 'V' ? raw : raw / this.shunt;
    this.reading = trueVal + sol.rng.gauss() * Math.abs(trueVal) * this.noise;
    this.overload = Math.abs(this.reading) > this.Range * 1.2;
  }

  readouts(): Readout[] {
    return [
      {
        name: this.mode,
        value: this.reading,
        unit: this.mode === 'V' ? 'V' : 'A',
        warn: this.overload
      }
    ];
  }
}
