// EEE-2152 Lab · Experiment presets
//
// One preset per experiment in References/experiment/. Every bench carries
// the AV-1/EV power supply and the AZ-VIPS/VIDC measurement rack, because
// every experiment in the course is performed on that bench.
//
// TERMINAL NAMES ARE THE SPRITE'S PRINTED JACKS. lab.place() overwrites each
// model's `terminals` with reg.layout.terms, and Netlist.computeNets() drops
// any wire whose endpoint is not a declared terminal — silently, with no
// error. A wire to a jack that does not exist is therefore invisible at
// runtime, which is why the rack's real posts are listed here and used
// verbatim:
//
//   rack voltmeter  A1 (+) / R (−)      high-Z, parallels the load
//   rack ammeter    DIN1+ / DIN1−       0.01 Ω shunt, wired in series
//   rack wattmeter  V across A1/R, I through the in/out series coil
//
// The rack has no V+ / V− posts. The presets used to wire those, so ten
// wires across five benches never reached the solver.
//
// Each preset also declares setup(lab): the supply model boots with every
// rail OFF, so a bench that is only placed and wired sits dead. setup()
// closes the isolator, selects the rail and winds the variac to the value
// the experiment calls for.
(function (root) {
'use strict';
const EEE = root.EEE;

// ── wiring helper: array of [aKind, aTerm, bKind, bTerm] ──────────
function wireAll(lab, list) {
  list.forEach(function (w) {
    const A = lab.devices.find(function (d) { return d.kind === w[0]; });
    const B = lab.devices.find(function (d) { return d.kind === w[2]; });
    if (A && B) lab.wiring.add(A.id, w[1], B.id, w[3]);
  });
}

// ── energise helper ───────────────────────────────────────────────
// The supply model is five independent rails behind a master isolator and
// an e-stop latch. Booting it means: clear the latch, close the isolator,
// then select and set the rail this experiment actually uses.
function energise(lab, cfg) {
  const psu = lab.devices.find(function (d) { return d.kind === 'power_supply'; });
  if (!psu) return;
  const m = psu.model;
  m.estop = false;
  m.master = true;
  m.enabled = true;
  m.warn = '';
  if (cfg) cfg(m);
}

const RACK = 'meter_rack';
const VM_P = 'A1';      // rack voltmeter, + post
const VM_N = 'R';       // rack voltmeter, − post
const AM_IN = 'in';     // rack series ammeter coil, in
const AM_OUT = 'out';   // rack series ammeter coil, out

// The rack has ONE ammeter movement (the in/out 0.01 Ω coil) and multiple
// high-Z displays. A current measurement must therefore be wired THROUGH
// in/out; the display posts only ever sense voltage. Wiring a load across a
// display's own posts leaves the circuit open, and — because the DIN bay's
// two columns are bonded — used to short the supply outright.

const PRESETS = {

  // ══ Exp 01 · Nameplate study — every machine side by side ══
  // Read with the power OFF. The supply and rack are on the bench because
  // the procedure says to record ratings with the supply isolated; nothing
  // is wired and nothing is energised.
  exp01_nameplate: {
    label: 'Exp 01 · Nameplate Study',
    sub: 'All machines · rated data',
    title: 'Experiment 01 · Study of Nameplate Ratings and Rated Speed',
    build: function (lab) {
      lab.clear();
      lab.place('dc_machine',         30,  30);
      lab.place('async_motor_3p',    380,  30);
      lab.place('sync_gen',          760,  30);
      lab.place('async_motor_1p',     30,  400);
      lab.place('single_phase_transformer', 430, 430);
      lab.place('rheostat',          760, 430);
      lab.place('power_supply',       30,  760);
      lab.place(RACK,                600,  760);
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function () { /* nameplate study — supply stays isolated */ }
  },

  // ══ Exp 02 · Polarity test of a 1φ transformer ══
  // One primary terminal is strapped to one secondary terminal, a reduced AC
  // voltage Va is applied to the primary, and Vc is measured across the two
  // remaining terminals.  Vc > Va ⇒ additive, Vc < Va ⇒ subtractive.
  exp02_polarity: {
    label: 'Exp 02 · Transformer Polarity',
    sub: '1φ transformer · additive / subtractive',
    title: 'Experiment 02 · Polarity Test of a Single-Phase Transformer',
    build: function (lab) {
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
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function (lab) {
      energise(lab, function (m) {
        m.rails.vac.on = true;
        m.rails.vac.set = 100;   // reduced voltage, as the procedure requires
      });
    }
  },

  // ══ Exp 03 · Transformer parameters by OC / SC test ══
  // Open-circuit bench: rated voltage on the primary, secondary open, and
  // the rack reading V₀ and I₀. Short the secondary through the ammeter to
  // run the short-circuit half.
  exp03_oc_sc: {
    label: 'Exp 03 · Transformer OC / SC',
    sub: '1φ transformer · R₀ X₀ Req Xeq',
    title: 'Experiment 03 · Transformer Parameters by Open- and Short-Circuit Test',
    build: function (lab) {
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
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function (lab) {
      energise(lab, function (m) {
        m.rails.vac.on = true;
        m.rails.vac.set = 230;   // rated primary voltage for the OC test
      });
    }
  },

  // ══ Exp 04 · DC shunt generator — external characteristic ══
  // The prime mover is the 3φ induction motor, coupled to the DC machine by
  // a shaft coupling — not a scripted primeRpm. Field is taken from the
  // armature through a rheostat, which is what makes it a SHUNT machine and
  // gives the characteristic its steep droop.
  exp04_dcgen: {
    label: 'Exp 04 · DC Shunt Generator',
    sub: 'motor-coupled · V_t vs I_L',
    title: 'Experiment 04 · DC Shunt Generator — External Characteristic',
    build: function (lab) {
      lab.clear();
      lab.place('power_supply',   20,  20);
      lab.place('async_motor_3p', 450,  20);
      lab.place('coupling',       850, 150);
      lab.place('dc_machine',    1100,  20);
      lab.place('rheostat',       450, 540);
      lab.place('load_bank',      820, 540);
      lab.place(RACK,            1120, 540);

      wireAll(lab, [
        // prime mover: 3φ motor in star, fed from the fixed 400 V line
        ['power_supply', '3P-L1', 'async_motor_3p', 'W2'],
        ['power_supply', '3P-L2', 'async_motor_3p', 'U2'],
        ['power_supply', '3P-L3', 'async_motor_3p', 'W1'],
        ['async_motor_3p', 'B1', 'async_motor_3p', 'B2'],
        ['async_motor_3p', 'B2', 'async_motor_3p', 'C2'],
        ['async_motor_3p', 'C2', 'power_supply', '3P-PE'],
        // mechanical link
        ['async_motor_3p', 'SHAFT', 'coupling', 'MA'],
        ['coupling', 'MB', 'dc_machine', 'SHAFT'],
        // Shunt field: A1 → F1, the FIELD WINDING, then F2 → rheostat → A2.
        // The rheostat must sit in SERIES with the field winding. Wiring it
        // F1 → rheostat → F2 put it in PARALLEL with the winding, so the
        // 30 Ω rheostat shorted the 250 Ω field and the machine drew 5.6 A
        // of field current instead of the rated 0.5 A.
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
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function (lab) {
      energise(lab, function (m) {
        m.rails.f3p.on = true;   // fixed 400 V 3φ line drives the prime mover
      });
      // The reference sets the field rheostat to give 220 V at no load, at
      // which point the field current is 0.088 A. With a 2500 Ω field that
      // means almost no added resistance — the machine self-excites on the
      // residual flux and the rheostat is trimmed from near zero.
      const rh = lab.devices.find(function (d) { return d.kind === 'rheostat'; });
      if (rh) rh.model.pos = 0.03;
      // Start on a light load; step it in to trace the characteristic.
      const lb = lab.devices.find(function (d) { return d.kind === 'load_bank'; });
      if (lb) lb.model.step = 4;
    }
  },

  // ══ Exp 05 · 1φ induction motor — capacitor start ══
  exp05_single_phase: {
    label: 'Exp 05 · 1φ Async Motor',
    sub: 'M-R/CV · C = 12.5 µF',
    title: 'Experiment 05 · Single-Phase Induction Motor — Capacitor Start',
    build: function (lab) {
      lab.clear();
      lab.place('power_supply',     30,  30);
      lab.place('async_motor_1p',  520,  60);
      lab.place(RACK,               30, 520);

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
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function (lab) {
      energise(lab, function (m) {
        m.rails.vac.on = true;
        m.rails.vac.set = 230;
      });
    }
  },

  // ══ Exp 06 · Synchronous reactance — OC / SC test ══
  // Field is fed from the variable DC rail through the rheostat. The U-phase
  // is left open so the voltmeter reads Voc; the V-phase is shorted through
  // the rack ammeter so the same run also yields Isc at that field current.
  // Zs = Voc / Isc, and Xs = √(Zs² − Ra²).
  exp06_sync: {
    label: 'Exp 06 · Sync Generator Xs',
    sub: 'GMS · OC + SC test',
    title: 'Experiment 06 · Synchronous Generator — OC / SC Test for Xs',
    build: function (lab) {
      lab.clear();
      lab.place('power_supply',  30,  30);
      lab.place('sync_gen',     560,  60);
      lab.place('rheostat',     600, 300);
      lab.place(RACK,            30, 520);

      wireAll(lab, [
        // field: DC+ → rheostat → F1, F2 → DC−
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
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function (lab) {
      energise(lab, function (m) {
        m.rails.vdc.on = true;
        m.rails.vdc.set = 50;    // first field-current step in the table
      });
      const rh = lab.devices.find(function (d) { return d.kind === 'rheostat'; });
      if (rh) rh.model.pos = 0.5;
    }
  },

  // ══ Extra · 3φ asynchronous motor, direct-on-line ══
  // Kept from the original bench: it is a valid starting-current study and
  // the 3φ line is now actually switched on.
  exp07_async3p: {
    label: 'Extra · 3φ Motor DOL Start',
    sub: 'M-4/EV · star connection',
    title: 'Three-Phase Asynchronous Motor — Direct-On-Line Starting',
    build: function (lab) {
      lab.clear();
      lab.place('power_supply',   30,  30);
      lab.place('async_motor_3p', 460,  30);
      lab.place(RACK,             30, 560);

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
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function (lab) {
      energise(lab, function (m) {
        m.rails.f3p.on = true;
      });
    }
  },

  // ══ Extra · DC machine load test ══
  exp08_dcload: {
    label: 'Extra · DC Machine Load Test',
    sub: 'M1-2/EV + load bank',
    title: 'Load Characteristics of a DC Machine',
    build: function (lab) {
      lab.clear();
      lab.place('power_supply', 30,  30);
      lab.place('dc_machine',  460,  30);
      lab.place('load_bank',    30, 520);
      lab.place(RACK,          640, 520);

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
      lab.titleEl.textContent = this.title;
      lab.fitView();
    },
    setup: function (lab) {
      energise(lab, function (m) {
        m.rails.vdc.on = true;
        m.rails.vdc.set = 220;
      });
    }
  },

  // ══ Sandbox · free bench ══
  sandbox: {
    label: 'Free Sandbox',
    sub: 'empty bench · wire anything',
    title: 'Sandbox · Free Wiring',
    build: function (lab) { lab.clear(); },
    setup: function () {}
  }
};

root.EEE = root.EEE || {};
root.EEE.PRESETS = PRESETS;

})(typeof window !== 'undefined' ? window : globalThis);
