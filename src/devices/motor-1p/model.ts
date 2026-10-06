/**
 * M-R/CV · Single-phase asynchronous motor.
 *
 * Terminals: Z1 · Z2 · C · C2 · U1 · U2 · PE
 * Main winding (U1-U2) plus an auxiliary winding (Z1-Z2) with run capacitor.
 *
 * These names MUST match the layout. They did not: the panel was renamed to
 * the real nameplate designations (Z1/Z2 aux, U1/U2 main) and the model was
 * left reading the old 'Aux2' / 'Run'. Because `terminalsOf()` builds the
 * terminal set from the layout, `netOf('Run')` and `netOf('Aux2')` returned
 * undefined forever, `stampNorton`/`stampConductance` silently no-op on an
 * undefined net, and neither winding was ever stamped into the matrix. Every
 * 1-phase bench - including the shipped Exp 05 preset - sat at 0 rpm with no
 * error shown anywhere.
 */

import { Thermal } from '../../engine/thermal.js';
import type { Machine, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, stampConductance, stampNorton } from '../_shared/model-util.js';
import { radOf, rpmOf } from '../dc-machine/model.js';
import { terminalsOf } from '../_shared/types.js';
import { motor1p } from './layout.js';

const TWO_PI = Math.PI * 2;

export interface Motor1POptions {
  id?: string;
  label?: string;
  Rmain?: number;
  Raux?: number;
  C?: number;
  p?: number;
  f?: number;
  Vrated?: number;
  Irated?: number;
  Nrated?: number;
  J?: number;
}

export class Motor1P implements Machine {
  readonly id: string;
  readonly type = 'motor_1p';
  readonly label: string;
  readonly terminals = terminalsOf(motor1p.layout);

  /**
   * Winding resistances.
   *
   * 230 V / 3.6 A rated means the two windings in parallel must present about
   * 64 ohm, so a 100 ohm run winding alongside a 180 ohm auxiliary gives
   * 64.3 ohm and 3.58 A at 230 V without the capacitor - matching the 3.5 A the
   * reference observation records for the no-capacitor case. The earlier
   * 52 / 95 ohm pair presented 33.6 ohm and drew 6.8 A, tripping the
   * variable-AC breaker at 134 V before the motor reached rated voltage.
   */
  Rmain: number;
  Raux: number;
  C: number;
  p: number;
  f: number;
  Vrated: number;
  Irated: number;
  Nrated: number;
  J: number;

  omega = 0;
  slip = 1;
  Irun = 0;
  Iaux = 0;
  Te = 0;
  primeRpm = 0;
  _coupled = false;

  readonly thermal = new Thermal({ C: 900, Rth: 2, Tmax: 130, Tburn: 250 });

  readonly mainPair: [string, string] = ['U1', 'U2'];
  readonly auxPair: [string, string] = ['Z1', 'Z2'];

  constructor(opts: Motor1POptions = {}) {
    this.id = opts.id ?? uid('m1');
    this.label = opts.label ?? '1-phase Async Motor M-R/CV';
    this.Rmain = opts.Rmain ?? 100;
    this.Raux = opts.Raux ?? 180;
    this.C = opts.C ?? 12.5e-6;
    this.p = opts.p ?? 2;
    this.f = opts.f ?? 50;
    this.Vrated = opts.Vrated ?? 230;
    this.Irated = opts.Irated ?? 3.6;
    this.Nrated = opts.Nrated ?? 2850;
    this.J = opts.J ?? 0.015;
  }

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

    const [ma, mb] = this.mainPair;
    const na = netOf(this.id, ma);
    const nb = netOf(this.id, mb);
    if (na !== undefined && nb !== undefined && na !== nb) {
      const E = 0.4 * this.slip * this.omega;
      stampNorton(mna, na, nb, 1 / this.Rmain, E, -1);
    }

    const [aa, ab] = this.auxPair;
    stampConductance(mna, netOf(this.id, aa), netOf(this.id, ab), 1 / this.Raux);

