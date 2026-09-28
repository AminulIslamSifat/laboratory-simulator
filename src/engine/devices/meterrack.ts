/**
 * AZ module rack - a bank of meter DISPLAYS.
 *
 * Every display on the panel is its own channel: a + input bank and a - input
 * bank (all posts inside one bank are the same electrical node, so a wire can
 * land on whichever button is handy), plus a V / A / W mode switch.
 *
 * The rack also carries ONE shared series shunt (in -> out). Watt mode
 * multiplies a channel's own voltage by that series current - a wattmeter is
 * a voltmeter times an ammeter.
 */

import type { Device, Mna, NetOf, Readout, Solution } from '../types.js';
import { uid } from '../uid.js';
import { stampConductance } from './util.js';

interface RackChannel {
  id: string;
  label: string;
  mode: 'V' | 'A' | 'W';
  pos: string[];
  neg: string[];
  V: number;
  I: number;
  A: number;
  W: number;
  shown: number;
  over: boolean;
}

export interface MeterRackOptions {
  id?: string;
  label?: string;
  VRange?: number;
  ARange?: number;
  WRange?: number;
  noise?: number;
}

export class MeterRack implements Device {
  readonly id: string;
  readonly type = 'meter_rack';
  readonly label: string;

  readonly channels: RackChannel[];

  terminals: Record<string, number> = {};
  /** Terminal pairs the netlist must bond. See the constructor. */
  bonds: Array<[string, string]> = [];

  /** The rack's single ammeter movement, shared by every display. */
  seriesPos = ['in'];
  seriesNeg = ['out'];

  VRange: number;
  ARange: number;
  WRange: number;
  V = 0;
  A = 0;
  W = 0;
  vOver = false;
  aOver = false;
  noise: number;
  shunt = 0.01;

  constructor(opts: MeterRackOptions = {}) {
    this.id = opts.id ?? uid('rack');
    this.label = opts.label ?? 'Measurement Rack AZ-VIPS/VIDC';

    // d1/d2 read the AZ-VIPS (Row 1 Bay 2) and MINS SCOPY (Row 1 Bay 3) posts.
    // d3/d4 read the DIN meter bay's two painted jack pairs (Row 2 Bay 2):
    //   top pair -> d3   bottom pair -> d4
    // Each pair's top-left/top-right are pos and neg; the matching bottom-row
    // post of the same column is bonded to it below, so a wire on ANY post of
    // that colour closes the loop.
    this.channels = [
      // The AZ-VIPS bay paints A1 B1 B2 D on the top row and R D2 C below.
      // Both rows are one node per column, so D belongs with the negatives -
      // omitting it left the fourth top-row jack dead and dropped any wire
      // landed on it.
      {
        id: 'd1', label: 'AZ-VIPS', mode: 'V',
        pos: ['A1', 'B1', 'B2'], neg: ['R', 'D2', 'C', 'D'],
        V: 0, I: 0, A: 0, W: 0, shown: 0, over: false
      },
      {
        id: 'd2', label: 'MINS', mode: 'V',
        pos: ['DIN1+'], neg: ['DIN1-'],
        V: 0, I: 0, A: 0, W: 0, shown: 0, over: false
      },
      {
        id: 'd3', label: 'AZ-VIDC', mode: 'A',
        pos: ['DIN2+'], neg: ['DIN2-'],
        V: 0, I: 0, A: 0, W: 0, shown: 0, over: false
      },
      {
        id: 'd4', label: 'AZ-VIDC 2', mode: 'W',
        pos: ['AA+', 'AA+2'], neg: ['AA-', 'AA-2'],
        V: 0, I: 0, A: 0, W: 0, shown: 0, over: false
      }
    ];

    const T = this.terminals;
    for (const c of this.channels) {
      for (const k of c.pos) T[k] = 1;
      for (const k of c.neg) T[k] = 1;
    }
    for (const k of this.seriesPos) T[k] = 1;
    for (const k of this.seriesNeg) T[k] = 1;

    // Every post in one row is the SAME node - the rows exist so a wire can
    // land on whichever post is handy and still close the loop. Declaring the
    // names is not enough; the netlist has to be told to bond them, otherwise
    // P1 and P2 become separate nets and a wire on P2 never meets P1.
    const B = this.bonds;
    const chain = (names: string[]): void => {
      for (let i = 1; i < names.length; i++) B.push([names[0], names[i]]);
    };
    for (const c of this.channels) {
      chain(c.pos);
      chain(c.neg);
    }
    chain(this.seriesPos);
    chain(this.seriesNeg);

    // Four jacks in a 2x2 layout on both bays. The rule: the TOP and BOTTOM
    // posts of the SAME COLUMN are shorted - they are the same node, just two
    // landings so a wire reaches whichever is closer.
    //   AA bay  : col L = + (AA+/AA+2)    col R = - (AA-/AA-2)
    //   DIN bay : col L = + (DIN1+/DIN2+) col R = - (DIN1-/DIN2-)
    // d3 and d4 both tap the DIN bay, so they share these two nodes by design
    // (the panel paints ONE jack pair for BOTH DIN meters).
    B.push(['AA+', 'AA+2']);
    B.push(['AA-', 'AA-2']);
    B.push(['DIN1+', 'DIN2+']);
    B.push(['DIN1-', 'DIN2-']);

    this.VRange = opts.VRange ?? 500;
    this.ARange = opts.ARange ?? 20;
    this.WRange = opts.WRange ?? 10000;
    this.noise = opts.noise ?? 0.004;
  }

