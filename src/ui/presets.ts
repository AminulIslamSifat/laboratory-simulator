/**
 * Experiment presets.
 *
 * One preset per experiment in `References/experiment/`. Every bench carries
 * the AV-1/EV power supply and the AZ-VIPS/VIDC measurement rack, because
 * every experiment in the course is performed on that bench.
 *
 * ─── Terminal names are the sprite's printed jacks ───
 * The netlist drops any wire whose endpoint is not a terminal the device
 * declares - silently, with no error. A wire to a jack that does not exist
 * is therefore invisible at runtime, which is why the rack's real posts are
 * used verbatim here:
 *
 *   rack voltmeter  A1 (+) / R (-)     high-Z, parallels the load
 *   rack ammeter    in / out           0.01 ohm shunt, wired in series
 *   rack wattmeter  V across A1/R, I through the in/out series coil
 *
 * The rack has no V+ / V- posts. The presets used to wire those, so ten
 * wires across five benches never reached the solver.
 *
 * ─── Why setup() exists ───
 * The supply model boots with every rail OFF behind an open isolator, so a
 * bench that is only placed and wired sits dead. That is deliberate - a
 * correctly-wired dead bench is exactly what you want the moment before you
 * energise it. `setup()` closes the isolator, selects the rail and winds the
 * variac to the value the experiment calls for.
 */

import type { Lab, Preset } from './lab.js';
import { EQUIPMENT } from '../devices/index.js';
import type { DCSupply, DCMachine } from '../devices/index.js';
import type { Rheostat } from '../devices/rheostat/model.js';
import { EXP04_BENCH, EXP04_IDS } from './exp04-bench.js';
import { EXP05_BENCH } from './exp05-bench.js';

/** A wire as `[fromKind, fromTerm, toKind, toTerm]`. */
type WireSpec = [string, string, string, string];

/**
 * Wire every listed connection.
 *
 * Looks devices up by KIND, not id, because a preset is written against the
 * bench it is about to build - it does not know or care what ids the lab
 * hands out. This means a preset may only place ONE device of each kind, which
 * is true of every experiment here.
 */
function wireAll(lab: Lab, list: WireSpec[]): void {
  const dropped: string[] = [];
  list.forEach((w) => {
    const A = lab.devices.find((d) => d.kind === w[0]);
    const B = lab.devices.find((d) => d.kind === w[2]);
    if (!A || !B) {
      dropped.push(`${w[0]}:${w[1]} -> ${w[2]}:${w[3]} (device not placed)`);
      return;
    }
    // A wire to a terminal the model does not declare is dropped by the
    // netlist in silence. Catch it here so a typo in this table fails loudly
    // instead of producing a dead bench with no explanation.
    const aTerms = (A.model as { terminals?: Record<string, number> }).terminals ?? {};
    const bTerms = (B.model as { terminals?: Record<string, number> }).terminals ?? {};
    if (!(w[1] in aTerms)) dropped.push(`${w[0]}:${w[1]} — no such terminal`);
    if (!(w[3] in bTerms)) dropped.push(`${w[2]}:${w[3]} — no such terminal`);
    lab.wiring.add(A.id, w[1], B.id, w[3]);
  });
  if (dropped.length > 0) console.warn('[preset] dropped wires:', dropped.join('; '));
}

/**
 * Energise the bench.
 *
 * The supply is five independent rails behind a master isolator and an
 * e-stop latch. Booting it means: clear the latch, close the isolator, then
 * select and set the rail this experiment actually uses.
 */
function energise(lab: Lab, cfg?: (m: DCSupply) => void): void {
  const psu = lab.devices.find((d) => d.kind === 'power_supply');
  if (!psu) return;
  const m = psu.model as DCSupply;
  m.estop = false;
  m.master = true;
  m.enabled = true;
  m.warn = '';
  if (cfg) cfg(m);
}

const RACK = 'meter_rack';
const VM_P = 'L1';      // rack three-line voltmeter bank, line 1
const VM_N = 'N';       // rack three-line voltmeter bank, neutral
const DIN_P = 'DIN1+';  // rack DIN voltmeter, + post
const DIN_N = 'DIN1-';  // rack DIN voltmeter, - post
const AM_IN = 'N';      // rack ammeter, ground post (row 1)
const AM_OUT = 'R';     // rack ammeter, row-3 leftmost jack

