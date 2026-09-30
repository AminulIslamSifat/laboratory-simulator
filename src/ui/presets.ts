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
import type { DCSupply } from '../devices/index.js';
import type { Rheostat } from '../devices/rheostat/model.js';

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
 *                 (ammeter sense = N/R, see AM_IN/AM_OUT)
 */

/**
 * Set the rack's shared series ammeter to A mode.
 *
 * `d3` (AZ-VIDC) is an A-mode display that reads the rack's ONE series coil —
 * the current to be measured must pass through in -> out. Switching the
 * display to A is what makes the number visible; the wiring alone is not
 * enough because the default mode is V.
 */
function readAmps(lab: Lab): void {
  const rack = lab.devices.find((d) => d.kind === RACK);
  const m = rack?.model as { setDisplayMode?: (id: string, mode: string) => void } | undefined;
  if (m && typeof m.setDisplayMode === 'function') m.setDisplayMode('d3', 'A');
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
        // primary loop; the rack ammeter sits on the RETURN leg (N-R)
        ['power_supply', 'AC-L1', 'single_phase_transformer', 'P230'],
        ['single_phase_transformer', 'P0', RACK, AM_IN],
        [RACK, AM_OUT, 'power_supply', 'AC-N'],
        // ADDITIVE strap: primary return tied to the secondary START (2U1).
        // The 2U winding (400 V tap) is ~1.74x the primary, so the series
        // sum Va + Vs2 gives a large, unambiguous reading (~220 V) - unlike
        // the 3U winding, which is ~1:1 and makes the sum ~= the primary.
        ['single_phase_transformer', 'P0', 'single_phase_transformer', '2U1'],
        // voltmeter across the primary (Va) and the far end (Vc)
        [RACK, DIN_P, 'single_phase_transformer', 'P230'],
        [RACK, DIN_N, 'single_phase_transformer', '2U2']
      ]);
      lab.titleEl.textContent = 'Experiment 02 \u00b7 Polarity Test \u2014 Additive Connection';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 100;   // reduced voltage, as the procedure requires
      });
      readAmps(lab);
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
        // primary loop; the rack ammeter sits on the RETURN leg (N-R)
        ['power_supply', 'AC-L1', 'single_phase_transformer', 'P230'],
        ['single_phase_transformer', 'P0', RACK, AM_IN],
        [RACK, AM_OUT, 'power_supply', 'AC-N'],
        // SUBTRACTIVE strap: primary return tied to the secondary FAR end
        // (2U2). The windings oppose, so P230 against 2U2 now reads a small
        // Va - Vs2 instead of the additive Va + Vs2.
        ['single_phase_transformer', 'P0', 'single_phase_transformer', '2U2'],
        // meter across the SAME pair as the additive bench, so the display
        // path is identical between the two - only the strap differs.
        [RACK, DIN_P, 'single_phase_transformer', 'P230'],
        [RACK, DIN_N, 'single_phase_transformer', '2U1']
      ]);
      lab.titleEl.textContent = 'Experiment 02 \u00b7 Polarity Test \u2014 Subtractive Connection';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 100;   // reduced voltage, as the procedure requires
      });
      readAmps(lab);
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
        // Primary at rated voltage; the rack ammeter sits on the RETURN
        // leg (N-R), so it reads the no-load current I0.
        ['power_supply', 'AC-L1', 'single_phase_transformer', 'P230'],
        ['single_phase_transformer', 'P0', RACK, AM_IN],
        [RACK, AM_OUT, 'power_supply', 'AC-N'],
        // Secondary fully OPEN - no wire on 2U1/2U2 or the 3U winding. The
        // voltmeter reads the APPLIED PRIMARY voltage V0, because that is the
        // independent variable in this test; the secondary EMF is derived
        // from it by the turns ratio, not measured.
        [RACK, VM_P, 'single_phase_transformer', 'P230'],
        [RACK, VM_N, 'single_phase_transformer', 'P0']
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
      readAmps(lab);
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
        // primary at reduced voltage; the rack ammeter sits on the RETURN
        // leg (N-R)
        ['power_supply', 'AC-L1', 'single_phase_transformer', 'P230'],
        ['single_phase_transformer', 'P0', RACK, AM_IN],
        [RACK, AM_OUT, 'power_supply', 'AC-N'],
        // TOP 2U winding SHORTED on itself (2U1 to 2U2). The series coil is
        // already in the primary, so the short does not need to pass through
        // the rack. The bottom 3U winding is left unconnected.
        ['single_phase_transformer', '2U1', 'single_phase_transformer', '2U2'],
        // voltmeter across the primary to read the applied Vsc
        [RACK, VM_P, 'single_phase_transformer', 'P230'],
        [RACK, VM_N, 'single_phase_transformer', 'P0']
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
      readAmps(lab);
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
      lab.clear();
      lab.place('power_supply', 20, 20);

      // Prime mover + generator on a common centre line, with the coupling in
      // the gap between them. The coupling is a LOGIC device: MA/MB remember
      // which machine hangs off each port so the simulator's mechanical pass
      // can couple their rotors, and the wire layer draws the shaft lines.
      // Its own size is decoration, so it does NOT need its ports to touch
      // the machines - it just has to sit between them and not overlap.
      //
      // The 3φ motor sprite is drawn VERTICAL (shaft on its bottom face), so
      // it is rotated 270° to point that shaft right, toward the generator.
      // The generator keeps its native orientation (shaft on the right) and
      // is flipped 180° so the two shafts face each other.
      // The power supply occupies [20..405] x [20..459]. A 270° rotation is
      // about the device centre, so the motor's box extends LEFT of its
      // placement x by (h/2 - w/2) = 59.5px. Placing at 500 puts its left
      // edge at 440.5, clear of the supply's 405.
      const MOTOR_X = 500;
      const MOTOR_Y = 120;
      // Rotation is passed AT PLACEMENT, not set afterwards: place() renders
      // the device immediately, so a rot assigned on the next line was ignored
      // and the motor still stood vertical.
      lab.place('async_motor_3p', MOTOR_X, MOTOR_Y, 270);

      // Coupling sits in the clear gap after the motor (rotated box ends at
      // 979.5).
      lab.place('coupling', 1040, 240);

      // Generator, flipped 180°, placed clear of the coupling's right edge
      // (1240) with a gap.
      lab.place('dc_machine', 1320, 165, 180);

      // TWO rheostats: the FIELD unit (left) and the LOAD unit (right).
      // Same device kind, which is why the load cannot go through wireAll() -
      // that resolves an endpoint by KIND and would hand back the field unit
      // for both. wireAll() still wires the FIELD one because it is placed
      // first; the load unit is wired by id further down.
      lab.place('rheostat', 460, 700);
      const loadRh = lab.place('rheostat', 790, 700);
      lab.place(RACK, 1120, 700);

      wireAll(lab, [
        // Prime mover: 3φ motor in star, fed from the fixed 400 V line.
        // Lines on the phase STARTS (U1 V1 W1); star point on the ends.
        ['power_supply', '3P-L1', 'async_motor_3p', 'U1'],
        ['power_supply', '3P-L2', 'async_motor_3p', 'V1'],
        ['power_supply', '3P-L3', 'async_motor_3p', 'W1'],
        ['async_motor_3p', 'U2', 'async_motor_3p', 'V2'],
        ['async_motor_3p', 'V2', 'async_motor_3p', 'W2'],
        ['async_motor_3p', 'W2', 'power_supply', '3P-PE'],
        // mechanical link
        ['async_motor_3p', 'SHAFT', 'coupling', 'MA'],
        ['coupling', 'MB', 'dc_machine', 'SHAFT'],
        // Shunt field: A1 -> F1, the FIELD WINDING, then F2 -> rheostat -> A2.
        // The rheostat must sit in SERIES with the field winding. Wiring it
        // F1 -> rheostat -> F2 put it in PARALLEL with the winding, so the
        // 30 ohm rheostat shorted the 2500 ohm field and the machine drew
        // 5.6 A of field current instead of the rated 0.5 A.
        //
        // BOTH rheostat elements are in series here, not just A: the current
        // runs F2 -> A_TOP -> [RA] -> A_BOT -> B_TOP -> [RB] -> B_RED -> A2,
        // so the field sees RA + RB (up to 1000 ohm). That doubles the range
        // and gives finer control of the field current, which is what sets
        // the no-load terminal voltage.
        ['dc_machine', 'A1', 'dc_machine', 'F1'],
        ['dc_machine', 'F2', 'rheostat', 'A_TOP'],
        ['rheostat', 'A_BOT', 'rheostat', 'B_TOP'],
        ['rheostat', 'B_RED', 'dc_machine', 'A2'],
        // Load return; the rack ammeter sits on the RETURN leg (N-R). The
        // load rheostat's own wires are added by id below, not here.
        [RACK, AM_IN, 'dc_machine', 'A2'],
        // voltmeter across the terminals
        [RACK, VM_P, 'dc_machine', 'A1'],
        [RACK, VM_N, 'dc_machine', 'A2']
      ]);

      // Load rheostat, wired by id because it is the SECOND of its kind:
      // A1 -> A_TOP -> [RA] -> A_BOT -> B_TOP -> [RB] -> B_RED -> rack
      // ammeter -> A2. Both elements in series, so the load is a smooth
      // 0-1000 ohm - the lab's rheostat-on-the-return-leg, not a stepped bank.
      const dcEntry = lab.devices.find((d) => d.kind === 'dc_machine');
      const rackEntry = lab.devices.find((d) => d.kind === RACK);
      if (loadRh && dcEntry && rackEntry) {
        lab.wiring.add(dcEntry.id, 'A1', loadRh.id, 'A_TOP');
        lab.wiring.add(loadRh.id, 'A_BOT', loadRh.id, 'B_TOP');
        lab.wiring.add(loadRh.id, 'B_RED', rackEntry.id, AM_OUT);
      }
      lab.titleEl.textContent = 'Experiment 04 \u00b7 DC Shunt Generator \u2014 External Characteristic';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.f3p.on = true;   // fixed 400 V 3phi line drives the prime mover
      });
      // The reference sets the field rheostat to give 220 V at no load, at
      // which point the field current is 0.088 A. With a 2500 ohm field that
      // means almost no added resistance - the machine self-excites on the
      // residual flux and the rheostat is trimmed from near zero.
      // Two rheostats: [0] is the FIELD unit, [1] the LOAD unit. modelOf()
      // returns the FIRST of a kind, so it can only ever reach the field one -
      // index into the placed list instead.
      const rhs = lab.devices
        .filter((d) => d.kind === 'rheostat')
        .map((d) => d.model as unknown as Rheostat);
      // Field trimmed near zero: the machine self-excites on residual flux and
      // reaches ~220 V at no load with almost no added field resistance.
      if (rhs[0]) { rhs[0].posA = 0.03; rhs[0].posB = 0.03; }
      // Load at max resistance = lightest load, the start of the
      // characteristic. Wind it down to pull current.
      if (rhs[1]) { rhs[1].posA = 1; rhs[1].posB = 1; }

      // The load current is read off the shared series coil (d3, A mode).
      readAmps(lab);
    }
  },

  /* ── Exp 05 · 1phi induction motor, capacitor start ───────────── */
  exp05_single_phase: {
    label: 'Exp 05 \u00b7 1\u03c6 Async Motor',
    sub: 'M-R/CV \u00b7 C = 12.5 \u00b5F',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('async_motor_1p', 520, 60);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        // Main winding through the rack's series ammeter coil.
        // U1-U2 is the main (run) winding. There is no 'Run' jack.
        ['power_supply', 'AC-L1', 'async_motor_1p', 'U1'],
        ['async_motor_1p', 'U2', RACK, AM_IN],
        [RACK, AM_OUT, 'power_supply', 'AC-N'],
        // Auxiliary winding in series with the starting capacitor.
        // Z1-Z2 is the auxiliary winding; C-C2 is the capacitor.
        ['power_supply', 'AC-L1', 'async_motor_1p', 'Z1'],
        ['async_motor_1p', 'Z2', 'async_motor_1p', 'C'],
        ['async_motor_1p', 'C2', 'power_supply', 'AC-N'],
        // Voltmeter across the main winding.
        [RACK, VM_P, 'async_motor_1p', 'U1'],
        [RACK, VM_N, 'async_motor_1p', 'U2']
      ]);
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
      lab.place('dc_machine', 460, 30);
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