  /**
   * Count the terminals sitting on each net.
   *
   * A declared-but-unwired post still gets its own single-terminal net, so
   * "more than one terminal" is the test for whether a post is actually part
   * of the circuit.
   */
  private netSizes(sol: Solution): Map<number, number> {
    const sizes = new Map<number, number>();
    for (const n of sol.nets) sizes.set(n.id, n.terminals.length);
    return sizes;
  }

  /**
   * Net index of the first WIRED candidate name in `names`.
   *
   * A bank has several posts that are the same node; the user only has to
   * wire one of them, so skip the floating ones instead of taking names[0].
   */
  private resolve(
    sol: Solution,
    names: string[],
    sizes: Map<number, number> | null
  ): number | undefined {
    for (const name of names) {
      const n = sol.netOf(this.id, name);
      if (n === undefined || n === null) continue;
      if (!sizes || sizes.size === 0) return n;
      if ((sizes.get(n) ?? 0) > 1) return n;
    }
    return undefined;
  }

  setDisplayMode(dispId: string, mode: string): void {
    const c = this.channels.find((x) => x.id === dispId);
    if (!c) return;
    if (mode !== 'V' && mode !== 'A' && mode !== 'W') return;
    c.mode = mode;
    // Re-point the readout immediately. `update()` computes V, A and W every
    // frame, so all three are already in hand - without this the display would
    // keep the previous mode's number until the solver runs another step,
    // which never happens if the bench is stopped.
    c.shown = mode === 'V' ? c.V : mode === 'A' ? c.I : c.W;
    c.over =
      mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2
      : mode === 'A' ? Math.abs(c.I) > this.ARange * 1.2
      : Math.abs(c.W) > this.WRange * 1.2;
  }

  stamp(mna: Mna, netOf: NetOf, netlist: { computeNets(): Array<{ id: number; terminals: string[] }> }): void {
    const sizes = new Map<number, number>();
    for (const n of netlist.computeNets()) sizes.set(n.id, n.terminals.length);

    const put = (a: number | undefined, b: number | undefined, g: number): void => {
      stampConductance(mna, a, b, g);
    };

    // Every display presents a high-Z voltmeter. An A-mode channel does NOT
    // stamp a shunt of its own: the DIN bay's two columns are bonded
    // (DIN1 +/- is DIN2 +/- - the panel paints ONE jack pair for both DIN
    // meters), so a per-channel 0.01 ohm shunt would sit directly across the
    // neighbouring voltmeter's posts. That is 100 S straight across the
    // mains - it shorted the supply and tripped the variable-AC breaker on
    // three benches.
    //
    // The rack has ONE ammeter movement: the in/out series coil stamped
    // below. An A-mode display is a readout of that coil, exactly like real
    // gear.
    for (const c of this.channels) {
      const resolve = (names: string[]): number | undefined => {
        for (const name of names) {
          const n = netOf(this.id, name);
          if (n === undefined || n === null) continue;
          if ((sizes.get(n) ?? 0) > 1) return n;
        }
        return undefined;
      };
      put(resolve(c.pos), resolve(c.neg), 1 / 1e6);
    }

    // Shared series shunt.
    const sa = netOf(this.id, this.seriesPos[0]);
    const sb = netOf(this.id, this.seriesNeg[0]);
    put(sa, sb, 1 / this.shunt);
  }

  update(_dt: number, sol: Solution): void {
    const sizes = this.netSizes(sol);
    const resolve = (names: string[]): number | undefined => this.resolve(sol, names, sizes);

    // The shared series shunt IS the rack's ammeter movement. A channel in A
    // mode reads this current; a channel in W mode multiplies its own voltage
    // across the load by it - a wattmeter is a voltmeter times an ammeter.
    // (Reading raw/shunt off a channel's OWN terminals would just divide its
    // own voltage by 0.01 and report tens of kiloamps.)
    const sa = resolve(this.seriesPos);
    const sb = resolve(this.seriesNeg);
    const aTrue =
      sa !== undefined && sb !== undefined
        ? ((sol.V[sa] ?? 0) - (sol.V[sb] ?? 0)) / this.shunt
        : 0;
    this.A = aTrue + sol.rng.gauss() * Math.abs(aTrue) * this.noise;
    this.aOver = Math.abs(this.A) > this.ARange * 1.2;

    for (const c of this.channels) {
      const a = resolve(c.pos);
      const b = resolve(c.neg);
      const vTrue = a !== undefined && b !== undefined ? (sol.V[a] ?? 0) - (sol.V[b] ?? 0) : 0;
      c.V = vTrue + sol.rng.gauss() * Math.abs(vTrue) * this.noise;
      // The current half of every display is the rack's single series coil.
      c.I = this.A;
      c.A = this.A;
      c.W = c.V * this.A;
      c.shown = c.mode === 'V' ? c.V : c.mode === 'A' ? c.I : c.W;
      c.over =
        c.mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2
        : c.mode === 'A' ? Math.abs(c.I) > this.ARange * 1.2
        : Math.abs(c.W) > this.WRange * 1.2;
    }

    this.V = this.channels[0]?.V ?? 0;
    this.W = this.V * this.A;
    this.vOver = Math.abs(this.V) > this.VRange * 1.2;
  }

  readouts(): Readout[] {
    const out: Readout[] = this.channels.map((c) => ({
      name: c.id,
      label: `${c.label} · ${c.mode}`,
      value: c.shown,
      unit: c.mode === 'V' ? 'V' : c.mode === 'A' ? 'A' : 'W',
      warn: c.over
    }));
    out.push({ name: 'V', label: 'Rack voltage', value: this.V, unit: 'V', warn: this.vOver });
    out.push({ name: 'A', label: 'Rack current', value: this.A, unit: 'A', warn: this.aOver });
    return out;
  }
}
