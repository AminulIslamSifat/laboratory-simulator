/**
 * GMS · Three-phase synchronous generator.
 *
 * Terminals: F1 F2 (field) · U1 U2 V1 V2 W1 W2 (armature) · G
 * The prime mover holds the rotor at Ns; field current sets the EMF.
 */

import { Thermal } from '../../engine/thermal.js';
import type { Machine, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, stampConductance, stampNorton } from '../_shared/model-util.js';
import { radOf, rpmOf } from '../dc-machine/model.js';
import { terminalsOf } from '../_shared/types.js';
import { syncGen } from './layout.js';

export interface SyncGenOptions {
  id?: string;
  label?: string;
  Rf?: number;
  Ra?: number;
  Ke?: number;
  J?: number;
  primeRpm?: number;
  f?: number;
  p?: number;
  Vrated?: number;
  Irated?: number;
  Nrated?: number;
}

export class SyncGen implements Machine {
  readonly id: string;
  readonly type = 'sync_gen';
  readonly label: string;
  readonly terminals = terminalsOf(syncGen.layout);

  Rf: number;
  Ra: number;
  Ke: number;

  /**
   * Rotor inertia, needed by the coupling pass so two shafted machines can
   * settle on one speed. A generator on the bench is a heavier body than the
   * small DC machine, hence the larger default.
   */
  J: number;
  f: number;
  p: number;
  Vrated: number;
  Irated: number;
  Nrated: number;

  If = 0;
  omega = 0;
  primeRpm: number;
  E = 0;
  Ia = 0;
  _coupled = false;

  readonly thermal = new Thermal({ C: 1200, Rth: 1.4, Tmax: 130, Tburn: 250 });
  readonly fieldThermal = new Thermal({ C: 500, Rth: 2, Tmax: 130, Tburn: 250 });

  readonly armature: Array<[string, string]> = [
    ['U1', 'U2'],
    ['V1', 'V2'],
    ['W1', 'W2']
  ];

  constructor(opts: SyncGenOptions = {}) {
    this.id = opts.id ?? uid('sg');
    this.label = opts.label ?? 'Sync Generator GMS';
    this.Rf = opts.Rf ?? 300;
    this.Ra = opts.Ra ?? 2.2;
    this.Ke = opts.Ke ?? 0.55;
    this.J = opts.J ?? 0.05;
    this.primeRpm = opts.primeRpm ?? 1500;
    this.f = opts.f ?? 50;
    this.p = opts.p ?? 2;
    this.Vrated = opts.Vrated ?? 400;
    this.Irated = opts.Irated ?? 1.3;
    this.Nrated = opts.Nrated ?? 1250;
  }

  stamp(mna: Mna, netOf: NetOf): void {
    if (this.thermal.dead) return;

    stampConductance(mna, netOf(this.id, 'F1'), netOf(this.id, 'F2'), 1 / this.Rf);

    const E = this.Ke * this.If * this.omega;
    this.E = E;
    const phase = E * 0.8;

    for (const [a, b] of this.armature) {
      stampNorton(mna, netOf(this.id, a), netOf(this.id, b), 1 / this.Ra, phase);
    }
  }

  update(dt: number, sol: Solution): void {
    if (this.thermal.dead) {
      this.omega = 0;
      this.If = 0;
      return;
    }

    this.If = netDiff(sol, this.id, 'F1', 'F2') / this.Rf;

    // A machine bolted to a coupling must NOT self-drive from primeRpm - if it
    // did, it would fight the coupling every frame and the pair would settle
    // at a tug-of-war speed. The coupling pass owns omega in that case.
    if (!this._coupled && this.primeRpm > 0) {
      const wTarget = radOf(this.primeRpm);
      this.omega += (wTarget - this.omega) * Math.min(1, dt / 0.2);
      if (!Number.isFinite(this.omega)) this.omega = 0;
    }

    let sumI = 0;
    for (const [a, b] of this.armature) {
      const v = netDiff(sol, this.id, a, b);
      const E = this.Ke * this.If * this.omega * 0.8;
      sumI += Math.abs((E - v) / this.Ra);
    }
    this.Ia = sumI / 3;

    this.thermal.step(dt, this.Ia * this.Ia * this.Ra + Math.abs(this.omega) * 0.004);
    this.fieldThermal.step(dt, this.If * this.If * this.Rf);

    if (this.Ia > this.Irated * 3) {
      this.thermal.damage += dt * (this.Ia - this.Irated * 3) * 0.0012;
    }
  }

  readouts(): Readout[] {
    return [
      { name: 'N', value: rpmOf(this.omega), unit: 'rpm' },
      { name: 'If', value: this.If, unit: 'A' },
      { name: 'Ia', value: this.Ia || 0, unit: 'A', warn: (this.Ia || 0) > this.Irated * 1.3 },
      { name: 'E', value: this.E, unit: 'V' },
      { name: 'f', value: this.f, unit: 'Hz' },
      { name: 'p', value: this.p, unit: 'poles' },
      { name: 'Tw', value: this.thermal.T, unit: 'C', warn: this.thermal.T > this.thermal.Tmax },
      { name: 'st', value: this.thermal.dead ? 'DEAD' : this.thermal.T > 100 ? 'HOT' : 'OK', unit: '' }
    ];
  }
}
