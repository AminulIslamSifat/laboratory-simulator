/**
 * M-4/EV · Three-phase asynchronous motor.
 *
 * Terminals: W2 U2 W1 (phase starts) · B1 B2 C2 (phase ends)
 *            A2 A3 D1 (star/delta taps)
 */

import { Thermal } from '../../engine/thermal.js';
import type { Machine, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, stampConductance, stampNorton } from '../_shared/model-util.js';
import { radOf, rpmOf } from '../dc-machine/model.js';
import { terminalsOf } from '../_shared/types.js';
import { motor3p } from './layout.js';

export interface Motor3POptions {
  id?: string;
  label?: string;
  Rw?: number;
  Rt?: number;
  p?: number;
  f?: number;
  Vrated?: number;
  Irated?: number;
  Nrated?: number;
  J?: number;
}

export class Motor3P implements Machine {
  readonly id: string;
  readonly type = 'motor_3p';
  readonly label: string;
  readonly terminals = terminalsOf(motor3p.layout);

  /**
   * Per-phase winding resistance.
   *
   * A 400 V / 1.5 A star-connected motor presents about 326 V / 1.5 A, i.e.
   * 217 ohm per phase at the snapshot above, so 150 ohm lands the modelled
   * line current near rated without pretending to model leakage reactance.
   */
  Rw: number;
  Rt: number;
  p: number;
  f: number;
  Vrated: number;
  Irated: number;
  Nrated: number;
  J: number;

  omega = 0;
  slip = 1;
  Iphase: [number, number, number] = [0, 0, 0];
  Iline = 0;
  Te = 0;
  primeRpm = 0;
  _coupled = false;

  readonly thermal = new Thermal({ C: 1500, Rth: 1.6, Tmax: 130, Tburn: 250 });

  /** Stator windings, as start to end terminal pairs. */
  readonly windings: Array<[string, string]> = [
    ['W2', 'B1'],
    ['U2', 'C2'],
    ['W1', 'B2']
  ];

  constructor(opts: Motor3POptions = {}) {
    this.id = opts.id ?? uid('m3');
    this.label = opts.label ?? '3-phase Async Motor M-4/EV';
    this.Rw = opts.Rw ?? 150;
    this.Rt = opts.Rt ?? 0.8;
    this.p = opts.p ?? 2;
    this.f = opts.f ?? 50;
    this.Vrated = opts.Vrated ?? 400;
    this.Irated = opts.Irated ?? 1.5;
    this.Nrated = opts.Nrated ?? 2850;
    this.J = opts.J ?? 0.02;
  }

  /** Synchronous speed, rpm. */
  get Nsync(): number {
    return (120 * this.f) / this.p;
  }

  /** Rotor speed, so a reloaded bench does not restart from standstill. */
  getState(): Record<string, unknown> {
    return { omega: this.omega };
  }

  setState(state: Record<string, unknown>): void {
    const n = typeof state.omega === 'number' ? state.omega : Number(state.omega);
    if (Number.isFinite(n)) this.omega = n;
  }

  stamp(mna: Mna, netOf: NetOf): void {
    if (this.thermal.dead) return;

    for (const [a, b] of this.windings) {
      // Rotor EMF referred to the stator, proportional to slip and speed.
      const E = 0.5 * this.slip * this.omega;
      stampNorton(mna, netOf(this.id, a), netOf(this.id, b), 1 / this.Rw, E, -1);
    }

    const taps: Array<[string, string]> = [
      ['A2', 'A3'],
      ['A3', 'D1']
    ];
    for (const [a, b] of taps) {
      stampConductance(mna, netOf(this.id, a), netOf(this.id, b), 1 / this.Rt);
    }
  }

