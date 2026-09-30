/**
 * Load bank - a bank of switched resistive elements.
 *
 * Two terminals, A and B. Conductance only; no EMF of its own.
 */

import { Thermal } from '../../engine/thermal.js';
import type { Device, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, stampConductance } from '../_shared/model-util.js';

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

  /** Selected step, so a saved bench reloads on the same load setting. */
  getState(): Record<string, unknown> {
    return { step: this.step };
  }

  setState(state: Record<string, unknown>): void {
    const n = typeof state.step === 'number' ? state.step : Number(state.step);
    if (Number.isFinite(n) && n >= 0 && n <= this.Rsteps.length) this.step = Math.floor(n);
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

