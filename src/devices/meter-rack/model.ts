/**
 * AZ module rack - a bank of meter DISPLAYS.
 *
 * Every display on the panel is its own channel: a + input bank and a - input
 * bank (all posts inside one bank are the same electrical node, so a wire can
 * land on whichever button is handy), plus a V / A / W mode switch.
 *
 * The rack also carries ONE shared series shunt, sensed between the row-1 N
 * post (ground) and the row-3 leftmost (R) jack - matching the real panel.
 * Watt mode multiplies a channel's own voltage by that series current - a
 * wattmeter is a voltmeter times an ammeter.
 */

import type { Device, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { stampConductance } from '../_shared/model-util.js';
import { terminalsOf } from '../_shared/types.js';
import { meterRack } from './layout.js';

interface RackChannel {
  id: string;
  label: string;
  mode: 'V' | 'A' | 'W';
  pos: string[];
  neg: string[];
  /**
   * Three-phase voltmeter display.
   *
   * Row 1 of an AZ-VIPS bay is a three-line input bank: L1 L2 L3 with the
   * neutral on the right. The panel shows all three line-to-neutral
   * voltages at once, so this channel reads EVERY pos terminal against the
   * single neg instead of picking the first one that resolves.
   */
  lines?: boolean;
  V: number;
  I: number;
  A: number;
  W: number;
  shown: number;
  over: boolean;
  /** Per-line voltages when `lines` is set - [L1, L2, L3] against N. */
  Vline?: number[];
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

  // Derived from the layout, like every other device. The channel table
  // below names the jacks each display reads; the assertion in the
  // constructor proves every one of those names is actually painted.
  terminals = terminalsOf(meterRack.layout);

  /** Terminal pairs the netlist must bond. See the constructor. */
  bonds: Array<[string, string]> = [];

  /** The rack's single ammeter movement, shared by every display.
   *  On the real panel the current sense is taken between the row-1 N
   *  post (ground) and the row-3 leftmost (R) jack. */
  seriesPos = ['N'];
  seriesNeg = ['R'];

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

    // d1/d2b are the two AZ-VIPS displays (Row 1 Bay 2 and Bay 4). They are
    // identical modules, so they get identical banks — just on different
    // jack names, because a device's terminals are one flat namespace.
    // d2 reads the DIN meter bay's top jack pair, d3 the bottom pair.
    this.channels = [
      // The AZ-VIPS bay paints A1 B1 B2 D on the top row and R D2 C below.
      // Both rows are one node per column, so D belongs with the negatives -
      // omitting it left the fourth top-row jack dead and dropped any wire
      // landed on it.
      {
        id: 'd1', label: 'AZ-VIPS', mode: 'V',
        pos: ['L1', 'L2', 'L3'], neg: ['N'], lines: true,
        V: 0, I: 0, A: 0, W: 0, shown: 0, over: false
      },
      // AZ-VIPS #2 (Row 1 Bay 4) — the mirrored twin. Same bank, same rules;
      // the 'b' suffix is only because both bays live on one device and so
      // share one terminal namespace.
      {
        id: 'd2b', label: 'AZ-VIPS 2', mode: 'V',
        pos: ['L1b', 'L2b', 'L3b'], neg: ['Nb'], lines: true,
        V: 0, I: 0, A: 0, W: 0, shown: 0, over: false
      },
      // d2 was labelled 'MINS' but wired to DIN1± — it has always read the
      // DIN meter bay, not the MINS SCOPY box. Label now matches the wire.
      {
        id: 'd2', label: 'DIN 1', mode: 'V',
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

    // Every jack a display reads must exist on the panel. The channel table
    // and the layout are both hand-maintained, and a typo in either —
    // 'DIN1-' spelled 'DIN1' — would give the netlist a name it can never
    // resolve. `netOf()` would return undefined, the reading would sit at
    // zero, and nothing would say why. Fail at construction instead.
    const missing: string[] = [];
    for (const c of this.channels) {
      for (const k of c.pos) if (!(k in this.terminals)) missing.push(k);
      for (const k of c.neg) if (!(k in this.terminals)) missing.push(k);
    }
    for (const k of this.seriesPos) if (!(k in this.terminals)) missing.push(k);
    for (const k of this.seriesNeg) if (!(k in this.terminals)) missing.push(k);
    if (missing.length > 0) {
      throw new Error(
        'MeterRack ' + this.id + ' reads jacks its panel does not draw: ' +
        missing.join(', ')
      );
    }

    // Every post in one row is the SAME node - the rows exist so a wire can
    // land on whichever post is handy and still close the loop. Declaring the
    // names is not enough; the netlist has to be told to bond them, otherwise
    // P1 and P2 become separate nets and a wire on P2 never meets P1.
    const B = this.bonds;
    const chain = (names: string[]): void => {
      for (let i = 1; i < names.length; i++) B.push([names[0], names[i]]);
    };
    for (const c of this.channels) {
      // A three-phase bank must NOT be chained: L1 L2 L3 are three separate
      // lines, and bonding them would short all three phases into one node.
      // The old pos list was redundant landings on ONE node, which is why
      // chaining was right then and is wrong now.
      if (c.lines) continue;
      chain(c.pos);
      chain(c.neg);
    }
    chain(this.seriesPos);
    chain(this.seriesNeg);

    // Every display is a SEPARATE instrument. The only bonds left are the
    // redundant landings WITHIN one display's own jack pair:
    //   AA bay : col L = + (AA+/AA+2), col R = - (AA-/AA-2)
    //   DIN bay: d2 reads DIN1+/- and d3 reads DIN2+/- - INDEPENDENT pairs.
    // The two DIN pairs used to be bonded (DIN1 is DIN2), which tied the top
    // DIN meter to the bottom one. They are separate channels, so they must
    // not share a node.
    B.push(['AA+', 'AA+2']);
    B.push(['AA-', 'AA-2']);

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

    // Every display presents a high-Z voltmeter, and an A-mode channel does
    // NOT stamp a shunt of its own - it reads the rack's shared in/out series
    // coil instead. That coil is the rack's ONE ammeter movement, stamped
    // below; a display in A mode is a readout of it, exactly like real gear.
    // (A per-channel 0.01 ohm shunt across a voltmeter pair would be 100 S
    // straight across the mains and would trip the variable-AC breaker.)
    for (const c of this.channels) {
      const resolve = (names: string[]): number | undefined => {
        for (const name of names) {
          const n = netOf(this.id, name);
          if (n === undefined || n === null) continue;
          if ((sizes.get(n) ?? 0) > 1) return n;
        }
        return undefined;
      };
      if (c.lines) {
        // Three-line display: EVERY line presents its own high-Z voltmeter
        // against the shared neutral. `resolve(c.pos)` would return only the
        // first line that happened to be wired, so L2 and L3 would read zero
        // even with a live supply on them.
        const n = resolve(c.neg);
        for (const p of c.pos) put(resolve([p]), n, 1 / 1e6);
      } else {
        put(resolve(c.pos), resolve(c.neg), 1 / 1e6);
      }
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
      if (c.lines) {
        // Each line against the shared neutral. The LCD shows all three at
        // once, so the numbers have to be computed here, not picked one-per-
        // channel by resolve().
        const nNet = resolve(c.neg);
        c.Vline = c.pos.map((p) => {
          const pNet = resolve([p]);
          const raw =
            pNet !== undefined && nNet !== undefined
              ? (sol.V[pNet] ?? 0) - (sol.V[nNet] ?? 0)
              : 0;
          return raw + sol.rng.gauss() * Math.abs(raw) * this.noise;
        });
        c.V = c.Vline[0] ?? c.V;
      }
      // The current half of every A-mode display is the rack's single series
      // coil. The bench has ONE ammeter movement (the in/out shunt); every
      // A-mode head is a readout of that movement, exactly like a real rack
      // where several meters share one shunt. A display therefore shows the
      // coil current regardless of which posts its own voltage inputs use.
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
    const out: Readout[] = [];
    for (const c of this.channels) {
      // A three-line display shows L1/L2/L3 ONLY in voltmeter mode. Pressing
      // A or W reuses the same LCD for a single reading, exactly like the
      // real AZ-VIPS: in V it is a three-phase voltmeter, in A a single
      // ammeter, in W a single wattmeter. Emitting the line values in every
      // mode was why the top display sat on voltages no matter which button
      // was pressed.
      if (c.lines && c.mode === 'V' && c.Vline) {
        // Three-phase display: one readout per line, keyed `<id>:<terminal>`
        // so the sprite's three data-live nodes each bind their own number.
        //
        // The terminal name comes from the CHANNEL (`c.pos`), NOT a hardcoded
        // ['L1','L2','L3']. The second AZ-VIPS bay is wired to `L1b/L2b/L3b`
        // and its sprite listens for exactly those names; keying the readout
        // `d2b:L1` meant `byName.get('d2b:L1b')` never matched and the whole
        // second display sat blank no matter how it was wired. d1 only worked
        // because its terminals happen to be spelled the same as the literal.
        const lines = c.pos;
        c.Vline.forEach((v, i) => {
          const ln = lines[i] ?? 'L' + (i + 1);
          out.push({ name: `${c.id}:${ln}`, label: `${c.label} ${ln}`, value: v, unit: 'V', warn: c.over });
        });
        continue;
      }
      out.push({
        name: c.id,
        label: `${c.label} · ${c.mode}`,
        value: c.shown,
        unit: c.mode === 'V' ? 'V' : c.mode === 'A' ? 'A' : 'W',
        warn: c.over
      });
    }
    out.push({ name: 'V', label: 'Rack voltage', value: this.V, unit: 'V', warn: this.vOver });
    out.push({ name: 'A', label: 'Rack current', value: this.A, unit: 'A', warn: this.aOver });
    return out;
  }
}