/**
 * Real terminal sets, read from each device's layout.ts.
 *
 * These exist because a wire to a jack the model does not declare is dropped
 * in SILENCE by the netlist. The old presets wired 3φ motor terminals B1, B2,
 * C2 and 1φ motor terminals Run, Aux2 — none of which are painted. Those wires
 * vanished and the benches sat dead with no error anywhere.
 *
 *   dc_machine   PE A1 A2 D1 D2 D3 F1 F2 SHAFT
 *   motor_3p     PE U1 U2 V1 V2 W1 W2 SHAFT
 *   motor_1p     Z1 Z2 C C2 U1 U2 PE SHAFT
 *   sync_gen     F1 F2 U1 U2 V1 V2 W1 W2 G SHAFT
 *   transformer  P230 P0 B1 B2 PE 2U1 2U2 2U3 2U4 3U1 3U2 3U3
 *   rheostat     A_TOP A_BOT B_TOP B_YEL B_RED
 *   load_bank    A B
 *   meter_rack   L1 L2 L3 N | R D2 C | L1b..Nb | AA± | DIN1± | DIN2±
 *
 * Row 2 is TWO IDENTICAL METER UNITS. Each owns a face and a 2x2 block of
 * jacks to its right:
 *
 *   top pair    -> the original terminals   (AA+ / AA-  ·  DIN1+ / DIN1-)
 *   bottom pair -> the same line through the meter's ammeter
 *                                           (AA+2 / AA-2  ·  DIN2+ / DIN2-)
 *
 * so the number you are reading always sits beside the jacks you are moving.
 */

/**
 * Set the rack's shared series ammeter to A mode.
 *
 * `d3` (AZ-VIDC) is an A-mode display that reads the rack's ONE series coil —
 * the current to be measured must pass through in -> out. Switching the
 * display to A is what makes the number visible; the wiring alone is not
 * enough because the default mode is V.
 */
function readAmps(lab: Lab, face = 'd3'): void {
  const rack = lab.devices.find((d) => d.kind === RACK);
  const m = rack?.model as { setDisplayMode?: (id: string, mode: string) => void } | undefined;
  if (m && typeof m.setDisplayMode === 'function') m.setDisplayMode(face, 'A');
}

/**
 * Put BOTH row-2 faces on V.
 *
 * The DIN face (d3) reads the source and the AA face (d2) reads the
 * resultant. Both are voltmeters, so both must be on V — the polarity test
 * compares two voltages and neither reading is a current.
 */
function readVolts(lab: Lab): void {
  const rack = lab.devices.find((d) => d.kind === RACK);
  const m = rack?.model as { setDisplayMode?: (id: string, mode: string) => void } | undefined;
  if (m && typeof m.setDisplayMode === 'function') {
    m.setDisplayMode('d2', 'V');
    m.setDisplayMode('d3', 'V');
  }
}

/** Find a placed device's model by kind, typed. */
function modelOf<T>(lab: Lab, kind: string): T | undefined {
  const d = lab.devices.find((x) => x.kind === kind);
  return d ? (d.model as unknown as T) : undefined;
}

/**
 * World position of one terminal after the device's rotation.
 *
 * The renderer rotates a device about its own centre and the wire layer
 * compensates with the same maths, so a preset that wants two mechanical
 * ports to actually meet must compute where the port LANDS, not where the
 * layout first drew it. Placement by hand guessed these and the coupling
 * floated in mid-air between a downward-facing motor shaft and a horizontal
 * generator shaft.
 */
function termWorld(
  lab: Lab,
  kind: string,
  term: string,
  x: number,
  y: number,
  rot = 0
): { x: number; y: number } | null {
  const reg = EQUIPMENT[kind];
  if (!reg) return null;
  const t = reg.layout.terms.find((k) => k.k === term);
  if (!t) return null;
  const cx = reg.layout.w / 2;
  const cy = reg.layout.h / 2;
  const dx = t.x - cx;
  const dy = t.y - cy;
  const a = (rot * Math.PI) / 180;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: x + cx + rx, y: y + cy + ry };
}

