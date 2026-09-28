/**
 * DC Machine M1-2/EV.
 *
 * Separately-excited DC machine with an interchangeable series field, usable
 * as either a motor or a generator. The panel paints PE A2 D3 D1 A1 D2 F1 F2.
 */

import { Thermal } from '../../engine/thermal.js';
import type { Machine, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, netVoltage, stampConductance, stampNorton } from '../_shared/model-util.js';
import { terminalsOf } from '../_shared/types.js';
import { dcMachine } from './layout.js';

export const TWO_PI = Math.PI * 2;

export function rpmOf(omega: number): number {
  return (omega * 60) / TWO_PI;
}

export function radOf(rpm: number): number {
  return (rpm * TWO_PI) / 60;
}

export interface DCMachineOptions {
  id?: string;
  label?: string;
  Ra?: number;
  Rf?: number;
  Rs?: number;
  Ke?: number;
  Kt?: number;
  J?: number;
  B?: number;
  Isat?: number;
  Vrated?: number;
  Irated?: number;
  Nrated?: number;
  primeRpm?: number;
}

export class DCMachine implements Machine {
  readonly id: string;
  readonly type = 'dc_machine';
  readonly label: string;

  // An earlier build declared D3 but stamped and read a terminal named 'D2',
  // so the series field (nameplate: D1-D2) stamped a net that did not exist
  // while the real D2 jack stayed dead. Both are declared and both are used.
  // PE is the protective-earth jack the sprite paints in yellow. It carries
  // no current in this simulator — there is no global earth net to bond it
  // to — but it MUST be declared. The netlist only unions terminals a device
  // declares, so an undeclared jack silently swallows any wire landed on it:
  // `parent.has('m:PE')` is false, the union is skipped, and the student's
  // wire vanishes with no error. Declaring it keeps the wire visible and
  // gives update() a valid net to read 0 V from.
  // Read from the panel layout, not declared a second time. The model and
  // the sprite are the same device; keeping two terminal lists in sync by
  // hand is what produced the PE bug — a jack was drawn that no model had
  // heard of, the netlist dropped the wire silently, and the bench sat dead.
  readonly terminals = terminalsOf(dcMachine.layout);

  Ra: number;

  /**
   * Field resistance. The Exp 04 reference records the no-load field current
   * as 0.088 A at 220 V, i.e. a 2500 ohm field circuit. A 250 ohm field drew
   * 0.88 A - ten times rated - and put the machine's whole calibration out.
   */
  Rf: number;
  Rs: number;

  /** EMF constant. Sized so Ke * phi(0.088 A) lands near 0.70. */
  Ke: number;
  Kt: number;
  J: number;
  B: number;
  /** Knee of the magnetisation curve, sized to the rated field current. */
  Isat: number;
  Vrated: number;
  Irated: number;
  Nrated: number;

  omega = 0;
  phi = 0.05;
  phiResidual = 0.05;
  If = 0;
  Is = 0;
  Ia = 0;
  /** Torque applied by an external prime mover, N m. */
  Tprime = 0;
  primeRpm: number;
  E = 0;
  Te = 0;
  vA1 = 0;
  vA2 = 0;
  _coupled = false;

  readonly thermal = new Thermal({ C: 1200, Rth: 1.2, Tmax: 130, Tburn: 250 });
  readonly fieldThermal = new Thermal({ C: 400, Rth: 2, Tmax: 130, Tburn: 250 });

  constructor(opts: DCMachineOptions = {}) {
    this.id = opts.id ?? uid('m');
    this.label = opts.label ?? 'DC Machine M1-2/EV';
    this.Ra = opts.Ra ?? 2.5;
    this.Rf = opts.Rf ?? 2500;
    this.Rs = opts.Rs ?? 1.0;
    this.Ke = opts.Ke ?? 0.95;
    this.Kt = opts.Kt ?? 0.95;
    this.J = opts.J ?? 0.03;
    this.B = opts.B ?? 0.0005;
    this.Isat = opts.Isat ?? 0.1;
    this.Vrated = opts.Vrated ?? 220;
    this.Irated = opts.Irated ?? 1.4;
    this.Nrated = opts.Nrated ?? 3000;
    this.primeRpm = opts.primeRpm ?? 0;
  }