  update(dt: number, sol: Solution): void {
    if (this.thermal.dead) {
      this.omega = 0;
      this.Iline = 0;
      return;
    }

    let sumI = 0;
    let energies = 0;
    for (let k = 0; k < this.windings.length; k++) {
      const [a, b] = this.windings[k];
      const i = netDiff(sol, this.id, a, b) / this.Rw;
      this.Iphase[k] = i;
      sumI += Math.abs(i);
      energies += i * i * this.Rw;
    }
    this.Iline = sumI / 3;

    if (sumI > 0.05) {
      const NsyncRad = radOf(this.Nsync);
      const slipNow = (NsyncRad - this.omega) / NsyncRad;
      this.slip = Math.max(-0.5, Math.min(1, slipNow));

      // Torque from the standard Kloss (approximate) induction-motor curve:
      //
      //     T / Tb = 2 / (s/sb + sb/s)
      //
      // Tb is the breakdown torque, reached at the breakdown slip sb (~0.2
      // for a machine this size). Torque RISES to Tb as slip falls from 1,
      // then FALLS back to zero at s = 0 - which is what makes an induction
      // motor settle at a small positive slip instead of racing to the
      // synchronous clamp.
      //
      // The old shape was `pull = I^2 * k / s`, monotonically INCREASING as s
      // fell, so it pinned itself against the 40 N m ceiling and the motor
      // crept up to 0.1% slip - 2997 rpm against a 3000 rpm field, a machine
      // that was effectively synchronous. That is not an induction motor.
      // Breakdown torque from the nameplate, not the current.
      //
      //   Trated = Prated / omega_rated = 1500 W / (2850 rpm * 2pi/60)
      //   Tb     = 2.5 * Trated   (typical breakdown ratio for a NEMA B frame)
      //
      // Sizing Tb off `Irated` was dimensionally wrong (amps are not N m) and
      // left the machine with so little torque that its own no-load friction
      // dragged it down to 0.8% slip - a motor that could barely turn itself.
      const Prated = 1500;
      const wRated = radOf(this.Nrated);
      const Trated = Prated / Math.max(1, wRated);
      const Tb = 2.5 * Trated;
      const sb = 0.2;
      const sAbs = Math.max(1e-3, Math.abs(this.slip));
      const ratio = sAbs / sb + sb / sAbs;
      const Tmag = (2 * Tb) / ratio;
      this.Te = Math.sign(this.slip || 1) * Tmag;
      if (!Number.isFinite(this.Te)) this.Te = 0;
    } else {
      this.Te = 0;
      this.slip = 1;
    }

    if (!this._coupled && this.primeRpm <= 0) {
      const friction = 0.003 * Math.sign(this.omega) + 0.0008 * this.omega;
      this.omega += ((this.Te - friction) / this.J) * dt;
      if (this.omega < 0) this.omega = 0;
    }
    if (!Number.isFinite(this.omega)) this.omega = 0;

    // An induction motor in motoring mode can never exceed synchronous speed -
    // the rotor would be generating. Clamp just under Ns.
    const NmaxRad = radOf(this.Nsync * 0.999);
    if (this.omega > NmaxRad) this.omega = NmaxRad;

    this.thermal.step(dt, energies + Math.abs(this.omega) * 0.01);
    if (this.Iline > this.Irated * 3) {
      this.thermal.damage += dt * (this.Iline - this.Irated * 3) * 0.0018;
    }
  }

  readouts(): Readout[] {
    return [
      { name: 'N', value: rpmOf(this.omega), unit: 'rpm' },
      { name: 's', value: this.slip, unit: '' },
      { name: 'I', value: this.Iline, unit: 'A', warn: this.Iline > this.Irated * 1.3 },
      { name: 'f', value: this.f, unit: 'Hz' },
      { name: 'p', value: this.p, unit: 'poles' },
      { name: 'T', value: this.Te, unit: 'N m' },
      { name: 'Tw', value: this.thermal.T, unit: 'C', warn: this.thermal.T > this.thermal.Tmax },
      { name: 'st', value: this.thermal.dead ? 'DEAD' : this.thermal.T > 100 ? 'HOT' : 'OK', unit: '' }
    ];
  }
}
