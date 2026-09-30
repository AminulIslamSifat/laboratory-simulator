/**
 * Rheostat - a variable resistance across the bench.
 *
 * The sprite paints two jacks on unit A: A_TOP (the wiper output) and A_BOT
 * (the base terminal). Read those names, not a legacy '1'/'2' - the terminal
 * override replaces `terminals` with the sprite's term list, so '1'/'2' never
 * exist and `stamp()` would silently bail.
 */

import { Thermal } from '../../engine/thermal.js';
import type { Device, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, stampConductance } from '../_shared/model-util.js';

/* ── Rheostat ───────────────────────────────────────────────────── */

export interface RheostatOptions {
  id?: string;
  label?: string;
  terminals?: Record<string, number>;
  Rmax?: number;
  posA?: number;
  posB?: number;
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
  Rmax: number;

  // Wiper positions for the two independent elements, 0..1.
  posA: number;
  posB: number;

  // Measured current through each element (for readouts / thermal).
  IA = 0;
  IB = 0;

  readonly thermalA = new Thermal({ C: 300, Rth: 3, Tmax: 200, Tburn: 350 });
  readonly thermalB = new Thermal({ C: 300, Rth: 3, Tmax: 200, Tburn: 350 });

  constructor(opts: RheostatOptions = {}) {
    this.id = opts.id ?? uid('rh');
    this.label = opts.label ?? 'Rheostat';
    this.terminals = opts.terminals ?? { A_TOP: 1, A_BOT: 1, B_TOP: 1, B_YEL: 1, B_RED: 1 };
    this.Rmax = opts.Rmax ?? 500;
    this.posA = opts.posA ?? 0.5;
    this.posB = opts.posB ?? 0.5;
  }

  /** Unit A element resistance (grey unit). */
  get RA(): number {
    return this.Rmax * this.posA + 0.05;
  }

  /** Unit B element resistance (green unit). */
  get RB(): number {
    return this.Rmax * this.posB + 0.05;
  }

  /**
   * Front-panel dials. `posA` drives the grey unit's wiper, `posB` the green
   * unit's. Each is 0..1 and maps linearly to R = 500 * pos for that element.
   */
  setControl(id: string, value: number | string | boolean): void {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return;
    const v = Math.max(0, Math.min(1, n));
    if (id === 'posA') this.posA = v;
    else if (id === 'posB') this.posB = v;
  }

  /** Wiper positions, so a saved bench reloads with the dials where they were. */
  getState(): Record<string, unknown> {
    return { posA: this.posA, posB: this.posB };
  }

  setState(state: Record<string, unknown>): void {
    const num = (v: unknown): number | null => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
    };
    const a = num(state.posA);
    const b = num(state.posB);
    if (a !== null) this.posA = a;
    if (b !== null) this.posB = b;
  }

  stamp(mna: Mna, netOf: NetOf): void {
    // Two independent elements. A_BOT and B_RED are the base terminals;
    // B_YEL carries no element (spare post on the green unit).
    stampConductance(mna, netOf(this.id, 'A_TOP'), netOf(this.id, 'A_BOT'), 1 / this.RA);
    stampConductance(mna, netOf(this.id, 'B_TOP'), netOf(this.id, 'B_RED'), 1 / this.RB);
  }

  update(dt: number, _sol: Solution): void {
    const vA = netDiff(_sol, this.id, 'A_TOP', 'A_BOT');
    const aA = _sol.netOf(this.id, 'A_TOP');
    const bA = _sol.netOf(this.id, 'A_BOT');
    this.IA = aA !== undefined && bA !== undefined ? Math.abs(vA) / this.RA : 0;
    this.thermalA.step(dt, this.IA * this.IA * this.RA);

    const vB = netDiff(_sol, this.id, 'B_TOP', 'B_RED');
    const aB = _sol.netOf(this.id, 'B_TOP');
    const bB = _sol.netOf(this.id, 'B_RED');
    this.IB = aB !== undefined && bB !== undefined ? Math.abs(vB) / this.RB : 0;
    this.thermalB.step(dt, this.IB * this.IB * this.RB);
  }

  readouts(): Readout[] {
    return [
      // RA / RB are what the two monitors show. R stays as the SERIES SUM of
      // the two elements for any consumer that wants a single figure.
      { name: 'RA', value: this.RA, unit: 'ohm' },
      { name: 'RB', value: this.RB, unit: 'ohm' },
      { name: 'R', value: this.RA + this.RB, unit: 'ohm' },
      { name: 'IA', value: this.IA, unit: 'A' },
      { name: 'IB', value: this.IB, unit: 'A' },
      { name: 'TA', value: this.thermalA.T, unit: 'C', warn: this.thermalA.T > 150 },
      { name: 'TB', value: this.thermalB.T, unit: 'C', warn: this.thermalB.T > 150 }
    ];
  }
}

