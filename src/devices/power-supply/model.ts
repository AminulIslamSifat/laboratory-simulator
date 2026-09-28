/**
 * AV-1/EV bench power supply — five independent rails in one box.
 *
 * The panel exposes:
 *   · variable 3φ AC     AC-L1/L2/L3 / AC-N      0–440 V LL, 50/60 Hz
 *   · variable DC        DC+ / DC-               0–250 V, smoothed
 *   · fixed 3φ 400 V     3P-L1..L3 / 3P-PE       400 V LL
 *   · fixed 6/12/24 V    DC+24 / DC-24           tap selected
 *   · fixed 50 V         DC+50 / DC-50
 *
 * ─── Why the 3φ set is a snapshot, not a rotating waveform ───
 * A balanced 3φ set is sampled at ONE instant — the peak of L1, i.e.
 * (A, −A/2, −A/2). Rotating a phase clock frame to frame would not give a
 * nicer motor: the solver steps at ~16.7 ms against a 20 ms mains period, so
 * a real phase clock aliases badly. `Motor3P` consumes line current as a mean
 * of |i| across windings and squares it into torque — fed an aliased phase it
 * would thrash. The frozen operating point is what this solver can actually
 * integrate, so rails stay balanced snapshots, the VARIAC drives amplitude,
 * and `f` is a genuine parameter that propagates to connected machines
 * (Ns = 120f/p responds).
 *
 * The honest consequence: power factor, phase angle and slip-dependent rotor
 * frequency are NOT simulated. For a nameplate or no-load study that is
 * irrelevant; for a load test it matters. See the About drawer.
 *
 * ─── Why `open` matters ───
 * A rail that is switched off must be ABSENT from the MNA stamp, not present
 * at V = 0. An ideal 0 V source is a dead short across its own terminals — it
 * would clamp every net it touches to ground and silently short the bench.
 * `refreshRails()` emits `open: true` and the simulator skips it.
 */

import { Thermal } from '../../engine/thermal.js';
import type { AuxRail, Device, Mna, NetOf, Readout, Solution } from '../../engine/types.js';
import { uid } from '../../engine/uid.js';
import { terminalsOf } from '../_shared/types.js';
import { powerSupply } from './layout.js';

type RailKey = 'vdc' | 'vac' | 'f3p' | 'd24' | 'd50';

interface Rail {
  key: RailKey;
  label: string;
  /** Rail switch on the front panel. */
  on: boolean;
  /** User's demand, before soft-start and fold-back. */
  set: number;
  /** Present output. Only an ideal source can change this instantly. */
  V: number;
  Vmax: number;
  Imax: number;
  /** Instantaneous breaker threshold — a hard short. */
  trip: number;
  /** Measured current for this rail. */
  I: number;
  T: number;
  tripped: boolean;
  /** Soft-start time constant, seconds. 0 for a tapped secondary. */
  tau: number;
  /** Seconds spent at or over the current limit. */
  overT: number;
  /** Base inverse-time trip delay, seconds. */
  tripDelay: number;
  /** Mains frequency, for rails that feed a machine. */
  f?: number;
  tap?: number;
  taps?: number[];
}

interface Channel {
  id: string;
  label: string;
  mode: 'V' | 'A' | 'F';
  V: number;
  I: number;
  F: number;
  shown: number;
  over: boolean;
}

/**
 * The AV-1/EV front panel's printed jacks.
 *
 * These are baked in rather than left to the caller because the panel is
 * fixed hardware — the sprite paints exactly these names. The previous build
 * defaulted to a placeholder `{ '+', '-' }` and relied on the lab's placement
 * path to overwrite `terminals` from the sprite layout. Anything that built a
 * supply any other way — a test, a saved-bench loader, a headless run — wired
 * `DC+` against a device that had never heard of it, the netlist dropped the
 * wire silently, and the bench sat dead with no error anywhere.
 */
