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
import type { DCSupply } from '../devices/index.js';
import type { Rheostat } from '../devices/rheostat/model.js';
import type { LoadBank } from '../devices/load-bank/model.js';

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
  list.forEach((w) => {
    const A = lab.devices.find((d) => d.kind === w[0]);
    const B = lab.devices.find((d) => d.kind === w[2]);
    if (A && B) lab.wiring.add(A.id, w[1], B.id, w[3]);
  });
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
const VM_P = 'A1';      // rack voltmeter, + post
const VM_N = 'R';       // rack voltmeter, - post
const AM_IN = 'in';     // rack series ammeter coil, in
const AM_OUT = 'out';   // rack series ammeter coil, out

/** Find a placed device's model by kind, typed. */
function modelOf<T>(lab: Lab, kind: string): T | undefined {
  const d = lab.devices.find((x) => x.kind === kind);
  return d ? (d.model as unknown as T) : undefined;
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

  /* ── Exp 02 · Polarity test of a 1phi transformer ────────────────
     One primary terminal is strapped to one secondary terminal, a reduced
     AC voltage Va is applied to the primary, and Vc is measured across the
     two remaining terminals. Vc > Va means additive, Vc < Va subtractive. */
  exp02_polarity: {
    label: 'Exp 02 \u00b7 Transformer Polarity',
    sub: '1\u03c6 transformer \u00b7 additive / subtractive',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('single_phase_transformer', 520, 40);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        // primary loop through the rack's series ammeter coil
        ['power_supply', 'AC-L1', RACK, AM_IN],
        [RACK, AM_OUT, 'single_phase_transformer', 'P230'],
        ['single_phase_transformer', 'P0', 'power_supply', 'AC-N'],
        // the polarity strap: primary return tied to the secondary start
        ['single_phase_transformer', 'P0', 'single_phase_transformer', '3U2'],
        // voltmeter across the primary (Va) and the two open ends (Vc)
        [RACK, VM_P, 'single_phase_transformer', 'P230'],
        [RACK, VM_N, 'single_phase_transformer', '3U1']
      ]);
      lab.titleEl.textContent = 'Experiment 02 \u00b7 Polarity Test of a Single-Phase Transformer';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 100;   // reduced voltage, as the procedure requires
      });
    }
  },

  /* ── Exp 03 · Transformer parameters by OC / SC test ─────────────
     Open-circuit bench: rated voltage on the primary, secondary open, and
     the rack reading V0 and I0. Short the secondary through the ammeter to
     run the short-circuit half. */
  exp03_oc_sc: {
    label: 'Exp 03 \u00b7 Transformer OC / SC',
    sub: '1\u03c6 transformer \u00b7 R0 X0 Req Xeq',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('single_phase_transformer', 520, 40);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        ['power_supply', 'AC-L1', RACK, AM_IN],
        [RACK, AM_OUT, 'single_phase_transformer', 'P230'],
        ['single_phase_transformer', 'P0', 'power_supply', 'AC-N'],
        [RACK, VM_P, 'single_phase_transformer', 'P230'],
        [RACK, VM_N, 'single_phase_transformer', 'P0']
      ]);
      lab.titleEl.textContent = 'Experiment 03 \u00b7 Transformer Parameters by Open- and Short-Circuit Test';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vac.on = true;
        m.rails.vac.set = 230;   // rated primary voltage for the OC test
      });
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
      lab.place('async_motor_3p', 450, 20);
      lab.place('coupling', 850, 150);
      lab.place('dc_machine', 1100, 20);
      lab.place('rheostat', 450, 540);
      lab.place('load_bank', 820, 540);
      lab.place(RACK, 1120, 540);

      wireAll(lab, [
        // prime mover: 3phi motor in star, fed from the fixed 400 V line
        ['power_supply', '3P-L1', 'async_motor_3p', 'W2'],
        ['power_supply', '3P-L2', 'async_motor_3p', 'U2'],
        ['power_supply', '3P-L3', 'async_motor_3p', 'W1'],
        ['async_motor_3p', 'B1', 'async_motor_3p', 'B2'],
        ['async_motor_3p', 'B2', 'async_motor_3p', 'C2'],
        ['async_motor_3p', 'C2', 'power_supply', '3P-PE'],
        // mechanical link
        ['async_motor_3p', 'SHAFT', 'coupling', 'MA'],
        ['coupling', 'MB', 'dc_machine', 'SHAFT'],
        // Shunt field: A1 -> F1, the FIELD WINDING, then F2 -> rheostat -> A2.
        // The rheostat must sit in SERIES with the field winding. Wiring it
        // F1 -> rheostat -> F2 put it in PARALLEL with the winding, so the
        // 30 ohm rheostat shorted the 2500 ohm field and the machine drew
        // 5.6 A of field current instead of the rated 0.5 A.
        ['dc_machine', 'A1', 'dc_machine', 'F1'],
        ['dc_machine', 'F2', 'rheostat', 'A_TOP'],
        ['rheostat', 'A_BOT', 'dc_machine', 'A2'],
        // load through the rack's series ammeter coil
        ['dc_machine', 'A1', RACK, AM_IN],
        [RACK, AM_OUT, 'load_bank', 'A'],
        ['load_bank', 'B', 'dc_machine', 'A2'],
        // voltmeter across the terminals
        [RACK, VM_P, 'dc_machine', 'A1'],
        [RACK, VM_N, 'dc_machine', 'A2']
      ]);
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
      const rh = modelOf<Rheostat>(lab, 'rheostat');
      if (rh) rh.pos = 0.03;
      // Start on a light load; step it in to trace the characteristic.
      const lb = modelOf<LoadBank>(lab, 'load_bank');
      if (lb) lb.step = 4;
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
        // main winding through the rack's series ammeter coil
        ['power_supply', 'AC-L1', RACK, AM_IN],
        [RACK, AM_OUT, 'async_motor_1p', 'Run'],
        ['async_motor_1p', 'U2', 'power_supply', 'AC-N'],
        // auxiliary winding in series with the starting capacitor
        ['power_supply', 'AC-L1', 'async_motor_1p', 'Aux2'],
        ['async_motor_1p', 'Z2', 'async_motor_1p', 'C'],
        ['async_motor_1p', 'C2', 'power_supply', 'AC-N'],
        // voltmeter across the main winding
        [RACK, VM_P, 'async_motor_1p', 'Run'],
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
    }
  },

  /* ── Exp 06 · Synchronous reactance, OC / SC test ────────────────
     Field is fed from the variable DC rail through the rheostat. The U-phase
     is left open so the voltmeter reads Voc; the V-phase is shorted through
     the rack ammeter so the same run also yields Isc at that field current.
     Zs = Voc / Isc, and Xs = sqrt(Zs^2 - Ra^2). */
  exp06_sync: {
    label: 'Exp 06 \u00b7 Sync Generator Xs',
    sub: 'GMS \u00b7 OC + SC test',
    build(lab) {
      lab.clear();
      lab.place('power_supply', 30, 30);
      lab.place('sync_gen', 560, 60);
      lab.place('rheostat', 600, 300);
      lab.place(RACK, 30, 520);

      wireAll(lab, [
        // field: DC+ -> rheostat -> F1, F2 -> DC-
        ['power_supply', 'DC+', 'rheostat', 'A_TOP'],
        ['rheostat', 'A_BOT', 'sync_gen', 'F1'],
        ['sync_gen', 'F2', 'power_supply', 'DC-'],
        // open-circuit voltage across the U phase
        [RACK, VM_P, 'sync_gen', 'U1'],
        [RACK, VM_N, 'sync_gen', 'U2'],
        // short-circuit current through the V phase, via the series coil
        [RACK, AM_IN, 'sync_gen', 'V1'],
        [RACK, AM_OUT, 'sync_gen', 'V2']
      ]);
      lab.titleEl.textContent = 'Experiment 06 \u00b7 Synchronous Generator \u2014 OC / SC Test for Xs';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.vdc.on = true;
        m.rails.vdc.set = 50;    // first field-current step in the table
      });
      const rh = modelOf<Rheostat>(lab, 'rheostat');
      if (rh) rh.pos = 0.5;
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
        ['power_supply', '3P-L1', RACK, AM_IN],
        [RACK, AM_OUT, 'async_motor_3p', 'W2'],
        ['power_supply', '3P-L2', 'async_motor_3p', 'U2'],
        ['power_supply', '3P-L3', 'async_motor_3p', 'W1'],
        ['async_motor_3p', 'B1', 'async_motor_3p', 'B2'],
        ['async_motor_3p', 'B2', 'async_motor_3p', 'C2'],
        ['async_motor_3p', 'C2', 'power_supply', '3P-PE'],
        [RACK, VM_P, 'async_motor_3p', 'W2'],
        [RACK, VM_N, 'async_motor_3p', 'U2']
      ]);
      lab.titleEl.textContent = 'Three-Phase Asynchronous Motor \u2014 Direct-On-Line Starting';
      lab.fitView();
    },
    setup(lab) {
      energise(lab, (m) => {
        m.rails.f3p.on = true;
      });
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