    // Run capacitor. Reactance magnitude 1/(2 pi f C) sets the auxiliary
    // current; modelled as a conductance of that magnitude.
    stampConductance(
      mna,
      netOf(this.id, 'C'),
      netOf(this.id, 'C2'),
      TWO_PI * this.f * this.C
    );
  }

  update(dt: number, sol: Solution): void {
    if (this.thermal.dead) {
      this.omega = 0;
      this.Irun = 0;
      this.Iaux = 0;
      return;
    }

    this.Irun = netDiff(sol, this.id, this.mainPair[0], this.mainPair[1]) / this.Rmain;
    this.Iaux = netDiff(sol, this.id, this.auxPair[0], this.auxPair[1]) / this.Raux;

    const Itot = Math.abs(this.Irun) + 0.5 * Math.abs(this.Iaux);

    if (Itot > 0.05) {
      const NsyncRad = radOf(this.Nsync);
      const slipNow = (NsyncRad - this.omega) / NsyncRad;
      this.slip = Math.max(-0.5, Math.min(1, slipNow));

      // Kloss curve, same shape as the 3-phase machine. A single-phase motor
      // is weaker and its breakdown slip sits a little higher, so sb = 0.25.
      // See motor-3p/model.ts for why the old `I^2/s` form was wrong.
      const sb = 0.25;
      // Breakdown torque scales with the SQUARE of the air-gap flux, and the
      // flux is set by the voltage actually standing across the main winding.
      //
      // Sizing Tb off `Irated` alone made it a constructor constant, so Te
      // depended only on slip: the machine settled at the same speed at 80 V
      // as at 230 V, and turning the variac down did nothing. Real torque is
      // T proportional to flux^2, so an 80 V supply gives (80/230)^2 = 12% of
      // the torque and a visibly larger slip.
      //
      // The flux is MEASURED, not assumed: if the main winding is floating
      // (a broken return path leaves only the voltmeter's megohm across it),
      // Vmain collapses and the machine correctly develops no torque instead
      // of spinning on a constant that does not know it is disconnected.
      const Vmain = Math.abs(netDiff(sol, this.id, this.mainPair[0], this.mainPair[1]));
      const flux = Math.min(1.2, Vmain / this.Vrated);
      const Tb = 2.0 * this.Irated * flux * flux;
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
      const friction = 0.002 * Math.sign(this.omega) + 0.0006 * this.omega;
      this.omega += ((this.Te - friction) / this.J) * dt;
      if (this.omega < 0) this.omega = 0;
    }
    if (!Number.isFinite(this.omega)) this.omega = 0;

    const NmaxRad = radOf(this.Nsync * 1.3);
    if (this.omega > NmaxRad) this.omega = NmaxRad;

    this.thermal.step(
      dt,
      this.Irun * this.Irun * this.Rmain +
        this.Iaux * this.Iaux * this.Raux +
        Math.abs(this.omega) * 0.008
    );
    if (Itot > this.Irated * 3) {
      this.thermal.damage += dt * (Itot - this.Irated * 3) * 0.0016;
    }
  }

  readouts(): Readout[] {
    return [
      { name: 'N', value: rpmOf(this.omega), unit: 'rpm' },
      { name: 's', value: this.slip, unit: '' },
      { name: 'Irun', value: Math.abs(this.Irun), unit: 'A' },
      { name: 'Iaux', value: Math.abs(this.Iaux), unit: 'A' },
      { name: 'C', value: this.C * 1e6, unit: 'uF' },
      { name: 'T', value: this.Te, unit: 'N m' },
      { name: 'Tw', value: this.thermal.T, unit: 'C', warn: this.thermal.T > this.thermal.Tmax },
      { name: 'st', value: this.thermal.dead ? 'DEAD' : this.thermal.T > 100 ? 'HOT' : 'OK', unit: '' }
    ];
  }
}