// The supply's jack list lives on its layout, beside the sprite that draws
// it. This re-export is kept only so callers that named it directly still
// resolve; new code should read `terminalsOf(powerSupply.layout)`.
export const SUPPLY_TERMINALS: Readonly<Record<string, number>> = terminalsOf(powerSupply.layout);

export interface DCSupplyOptions {
  id?: string;
  label?: string;
  terminals?: Record<string, number>;
  pos?: string;
  neg?: string;
  V?: number;
  Imax?: number;
}

export class DCSupply implements Device {
  readonly id: string;
  readonly type = 'dc_supply';
  readonly label: string;
  terminals: Record<string, number>;

  /** Terminals the main stamped source aims at while live. */
  private readonly _posLive: string;
  private readonly _negLive: string;
  /** Aimed at names that do not exist, so `netOf` returns undefined and the
   *  stamp is skipped entirely. That is how "off" avoids becoming a 0 V short. */
  private readonly _posOff = '__vdc_off_p';
  private readonly _negOff = '__vdc_off_n';

  pos: string;
  neg: string;
  V: number;
  _Veff: number;
  Imax: number;

  /** Master isolator closed. */
  enabled = false;
  /** Main isolator switch on the panel. */
  master = false;
  /** Latching emergency mushroom. */
  estop = false;

  I = 0;
  _vsIndex = -1;
  warn = '';
  smoke = 0;
  Vactual = 0;
  limiting = false;

  readonly thermal = new Thermal({ C: 800, Rth: 0.4, Tmax: 90, Tburn: 200 });

  readonly rails: Record<RailKey, Rail>;
  readonly railThermal: Record<RailKey, Thermal>;

  /** Rebuilt by `refreshRails()`, read by the simulator. */
  auxLines: AuxRail[] = [];

  private railIacc: Partial<Record<RailKey, number>> = {};

  readonly channels: Channel[];
  readonly VRange = 500;
  readonly IRange = 12;

  constructor(opts: DCSupplyOptions = {}) {
    this.id = opts.id ?? uid('vdc');
    this.label = opts.label ?? 'Power Supply AV-1/EV';
    this.terminals = opts.terminals ?? { ...SUPPLY_TERMINALS };

    this.pos = opts.pos ?? 'DC+';
    this.neg = opts.neg ?? 'DC-';
    this._posLive = this.pos;
    this._negLive = this.neg;

    this.V = opts.V ?? 0;
    this._Veff = this.V;
    this.Imax = opts.Imax ?? 3.5;

    this.rails = {
      vdc: { key: 'vdc', label: 'Variable DC', on: false, set: 0, V: 0, Vmax: 250, Imax: 3.5, trip: 4.2, I: 0, T: 25, tripped: false, tau: 0.25, overT: 0, tripDelay: 1.5 },
      // The variable AC line feeds the 1φ motor in Exp 05, whose reference
      // observation records 3.5 A without the starting capacitor. A 2 A rail
      // tripped before the motor reached rated voltage, so the experiment
      // could never be performed. The panel prints this output in the 3–4 A
      // class.
      vac: { key: 'vac', label: 'Variable AC 3φ', on: false, set: 0, V: 0, Vmax: 440, Imax: 4, trip: 4.5, I: 0, T: 25, tripped: false, tau: 0.35, f: 50, overT: 0, tripDelay: 1.5 },
      f3p: { key: 'f3p', label: 'Fixed 3φ 400 V', on: false, set: 400, V: 400, Vmax: 400, Imax: 10, trip: 12, I: 0, T: 25, tripped: false, tau: 0, overT: 0, tripDelay: 2.0 },
      d24: { key: 'd24', label: 'Fixed 6/12/24 V', on: false, set: 24, V: 24, Vmax: 24, Imax: 2, trip: 2.4, I: 0, T: 25, tripped: false, tau: 0, overT: 0, tripDelay: 2.0, tap: 24, taps: [6, 12, 24] },
      d50: { key: 'd50', label: 'Fixed 50 V', on: false, set: 50, V: 50, Vmax: 50, Imax: 2, trip: 2.4, I: 0, T: 25, tripped: false, tau: 0, overT: 0, tripDelay: 2.0 }
    };

    this.railThermal = {
      vdc: new Thermal({ C: 600, Rth: 0.5, Tmax: 95, Tburn: 220 }),
      vac: new Thermal({ C: 700, Rth: 0.6, Tmax: 95, Tburn: 220 }),
      f3p: new Thermal({ C: 900, Rth: 0.4, Tmax: 100, Tburn: 240 }),
      d24: new Thermal({ C: 400, Rth: 0.9, Tmax: 90, Tburn: 200 }),
      d50: new Thermal({ C: 400, Rth: 0.9, Tmax: 90, Tburn: 200 })
    };

    // Shape matches MeterRack so the shared `.mbtn` plumbing and the sprite
    // readout binder work untouched: each channel needs {id, mode} and the
    // model must expose setDisplayMode().
    this.channels = [
      { id: 'm1', label: 'VAR AC', mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false },
      { id: 'm2', label: 'VAR DC', mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false },
      { id: 'm3', label: '3φ 400', mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false },
      { id: 'm4', label: 'DC LV', mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false }
    ];

    this.refreshRails();
  }

