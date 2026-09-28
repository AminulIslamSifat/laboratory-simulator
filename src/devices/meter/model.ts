/**
 * Panel meter - one V / A movement.
 *
 * V mode uses the high-impedance + / - pair and parallels the load.
 * A mode uses in / out and sits in series, measuring across the shunt.
 */

import { Thermal } from '../../engine/thermal.js';
import type { Device, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, stampConductance } from '../_shared/model-util.js';
import { terminalsOf } from '../_shared/types.js';
import { meter } from './layout.js';

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
    // Every jack on the meter panel, regardless of mode. The model reads
    // whichever pair its mode needs (posTerm/negTerm below); declaring only
    // the active pair left the other pair's wires dropped silently, so a
    // voltmeter wired through in/out lost the connection with no error.
    this.terminals = terminalsOf(meter.layout);
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
