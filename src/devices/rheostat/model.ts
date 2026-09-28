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