  /**
   * Peak phase-to-neutral for a balanced set.
   *
   * A 3φ line at Vll volts has phase voltage Vll/√3 RMS, so the peak is
   * Vll/√3·√2. Sampling at the instant L1 peaks gives (A, −A/2, −A/2), which
   * sums to zero — mandatory, since the neutral reference is only meaningful
   * if the three line potentials balance.
   */
  private peak(Vll: number): number {
    return (Vll / Math.sqrt(3)) * Math.SQRT2;
  }

  /**
   * Rebuild the rail table from current switch state.
   *
   * Called by the simulator at the TOP of every solve, before stamping, so a
   * breaker that tripped last frame is already absent this frame.
   */
  refreshRails(): void {
    const live = this.enabled && this.master && !this.estop;
    const R = this.rails;
    const lines: AuxRail[] = [];

    /** A rail is live only if the master is on, its own switch is on, its
     *  breaker has not tripped, and it actually has a non-zero demand. */
    const railLive = (r: Rail): boolean => {
      if (!live || !r.on || r.tripped) return false;
      if ((r.key === 'vdc' || r.key === 'vac') && r.V < 0.5) return false;
      return true;
    };

    // ── variable 3φ AC ──
    const vacOpen = !railLive(R.vac);
    if (!vacOpen) {
      const A = this.peak(R.vac.V);
      lines.push({ rail: 'vac', pos: 'AC-L1', neg: 'AC-N', V: A, Imax: R.vac.Imax, f: R.vac.f });
      lines.push({ rail: 'vac', pos: 'AC-L2', neg: 'AC-N', V: -A / 2, Imax: R.vac.Imax, f: R.vac.f });
      lines.push({ rail: 'vac', pos: 'AC-L3', neg: 'AC-N', V: -A / 2, Imax: R.vac.Imax, f: R.vac.f });
    } else {
      lines.push({ rail: 'vac', pos: 'AC-L1', neg: 'AC-N', open: true });
      lines.push({ rail: 'vac', pos: 'AC-L2', neg: 'AC-N', open: true });
      lines.push({ rail: 'vac', pos: 'AC-L3', neg: 'AC-N', open: true });
    }

    // ── fixed 3φ 400 V ──
    if (railLive(R.f3p)) {
      const A = this.peak(R.f3p.V);
      lines.push({ rail: 'f3p', pos: '3P-L1', neg: '3P-PE', V: A, Imax: R.f3p.Imax });
      lines.push({ rail: 'f3p', pos: '3P-L2', neg: '3P-PE', V: -A / 2, Imax: R.f3p.Imax });
      lines.push({ rail: 'f3p', pos: '3P-L3', neg: '3P-PE', V: -A / 2, Imax: R.f3p.Imax });
    } else {
      lines.push({ rail: 'f3p', pos: '3P-L1', neg: '3P-PE', open: true });
      lines.push({ rail: 'f3p', pos: '3P-L2', neg: '3P-PE', open: true });
      lines.push({ rail: 'f3p', pos: '3P-L3', neg: '3P-PE', open: true });
    }

    // ── fixed low-voltage DC (6/12/24) ──
    lines.push(
      railLive(R.d24)
        ? { rail: 'd24', pos: 'DC+24', neg: 'DC-24', V: R.d24.V, Imax: R.d24.Imax }
        : { rail: 'd24', pos: 'DC+24', neg: 'DC-24', open: true }
    );

    // ── fixed 50 V DC ──
    lines.push(
      railLive(R.d50)
        ? { rail: 'd50', pos: 'DC+50', neg: 'DC-50', V: R.d50.V, Imax: R.d50.Imax }
        : { rail: 'd50', pos: 'DC+50', neg: 'DC-50', open: true }
    );

    this.auxLines = lines;

    // The main stamped source follows the variable DC rail. When it is dead we
    // aim pos/neg at non-existent terminals so the stamp is skipped — a 0 V
    // source would be a dead short across the bench.
    if (railLive(R.vdc)) {
      this.pos = this._posLive;
      this.neg = this._negLive;
      this.V = R.vdc.V;
      this.Imax = R.vdc.Imax;
    } else {
      this.pos = this._posOff;
      this.neg = this._negOff;
      this.V = 0;
    }

    // Fresh frame — start collecting rail currents again.
    this.railIacc = {};
  }