  stamp(mna: Mna, netOf: NetOf): void {
    if (this.thermal.dead) return;

    const A1 = netOf(this.id, 'A1');
    const A2 = netOf(this.id, 'A2');

    if (A1 !== undefined && A2 !== undefined) {
      // Armature: EMF in series with Ra plus a brush-drop allowance.
      const E = this.Ke * this.phi * this.omega;
      stampNorton(mna, A1, A2, 1 / (this.Ra + 0.1), E);
    }

    stampConductance(mna, netOf(this.id, 'F1'), netOf(this.id, 'F2'), 1 / this.Rf);
    stampConductance(mna, netOf(this.id, 'D1'), netOf(this.id, 'D3'), 1 / this.Rs);
  }

  update(dt: number, sol: Solution): void {
    if (this.thermal.dead) {
      this.Ia = 0;
      this.If = 0;
      this.Is = 0;
      this.omega = 0;
      return;
    }

    this.vA1 = netVoltage(sol, this.id, 'A1');
    this.vA2 = netVoltage(sol, this.id, 'A2');
    this.If = netDiff(sol, this.id, 'F1', 'F2') / this.Rf;
    this.Is = netDiff(sol, this.id, 'D1', 'D3') / this.Rs;

    const E = this.Ke * this.phi * this.omega;
    this.E = E;
    this.Ia = (this.vA1 - this.vA2 - E) / (this.Ra + 0.1);

    // Magnetisation curve. The series field contributes at reduced weight
    // because it is wound to buck or boost, not to carry the main flux alone.
    const Ieff = this.If + this.Is * 0.4;
    const targetPhi =
      this.phiResidual + (1 - this.phiResidual) * Math.tanh(Ieff / this.Isat);
    this.phi += (targetPhi - this.phi) * Math.min(1, dt / 0.05);
    if (!Number.isFinite(this.phi)) this.phi = this.phiResidual;

    this.Te = this.Kt * this.phi * this.Ia;

    if (this.primeRpm > 0) {
      const wTarget = radOf(this.primeRpm);
      this.omega += (wTarget - this.omega) * Math.min(1, dt / 0.15);
    } else if (!this._coupled) {
      const friction = 0.002 * Math.sign(this.omega) + this.B * this.omega;
      this.omega += ((this.Te + this.Tprime - friction) / this.J) * dt;
      if (this.omega < 0) this.omega = 0;
    }
    if (!Number.isFinite(this.omega)) this.omega = 0;

    const rpm = rpmOf(this.omega);
    if (rpm > this.Nrated * 1.5) {
      this.thermal.damage += dt * (rpm - this.Nrated * 1.5) * 0.00005;
    }

    this.thermal.step(
      dt,
      this.Ia * this.Ia * this.Ra +
        this.Is * this.Is * this.Rs +
        0.3 * this.phi * this.phi * Math.min(1, Math.abs(this.omega) / 100) +
        Math.abs(this.omega) * 0.005
    );
    this.fieldThermal.step(dt, this.If * this.If * this.Rf);

    if (Math.abs(this.Ia) > this.Irated * 3) {
      this.thermal.damage += dt * (Math.abs(this.Ia) - this.Irated * 3) * 0.0015;
    }
    if (Math.abs(this.If) > 0.6) {
      this.fieldThermal.damage += dt * (Math.abs(this.If) - 0.6) * 0.008;
    }
  }

  readouts(): Readout[] {
    return [
      { name: 'N', value: rpmOf(this.omega), unit: 'rpm' },
      { name: 'Ia', value: Math.abs(this.Ia), unit: 'A', warn: Math.abs(this.Ia) > this.Irated * 1.3 },
      { name: 'If', value: this.If, unit: 'A' },
      { name: 'E', value: this.E, unit: 'V' },
      { name: 'Vt', value: this.vA1 - this.vA2, unit: 'V' },
      { name: 'T', value: this.Te || 0, unit: 'N m' },
      { name: 'Tw', value: this.thermal.T, unit: 'C', warn: this.thermal.T > this.thermal.Tmax },
      { name: 'st', value: this.thermal.dead ? 'DEAD' : this.thermal.T > 100 ? 'HOT' : 'OK', unit: '' }
    ];
  }
}
