/**
 * M-13/EV · Single-phase transformer.
 *
 * Terminals: P230 PE (primary) · B1 B2 (printed link) · RA (51 ohm)
 *            2U1 2U3 2U4 2U2 3U1 3U3 3U2 (tapped secondary)
 *
 * Secondary sections, referenced to the 230 V primary:
 *   3U2-3U3 = 115 V · 3U3-3U1 = 115 V  ->  3U2-3U1 = 230 V
 *   2U1-2U3 =  53 V · 2U3-2U4 =  94 V · 2U4-2U2 = 53 V
 *                                       ->  2U1-2U2 = 200 V
 * Chain the two groups and you land on the printed 400 V range
 * (230 + 200 = 430 V nominal, about 400 V under load).
 */

import { Thermal } from '../../engine/thermal.js';
import type { Device, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { netDiff, stampConductance, stampNorton } from '../_shared/model-util.js';
import { terminalsOf } from '../_shared/types.js';
import { transformer } from './layout.js';

/** One secondary section: [terminal A, terminal B, rated volts, resistance]. */
export type Section = [string, string, number, number];

export interface TransformerOptions {
  id?: string;
  label?: string;
  Rmag?: number;
  Ra?: number;
  Rcontact?: number;
  Vrated?: number;
  Srated?: number;
  VpRef?: number;
  sections?: Section[];
}

export class Transformer implements Device {
  readonly id: string;
  readonly type = 'transformer_1p';
  readonly label: string;

  // Derived from the layout. The panel has no RA jack, so neither does the
  // model — `stamp()` guards the 51 ohm branch with a netOf() presence check
  // and simply skips it when the terminal is absent, which is correct: an
  // unreachable resistor should not appear in the matrix.
  readonly terminals = terminalsOf(transformer.layout);

  /**
   * Magnetising branch resistance.
   *
   * A plain "primary resistance" would draw full-load current even with
   * nothing on the secondary. This panel has no magnetising inductance to
   * hold the no-load current down, so the branch is sized to the real
   * no-load draw (about 0.35 A at 230 V) and the secondary load is reflected
   * back on top of it in `update()`.
   */
  Rmag: number;
  /** Reflected secondary conductance, recomputed each step. */
  Gref = 0;
  P2 = 0;
  /** The 51 ohm resistor printed on the panel, to PE. */
  Ra: number;
  Rcontact: number;
  Vrated: number;
  Srated: number;
  Irated: number;

  /**
   * This engine solves an instantaneous snapshot, and the lab's variable AC
   * line sits at 325 V - the peak of the 230 V RMS nameplate. Scaling the
   * EMFs by VpRef makes the printed tap voltages come out right when the panel
   * is fed from AC-L1, and keeps the ratio linear on any other supply.
   */
  VpRef: number;

  readonly sections: Section[];

  Vp = 0;
  Ip = 0;
  Is = 0;
  S = 0;

  /**
   * Primary voltage as it stood when the secondary EMFs were stamped.
   *
   * The stamp and the load-reflection maths MUST agree on this. The stamp
   * runs before the solve and can only use last frame's primary voltage; if
   * `update()` then derives the section EMFs from the *new* primary voltage,
   * the two disagree by exactly the amount the primary moved this frame.
   * While the variac is winding up that mismatch is large, `(E - v)/R` reads
   * it as load current, `sumP` inflates, `Gref` jumps, and the reflected load
   * trips the supply breaker on a transformer with nothing connected to its
   * secondary. Freezing the value at stamp time makes the two consistent, so
   * an open secondary correctly reflects no load.
   */
  private vpStamped = 0;

  readonly thermal = new Thermal({ C: 2400, Rth: 0.7, Tmax: 130, Tburn: 250 });

  constructor(opts: TransformerOptions = {}) {
    this.id = opts.id ?? uid('tr');
    this.label = opts.label ?? '1-phase Transformer M-13/EV';
    this.Rmag = opts.Rmag ?? 930;
    this.Ra = opts.Ra ?? 51;
    this.Rcontact = opts.Rcontact ?? 0.05;
    this.Vrated = opts.Vrated ?? 230;
    this.Srated = opts.Srated ?? 760;
    this.VpRef = opts.VpRef ?? 325;
    this.sections = opts.sections ?? [
      ['3U2', '3U3', 115, 1.1],
      ['3U3', '3U1', 115, 1.1],
      ['2U1', '2U3', 53, 0.4],
      ['2U3', '2U4', 94, 0.7],
      ['2U4', '2U2', 53, 0.4]
    ];
    this.Irated = this.Srated / this.Vrated;
  }

  stamp(mna: Mna, netOf: NetOf): void {
    if (this.thermal.dead) return;

    // Freeze the primary voltage for this frame. `update()` reads it back so
    // the EMFs it reports are the same ones this stamp actually applied.
    this.vpStamped = this.Vp;

    // Primary winding - the load the variac actually sees.
    // P0 is the return terminal; PE is the earth jack and carries no winding.
    const gp = 1 / this.Rmag + this.Gref;
    stampConductance(mna, netOf(this.id, 'P230'), netOf(this.id, 'P0'), gp);

    // Secondary sections - Norton form of EMF in series with the section R.
    // EMF tracks the primary voltage found on the previous solve, the same
    // relaxed one-step-behind coupling the machines use.
    for (const sec of this.sections) {
      const E = this.sectionEmf(sec, this.vpStamped);
      stampNorton(mna, netOf(this.id, sec[0]), netOf(this.id, sec[1]), 1 / sec[3], E);
    }

    // B - printed link across the primary circuit.
    stampConductance(mna, netOf(this.id, 'B1'), netOf(this.id, 'B2'), 1 / this.Rcontact);

    // RA - the 51 ohm resistor to PE.
    stampConductance(mna, netOf(this.id, 'RA'), netOf(this.id, 'PE'), 1 / this.Ra);
  }

  update(dt: number, sol: Solution): void {
    if (this.thermal.dead) {
      this.Vp = 0;
      this.Ip = 0;
      this.Is = 0;
      this.S = 0;
      this.Gref = 0;
      return;
    }

    this.Vp = netDiff(sol, this.id, 'P230', 'P0');
    if (!Number.isFinite(this.Vp)) this.Vp = 0;

    // EMFs are evaluated at the voltage the stamp used, not the fresh one, so
    // (E - v) measures load current rather than this frame's ramp.
    const vpForEmf = this.vpStamped;

    // A section only delivers power if at least one of its two terminals sits
    // on a net that LEAVES this device. The five sections are chained through
    // shared intermediate terminals (3U3, 2U3, 2U4), so with the secondary
    // open the string is a floating sub-network: the MNA matrix is singular
    // there, the solve leaves those nodes at 0 V, and every section then
    // reports a large (E - 0)/R current into a node that does not exist. That
    // phantom current used to feed Gref, which dragged a fake load through the
    // primary and tripped the supply breaker - an open-circuited transformer
    // appeared to draw more current than a shorted one.
    const externalNets = new Set<number>();
    for (const n of sol.nets) {
      for (const t of n.terminals) {
        if (t.split(':')[0] !== this.id) {
          externalNets.add(n.id);
          break;
        }
      }
    }

    let sumI = 0;
    let sumP = 0;
    for (const sec of this.sections) {
      const a = sol.netOf(this.id, sec[0]);
      const b = sol.netOf(this.id, sec[1]);
      if (a === undefined || b === undefined) continue;
      if (!externalNets.has(a) && !externalNets.has(b)) continue;

      const v = (sol.V[a] ?? 0) - (sol.V[b] ?? 0);
      const E = this.sectionEmf(sec, vpForEmf);
      const i2 = (E - v) / sec[3];
      if (!Number.isFinite(i2)) continue;
      sumI += Math.abs(i2);
      sumP += Math.abs(v * i2);
    }
    this.Is = sumI;
    this.P2 = sumP;

    // Reflect the secondary load into the primary, one step behind - same
    // relaxed coupling the section EMFs use, and stable at 60 fps.
    const vp2 = this.Vp * this.Vp;
    this.Gref = vp2 > 1 ? Math.min(0.4, sumP / vp2) : 0;
    this.Ip = this.Vp * (1 / this.Rmag + this.Gref);
    this.S = Math.abs(this.Vp * this.Ip);

    const Req = 1 / (1 / this.Rmag + this.Gref);
    this.thermal.step(dt, this.Ip * this.Ip * Req + sumP * 0.12 + Math.abs(this.Is) * 0.004);
    if (this.Is > this.Irated * 2) {
      this.thermal.damage += dt * (this.Is - this.Irated * 2) * 0.0012;
    }
  }

  /**
   * Open-circuit EMF of one secondary section for a given primary voltage.
   *
   * A section rated at `sec[2]` volts at `Vrated` primary volts scales
   * linearly, and the whole set is anchored to `VpRef` so the printed tap
   * voltages come out right when the panel is fed from the AC-L1 peak.
   */
  private sectionEmf(sec: Section, vp: number): number {
    return (sec[2] / this.Vrated) * vp;
  }

  readouts(): Readout[] {
    return [
      { name: 'V1', value: Math.abs(this.Vp), unit: 'V' },
      { name: 'I1', value: Math.abs(this.Ip), unit: 'A', warn: Math.abs(this.Ip) > 3.7 },
      { name: 'I2', value: this.Is, unit: 'A', warn: this.Is > this.Irated },
      { name: 'P2', value: this.P2 || 0, unit: 'W' },
      { name: 'S', value: this.S, unit: 'VA' },
      { name: 'k', value: this.VpRef ? this.Vp / this.VpRef : 0, unit: '', warn: !this.Vp },
      { name: 'Tw', value: this.thermal.T, unit: 'C', warn: this.thermal.T > this.thermal.Tmax },
      { name: 'st', value: this.thermal.dead ? 'DEAD' : this.thermal.T > 100 ? 'HOT' : 'OK', unit: '' }
    ];
  }
}