  /**
   * Per-rail current report, called from the simulator during the solve.
   *
   * Fires once per fold-back iteration AND once after the final solve, so we
   * keep the MAX rather than summing — summing would multiply the reading by
   * the iteration count.
   */
  noteRailCurrent(rail: string, i: number, _imax: number): void {
    if (!rail || !Number.isFinite(i)) return;
    const key = rail as RailKey;
    const a = this.railIacc;
    a[key] = Math.max(a[key] ?? 0, i);
  }

  setControl(id: string, value: number | string | boolean): void {
    const R = this.rails;
    const num = Number(value);

    switch (id) {
      case 'master':
        this.master = Boolean(value);
        if (!this.master) this.enabled = false;
        break;

      case 'estop':
        // Emergency mushroom latches. Pressing it kills everything and it
        // STAYS down until START is pressed — that is the whole point of an
        // emergency stop, it must not be self-clearing.
        this.estop = Boolean(value);
        if (this.estop) {
          this.master = false;
          this.enabled = false;
        }
        break;

      case 'start':
        // START clears the e-stop latch, re-arms the isolator AND restores the
        // main contactor. Setting `master` alone was not enough: e-stop had
        // already forced enabled = false, and nothing else turns that back on.
        this.estop = false;
        this.master = true;
        this.enabled = true;
        this.warn = '';
        break;

      case 'reset':
        // Breaker RESET: clear every tripped rail and cool it back down. Does
        // NOT re-energise — the rail switch must be closed by hand afterwards,
        // exactly like real gear. Clearing `tripped` without also dropping
        // `on` let a tripped rail spring straight back to full output the
        // instant RESET was pressed, because the rail switch was still latched
        // closed.
        for (const k of Object.keys(R) as RailKey[]) {
          const r = R[k];
          if (r.tripped) r.on = false;
          r.tripped = false;
          r.T = 25;
        }
        for (const k of Object.keys(this.railThermal) as RailKey[]) {
          this.railThermal[k].reset();
        }
        this.thermal.reset();
        this.smoke = 0;
        this.warn = '';
        break;

      case 'vdcOn': R.vdc.on = Boolean(value); break;
      case 'vdcV': R.vdc.set = Math.max(0, Math.min(R.vdc.Vmax, num)); break;
      case 'vacOn': R.vac.on = Boolean(value); break;
      case 'vacV': R.vac.set = Math.max(0, Math.min(R.vac.Vmax, num)); break;
      case 'vacF': R.vac.f = num >= 55 ? 60 : 50; break;
      case 'f3pOn': R.f3p.on = Boolean(value); break;
      case 'd24On': R.d24.on = Boolean(value); break;
      case 'd50On': R.d50.on = Boolean(value); break;

      case 'tap': {
        // Cycle 6 → 12 → 24 → 6. The 6/12/24 line is a tapped secondary, so
        // the output follows the tap immediately.
        const taps = R.d24.taps ?? [6, 12, 24];
        const cur = R.d24.tap ?? 24;
        const idx = Math.max(0, taps.indexOf(cur));
        const next = taps[(idx + 1) % taps.length];
        R.d24.tap = next;
        R.d24.set = next;
        R.d24.V = next;
        break;
      }

      default:
        break;
    }
  }

