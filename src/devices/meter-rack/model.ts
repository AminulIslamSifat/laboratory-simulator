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
   * Voltage-sense jacks, when they are a SEPARATE pair from the current path.
   *
   * The panel is 4-wire: a display with two jack pairs has one pair carrying
   * the branch current (through a shunt) and a second pair tapping the
   * voltage across the load. The AA bay is wired exactly that way - AA+/AA-
   * sense the armature while AA+2/AA-2 carry the load current - so a single
   * display can report volts AND amps at once, which is what a wattmeter is.
   *
   * When omitted, the channel's `pos`/`neg` are the voltage pair AND the
   * current pair is the same posts (a 2-jack meter).
   */
  vpos?: string[];
  vneg?: string[];

  /**
   * SERIES ammeter: the `pos`/`neg` posts carry the branch current through a
   * shunt, rather than being a high-Z voltage sense. A channel with a
   * separate `vpos`/`vneg` is BOTH: current through pos/neg, voltage across
   * vpos/vneg.
   */
  series?: boolean;

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
      // Row 2 is TWO IDENTICAL meter units, one per bay. Each owns its own
      // 2x2 jack block and the face drawn immediately to the left of it:
      //
      //   top pair    ->  the original terminals
      //   bottom pair ->  the same line taken through the meter's ammeter
      //
      // so the number you are reading is always beside the jacks you are
      // moving. Before this, both faces sat in one bay while BOTH sets of
      // jacks sat in the other, and the panel gave you no way to know.
      //
      // The SHUNT sits between the two + jacks, never between a + and a -.
      // Current in on the top +, through the shunt, out on the bottom + to
      // the load; the two - jacks are one solid return node. So the CURRENT
      // pair is (+, +2) and the VOLTAGE pair is (+2, -2): amps across the
      // shunt, volts across the load, and W is their product.
      //
      // Getting this backwards - shunt between +2 and -2 - leaves the top +
      // a dead end AND drops a 0.01 ohm short straight across the load, so a
      // correctly-wired bench reads zero everywhere with no error shown.
      {
        id: 'd2', label: 'AA METER', mode: 'V',
        // Sense across the ORIGINAL pair (AA+ / AA-), not the ammeter pair.
        // Wiring only the top pair has to give a plain voltmeter reading -
        // that is the common case by far. Sensing on the bottom pair instead
        // meant an unused ammeter path left the face sitting at 0 V.
        pos: ['AA+'], neg: ['AA+2'], series: true,
        vpos: ['AA+'], vneg: ['AA-'],
        V: 0, I: 0, A: 0, W: 0, shown: 0, over: false
      },
      {
        id: 'd3', label: 'DIN METER', mode: 'V',
        pos: ['DIN1+'], neg: ['DIN2+'], series: true,
        vpos: ['DIN1+'], vneg: ['DIN1-'],
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

    // Each meter unit has ONE bond, and it is always the same one: the two
    // minus jacks are the straight return leg, so they are one node either
    // side of the unit. The two PLUS jacks are deliberately NOT bonded - that
    // pair is the ammeter's current path, and a bond across it would short
    // the shunt to nothing and read zero amps forever.
    B.push(['AA-', 'AA-2']);
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

  /**
   * Panel state: which V / A / W button each display is sitting on.
   *
   * Without this a reloaded bench came back with every display on its
   * construction default, and for a DIN bay that default is 'A' - a 0.01 ohm
   * shunt straight across whatever it is wired to. A bench reading a clean
   * voltage before the reload would trip its supply after it, with nothing on
   * the panel to explain why.
   */
  getState(): Record<string, unknown> {
    const modes: Record<string, string> = {};
    for (const c of this.channels) modes[c.id] = c.mode;
    return { modes };
  }

  setState(state: Record<string, unknown>): void {
    const modes = state.modes as Record<string, string> | undefined;
    if (!modes || typeof modes !== 'object') return;
    for (const c of this.channels) {
      const m = modes[c.id];
      if (m === 'V' || m === 'A' || m === 'W') c.mode = m;
    }
  }

  stamp(mna: Mna, netOf: NetOf, netlist: { computeNets(): Array<{ id: number; terminals: string[] }> }): void {
    const sizes = new Map<number, number>();
    for (const n of netlist.computeNets()) sizes.set(n.id, n.terminals.length);

    const put = (a: number | undefined, b: number | undefined, g: number): void => {
      stampConductance(mna, a, b, g);
    };

    // A display is ONE instrument with two personalities, and which one it
    // wears is the V / A button.
    //
    //   V (and W) - a HIGH-Z VOLTMETER. It parallels the thing it measures.
    //   A         - a SERIES AMMETER. Its + and - posts are the two ends of
    //               its shunt, and the measured current flows THROUGH it.
    //
    // Stamping a megohm for every channel regardless of mode was a real bug:
    // a student wiring a DC ammeter in series with the shunt field - F1 to
    // DIN2-, DIN2+ back through the rheostat to F2, exactly as the ammeter
    // goes in on the bench - got a 1 MOhm break in the middle of the field
    // circuit. The machine could not excite, and every reading sat at zero
    // with nothing on the panel to say why. A meter that cannot pass current
    // cannot measure it.
    //
    // EVERY display is an INDEPENDENT instrument.
    //
    // Each channel stamps its OWN shunt between its OWN two posts. Whatever
    // the student wires across those two jacks is the branch that display
    // measures, and nothing about it touches any other display. This is the
    // whole point of having four meters on the panel: four separate
    // measurements, four separate branches.
    //
    // The old model ran ONE shared N-R shunt and let every non-series
    // channel borrow its current, so three displays reported the same number
    // no matter where they were wired. A meter that reads someone else's
    // branch is not a meter.
    //
    // The shunt is tiny (0.01 ohm) so it is electrically invisible to the
    // branch it sits in, but not so tiny that the solver loses the drop in
    // its noise floor - at 1 A it is 10 mV, which resolves cleanly.
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
      } else if (c.vpos && c.vneg) {
        // TRUE 4-wire instrument (the AA wattmeter). Its current pair ALWAYS
        // carries the shunt and its sense pair is ALWAYS high-Z - that is
        // what makes it a wattmeter. The mode button only chooses which of
        // the three numbers it shows, never how it is wired.
        put(resolve(c.pos), resolve(c.neg), 1 / this.shunt);
        put(resolve(c.vpos), resolve(c.vneg), 1 / 1e6);
      } else if (c.series && c.mode === 'A') {
        // 2-jack DIN meter in AMMETER mode. The V / A / W button IS the
        // function switch: pressing A drops the shunt INTO the branch, which
        // is why an ammeter goes in series and a voltmeter does not.
        put(resolve(c.pos), resolve(c.neg), 1 / this.shunt);
      } else {
        // This display sits ACROSS its branch - a high-Z voltmeter. It still
        // reads its OWN two posts, but it must not load the branch, so no
        // shunt is stamped. (Stamping 0.01 ohm across an armature would short
        // it and kill the machine.) A current reading on an across-wired
        // display is therefore ~0, which is the truth: no current flows
        // through a voltmeter.
        put(resolve(c.pos), resolve(c.neg), 1 / 1e6);
      }
    }
  }

  update(_dt: number, sol: Solution): void {
    const sizes = this.netSizes(sol);
    const resolve = (names: string[]): number | undefined => this.resolve(sol, names, sizes);

    // EVERY channel reads its OWN branch. Its voltage is the drop across its
    // own two posts; its current is the drop across its OWN shunt sitting on
    // those same two posts, divided by the shunt resistance. Nothing is
    // borrowed from another channel, so two displays wired to two different
    // loads show two different numbers - which is the entire reason a rack
    // has more than one meter on it.
    for (const c of this.channels) {
      const a = resolve(c.pos);
      const b = resolve(c.neg);

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
        c.V = c.Vline[0] ?? 0;
        // A three-line voltmeter draws no current of its own.
        c.I = 0;
        c.A = 0;
        c.W = 0;
        c.shown = c.mode === 'V' ? c.V : c.mode === 'A' ? c.I : c.W;
        c.over = c.mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2 : false;
        continue;
      }

      // Voltage comes from the channel's OWN voltage pair when it has one
      // (4-wire display), otherwise from its current posts.
      const va = c.vpos ? resolve(c.vpos) : a;
      const vb = c.vneg ? resolve(c.vneg) : b;
      const vTrue = va !== undefined && vb !== undefined ? (sol.V[va] ?? 0) - (sol.V[vb] ?? 0) : 0;
      c.V = vTrue + sol.rng.gauss() * Math.abs(vTrue) * this.noise;

      // Current through this channel's OWN shunt, but only if it HAS one.
      // A series display carries the branch current through its posts, so the
      // drop there is I * shunt. An across display is a voltmeter with no
      // shunt - no current flows through it, and reporting one would be a
      // lie. Each display's answer depends only on its own wiring.
      const iDrop = a !== undefined && b !== undefined ? (sol.V[a] ?? 0) - (sol.V[b] ?? 0) : 0;
      // The shunt is only IN the circuit when this display is actually in
      // ammeter mode. Reading a current off a high-Z voltmeter - or off a
      // 4-wire wattmeter's SENSE pair - would divide a normal line voltage by
      // 0.01 ohm and report kiloamps that are not flowing anywhere.
      const hasShunt = (c.vpos && c.vneg) || (c.series && c.mode === 'A');
      const iOwn =
        hasShunt && a !== undefined && b !== undefined && a !== b
          ? iDrop / this.shunt
          : 0;
      c.I = iOwn + sol.rng.gauss() * Math.abs(iOwn) * this.noise;
      c.A = c.I;
      c.W = c.V * c.I;

      // The V / A / W button only chooses which of the channel's OWN three
      // numbers the LCD shows. It never changes what the channel measures or
      // how it is wired - switching modes cannot break the circuit.
      c.shown = c.mode === 'V' ? c.V : c.mode === 'A' ? c.I : c.W;
      c.over =
        c.mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2
        : c.mode === 'A' ? Math.abs(c.I) > this.ARange * 1.2
        : Math.abs(c.W) > this.WRange * 1.2;
    }

    this.V = this.channels[0]?.V ?? 0;
    this.A = this.channels[0]?.I ?? 0;
    this.W = this.V * this.A;
    this.aOver = Math.abs(this.A) > this.ARange * 1.2;
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