/** Inverse of termWorld: the device x/y that puts `term` at a world point. */
function placeForTerm(
  lab: Lab,
  kind: string,
  term: string,
  world: { x: number; y: number },
  rot = 0
): { x: number; y: number } {
  const reg = EQUIPMENT[kind];
  const t = reg.layout.terms.find((k) => k.k === term)!;
  const cx = reg.layout.w / 2;
  const cy = reg.layout.h / 2;
  const dx = t.x - cx;
  const dy = t.y - cy;
  const a = (rot * Math.PI) / 180;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: world.x - cx - rx, y: world.y - cy - ry };
}

export const PRESETS: Record<string, Preset> = {

  /* ── Exp 01 · Nameplate study ────────────────────────────────────
     Read with the power OFF. The supply and rack are on the bench because
     the procedure says to record ratings with the supply isolated; nothing
     is wired and nothing is energised. */
  exp01_nameplate: {
    label: 'Exp 01 \u00b7 Nameplate Study',
    sub: 'All machines \u00b7 rated data',
    build(lab) {
      lab.clear();
      lab.place('dc_machine', 30, 30);
      lab.place('async_motor_3p', 380, 30);
      lab.place('sync_gen', 760, 30);
      lab.place('async_motor_1p', 30, 400);
      lab.place('single_phase_transformer', 430, 430);
      lab.place('rheostat', 760, 430);
      lab.place('power_supply', 30, 760);
      lab.place(RACK, 600, 760);
      lab.titleEl.textContent = 'Experiment 01 \u00b7 Study of Nameplate Ratings and Rated Speed';
      lab.fitView();
    },
    // Nameplate study - supply stays isolated.
    setup() { /* nothing to energise */ }
  },

  /* ── Exp 02a · Polarity test, ADDITIVE ───────────────────────────
     One primary terminal is strapped to one secondary terminal, a reduced
     AC voltage Va is applied to the primary, and Vc is measured across the
     two remaining terminals. With P0 strapped to the secondary START (3U2)
     the windings add in series, so Vc > Va: additive. */
  exp02_polarity_additive: {
    label: 'Exp 02a \u00b7 Polarity \u00b7 Additive',
    sub: '1\u03c6 transformer \u00b7 Vc > Va',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('single_phase_transformer', 520, 40);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        // Supply enters the DIN unit on its ORIGINAL pair and leaves on the
        // ammeter pair into the primary. The two minus jacks are one node
        // inside the unit, so AC-N can land on either of them.
        ['power_supply', 'AC-L1', RACK, 'DIN1+'],
        [RACK, 'DIN2+', 'single_phase_transformer', 'P230'],
        ['power_supply', 'AC-N', RACK, 'DIN1-'],
        // Second return leg, out through the unit's ammeter to the primary
        // return.
        [RACK, 'DIN2-', 'single_phase_transformer', 'P0'],
        // AA face across the two open ends.
        ['single_phase_transformer', 'P230', RACK, 'AA+'],
        // ADDITIVE: primary return strapped to the 2U START, then the whole
        // 2U+3U chain in series-aiding, probe at the far end (3U2).
        // Vc = Va + Vb, so Vc > Va.
        ['single_phase_transformer', 'P0', 'single_phase_transformer', '2U1'],
        ['single_phase_transformer', '2U2', 'single_phase_transformer', '3U1'],
        ['single_phase_transformer', '3U2', RACK, 'AA-']
      ]);
      lab.titleEl.textContent = 'Experiment 02 \u00b7 Polarity Test \u2014 Additive Connection';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 100;   // reduced voltage, as the procedure requires
      });
      readVolts(lab);
    }
  },

  /* ── Exp 02b · Polarity test, SUBTRACTIVE ────────────────────────
     Same primary loop and the SAME meter pair as the additive bench
     (P230 -> 2U2). Only the strap moves: P0 is tied to the secondary FAR
     end (2U2) instead of the start (2U1). The two windings now oppose, so
     the meter reads Va - Vs2: a small, clearly-reduced voltage. */
  exp02_polarity_subtractive: {
    label: 'Exp 02b \u00b7 Polarity \u00b7 Subtractive',
    sub: '1\u03c6 transformer \u00b7 Vc < Va',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('single_phase_transformer', 520, 40);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        // Identical spine to the additive bench - only the last three wires
        // move. Supply in on the DIN unit's original pair, out through its
        // ammeter into the primary.
        ['power_supply', 'AC-L1', RACK, 'DIN1+'],
        [RACK, 'DIN2+', 'single_phase_transformer', 'P230'],
        ['power_supply', 'AC-N', RACK, 'DIN1-'],
        [RACK, 'DIN2-', 'single_phase_transformer', 'P0'],
        ['single_phase_transformer', 'P230', RACK, 'AA+'],
        // SUBTRACTIVE: the mirror. Primary return strapped to the 3U FAR end,
        // the chain walked the other way, probe at 2U1. The windings oppose,
        // so Vc = Va - Vb and Vc < Va.
        ['single_phase_transformer', 'P0', 'single_phase_transformer', '3U2'],
        ['single_phase_transformer', '3U1', 'single_phase_transformer', '2U2'],
        ['single_phase_transformer', '2U1', RACK, 'AA-']
      ]);
      lab.titleEl.textContent = 'Experiment 02 \u00b7 Polarity Test \u2014 Subtractive Connection';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 100;   // reduced voltage, as the procedure requires
      });
      readVolts(lab);
    }
  },

  /* ── Exp 03a · Open-circuit test ─────────────────────────────────
     Rated voltage on the primary, secondary OPEN, rack reads V0 and I0.
     Yields the shunt branch: R0 and X0. */
  exp03_oc: {
    label: 'Exp 03a \u00b7 Open-Circuit Test',
    sub: '1\u03c6 transformer \u00b7 V0 / I0 \u2192 R0 X0',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('single_phase_transformer', 520, 40);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        // Supply in on the AA face's ORIGINAL pair, out through its ammeter
        // into the primary. The two minus jacks are one node inside the unit,
        // so the return only has to reach one of them - and on this unit that
        // jack is NOT the ammeter output, so it cannot short the shunt.
        ['power_supply', 'AC-L1', RACK, 'AA+'],
        [RACK, 'AA-', 'power_supply', 'AC-N'],
        [RACK, 'AA+2', 'single_phase_transformer', 'P230'],
        [RACK, 'AA-2', 'single_phase_transformer', 'P0'],
        // Secondaries in series but the loop left OPEN - that is the test.
        ['single_phase_transformer', '2U2', 'single_phase_transformer', '3U1']
      ]);
      lab.titleEl.textContent = 'Experiment 03 \u00b7 Open-Circuit Test of a Single-Phase Transformer';
      lab.fitView();
    },
    setup(lab) {
      // Rated primary voltage. The secondary is open, so the primary draws
      // only the magnetising + core-loss current I0 (a few percent of rated).
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 230;
      });
      // V0 on the AA face; I0 shows on the supply's VAR AC - I readout.
      readVolts(lab);
    }
  },

  /* ── Exp 03b · Short-circuit test ────────────────────────────────
     The secondary is SHORTED on itself, and a reduced primary voltage is
     applied so Isc is around rated. Yields the series branch: Req and Xeq. */
  exp03_sc: {
    label: 'Exp 03b \u00b7 Short-Circuit Test',
    sub: '1\u03c6 transformer \u00b7 Vsc / Isc \u2192 Req Xeq',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('single_phase_transformer', 520, 40);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        // Same spine as the open-circuit bench - only the secondary changes.
        ['power_supply', 'AC-L1', RACK, 'AA+'],
        [RACK, 'AA-', 'power_supply', 'AC-N'],
        [RACK, 'AA+2', 'single_phase_transformer', 'P230'],
        [RACK, 'AA-2', 'single_phase_transformer', 'P0'],
        // Both secondaries in ONE CLOSED LOOP - that is the short.
        ['single_phase_transformer', '2U2', 'single_phase_transformer', '3U1'],
        ['single_phase_transformer', '3U2', 'single_phase_transformer', '2U1']
      ]);
      lab.titleEl.textContent = 'Experiment 03 \u00b7 Short-Circuit Test of a Single-Phase Transformer';
      lab.fitView();
    },
    setup(lab) {
      // The SC test applies just enough primary voltage to drive RATED
      // current through the shorted secondary - not full voltage, which would
      // trip the rail. On this panel the top 2U winding reaches the 760 VA
      // transformer's ~3.3 A rated current at about 10 V of primary. The
      // measured bench: set=10 gives I_sc = 3.26 A; set=15 trips the 4.5 A
      // rail breaker, so 10 V is the working point.
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 10;
      });
      // The AA face is the one sitting in the primary loop here, so THAT is
      // the display that has to be on A to show Isc.
      readAmps(lab, 'd2');
    }
  },

  /* ── Exp 04 · DC shunt generator, external characteristic ────────
     The prime mover is the 3phi induction motor, coupled to the DC machine
     by a shaft coupling - not a scripted primeRpm. Field is taken from the
     armature through a rheostat, which is what makes it a SHUNT machine and
     gives the characteristic its steep droop. */
  exp04_dcgen: {
    label: 'Exp 04 \u00b7 DC Shunt Generator',
    sub: 'motor-coupled \u00b7 V_t vs I_L',
    build(lab) {
      // This preset is the REAL bench, loaded verbatim from a working session
      // rather than re-derived from a description of it.
      //
      // Everything the hand-written version below used to do still applies as
      // intent, but the actual coordinates, rotations and — critically — the
      // WIRING came off the saved bench, so the preset matches the machine on
      // the desk instead of a plausible reconstruction of it:
      //
      //   · the field is tapped through DIN 2's own ammeter jacks
      //     (F2 -> rheostat -> DIN2+ -> DIN2- -> F1), so the field current is
      //     read in line rather than merely inferred
      //   · the load hangs off the d4 wattmeter shunt (AA+2/AA-2), with AA+/AA-
      //     tapping the armature across it — a 4-wire measurement, which is
      //     what that bay is for
      //
      // The old reconstruction is gone rather than kept alongside, because
      // two sources of truth for one experiment is how they drift apart.
      lab.loadBench(EXP04_BENCH);
      lab.titleEl.textContent = 'Experiment 04 \u00b7 DC Shunt Generator \u2014 External Characteristic';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.f3p.on = true;   // fixed 400 V 3phi line drives the prime mover
      });

      // Address the two rheostats BY SAVED ID, not by index.
      //
      // The bench has two of the same kind, so `devices.filter(kind)` order is
      // the only thing an index would be keyed to — and that order comes from
      // the saved array, which is not a contract. `EXP04_IDS` names them by
      // the role the WIRING gives them, so swapping them in the file cannot
      // silently turn the field trim into a load setting.
      const byId = new Map(lab.devices.map((d) => [d.id, d.model as unknown as Rheostat]));
      const field = byId.get(EXP04_IDS.FIELD_RH);
      const load = byId.get(EXP04_IDS.LOAD_RH);

      // Field trimmed near zero: the machine self-excites on residual flux and
      // reaches ~220 V at no load with almost no added field resistance.
      if (field) { field.posA = 0.03; field.posB = 0.03; }
      // Load at max resistance = lightest load, the start of the
      // characteristic. Wind it down to pull current.
      if (load) { load.posA = 1; load.posB = 1; }

      // The DIN bay's d3 display is the ammeter, and its own mode default is
      // already 'A' — but the ARMETER the experiment reads is the d4 wattmeter
      // on the load shunt, so put that one in A too.
      const rack = lab.devices.find((d) => d.kind === RACK);
      const rm = rack?.model as { setDisplayMode?: (id: string, mode: string) => void } | undefined;
      if (rm && typeof rm.setDisplayMode === 'function') rm.setDisplayMode('d4', 'A');
      readAmps(lab);
    }
  },

  /* ── Exp 05 · 1phi induction motor, capacitor start ───────────── */
  exp05_single_phase: {
    label: 'Exp 05 \u00b7 1\u03c6 Async Motor',
    sub: 'M-R/CV \u00b7 C = 12.5 \u00b5F',
    build(lab) {
      // This preset is the REAL bench, loaded verbatim from a working session
      // (MongoDB roll 2403123, "Real-exp5") rather than hand-wired.
      //
      // The wiring came off the actual lab bench:
      //   · Z1 -> C links the auxiliary winding to the start capacitor internally
      //   · Z2 -> U2 ties the aux winding return to the main winding return
      //   · U1 -> C2 completes the capacitor loop through the main winding
      //   · AC-N -> rack N, rack N -> motor U2 provides the neutral return
      //   · AC-L3 -> rack L3 feeds the 3-phase line through the rack metering
      //   · U1 -> rack C taps the voltmeter across the main winding
      lab.loadBench(EXP05_BENCH);
      lab.titleEl.textContent = 'Experiment 05 \u00b7 Single-Phase Induction Motor \u2014 Capacitor Start';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 230;
      });
      readAmps(lab);
    }
  },

  /* ── Exp 06 · Synchronous reactance, OC / SC test ────────────────

     Prime mover: a 3φ induction motor on the fixed 400 V line, shafted to
     the generator through a coupling. The generator does NOT get a scripted
     primeRpm — the mechanical pass drives it from whatever the motor's shaft
     is doing, exactly as Exp 04 does. A generator bolted to nothing and told
     to spin is not a bench anyone recognises.

     Field is fed from the variable DC rail through the field rheostat. The
     U-phase is left open so the DIN voltmeter reads Voc; the V-phase is
     shorted through the rack series coil so the same run also yields Isc at
     that field current. Zs = Voc / Isc, and Xs = sqrt(Zs^2 - Ra^2).

     Reference data (Rdc = 18.5 Ω, Ra = 1.4·Rdc = 25.9 Ω):
       If 0.100 A -> Voc 155.1 V, Isc 0.182 A -> Zs 852.20 Ω, Xs 851.81 Ω
       If 0.290 A -> Voc 398.8 V, Isc 0.575 A -> Zs 693.57 Ω, Xs 693.08 Ω */
  exp06_sync: {
    label: 'Exp 06 \u00b7 Sync Generator Xs',
    sub: 'GMS \u00b7 OC + SC test',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 20, 20);
      // Prime mover train: 3φ motor -> coupling -> generator.
      lab.place('async_motor_3p', 430, 20);
      lab.place('coupling', 830, 150);
      lab.place('sync_gen', 1060, 20);
      lab.place('rheostat', 430, 560);
      lab.place(RACK, 1060, 560);

      wireAll(lab, [
        // Prime mover: 3φ motor in star on the fixed 400 V line.
        ['power_supply', '3P-L1', 'async_motor_3p', 'U1'],
        ['power_supply', '3P-L2', 'async_motor_3p', 'V1'],
        ['power_supply', '3P-L3', 'async_motor_3p', 'W1'],
        ['async_motor_3p', 'U2', 'async_motor_3p', 'V2'],
        ['async_motor_3p', 'V2', 'async_motor_3p', 'W2'],
        ['async_motor_3p', 'W2', 'power_supply', '3P-PE'],
        // Mechanical link: the motor turns the generator.
        ['async_motor_3p', 'SHAFT', 'coupling', 'MA'],
        ['coupling', 'MB', 'sync_gen', 'SHAFT'],
        // Field: DC+ -> rheostat -> F1, F2 -> DC-.
        ['power_supply', 'DC+', 'rheostat', 'A_TOP'],
        ['rheostat', 'A_BOT', 'sync_gen', 'F1'],
        ['sync_gen', 'F2', 'power_supply', 'DC-'],
        // Open-circuit voltage across the U phase: DIN voltmeter.
        [RACK, DIN_P, 'sync_gen', 'U1'],
        [RACK, DIN_N, 'sync_gen', 'U2'],
        // Short-circuit current through the V phase, via the series coil.
        // The DIN bank is ONE node pair shared by d2 and d3, so it cannot
        // also carry the field loop without shorting the two measurements
        // together. The field current is read from the supply's own DC rail
        // ammeter instead.
        [RACK, AM_IN, 'sync_gen', 'V1'],
        [RACK, AM_OUT, 'sync_gen', 'V2']
      ]);
      lab.titleEl.textContent = 'Experiment 06 \u00b7 Synchronous Generator \u2014 OC / SC Test for Xs';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.f3p.on = true;   // 400 V 3φ line drives the prime mover
        m.rails.vdc.on = true;
        m.rails.vdc.set = 50;    // first field-current step in the table
      });
      const rh = modelOf<Rheostat>(lab, 'rheostat');
      if (rh) { rh.posA = 0.5; rh.posB = 0.5; }
      readAmps(lab);
    }
  },

  /* ── Extra · 3phi asynchronous motor, direct-on-line ─────────────
     Kept from the original bench: a valid starting-current study, and the
     3phi line is now actually switched on. */
  exp07_async3p: {
    label: 'Extra \u00b7 3\u03c6 Motor DOL Start',
    sub: 'M-4/EV \u00b7 star connection',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('async_motor_3p', 460, 30);
      lab.place(RACK, 30, 560);

      wireAll(lab, [
        // Lines on the phase STARTS (U1 V1 W1) through the series coil on L1.
        // The 3φ motor's jacks are U1 U2 V1 V2 W1 W2 - there is no B1/B2/C2.
        ['power_supply', '3P-L1', RACK, AM_IN],
        [RACK, AM_OUT, 'async_motor_3p', 'U1'],
        ['power_supply', '3P-L2', 'async_motor_3p', 'V1'],
        ['power_supply', '3P-L3', 'async_motor_3p', 'W1'],
        // Star point: the three phase ENDS bonded and returned to 3P-PE.
        ['async_motor_3p', 'U2', 'async_motor_3p', 'V2'],
        ['async_motor_3p', 'V2', 'async_motor_3p', 'W2'],
        ['async_motor_3p', 'W2', 'power_supply', '3P-PE'],
        // Voltmeter across L1-L2.
        [RACK, DIN_P, 'async_motor_3p', 'U1'],
        [RACK, DIN_N, 'async_motor_3p', 'V1']
      ]);
      lab.titleEl.textContent = 'Three-Phase Asynchronous Motor \u2014 Direct-On-Line Starting';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.f3p.on = true;
      });
      readAmps(lab);
    }
  },

  /* ── Extra · DC machine load test ─────────────────────────────── */
  exp08_dcload: {
    label: 'Extra \u00b7 DC Machine Load Test',
    sub: 'M1-2/EV + load bank',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      const dc = lab.place('dc_machine', 460, 30);
      // Separately excited here: the field hangs off the main DC rail via
      // F1/F2, so the machine's internal shunt link (F2≡A2) has to be off.
      // Left on, it ties the field return to the armature return and the load
      // bank ends up measuring a merged field+armature current.
      (dc?.model as DCMachine | undefined)?.setShuntField(false);
      lab.place('load_bank', 30, 520);
      lab.place(RACK, 640, 520);

      wireAll(lab, [
        ['power_supply', 'DC+', 'dc_machine', 'A1'],
        ['dc_machine', 'A2', RACK, AM_IN],
        [RACK, AM_OUT, 'load_bank', 'A'],
        ['load_bank', 'B', 'power_supply', 'DC-'],
        ['power_supply', 'DC+', 'dc_machine', 'F1'],
        ['dc_machine', 'F2', 'power_supply', 'DC-'],
        [RACK, VM_P, 'dc_machine', 'A1'],
        [RACK, VM_N, 'dc_machine', 'A2']
      ]);
      lab.titleEl.textContent = 'Load Characteristics of a DC Machine';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vdc.on = true;
        m.rails.vdc.set = 220;
      });
      readAmps(lab);
    }
  },

  /* ── Sandbox · free bench ─────────────────────────────────────── */
  sandbox: {
    label: 'Free Sandbox',
    sub: 'empty bench \u00b7 wire anything',
    build(lab) { lab.clear(); },
    setup() { /* nothing to energise */ }
  }
};