  setDisplayMode(dispId: string, mode: string): void {
    const c = this.channels.find((x) => x.id === dispId);
    if (!c) return;
    if (mode !== 'V' && mode !== 'A' && mode !== 'F') return;
    c.mode = mode;
    // Repoint immediately so a mode switch on a stopped bench still updates.
    c.shown = mode === 'V' ? c.V : mode === 'A' ? c.I : c.F;
    c.over =
      mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2
      : mode === 'A' ? Math.abs(c.I) > this.IRange * 1.2
      : false;
  }

  update(dt: number, sol: Solution): void {
    const R = this.rails;
    const acc = this.railIacc;
    const live = this.enabled && this.master && !this.estop;

    // Master current = the variable DC rail's own source current.
    if (live && this._vsIndex >= 0 && sol.Ivs) {
      this.I = Math.abs(sol.Ivs[this._vsIndex] ?? 0);
    } else {
      this.I = 0;
    }

    for (const k of Object.keys(R) as RailKey[]) {
      const r = R[k];
      const th = this.railThermal[k];
      r.I = acc[k] ?? 0;

      // Soft start: only the continuously-variable rails ramp. A fixed line
      // comes up instantly because a tapped secondary has nothing to wind.
      if (r.tau > 0) {
        const target = live && r.on && !r.tripped ? r.set : 0;
        const a = Math.min(1, dt / r.tau);
        r.V += (target - r.V) * a;
        if (r.V < 0.05) r.V = 0;
      } else {
        r.V = live && r.on && !r.tripped ? r.set : 0;
      }

      // I²R loss across the pass element. The variable rails burn more because
      // they regulate; the fixed lines are stiff.
      const burden = r.key === 'vdc' || r.key === 'vac' ? 0.06 : 0.02;
      th.step(dt, r.I * r.I * burden + (r.V > 0 ? 0.4 : 0));
      r.T = th.T;

      // ── breaker ────────────────────────────────────────────────
      // An instantaneous threshold is UNREACHABLE on a regulated rail: the
      // CV/CC fold-back clamps the output at Imax and holds it there forever,
      // so the current can never exceed Imax by enough to cross a higher
      // instantaneous trip point. That is correct behaviour for a bench supply
      // (constant-current mode), which means the breaker must key off TIME
      // SPENT AT THE LIMIT, like a real inverse-time thermal-magnetic breaker.
      const atLimit = live && !r.tripped && r.I > r.Imax * 0.95;
      if (atLimit) r.overT += dt;
      else r.overT = Math.max(0, r.overT - dt * 2);

      // Inverse-time curve. Fold-back clamps EVERY overload to the same
      // current, so current alone cannot distinguish a dead short from a mild
      // overload. The depth of the fold can: a stiff short drags the regulated
      // output far below its setting, a mild overload barely dips it.
      let delay = r.tripDelay;
      if (r.tau > 0 && this.V > 1) {
        const fold = (this._Veff ?? this.V) / this.V;
        if (fold < 0.5) delay = 0.15;        // hard short — trip almost at once
        else if (fold < 0.85) delay = 0.5;   // solid overload
      }

      if (!r.tripped && live) {
        if (r.I > r.trip) {
          r.tripped = true;
          r.on = false;
          this.warn = `${r.label} breaker tripped (overload)`;
        } else if (atLimit && r.overT >= delay) {
          r.tripped = true;
          r.on = false;
          this.warn = `${r.label} breaker tripped (sustained ${r.I.toFixed(2)} A)`;
        }
      }
      if (th.dead && !r.tripped) {
        r.tripped = true;
        r.on = false;
        this.warn = `${r.label} overheated`;
      }
    }

    // Master thermal follows the variable DC rail — it is the one dissipating.
    this.thermal.step(dt, this.I * this.I * 0.02);
    if (this.thermal.dead) {
      this.enabled = false;
      this.master = false;
    }
    this.smoke = Math.max(
      this.thermal.smoke,
      this.railThermal.vdc.smoke,
      this.railThermal.vac.smoke
    );

    // ── front-panel displays ──
    // Each ESAM shows one rail. V / A / F are all computed every frame so a
    // mode switch never leaves a stale number under a fresh unit.
    const map: Record<string, RailKey> = { m1: 'vac', m2: 'vdc', m3: 'f3p', m4: 'd24' };
    for (const c of this.channels) {
      const r = R[map[c.id]];
      if (!r) continue;
      c.V = r.V;
      c.I = r.I;
      c.F = r.key === 'vac' || r.key === 'f3p' ? (r.f ?? 50) : 0;
      c.shown = c.mode === 'V' ? c.V : c.mode === 'A' ? c.I : c.F;
      c.over =
        c.mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2
        : c.mode === 'A' ? Math.abs(c.I) > this.IRange * 1.2
        : false;
    }

    this.Vactual = R.vdc.V;
    this.limiting = this.I > R.vdc.Imax * 0.98;
  }

  readouts(): Readout[] {
    const R = this.rails;
    const out: Readout[] = [];

    if (this.estop) {
      out.push({ name: 'ESTOP', label: 'EMERGENCY STOP', value: 'LATCHED', unit: '', warn: true });
    }
    if (this.warn) {
      out.push({ name: 'WARN', label: 'Panel', value: this.warn, unit: '', warn: true });
    }

    out.push({ name: 'vdcV', label: 'VAR DC · V', value: R.vdc.V, unit: 'V', warn: R.vdc.tripped });
    out.push({ name: 'vdcI', label: 'VAR DC · I', value: R.vdc.I, unit: 'A', warn: R.vdc.I > R.vdc.Imax });
    out.push({ name: 'vacV', label: 'VAR AC · V LL', value: R.vac.V, unit: 'V', warn: R.vac.tripped });
    out.push({ name: 'vacI', label: 'VAR AC · I', value: R.vac.I, unit: 'A', warn: R.vac.I > R.vac.Imax });
    out.push({ name: 'vacF', label: 'VAR AC · f', value: R.vac.f ?? 50, unit: 'Hz' });
    out.push({ name: 'f3pI', label: '3φ 400 · I', value: R.f3p.I, unit: 'A', warn: R.f3p.tripped });
    out.push({ name: 'd24V', label: `DC ${R.d24.tap ?? 24} V`, value: R.d24.V, unit: 'V', warn: R.d24.tripped });
    out.push({ name: 'd50V', label: 'DC 50 V', value: R.d50.V, unit: 'V', warn: R.d50.tripped });
    out.push({ name: 'T', label: 'Pass element', value: this.thermal.T, unit: '°C', warn: this.thermal.T > 70 });

    const anyTripped = (Object.keys(R) as RailKey[]).some((k) => R[k].tripped);
    if (anyTripped) {
      out.push({ name: 'TRIP', label: 'Breaker', value: 'TRIPPED — press RESET', unit: '', warn: true });
    }
    return out;
  }
}
