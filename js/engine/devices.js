// EEE Lab Simulator - Device Library
(function (root) {
'use strict';
const EEE = root.EEE;

let _idc = 0;
function uid(p) { return p + '_' + (++_idc) + '_' + Math.random().toString(36).slice(2, 6); }

/* ═══════════════════════════════════════════════════════════════════
   AV-1/EV POWER SUPPLY — five independent rails

   The panel is one box but it is NOT one source. It exposes:
     · variable 3φ AC     AC-L1/L2/L3 / AC-N   0–440 V LL, 50/60 Hz
     · variable DC        DC+ / DC-            0–250 V, smoothed
     · fixed 3φ 400 V     3P-L1..L3 / 3P-PE   400 V LL
     · fixed 6/12/24 V    DC+24 / DC-24        tap selected
     · fixed 50 V         DC+50 / DC-50

   WHY SNAPSHOTS AND NOT A ROTATING WAVEFORM
   A balanced 3φ set is sampled as ONE INSTANT — the peak of L1, i.e.
   (A, −A/2, −A/2). Rotating a phase clock frame to frame would not give a
   nicer motor: the solver steps at ~16.7 ms against a 20 ms mains period,
   so a real phase clock aliases. Motor3P.update() consumes `Iline` as a mean
   of |i| across windings and squares it into torque — fed an aliased phase
   it would thrash. The frozen operating point is what this solver can
   actually integrate, so rails stay balanced snapshots, the VARIAC drives
   amplitude, and `f` is a genuine parameter that propagates to connected
   machines (Ns = 120f/p finally responds).

   WHY `open` MATTERS
   A rail that is switched off must be ABSENT from the MNA stamp, not
   present at V=0. An ideal 0 V source is a dead short across its own
   terminals — it would clamp every net it touches to ground and silently
   short the bench. See core.js: aux rails with `open:true` are skipped.
   ═══════════════════════════════════════════════════════════════════ */
function DCSupply(opts) {
  opts = opts || {};
  this.id = opts.id || uid('vdc');
  this.type = 'dc_supply';
  this.label = opts.label || 'Power Supply AV-1/EV';
  this.terminals = opts.terminals || { '+': 1, '-': 1 };

  // Main stamped source = the variable DC rail. `pos`/`neg` point at the
  // DC+ / DC- printed jacks when live; when the rail is off they are aimed
  // at names that do not exist, so netOf() returns undefined and core.js
  // skips the stamp entirely. That is how "off" avoids becoming a 0 V short.
  this.pos = opts.pos || 'DC+';
  this.neg = opts.neg || 'DC-';
  this._posLive = this.pos;
  this._negLive = this.neg;
  this._posOff  = '__vdc_off_p';
  this._negOff  = '__vdc_off_n';

  this.V = opts.V != null ? opts.V : 0;
  this._Veff = this.V;
  this.Imax = opts.Imax != null ? opts.Imax : 3.5;
  this.enabled = false;
  this.I = 0;
  this._vsIndex = -1;

  // ── master state ───────────────────────────────────────────────
  this.master = false;      // main isolator (AEG breaker + MAIN SWITCH)
  this.estop = false;       // latching emergency mushroom
  this.thermal = new EEE.Thermal({ C: 800, Rth: 0.4, Tmax: 90, Tburn: 200 });
  this.warn = '';
  this.smoke = 0;

  // ── per-rail state ─────────────────────────────────────────────
  // `set` is the user's demand, `V` the actual output (soft-started),
  // `tripped` latches a breaker until RESET, `I` the measured current.
  this.rails = {
    vdc: { key: 'vdc', label: 'Variable DC',     on: false, set: 0,   V: 0,   Vmax: 250, Imax: 3.5, trip: 4.2, I: 0, T: 25, tripped: false, tau: 0.25, overT: 0, tripDelay: 1.5 },
    // The variable AC line feeds the 1φ motor in Exp 05, whose reference
    // observation records 3.5 A without the starting capacitor. A 2 A rail
    // tripped before the motor reached rated voltage, so the experiment could
    // never be performed. The panel prints this output in the 3–4 A class.
    vac: { key: 'vac', label: 'Variable AC 3φ',  on: false, set: 0,   V: 0,   Vmax: 440, Imax: 4,   trip: 4.5, I: 0, T: 25, tripped: false, tau: 0.35, f: 50, overT: 0, tripDelay: 1.5 },
    f3p: { key: 'f3p', label: 'Fixed 3φ 400 V',  on: false, set: 400, V: 400, Vmax: 400, Imax: 10,  trip: 12,  I: 0, T: 25, tripped: false, tau: 0, overT: 0, tripDelay: 2.0 },
    d24: { key: 'd24', label: 'Fixed 6/12/24 V', on: false, set: 24,  V: 24,  Vmax: 24,  Imax: 2,   trip: 2.4, I: 0, T: 25, tripped: false, tau: 0, tap: 24, taps: [6, 12, 24], overT: 0, tripDelay: 2.0 },
    d50: { key: 'd50', label: 'Fixed 50 V',      on: false, set: 50,  V: 50,  Vmax: 50,  Imax: 2,   trip: 2.4, I: 0, T: 25, tripped: false, tau: 0, overT: 0, tripDelay: 2.0 }
  };
  this._railIacc = {};

  // Per-rail thermal stores. Small supplies heat fast under a short.
  this.railThermal = {
    vdc: new EEE.Thermal({ C: 600, Rth: 0.5, Tmax: 95,  Tburn: 220 }),
    vac: new EEE.Thermal({ C: 700, Rth: 0.6, Tmax: 95,  Tburn: 220 }),
    f3p: new EEE.Thermal({ C: 900, Rth: 0.4, Tmax: 100, Tburn: 240 }),
    d24: new EEE.Thermal({ C: 400, Rth: 0.9, Tmax: 90,  Tburn: 200 }),
    d50: new EEE.Thermal({ C: 400, Rth: 0.9, Tmax: 90,  Tburn: 200 })
  };

  // ── front-panel displays ───────────────────────────────────────
  // Shape matches MeterRack so lab.js's existing `.mbtn` plumbing and
  // _updateSpriteReadouts() work untouched: each channel needs {id, mode}
  // and setDisplayMode() must be present on the model.
  this.channels = [
    { id: 'm1', label: 'VAR AC', mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false },
    { id: 'm2', label: 'VAR DC', mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false },
    { id: 'm3', label: '3φ 400', mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false },
    { id: 'm4', label: 'DC LV',  mode: 'V', V: 0, I: 0, F: 0, shown: 0, over: false }
  ];
  this.VRange = 500;
  this.IRange = 12;

  // Rebuilt every frame by refreshRails(); core.js reads this.
  this.auxLines = [];
  this.refreshRails();
}

/* ── peak phase-to-neutral for a balanced set ──────────────────────
   A 3φ line at Vll volts has phase voltage Vll/√3 RMS, so the peak is
   Vll/√3·√2. Sampling at the instant L1 peaks gives (A, −A/2, −A/2),
   which sums to zero — mandatory, since the "neutral" reference is only
   meaningful if the three line potentials balance. */
DCSupply.prototype._peak = function (Vll) {
  return (Vll / Math.sqrt(3)) * Math.SQRT2;
};

/* ── rebuild the rail table from current switch state ──────────────
   Called by core.js at the TOP of every solve, before stamping, so a
   breaker that tripped last frame is already absent this frame. */
DCSupply.prototype.refreshRails = function () {
  const live = this.enabled && this.master && !this.estop;
  const R = this.rails;
  const self = this;
  const lines = [];

  // A rail is live only if the master is on, its own switch is on, its
  // breaker has not tripped, and it actually has a non-zero demand.
  function railLive(r) {
    if (!live || !r.on || r.tripped) return false;
    if ((r.key === 'vdc' || r.key === 'vac') && r.V < 0.5) return false;
    return true;
  }

  // ── variable 3φ AC ──
  if (railLive(R.vac)) {
    const A = self._peak(R.vac.V);
    lines.push({ rail: 'vac', pos: 'AC-L1', neg: 'AC-N', V:  A,     Imax: R.vac.Imax, f: R.vac.f });
    lines.push({ rail: 'vac', pos: 'AC-L2', neg: 'AC-N', V: -A / 2, Imax: R.vac.Imax, f: R.vac.f });
    lines.push({ rail: 'vac', pos: 'AC-L3', neg: 'AC-N', V: -A / 2, Imax: R.vac.Imax, f: R.vac.f });
  } else {
    lines.push({ rail: 'vac', pos: 'AC-L1', neg: 'AC-N', open: true });
    lines.push({ rail: 'vac', pos: 'AC-L2', neg: 'AC-N', open: true });
    lines.push({ rail: 'vac', pos: 'AC-L3', neg: 'AC-N', open: true });
  }

  // ── fixed 3φ 400 V ──
  if (railLive(R.f3p)) {
    const A = self._peak(R.f3p.V);
    lines.push({ rail: 'f3p', pos: '3P-L1', neg: '3P-PE', V:  A,     Imax: R.f3p.Imax });
    lines.push({ rail: 'f3p', pos: '3P-L2', neg: '3P-PE', V: -A / 2, Imax: R.f3p.Imax });
    lines.push({ rail: 'f3p', pos: '3P-L3', neg: '3P-PE', V: -A / 2, Imax: R.f3p.Imax });
  } else {
    lines.push({ rail: 'f3p', pos: '3P-L1', neg: '3P-PE', open: true });
    lines.push({ rail: 'f3p', pos: '3P-L2', neg: '3P-PE', open: true });
    lines.push({ rail: 'f3p', pos: '3P-L3', neg: '3P-PE', open: true });
  }

  // ── fixed low-voltage DC (6/12/24) ──
  lines.push(railLive(R.d24)
    ? { rail: 'd24', pos: 'DC+24', neg: 'DC-24', V: R.d24.V, Imax: R.d24.Imax }
    : { rail: 'd24', pos: 'DC+24', neg: 'DC-24', open: true });

  // ── fixed 50 V DC ──
  lines.push(railLive(R.d50)
    ? { rail: 'd50', pos: 'DC+50', neg: 'DC-50', V: R.d50.V, Imax: R.d50.Imax }
    : { rail: 'd50', pos: 'DC+50', neg: 'DC-50', open: true });

  this.auxLines = lines;

  // Main stamped source follows the variable DC rail. When it is dead we
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
  this._railIacc = {};
};

/* ── per-rail current report, called from core.js during the solve ──
   Fires once per fold-back iteration AND once after the final solve, so we
   keep the MAX rather than summing — summing would multiply the reading by
   the iteration count. */
DCSupply.prototype.noteRailCurrent = function (rail, i, imax) {
  if (!rail || !isFinite(i)) return;
  const a = this._railIacc;
  a[rail] = Math.max(a[rail] || 0, i);
};

/* ── control dispatch (panel switches, dials, selectors) ───────────
   lab.js sends {id, value}. Every control the sprite declares lands here. */
DCSupply.prototype.setControl = function (id, value) {
  const R = this.rails;
  switch (id) {
    case 'master':
      this.master = !!value;
      if (!this.master) this.enabled = false;
      break;

    case 'estop':
      // Emergency mushroom latches. Pressing it kills everything and it STAYS
      // down until START is pressed — that is the whole point of an emergency
      // stop, it must not be self-clearing.
      this.estop = !!value;
      if (this.estop) { this.master = false; this.enabled = false; }
      break;

    case 'start':
      // START clears the e-stop latch, re-arms the isolator AND restores the
      // main contactor. Setting `master` alone was not enough: e-stop had
      // already forced enabled=false, and nothing else in the model turns
      // that back on. In the running lab Lab._loop() force-enables every
      // supply each frame and masked this, which is exactly the kind of bug
      // that only shows up headless.
      this.estop = false;
      this.master = true;
      this.enabled = true;
      this.warn = '';
      break;

    case 'reset':
      // Breaker RESET: clear every tripped rail and cool it back down. Does
      // NOT re-energise — the rail switch must be closed by hand afterwards,
      // exactly like real gear. Clearing `tripped` without also dropping `on`
      // let a tripped rail spring straight back to full output the instant
      // RESET was pressed, because the rail switch was still latched closed.
      for (const k in R) {
        if (R[k].tripped) R[k].on = false;
        R[k].tripped = false;
        R[k].T = 25;
      }
      for (const kk in this.railThermal) {
        const th = this.railThermal[kk];
        th.dead = false; th.damage = 0; th.T = 25; th.smoke = 0;
      }
      this.thermal.dead = false; this.thermal.damage = 0;
      this.thermal.T = 25; this.thermal.smoke = 0;
      this.smoke = 0;
      this.warn = '';
      break;

    case 'vdcOn':  R.vdc.on = !!value; break;
    case 'vdcV':   R.vdc.set = Math.max(0, Math.min(R.vdc.Vmax, value)); break;
    case 'vacOn':  R.vac.on = !!value; break;
    case 'vacV':   R.vac.set = Math.max(0, Math.min(R.vac.Vmax, value)); break;
    case 'vacF':   R.vac.f = (value >= 55) ? 60 : 50; break;
    case 'f3pOn':  R.f3p.on = !!value; break;
    case 'd24On':  R.d24.on = !!value; break;
    case 'd50On':  R.d50.on = !!value; break;

    case 'tap': {
      // Cycle 6 → 12 → 24 → 6. The 6/12/24 line is a tapped secondary, so
      // the output follows the tap immediately.
      const t = R.d24.taps;
      const i = t.indexOf(R.d24.tap);
      R.d24.tap = t[(i + 1) % t.length];
      R.d24.set = R.d24.tap;
      R.d24.V = R.d24.tap;
      break;
    }
  }
};

DCSupply.prototype.setDisplayMode = function (dispId, mode) {
  const c = this.channels.find(function (x) { return x.id === dispId; });
  if (!c || (mode !== 'V' && mode !== 'A' && mode !== 'F')) return;
  c.mode = mode;
  // Repoint immediately so a mode switch on a stopped bench still updates.
  c.shown = mode === 'V' ? c.V : mode === 'A' ? c.I : c.F;
  c.over = mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2
         : mode === 'A' ? Math.abs(c.I) > this.IRange * 1.2
         : false;
};

DCSupply.prototype.update = function (dt, sol) {
  const R = this.rails;
  const acc = this._railIacc || {};
  const live = this.enabled && this.master && !this.estop;

  // Master current = the variable DC rail's own source current.
  if (live && this._vsIndex >= 0 && sol.Ivs) {
    this.I = Math.abs(sol.Ivs[this._vsIndex] || 0);
  } else {
    this.I = 0;
  }

  // ── move each rail toward its demand, then service it ──
  for (const k in R) {
    const r = R[k];
    const th = this.railThermal[k];
    r.I = acc[k] || 0;

    // Soft start: only the continuously-variable rails ramp. A fixed line
    // comes up instantly because a tapped secondary has nothing to wind.
    if (r.tau > 0) {
      const target = (live && r.on && !r.tripped) ? r.set : 0;
      const a = Math.min(1, dt / r.tau);
      r.V += (target - r.V) * a;
      if (r.V < 0.05) r.V = 0;
    } else {
      r.V = (live && r.on && !r.tripped) ? r.set : 0;
    }

    // I²R loss across the pass element. The variable rails burn more because
    // they regulate; the fixed lines are stiff.
    const burden = (r.key === 'vdc' || r.key === 'vac') ? 0.06 : 0.02;
    th.step(dt, r.I * r.I * burden + (r.V > 0 ? 0.4 : 0));
    r.T = th.T;

    // A rail carrying well over its limit trips its breaker. The thermal
    // model is the slower backstop for a rail that cooks without quite
    // tripping on current alone.
    // ── breaker ──────────────────────────────────────────────────
    // An instantaneous threshold is UNREACHABLE on a regulated rail: the
    // CV/CC fold-back in core.js clamps the output at Imax and happily holds
    // it there forever, so the current can never exceed Imax by enough to
    // cross a higher instantaneous trip point. That is correct behaviour for
    // a bench supply (constant-current mode) but it means the breaker must
    // key off TIME SPENT AT THE LIMIT, exactly like a real thermal-magnetic
    // breaker with an inverse-time curve.
    //
    // Two ways to trip:
    //   · sustained current at/over the rail limit for tripDelay seconds
    //   · a hard overload past `trip` (a dead short through a fat wire)
    const atLimit = live && !r.tripped && r.I > r.Imax * 0.95;
    if (atLimit) r.overT += dt; else r.overT = Math.max(0, r.overT - dt * 2);

    // Inverse-time curve. Fold-back clamps EVERY overload to the same
    // current, so current alone cannot distinguish a dead short from a mild
    // overload. The depth of the fold can: a stiff short drags the regulated
    // output far below its setting, a mild overload barely dips it. Scale
    // the trip delay by that ratio, like a real thermal-magnetic breaker.
    let delay = r.tripDelay || 1.5;
    if (r.tau > 0 && this.V > 1) {
      const fold = (this._Veff != null ? this._Veff : this.V) / this.V;
      if (fold < 0.5)       delay = 0.15;   // hard short — trip almost at once
      else if (fold < 0.85) delay = 0.5;    // solid overload
    }

    if (!r.tripped && live) {
      if (r.I > r.trip) {
        r.tripped = true;
        r.on = false;
        this.warn = r.label + ' breaker tripped (overload)';
      } else if (atLimit && r.overT >= delay) {
        r.tripped = true;
        r.on = false;
        this.warn = r.label + ' breaker tripped (sustained ' +
                    r.I.toFixed(2) + ' A)';
      }
    }
    if (th.dead && !r.tripped) {
      r.tripped = true;
      r.on = false;
      this.warn = r.label + ' overheated';
    }
  }

  // Master thermal follows the variable DC rail — it is the one dissipating.
  this.thermal.step(dt, this.I * this.I * 0.02);
  if (this.thermal.dead) { this.enabled = false; this.master = false; }
  this.smoke = Math.max(
    this.thermal.smoke,
    this.railThermal.vdc.smoke,
    this.railThermal.vac.smoke
  );

  // ── front-panel displays ──
  // Each ESAM shows one rail. V / A / F are all computed every frame so a
  // mode switch never leaves a stale number under a fresh unit.
  const map = { m1: 'vac', m2: 'vdc', m3: 'f3p', m4: 'd24' };
  const self = this;
  this.channels.forEach(function (c) {
    const r = R[map[c.id]];
    if (!r) return;
    c.V = r.V;
    c.I = r.I;
    c.F = (r.key === 'vac' || r.key === 'f3p') ? (r.f || 50) : 0;
    c.shown = c.mode === 'V' ? c.V : c.mode === 'A' ? c.I : c.F;
    c.over = c.mode === 'V' ? Math.abs(c.V) > self.VRange * 1.2
           : c.mode === 'A' ? Math.abs(c.I) > self.IRange * 1.2
           : false;
  });

  this.Vactual = R.vdc.V;
  this.limiting = this.I > R.vdc.Imax * 0.98;
};

DCSupply.prototype.readouts = function () {
  const R = this.rails;
  const out = [];

  if (this.estop) out.push({ name: 'ESTOP', label: 'EMERGENCY STOP', value: 'LATCHED', unit: '', warn: true });
  if (this.warn)  out.push({ name: 'WARN',  label: 'Panel', value: this.warn, unit: '', warn: true });

  out.push({ name: 'vdcV', label: 'VAR DC · V',     value: R.vdc.V,  unit: 'V', warn: R.vdc.tripped });
  out.push({ name: 'vdcI', label: 'VAR DC · I',     value: R.vdc.I,  unit: 'A', warn: R.vdc.I > R.vdc.Imax });
  out.push({ name: 'vacV', label: 'VAR AC · V LL',  value: R.vac.V,  unit: 'V', warn: R.vac.tripped });
  out.push({ name: 'vacI', label: 'VAR AC · I',     value: R.vac.I,  unit: 'A', warn: R.vac.I > R.vac.Imax });
  out.push({ name: 'vacF', label: 'VAR AC · f',     value: R.vac.f,  unit: 'Hz' });
  out.push({ name: 'f3pI', label: '3φ 400 · I',     value: R.f3p.I,  unit: 'A', warn: R.f3p.tripped });
  out.push({ name: 'd24V', label: 'DC ' + R.d24.tap + ' V', value: R.d24.V, unit: 'V', warn: R.d24.tripped });
  out.push({ name: 'd50V', label: 'DC 50 V',        value: R.d50.V,  unit: 'V', warn: R.d50.tripped });
  out.push({ name: 'T',    label: 'Pass element',   value: this.thermal.T, unit: '\u00B0C', warn: this.thermal.T > 70 });

  const anyTripped = Object.keys(R).some(function (k) { return R[k].tripped; });
  if (anyTripped) out.push({ name: 'TRIP', label: 'Breaker', value: 'TRIPPED — press RESET', unit: '', warn: true });
  return out;
};

function Rheostat(opts) {
  opts = opts || {};
  this.id = opts.id || uid('rh');
  this.type = 'rheostat';
  this.label = opts.label || 'Rheostat';
  // The sprite paints two jacks on unit A: A_TOP (the wiper output) and
  // A_BOT (the base terminal). Read those names, not legacy '1'/'2' — the
  // lab.place() terminal override replaces `terminals` with the sprite's
  // term list, so '1'/'2' never exist and stamp() would silently bail.
  this.terminals = opts.terminals || { A_TOP: 1, A_BOT: 1, B_TOP: 1, B_YEL: 1, B_RED: 1 };
  this.tA = opts.tA || 'A_TOP';
  this.tB = opts.tB || 'A_BOT';
  this.Rmax = opts.Rmax != null ? opts.Rmax : 500;
  this.pos = opts.pos != null ? opts.pos : 0.5;
  this.I = 0;
  this.thermal = new EEE.Thermal({ C: 300, Rth: 3, Tmax: 200, Tburn: 350 });
}
Object.defineProperty(Rheostat.prototype, 'R', {
  get: function () { return this.Rmax * this.pos + 0.05; }
});
Rheostat.prototype.stamp = function (mna, netOf) {
  const a = netOf(this.id, this.tA), b = netOf(this.id, this.tB);
  if (a === undefined || b === undefined) return;
  const g = 1 / this.R;
  mna.G[a][a] += g; mna.G[b][b] += g;
  mna.G[a][b] -= g; mna.G[b][a] -= g;
};
Rheostat.prototype.update = function (dt, sol) {
  const a = sol.netOf(this.id, this.tA), b = sol.netOf(this.id, this.tB);
  this.I = (a !== undefined && b !== undefined) ? Math.abs(sol.V[a] - sol.V[b]) / this.R : 0;
  this.thermal.step(dt, this.I * this.I * this.R);
};
Rheostat.prototype.readouts = function () {
  return [
    { name: 'R', value: this.R, unit: '\u03A9' },
    { name: 'I', value: this.I, unit: 'A' },
    { name: 'T', value: this.thermal.T, unit: '\u00B0C', warn: this.thermal.T > 150 }
  ];
};

function DCMachine(opts) {
  opts = opts || {};
  this.id = opts.id || uid('m');
  this.type = 'dc_machine';
  this.label = opts.label || 'DC Machine M1-2/EV';
  // The panel paints PE A2 D3 D1 A1 D2 F1 F2. The model used to declare D3
  // but stamp and read a terminal literally named 'D2', so the series field
  // (nameplate: D1–D2) stamped a net that did not exist while the real D2
  // jack stayed dead. Declare both D2 and D3 — the sprite has both.
  this.terminals = { A1: 1, A2: 1, F1: 1, F2: 1, D1: 1, D2: 1, D3: 1 };
  this.Ra = opts.Ra != null ? opts.Ra : 2.5;
  // The Exp 04 reference records the no-load field current as 0.088 A at
  // 220 V, i.e. a 2500 Ω field circuit. The old 250 Ω drew 0.88 A — ten
  // times rated — and put the machine's whole calibration out.
  this.Rf = opts.Rf != null ? opts.Rf : 2500;
  this.Rs = opts.Rs != null ? opts.Rs : 1.0;
  // EMF constant. The machine must generate ≈220 V at its rated 3000 rpm
  // while carrying only the 0.088 A field the nameplate allows, so the field
  // saturates at that current (Isat below) and Ke·φ(0.088) ≈ 0.70.
  this.Ke = opts.Ke != null ? opts.Ke : 0.95;
  this.Kt = opts.Kt != null ? opts.Kt : 0.95;
  this.J = opts.J != null ? opts.J : 0.03;
  this.B = opts.B != null ? opts.B : 0.0005;
  // Knee of the magnetisation curve. Sized to the 0.088 A rated field so the
  // machine reaches rated volts at rated field rather than deep in saturation.
  this.Isat = opts.Isat != null ? opts.Isat : 0.10;
  this.Vrated = opts.Vrated != null ? opts.Vrated : 220;
  this.Irated = opts.Irated != null ? opts.Irated : 1.4;
  this.Nrated = opts.Nrated != null ? opts.Nrated : 3000;
  this.omega = 0;
  this.phi = 0.05;
  this.phiResidual = 0.05;
  this.If = 0;
  this.Is = 0;
  this.Ia = 0;
  this.Tprime = 0;
  this.primeRpm = opts.primeRpm != null ? opts.primeRpm : 0;
  this.E = 0;
  this.Te = 0;
  this.thermal = new EEE.Thermal({ C: 1200, Rth: 1.2, Tmax: 130, Tburn: 250 });
  this.fieldThermal = new EEE.Thermal({ C: 400, Rth: 2, Tmax: 130, Tburn: 250 });
}
DCMachine.prototype.stamp = function (mna, netOf) {
  if (this.thermal.dead) return;
  const A1 = netOf(this.id, 'A1'), A2 = netOf(this.id, 'A2');
  const F1 = netOf(this.id, 'F1'), F2 = netOf(this.id, 'F2');
  const D1 = netOf(this.id, 'D1'), D3 = netOf(this.id, 'D2');
  if (A1 !== undefined && A2 !== undefined) {
    const ga = 1 / (this.Ra + 0.1);
    mna.G[A1][A1] += ga; mna.G[A2][A2] += ga;
    mna.G[A1][A2] -= ga; mna.G[A2][A1] -= ga;
    const E = this.Ke * this.phi * this.omega;
    mna.I[A1] += ga * E;
    mna.I[A2] -= ga * E;
  }
  if (F1 !== undefined && F2 !== undefined) {
    const gf = 1 / this.Rf;
    mna.G[F1][F1] += gf; mna.G[F2][F2] += gf;
    mna.G[F1][F2] -= gf; mna.G[F2][F1] -= gf;
  }
  if (D1 !== undefined && D3 !== undefined) {
    const gs = 1 / this.Rs;
    mna.G[D1][D1] += gs; mna.G[D3][D3] += gs;
    mna.G[D1][D3] -= gs; mna.G[D3][D1] -= gs;
  }
};
DCMachine.prototype.update = function (dt, sol) {
  if (this.thermal.dead) { this.Ia = 0; this.If = 0; this.Is = 0; this.omega = 0; return; }
  const vA1 = sol.V[sol.netOf(this.id, 'A1')] || 0;
  const vA2 = sol.V[sol.netOf(this.id, 'A2')] || 0;
  this.vA1 = vA1; this.vA2 = vA2;
  const vF1 = sol.V[sol.netOf(this.id, 'F1')] || 0;
  const vF2 = sol.V[sol.netOf(this.id, 'F2')] || 0;
  const vD1 = sol.V[sol.netOf(this.id, 'D1')] || 0;
  const vD3 = sol.V[sol.netOf(this.id, 'D2')] || 0;
  this.If = (vF1 - vF2) / this.Rf;
  this.Is = (vD1 - vD3) / this.Rs;
  const E = this.Ke * this.phi * this.omega;
  this.E = E;
  this.Ia = ((vA1 - vA2) - E) / (this.Ra + 0.1);
  const Ieff = this.If + this.Is * 0.4;
  const targetPhi = this.phiResidual + (1 - this.phiResidual) * Math.tanh(Ieff / this.Isat);
  const tau = 0.05;
  this.phi += (targetPhi - this.phi) * Math.min(1, dt / tau);
  if (!isFinite(this.phi)) this.phi = this.phiResidual;
  const Te = this.Kt * this.phi * this.Ia;
  this.Te = Te;
  if (this.primeRpm > 0) {
    const wTarget = this.primeRpm * 2 * Math.PI / 60;
    const lag = 0.15;
    this.omega += (wTarget - this.omega) * Math.min(1, dt / lag);
  } else {
    const friction = 0.002 * Math.sign(this.omega) + this.B * this.omega;
    const Tnet = Te + this.Tprime - friction;
    this.omega += (Tnet / this.J) * dt;
    if (this.omega < 0) this.omega = 0;
  }
  if (!isFinite(this.omega)) this.omega = 0;
  const rpm = this.omega * 60 / (2 * Math.PI);
  if (rpm > this.Nrated * 1.5) this.thermal.damage += dt * (rpm - this.Nrated * 1.5) * 0.00005;
  this.thermal.step(dt, this.Ia * this.Ia * this.Ra + this.Is * this.Is * this.Rs + 0.3 * this.phi * this.phi * Math.min(1, Math.abs(this.omega) / 100) + Math.abs(this.omega) * 0.005);
  this.fieldThermal.step(dt, this.If * this.If * this.Rf);
  if (Math.abs(this.Ia) > this.Irated * 3) this.thermal.damage += dt * (Math.abs(this.Ia) - this.Irated * 3) * 0.0015;
  if (Math.abs(this.If) > 0.6) this.fieldThermal.damage += dt * (Math.abs(this.If) - 0.6) * 0.008;
};
DCMachine.prototype.readouts = function () {
  const rpm = this.omega * 60 / (2 * Math.PI);
  const Vt = (this.vA1 != null && this.vA2 != null) ? (this.vA1 - this.vA2) : (this.E - this.Ia * this.Ra);
  return [
    { name: 'N', value: rpm, unit: 'rpm' },
    { name: 'Ia', value: Math.abs(this.Ia), unit: 'A', warn: Math.abs(this.Ia) > this.Irated * 1.3 },
    { name: 'If', value: this.If, unit: 'A' },
    { name: 'E', value: this.E, unit: 'V' },
    { name: 'Vt', value: Vt, unit: 'V' },
    { name: 'T', value: this.Te || 0, unit: 'N\u00B7m' },
    { name: 'Tw', value: this.thermal.T, unit: '\u00B0C', warn: this.thermal.T > this.thermal.Tmax },
    { name: 'st', value: this.thermal.dead ? 'DEAD' : (this.thermal.T > 100 ? 'HOT' : 'OK'), unit: '' }
  ];
};

/* ══════════════════════════════════════════════════════════════
   SHAFT COUPLING — a rigid mechanical link between two machines.

   Purely mechanical: no electrical stamp. It declares two MECH ports
   (A and B) which the solver walks after the electrical step. Machines
   that have a `shaft` field (`omega`, `J`) and are joined by a coupling
   are constrained to share one angular velocity, weighted by their
   inertias. This is what turns a motor-driven generator from a scripted
   `primeRpm` into an actual coupled pair.

   Ports are NOT electrical terminals — they never appear in the MNA
   matrix. lab.wiring() uses them only to draw the shaft link and to
   let the solver find the pair.
   ══════════════════════════════════════════════════════════════ */
function Coupling(opts) {
  opts = opts || {};
  this.id = opts.id || uid('cp');
  this.type = 'coupling';
  this.label = opts.label || 'Shaft Coupling';
  // Mechanical ports — no electrical stamp, never in `terminals`.
  this.mechA = opts.mechA || 'MA';
  this.mechB = opts.mechB || 'MB';
  this.joint = opts.joint != null ? opts.joint : 0.0002;  // loss coefficient
  this.Tmax = opts.Tmax != null ? opts.Tmax : 40;          // torque before slip
  this.slipped = false;
  this.T = 0;
}
Coupling.prototype.stamp = function () { /* mechanical only */ };
Coupling.prototype.update = function (dt) {
  // The actual velocity equalisation runs in the solver's mechanical pass,
  // not here, because it needs both coupled machines in hand. This method
  // just decays the reported coupling torque.
  this.T *= Math.max(0, 1 - dt * 4);
};
Coupling.prototype.readouts = function () {
  return [
    { name: 'T', value: Math.abs(this.T), unit: 'N\u00B7m', warn: this.slipped },
    { name: 'st', value: this.slipped ? 'SLIP' : 'LOCK', unit: '', warn: this.slipped }
  ];
};

function Meter(opts) {
  opts = opts || {};
  this.id = opts.id || uid('met');
  this.mode = opts.mode || 'V';
  this.type = this.mode === 'A' ? 'ammeter' : 'voltmeter';
  this.label = opts.label || (this.mode === 'V' ? 'Voltmeter' : 'Ammeter');
  this.terminals = this.mode === 'V' ? { '+': 1, '-': 1 } : { in: 1, out: 1 };
  this.Range = opts.Range != null ? opts.Range : (this.mode === 'V' ? 300 : 10);
  this.reading = 0;
  this.overload = false;
  this.noise = opts.noise != null ? opts.noise : 0.004;
  this.shunt = 0.01;
}
Meter.prototype.stamp = function (mna, netOf) {
  const a = netOf(this.id, this.mode === 'V' ? '+' : 'in');
  const b = netOf(this.id, this.mode === 'V' ? '-' : 'out');
  if (a === undefined || b === undefined) return;
  const R = this.mode === 'V' ? 1e6 : this.shunt;
  const g = 1 / R;
  mna.G[a][a] += g; mna.G[b][b] += g;
  mna.G[a][b] -= g; mna.G[b][a] -= g;
};
Meter.prototype.update = function (dt, sol) {
  const a = sol.netOf(this.id, this.mode === 'V' ? '+' : 'in');
  const b = sol.netOf(this.id, this.mode === 'V' ? '-' : 'out');
  if (a === undefined || b === undefined) { this.reading = 0; return; }
  const raw = sol.V[a] - sol.V[b];
  const trueVal = this.mode === 'V' ? raw : raw / this.shunt;
  this.reading = EEE.meterNoise(trueVal, this.noise);
  this.overload = Math.abs(this.reading) > this.Range * 1.2;
};
Meter.prototype.readouts = function () {
  return [{ name: this.mode, value: this.reading, unit: this.mode === 'V' ? 'V' : 'A', warn: this.overload }];
};

/* AZ module rack — a bank of meter DISPLAYS. Every display on the panel is its
   own channel: a + input bank and a - input bank (all posts inside one bank are
   the same electrical node, so a wire can land on whichever button is handy),
   plus a V / A / W mode switch.

   The rack also carries ONE shared series shunt (in -> out, aliased to the
   AZ-VIPS B1/B2/D posts). Watt mode multiplies a channel's own voltage by that
   series current — a wattmeter is a voltmeter times an ammeter. */
function MeterRack(opts) {
  opts = opts || {};
  this.id = opts.id || uid('rack');
  this.type = 'meter_rack';
  this.label = opts.label || 'Measurement Rack AZ-VIPS/VIDC';

  // d1/d2 read the AZ-VIPS (Row 1 Bay 2) and MINS SCOPY (Row 1 Bay 3) posts.
  // d3/d4 read the DIN meter bay's two painted jack pairs (Row 2 Bay 2):
  //   top pair    → d3   bottom pair → d4
  // Each pair's top-left/top-right are pos and neg; the matching bottom-row
  // post of the same column is shorted to it in `bonds` below, so a wire on
  // ANY post of that colour closes the loop.
  this.channels = [
    // The AZ-VIPS bay paints A1 B1 B2 D on the top row and R D2 C below.
    // Both rows are one node per column, so D belongs with the negatives —
    // omitting it left the fourth top-row jack dead and dropped any wire
    // landed on it.
    { id: 'd1', label: 'AZ-VIPS', mode: 'V',
      pos: ['A1', 'B1', 'B2'], neg: ['R', 'D2', 'C', 'D'],
      V: 0, I: 0, A: 0, W: 0, shown: 0, over: false },
    { id: 'd2', label: 'MINS', mode: 'V',
      pos: ['DIN1+'], neg: ['DIN1-'],
      V: 0, I: 0, A: 0, W: 0, shown: 0, over: false },
    { id: 'd3', label: 'AZ-VIDC', mode: 'A',
      pos: ['DIN2+'], neg: ['DIN2-'],
      V: 0, I: 0, A: 0, W: 0, shown: 0, over: false },
    { id: 'd4', label: 'AZ-VIDC 2', mode: 'W',
      pos: ['AA+', 'AA+2'], neg: ['AA-', 'AA-2'],
      V: 0, I: 0, A: 0, W: 0, shown: 0, over: false }
  ];

  // The rack's series-shunt is the shared in→out coil. W mode on any display
  // multiplies that display's own V by this current.
  this.seriesPos = ['in'];
  this.seriesNeg = ['out'];

  this.terminals = {};
  const T = this.terminals;
  this.channels.forEach(function (c) {
    c.pos.forEach(function (k) { T[k] = 1; });
    c.neg.forEach(function (k) { T[k] = 1; });
  });
  this.seriesPos.forEach(function (k) { T[k] = 1; });
  this.seriesNeg.forEach(function (k) { T[k] = 1; });

  // Every post in one row is the SAME node — the rows exist so a wire can
  // land on whichever post is handy and still close the loop. Declaring the
  // names is not enough; the netlist has to be told to bond them, otherwise
  // P1 and P2 become separate nets and a wire on P2 never meets P1.
  this.bonds = [];
  const B = this.bonds;
  function chain(names) {
    for (let i = 1; i < names.length; i++) B.push([names[0], names[i]]);
  }
  this.channels.forEach(function (c) { chain(c.pos); chain(c.neg); });
  chain(this.seriesPos);
  chain(this.seriesNeg);

  // Four jacks in a 2x2 layout on both bays. The user's rule: the TOP and
  // BOTTOM posts of the SAME COLUMN are shorted — they're the same node, just
  // two landings so a wire reaches whichever is closer.
  //   AA bay  : col L = + (AA+/AA+2)   col R = − (AA-/AA-2)
  //   DIN bay : col L = + (DIN1+/DIN2+) col R = − (DIN1-/DIN2-)
  // d3 and d4 both tap the DIN bay, so they share these two nodes by design
  // (the panel paints ONE jack pair for BOTH DIN meters — see spriteDINMeters).
  B.push(['AA+',   'AA+2']);
  B.push(['AA-',   'AA-2']);
  B.push(['DIN1+', 'DIN2+']);
  B.push(['DIN1-', 'DIN2-']);

  this.VRange = opts.VRange != null ? opts.VRange : 500;
  this.ARange = opts.ARange != null ? opts.ARange : 20;
  this.WRange = opts.WRange != null ? opts.WRange : 10000;
  this.V = 0;
  this.A = 0;
  this.W = 0;
  this.vOver = false;
  this.aOver = false;
  this.noise = opts.noise != null ? opts.noise : 0.004;
  this.shunt = 0.01;
}
// Count the terminals sitting on each net. A declared-but-unwired post still
// gets its own single-terminal net, so "more than one terminal" is the test
// for whether a post is actually part of the circuit.
MeterRack.prototype._netSizes = function (netlist) {
  const sizes = new Map();
  if (!netlist || typeof netlist.computeNets !== 'function') return sizes;
  netlist.computeNets().forEach(function (n) { sizes.set(n.id, n.terminals.length); });
  return sizes;
};
// Return the net index of the first WIRED candidate name in `names`.
// A bank has several posts that are the same node; the user only has to wire
// one of them, so we must skip the floating ones instead of taking names[0].
MeterRack.prototype._resolve = function (netOf, names, sizes) {
  for (let i = 0; i < names.length; i++) {
    const n = netOf(this.id, names[i]);
    if (n === undefined || n === null) continue;
    if (!sizes || sizes.size === 0) return n;      // no netlist info: first hit
    if ((sizes.get(n) || 0) > 1) return n;         // bonded to something
  }
  return undefined;
};
MeterRack.prototype.setDisplayMode = function (dispId, mode) {
  const c = this.channels.find(function (x) { return x.id === dispId; });
  if (!c || (mode !== 'V' && mode !== 'A' && mode !== 'W')) return;
  c.mode = mode;
  // Re-point the readout immediately. update() computes V, A and W every
  // frame, so all three are already in hand — without this the display would
  // keep the previous mode's number until the solver runs another step, which
  // never happens if the bench is stopped.
  c.shown = mode === 'V' ? c.V : mode === 'A' ? c.I : c.W;
  c.over = mode === 'V' ? Math.abs(c.V) > this.VRange * 1.2
         : mode === 'A' ? Math.abs(c.I) > this.ARange * 1.2
         : Math.abs(c.W) > this.WRange * 1.2;
};
MeterRack.prototype.stamp = function (mna, netOf, netlist) {
  const self = this;
  const sizes = this._netSizes(netlist);
  function put(a, b, g) {
    if (a === undefined || b === undefined || a === b) return;
    mna.G[a][a] += g; mna.G[b][b] += g;
    mna.G[a][b] -= g; mna.G[b][a] -= g;
  }
  // Every display presents a high-Z voltmeter. An A-mode channel does NOT
  // stamp a shunt of its own: the DIN bay's two columns are bonded
  // (DIN1± ≡ DIN2± — the panel paints ONE jack pair for both DIN meters), so
  // a per-channel 0.01 Ω shunt would sit directly across the neighbouring
  // voltmeter's posts. That is 100 S straight across the mains — it shorted
  // the supply and tripped the variable-AC breaker on three benches.
  //
  // The rack has ONE ammeter movement: the in/out series coil stamped below.
  // An A-mode display is a readout of that coil, exactly like real gear.
  this.channels.forEach(function (c) {
    const a = self._resolve(netOf, c.pos, sizes);
    const b = self._resolve(netOf, c.neg, sizes);
    put(a, b, 1 / 1e6);
  });
  // shared series shunt
  put(this._resolve(netOf, this.seriesPos, sizes),
      this._resolve(netOf, this.seriesNeg, sizes), 1 / this.shunt);
};
MeterRack.prototype.update = function (dt, sol) {
  const self = this;
  const netOf = function (id, name) { return sol.netOf(id, name); };
  const sizes = new Map();
  (sol.nets || []).forEach(function (n) { sizes.set(n.id, n.terminals.length); });

  // The shared series shunt IS the rack's ammeter movement. A channel in A
  // mode reads this current; a channel in W mode multiplies its own voltage
  // across the load by it — a wattmeter is a voltmeter times an ammeter.
  // (Reading raw/shunt off a channel's OWN terminals would just divide its
  // own voltage by 0.01 and report tens of kiloamps.)
  const sa = this._resolve(netOf, this.seriesPos, sizes);
  const sb = this._resolve(netOf, this.seriesNeg, sizes);
  this.A = (sa !== undefined && sb !== undefined)
    ? EEE.meterNoise((sol.V[sa] - sol.V[sb]) / this.shunt, this.noise) : 0;
  this.aOver = Math.abs(this.A) > this.ARange * 1.2;

  this.channels.forEach(function (c) {
    const a = self._resolve(netOf, c.pos, sizes);
    const b = self._resolve(netOf, c.neg, sizes);
    // All three quantities are computed every frame so a mode switch is
    // instant and never leaves a stale number sitting under a fresh unit.
    //
    // V — potential across this display's own + / − rows.
    // A — current through this display's own rows. In A mode the channel
    //     stamps a shunt, so the loop the user closed through those posts is
    //     the current being measured; a wire must run THROUGH the display.
    // W — this display's voltage times the rack's shared series current
    //     (the in/out coil). A wattmeter is a voltmeter times an ammeter and
    //     only has one pair of posts, so the current half comes from the
    //     rack's series coil.
    c.V = (a !== undefined && b !== undefined)
      ? EEE.meterNoise(sol.V[a] - sol.V[b], self.noise) : 0;
    // The current half of every display is the rack's single series coil.
    // Reading it off the channel's own posts would divide its own voltage by
    // 0.01 and report tens of kiloamps — and stamping a shunt there is the
    // short this fix removes.
    c.I = self.A;
    c.A = self.A;
    c.W = c.V * self.A;
    c.shown = c.mode === 'V' ? c.V : c.mode === 'A' ? c.I : c.W;
    c.over = c.mode === 'V' ? Math.abs(c.V) > self.VRange * 1.2
           : c.mode === 'A' ? Math.abs(c.I) > self.ARange * 1.2
           : Math.abs(c.W) > self.WRange * 1.2;
  });
  this.V = this.channels[0].V;
  this.W = this.V * this.A;
  this.vOver = Math.abs(this.V) > this.VRange * 1.2;
};
MeterRack.prototype.readouts = function () {
  const out = this.channels.map(function (c) {
    return {
      name: c.id,
      label: c.label + ' \u00b7 ' + c.mode,
      value: c.shown,
      unit: c.mode === 'V' ? 'V' : c.mode === 'A' ? 'A' : 'W',
      warn: c.over
    };
  });
  out.push({ name: 'V', label: 'Rack voltage', value: this.V, unit: 'V', warn: this.vOver });
  out.push({ name: 'A', label: 'Rack current', value: this.A, unit: 'A', warn: this.aOver });
  return out;
};

function LoadBank(opts) {
  opts = opts || {};
  this.id = opts.id || uid('ld');
  this.type = 'load_bank';
  this.label = opts.label || 'Load Bank';
  this.terminals = { A: 1, B: 1 };
  this.Rsteps = opts.Rsteps || [200, 300, 400, 600, 1200];
  this.step = opts.step != null ? opts.step : 1;   // start loaded on step 1
  this.I = 0;
  this.thermal = new EEE.Thermal({ C: 500, Rth: 4, Tmax: 250, Tburn: 400 });
}
Object.defineProperty(LoadBank.prototype, 'R', {
  get: function () { return this.step === 0 ? Infinity : this.Rsteps[this.step - 1]; }
});
LoadBank.prototype.stamp = function (mna, netOf) {
  if (this.step === 0) return;
  const a = netOf(this.id, 'A'), b = netOf(this.id, 'B');
  if (a === undefined || b === undefined) return;
  const g = 1 / this.R;
  mna.G[a][a] += g; mna.G[b][b] += g;
  mna.G[a][b] -= g; mna.G[b][a] -= g;
};
LoadBank.prototype.update = function (dt, sol) {
  const a = sol.netOf(this.id, 'A'), b = sol.netOf(this.id, 'B');
  this.I = (a !== undefined && b !== undefined && this.step > 0) ? (sol.V[a] - sol.V[b]) / this.R : 0;
  if (this.step > 0) this.thermal.step(dt, this.I * this.I * this.R);
};
LoadBank.prototype.readouts = function () {
  return [
    { name: 'R', value: this.R, unit: '\u03A9' },
    { name: 'I', value: this.I, unit: 'A' },
    { name: 'T', value: this.thermal.T, unit: '\u00B0C', warn: this.thermal.T > 200 }
  ];
};

/* ══════════════════════════════════════════════════════════════
   M-4/EV · THREE-PHASE ASYNCHRONOUS MOTOR
   Terminals: W2 U2 W1 (phase starts) · B1 B2 C2 (phase ends)
              A2 A3 D1 (star/delta taps)
   Three stator windings; when energised the rotor accelerates
   toward synchronous speed (120f/p = 3000 rpm) and settles at slip.
   ══════════════════════════════════════════════════════════════ */
function Motor3P(opts) {
  opts = opts || {};
  this.id = opts.id || uid('m3');
  this.type = 'motor_3p';
  this.label = opts.label || '3φ Async Motor M-4/EV';
  this.terminals = { W2: 1, U2: 1, W1: 1, A2: 1, A3: 1, D1: 1, B1: 1, B2: 1, C2: 1 };
  // Per-phase winding resistance. A 400 V / 1.5 A star-connected motor
  // presents ≈ 326 V / 1.5 A ≈ 217 Ω per phase at the snapshot above, so
  // 150 Ω lands the modelled line current near rated without pretending
  // to model the leakage reactance.
  this.Rw = opts.Rw != null ? opts.Rw : 150;
  this.Rt = opts.Rt != null ? opts.Rt : 0.8;
  this.p = opts.p != null ? opts.p : 2;
  this.f = opts.f != null ? opts.f : 50;
  this.Vrated = opts.Vrated != null ? opts.Vrated : 400;
  this.Irated = opts.Irated != null ? opts.Irated : 1.5;
  this.Nsync = 120 * this.f / this.p;
  this.Nrated = opts.Nrated != null ? opts.Nrated : 2850;
  this.J = opts.J != null ? opts.J : 0.02;
  this.omega = 0;
  this.slip = 1;
  this.Iphase = [0, 0, 0];
  this.Iline = 0;
  this.Te = 0;
  this.thermal = new EEE.Thermal({ C: 1500, Rth: 1.6, Tmax: 130, Tburn: 250 });
  this.windings = [['W2', 'B1'], ['U2', 'C2'], ['W1', 'B2']];
}
Motor3P.prototype.stamp = function (mna, netOf) {
  if (this.thermal.dead) return;
  const self = this;
  this.windings.forEach(function (w) {
    const a = netOf(self.id, w[0]), b = netOf(self.id, w[1]);
    if (a === undefined || b === undefined || a === b) return;
    const g = 1 / self.Rw;
    mna.G[a][a] += g; mna.G[b][b] += g;
    mna.G[a][b] -= g; mna.G[b][a] -= g;
    const E = 0.5 * self.slip * self.omega;
    mna.I[a] -= g * E;
    mna.I[b] += g * E;
  });
  const taps = [['A2', 'A3'], ['A3', 'D1']];
  taps.forEach(function (t) {
    const a = netOf(self.id, t[0]), b = netOf(self.id, t[1]);
    if (a === undefined || b === undefined || a === b) return;
    const g = 1 / self.Rt;
    mna.G[a][a] += g; mna.G[b][b] += g;
    mna.G[a][b] -= g; mna.G[b][a] -= g;
  });
};
Motor3P.prototype.update = function (dt, sol) {
  if (this.thermal.dead) { this.omega = 0; this.Iline = 0; return; }
  const self = this;
  let sumI = 0, energies = 0;
  this.windings.forEach(function (w, k) {
    const a = sol.netOf(self.id, w[0]), b = sol.netOf(self.id, w[1]);
    const v = (a !== undefined && b !== undefined) ? (sol.V[a] - sol.V[b]) : 0;
    const i = v / self.Rw;
    self.Iphase[k] = i;
    sumI += Math.abs(i);
    energies += i * i * self.Rw;
  });
  this.Iline = sumI / 3;
  const energised = sumI > 0.05;
  if (energised) {
    const NsyncRad = this.Nsync * 2 * Math.PI / 60;
    const slipNow = (NsyncRad - this.omega) / NsyncRad;
    this.slip = Math.max(-0.5, Math.min(1, slipNow));
    const s = Math.max(0.02, Math.abs(this.slip));
    const pull = this.Iline * this.Iline * 0.6 / s;
    this.Te = Math.sign(this.slip || 1) * Math.min(pull, 40);
  } else {
    this.Te = 0;
    this.slip = 1;
  }
  const friction = 0.003 * Math.sign(this.omega) + 0.0008 * this.omega;
  const Tnet = this.Te - friction;
  this.omega += (Tnet / this.J) * dt;
  if (this.omega < 0) this.omega = 0;
  if (!isFinite(this.omega)) this.omega = 0;
  // An induction motor in motoring mode can never exceed synchronous
  // speed — the rotor would be generating. Clamp just under Ns.
  const NmaxRad = this.Nsync * 0.999 * 2 * Math.PI / 60;
  if (this.omega > NmaxRad) this.omega = NmaxRad;
  this.thermal.step(dt, energies + Math.abs(this.omega) * 0.01);
  if (this.Iline > this.Irated * 3) this.thermal.damage += dt * (this.Iline - this.Irated * 3) * 0.0018;
};
Motor3P.prototype.readouts = function () {
  const rpm = this.omega * 60 / (2 * Math.PI);
  return [
    { name: 'N', value: rpm, unit: 'rpm' },
    { name: 's', value: this.slip, unit: '' },
    { name: 'I', value: this.Iline, unit: 'A', warn: this.Iline > this.Irated * 1.3 },
    { name: 'f', value: this.f, unit: 'Hz' },
    { name: 'p', value: this.p, unit: 'poles' },
    { name: 'T', value: this.Te, unit: 'N·m' },
    { name: 'Tw', value: this.thermal.T, unit: '°C', warn: this.thermal.T > this.thermal.Tmax },
    { name: 'st', value: this.thermal.dead ? 'DEAD' : (this.thermal.T > 100 ? 'HOT' : 'OK'), unit: '' }
  ];
};

/* ══════════════════════════════════════════════════════════════
   M-R/CV · SINGLE-PHASE ASYNCHRONOUS MOTOR
   Terminals: Aux2 · Z2 · C · C2 · Run · U2 · PE
   Main winding (Run-U2) plus auxiliary winding with run capacitor.
   ══════════════════════════════════════════════════════════════ */
function Motor1P(opts) {
  opts = opts || {};
  this.id = opts.id || uid('m1');
  this.type = 'motor_1p';
  this.label = opts.label || '1φ Async Motor M-R/CV';
  this.terminals = { Aux2: 1, Z2: 1, C: 1, C2: 1, Run: 1, U2: 1, PE: 1 };
  // 230 V / 3.6 A rated ⇒ the two windings in parallel must present ≈64 Ω,
  // so a 100 Ω run winding alongside a 180 Ω auxiliary gives 64.3 Ω and
  // 3.58 A at 230 V without the capacitor — matching the 3.5 A the reference
  // observation records for the no-capacitor case. The old 52 Ω / 95 Ω pair
  // presented 33.6 Ω and drew 6.8 A, tripping the variable-AC breaker at
  // 134 V before the motor ever reached rated voltage.
  this.Rmain = opts.Rmain != null ? opts.Rmain : 100;
  this.Raux = opts.Raux != null ? opts.Raux : 180;
  this.C = opts.C != null ? opts.C : 12.5e-6;
  this.p = opts.p != null ? opts.p : 2;
  this.f = opts.f != null ? opts.f : 50;
  this.Vrated = opts.Vrated != null ? opts.Vrated : 230;
  this.Irated = opts.Irated != null ? opts.Irated : 3.6;
  this.Nsync = 120 * this.f / this.p;
  this.Nrated = opts.Nrated != null ? opts.Nrated : 2850;
  this.J = opts.J != null ? opts.J : 0.015;
  this.omega = 0;
  this.slip = 1;
  this.Irun = 0;
  this.Iaux = 0;
  this.Te = 0;
  this.thermal = new EEE.Thermal({ C: 900, Rth: 2, Tmax: 130, Tburn: 250 });
  this.mainPair = ['Run', 'U2'];
  this.auxPair  = ['Aux2', 'Z2'];
}
Motor1P.prototype.stamp = function (mna, netOf) {
  if (this.thermal.dead) return;
  const a = netOf(this.id, this.mainPair[0]), b = netOf(this.id, this.mainPair[1]);
  if (a !== undefined && b !== undefined && a !== b) {
    const g = 1 / this.Rmain;
    mna.G[a][a] += g; mna.G[b][b] += g;
    mna.G[a][b] -= g; mna.G[b][a] -= g;
    const E = 0.4 * this.slip * this.omega;
    mna.I[a] -= g * E;
    mna.I[b] += g * E;
  }
  const c = netOf(this.id, this.auxPair[0]), d = netOf(this.id, this.auxPair[1]);
  if (c !== undefined && d !== undefined && c !== d) {
    const g = 1 / this.Raux;
    mna.G[c][c] += g; mna.G[d][d] += g;
    mna.G[c][d] -= g; mna.G[d][c] -= g;
  }
  const p = netOf(this.id, 'C'), q = netOf(this.id, 'C2');
  if (p !== undefined && q !== undefined && p !== q) {
    // Run capacitor: reactance magnitude 1/(2πfC) sets the auxiliary
    // current. Modelled as a conductance of that magnitude.
    const g = 2 * Math.PI * this.f * this.C;
    mna.G[p][p] += g; mna.G[q][q] += g;
    mna.G[p][q] -= g; mna.G[q][p] -= g;
  }
};
Motor1P.prototype.update = function (dt, sol) {
  if (this.thermal.dead) { this.omega = 0; this.Irun = 0; this.Iaux = 0; return; }
  const a = sol.netOf(this.id, this.mainPair[0]), b = sol.netOf(this.id, this.mainPair[1]);
  const v = (a !== undefined && b !== undefined) ? (sol.V[a] - sol.V[b]) : 0;
  this.Irun = v / this.Rmain;
  const c = sol.netOf(this.id, this.auxPair[0]), d = sol.netOf(this.id, this.auxPair[1]);
  const va = (c !== undefined && d !== undefined) ? (sol.V[c] - sol.V[d]) : 0;
  this.Iaux = va / this.Raux;
  const Itot = Math.abs(this.Irun) + 0.5 * Math.abs(this.Iaux);
  if (Itot > 0.05) {
    const NsyncRad = this.Nsync * 2 * Math.PI / 60;
    const slipNow = (NsyncRad - this.omega) / NsyncRad;
    this.slip = Math.max(-0.5, Math.min(1, slipNow));
    const s = Math.max(0.03, Math.abs(this.slip));
    const pull = Itot * Itot * 0.4 / s;
    this.Te = Math.sign(this.slip || 1) * Math.min(pull, 20);
  } else {
    this.Te = 0;
    this.slip = 1;
  }
  const friction = 0.002 * Math.sign(this.omega) + 0.0006 * this.omega;
  const Tnet = this.Te - friction;
  this.omega += (Tnet / this.J) * dt;
  if (this.omega < 0) this.omega = 0;
  if (!isFinite(this.omega)) this.omega = 0;
  const NmaxRad = this.Nsync * 1.3 * 2 * Math.PI / 60;
  if (this.omega > NmaxRad) this.omega = NmaxRad;
  this.thermal.step(dt, this.Irun * this.Irun * this.Rmain + this.Iaux * this.Iaux * this.Raux + Math.abs(this.omega) * 0.008);
  if (Itot > this.Irated * 3) this.thermal.damage += dt * (Itot - this.Irated * 3) * 0.0016;
};
Motor1P.prototype.readouts = function () {
  const rpm = this.omega * 60 / (2 * Math.PI);
  return [
    { name: 'N', value: rpm, unit: 'rpm' },
    { name: 's', value: this.slip, unit: '' },
    { name: 'Irun', value: Math.abs(this.Irun), unit: 'A' },
    { name: 'Iaux', value: Math.abs(this.Iaux), unit: 'A' },
    { name: 'C', value: this.C * 1e6, unit: 'µF' },
    { name: 'T', value: this.Te, unit: 'N·m' },
    { name: 'Tw', value: this.thermal.T, unit: '°C', warn: this.thermal.T > this.thermal.Tmax },
    { name: 'st', value: this.thermal.dead ? 'DEAD' : (this.thermal.T > 100 ? 'HOT' : 'OK'), unit: '' }
  ];
};

/* ══════════════════════════════════════════════════════════════
   GMS · THREE-PHASE SYNCHRONOUS GENERATOR
   Terminals: F1 F2 (field) · U1 U2 V1 V2 W1 W2 (armature) · G
   Prime mover holds rotor at Ns; field current sets the EMF.
   ══════════════════════════════════════════════════════════════ */
function SyncGen(opts) {
  opts = opts || {};
  this.id = opts.id || uid('sg');
  this.type = 'sync_gen';
  this.label = opts.label || 'Sync Generator GMS';
  this.terminals = { F1: 1, F2: 1, U1: 1, U2: 1, V1: 1, V2: 1, W1: 1, W2: 1, G: 1 };
  this.Rf = opts.Rf != null ? opts.Rf : 300;
  this.Ra = opts.Ra != null ? opts.Ra : 2.2;
  this.Ke = opts.Ke != null ? opts.Ke : 0.55;
  // Rotor inertia — needed by the coupling pass so two shafted machines can
  // settle on one speed. A generator on the bench is a heavier body than the
  // small DC machine, hence the larger default.
  this.J = opts.J != null ? opts.J : 0.05;
  this.If = 0;
  this.omega = 0;
  this.primeRpm = opts.primeRpm != null ? opts.primeRpm : 1500;
  this.f = opts.f != null ? opts.f : 50;
  this.p = opts.p != null ? opts.p : 2;
  this.Vrated = opts.Vrated != null ? opts.Vrated : 400;
  this.Irated = opts.Irated != null ? opts.Irated : 1.3;
  this.Nrated = opts.Nrated != null ? opts.Nrated : 1250;
  this.E = 0;
  this.Ia = 0;
  this.thermal = new EEE.Thermal({ C: 1200, Rth: 1.4, Tmax: 130, Tburn: 250 });
  this.fieldThermal = new EEE.Thermal({ C: 500, Rth: 2, Tmax: 130, Tburn: 250 });
  this.armature = [['U1', 'U2'], ['V1', 'V2'], ['W1', 'W2']];
}
SyncGen.prototype.stamp = function (mna, netOf) {
  if (this.thermal.dead) return;
  const self = this;
  const f1 = netOf(this.id, 'F1'), f2 = netOf(this.id, 'F2');
  if (f1 !== undefined && f2 !== undefined && f1 !== f2) {
    const gf = 1 / this.Rf;
    mna.G[f1][f1] += gf; mna.G[f2][f2] += gf;
    mna.G[f1][f2] -= gf; mna.G[f2][f1] -= gf;
  }
  const E = this.Ke * this.If * this.omega;
  this.E = E;
  const phase = E * 0.8;
  this.armature.forEach(function (w) {
    const a = netOf(self.id, w[0]), b = netOf(self.id, w[1]);
    if (a === undefined || b === undefined || a === b) return;
    const g = 1 / self.Ra;
    mna.G[a][a] += g; mna.G[b][b] += g;
    mna.G[a][b] -= g; mna.G[b][a] -= g;
    mna.I[a] += g * phase;
    mna.I[b] -= g * phase;
  });
};
SyncGen.prototype.update = function (dt, sol) {
  if (this.thermal.dead) { this.omega = 0; this.If = 0; return; }
  const vF1 = sol.V[sol.netOf(this.id, 'F1')] || 0;
  const vF2 = sol.V[sol.netOf(this.id, 'F2')] || 0;
  this.If = (vF1 - vF2) / this.Rf;
  // A machine bolted to a coupling must NOT self-drive from primeRpm — if it
  // did, it would fight the coupling every frame and the pair would settle at
  // a tug-of-war speed. The coupling pass owns omega; we only integrate here
  // when the shaft is free.
  if (!this._coupled) {
    const wTarget = this.primeRpm * 2 * Math.PI / 60;
    this.omega += (wTarget - this.omega) * Math.min(1, dt / 0.2);
    if (!isFinite(this.omega)) this.omega = 0;
  }
  const self = this;
  let sumI = 0;
  this.armature.forEach(function (w) {
    const a = sol.netOf(self.id, w[0]), b = sol.netOf(self.id, w[1]);
    const v = (a !== undefined && b !== undefined) ? (sol.V[a] - sol.V[b]) : 0;
    const E = self.Ke * self.If * self.omega * 0.8;
    sumI += Math.abs((E - v) / self.Ra);
  });
  this.Ia = sumI / 3;
  this.thermal.step(dt, this.Ia * this.Ia * this.Ra + Math.abs(this.omega) * 0.004);
  this.fieldThermal.step(dt, this.If * this.If * this.Rf);
  if (this.Ia > this.Irated * 3) this.thermal.damage += dt * (this.Ia - this.Irated * 3) * 0.0012;
};
SyncGen.prototype.readouts = function () {
  const rpm = this.omega * 60 / (2 * Math.PI);
  return [
    { name: 'N', value: rpm, unit: 'rpm' },
    { name: 'If', value: this.If, unit: 'A' },
    { name: 'Ia', value: this.Ia || 0, unit: 'A', warn: (this.Ia || 0) > this.Irated * 1.3 },
    { name: 'E', value: this.E, unit: 'V' },
    { name: 'f', value: this.f, unit: 'Hz' },
    { name: 'p', value: this.p, unit: 'poles' },
    { name: 'Tw', value: this.thermal.T, unit: '°C', warn: this.thermal.T > this.thermal.Tmax },
    { name: 'st', value: this.thermal.dead ? 'DEAD' : (this.thermal.T > 100 ? 'HOT' : 'OK'), unit: '' }
  ];
};

/* ══════════════════════════════════════════════════════════════
   M-13/EV · SINGLE-PHASE TRANSFORMER
   Terminals: P230 PE (primary) · B1 B2 (printed link) · RA (51 Ω)
              2U1 2U3 2U4 2U2 3U1 3U3 3U2 (tapped secondary)

   Secondary sections, referenced to the 230 V primary:
     3U2–3U3 = 115 V · 3U3–3U1 = 115 V  → 3U2–3U1 = 230 V
     2U1–2U3 =  53 V · 2U3–2U4 =  94 V · 2U4–2U2 = 53 V
                                        → 2U1–2U2 = 200 V
   Chain the two groups and you land on the printed 400 V range
   (230 + 200 = 430 V nominal ≈ 400 V under load).
   ══════════════════════════════════════════════════════════════ */
function Transformer(opts) {
  opts = opts || {};
  this.id = opts.id || uid('tr');
  this.type = 'transformer_1p';
  this.label = opts.label || '1φ Transformer M-13/EV';
  this.terminals = {
    P230: 1, P0: 1, PE: 1, B1: 1, B2: 1, RA: 1,
    '2U1': 1, '2U3': 1, '2U4': 1, '2U2': 1, '3U1': 1, '3U3': 1, '3U2': 1
  };
  // Magnetising branch. A plain "primary resistance" would draw full-load
  // current even with nothing on the secondary — this panel has no
  // magnetising inductance to hold the no-load current down, so the branch
  // is sized to the real no-load draw (≈0.35 A at 230 V) and the secondary
  // load is reflected back on top of it in update().
  this.Rmag = opts.Rmag != null ? opts.Rmag : 930;
  this.Gref = 0;
  this.P2 = 0;
  this.Ra = opts.Ra != null ? opts.Ra : 51;        // printed RA = 51 Ω
  this.Rcontact = opts.Rcontact != null ? opts.Rcontact : 0.05;
  this.Vrated = opts.Vrated != null ? opts.Vrated : 230;
  this.Srated = opts.Srated != null ? opts.Srated : 760;
  // This engine solves an instantaneous snapshot, and the lab's variable AC
  // line sits at 325 V — the peak of the 230 V RMS nameplate. Scaling the
  // EMFs by VpRef makes the printed tap voltages come out right when the
  // panel is fed from AC-L1, and keeps the ratio linear on any other supply.
  this.VpRef = opts.VpRef != null ? opts.VpRef : 325;
  this.sections = opts.sections || [
    ['3U2', '3U3', 115, 1.1],
    ['3U3', '3U1', 115, 1.1],
    ['2U1', '2U3',  53, 0.4],
    ['2U3', '2U4',  94, 0.7],
    ['2U4', '2U2',  53, 0.4]
  ];
  this.Vp = 0;
  this.Ip = 0;
  this.Is = 0;
  this.S = 0;
  this.Irated = this.Srated / this.Vrated;
  this.thermal = new EEE.Thermal({ C: 2400, Rth: 0.7, Tmax: 130, Tburn: 250 });
}
Transformer.prototype.stamp = function (mna, netOf) {
  if (this.thermal.dead) return;
  const self = this;

  // primary winding — the load the variac actually sees.
  // P0 is the return terminal; PE is the earth jack and carries no winding.
  const p = netOf(this.id, 'P230'), q = netOf(this.id, 'P0');
  if (p !== undefined && q !== undefined && p !== q) {
    const gp = 1 / this.Rmag + this.Gref;
    mna.G[p][p] += gp; mna.G[q][q] += gp;
    mna.G[p][q] -= gp; mna.G[q][p] -= gp;
  }

  // secondary sections — Norton form of (EMF in series with the section R).
  // EMF tracks the primary voltage found on the previous solve, the same
  // relaxed one-step-behind coupling the motors in this file use.
  const k = this.Vp / this.VpRef;
  this.sections.forEach(function (sec) {
    const a = netOf(self.id, sec[0]), b = netOf(self.id, sec[1]);
    if (a === undefined || b === undefined || a === b) return;
    const g = 1 / sec[3];
    const E = (sec[2] / self.Vrated) * self.VpRef * k;
    mna.G[a][a] += g; mna.G[b][b] += g;
    mna.G[a][b] -= g; mna.G[b][a] -= g;
    mna.I[a] += g * E;
    mna.I[b] -= g * E;
  });

  // B — printed link across the primary circuit
  const b1 = netOf(this.id, 'B1'), b2 = netOf(this.id, 'B2');
  if (b1 !== undefined && b2 !== undefined && b1 !== b2) {
    const gb = 1 / this.Rcontact;
    mna.G[b1][b1] += gb; mna.G[b2][b2] += gb;
    mna.G[b1][b2] -= gb; mna.G[b2][b1] -= gb;
  }

  // RA — the 51 Ω resistor to PE
  const ra = netOf(this.id, 'RA'), pe = netOf(this.id, 'PE');
  if (ra !== undefined && pe !== undefined && ra !== pe) {
    const ga = 1 / this.Ra;
    mna.G[ra][ra] += ga; mna.G[pe][pe] += ga;
    mna.G[ra][pe] -= ga; mna.G[pe][ra] -= ga;
  }
};
Transformer.prototype.update = function (dt, sol) {
  if (this.thermal.dead) { this.Vp = 0; this.Ip = 0; this.Is = 0; this.S = 0; this.Gref = 0; return; }
  const self = this;
  const p = sol.netOf(this.id, 'P230'), q = sol.netOf(this.id, 'P0');
  this.Vp = (p !== undefined && q !== undefined) ? (sol.V[p] - sol.V[q]) : 0;
  if (!isFinite(this.Vp)) this.Vp = 0;

  // A section only delivers power if at least one of its two terminals sits
  // on a net that LEAVES this device. The five sections are chained through
  // shared intermediate terminals (3U3, 2U3, 2U4), so with the secondary
  // open the string is a floating sub-network: the MNA matrix is singular
  // there, the solve leaves those nodes at 0 V, and every section then
  // reports a large (E - 0)/R current into a node that does not exist. That
  // phantom current used to feed Gref, which dragged a fake load through the
  // primary and tripped the supply breaker — an open-circuited transformer
  // appeared to draw more current than a shorted one.
  const externalNets = new Set();
  if (sol.nets) {
    sol.nets.forEach(function (n) {
      let theirs = 0;
      for (let i = 0; i < n.terminals.length; i++) {
        if (n.terminals[i].split(':')[0] !== self.id) { theirs++; break; }
      }
      if (theirs > 0) externalNets.add(n.id);
    });
  }

  let sumI = 0, sumP = 0;
  this.sections.forEach(function (sec) {
    const a = sol.netOf(self.id, sec[0]), b = sol.netOf(self.id, sec[1]);
    if (a === undefined || b === undefined) return;
    if (!externalNets.has(a) && !externalNets.has(b)) return;   // floating winding
    const v = sol.V[a] - sol.V[b];
    const E = (sec[2] / self.Vrated) * self.Vp;
    const i2 = (E - v) / sec[3];
    if (!isFinite(i2)) return;
    sumI += Math.abs(i2);
    sumP += Math.abs(v * i2);          // power actually handed to the external load
  });
  this.Is = sumI;
  this.P2 = sumP;

  // Reflect the secondary load into the primary, one step behind — same
  // relaxed coupling the section EMFs use, and stable at 60 fps.
  const vp2 = this.Vp * this.Vp;
  this.Gref = vp2 > 1 ? Math.min(0.4, sumP / vp2) : 0;
  this.Ip = this.Vp * (1 / this.Rmag + this.Gref);
  this.S = Math.abs(this.Vp * this.Ip);

  const Req = 1 / (1 / this.Rmag + this.Gref);
  this.thermal.step(dt, this.Ip * this.Ip * Req + sumP * 0.12 + Math.abs(this.Is) * 0.004);
  if (this.Is > this.Irated * 2) this.thermal.damage += dt * (this.Is - this.Irated * 2) * 0.0012;
};
Transformer.prototype.readouts = function () {
  const turns = this.Vp ? 1 : 0;
  return [
    { name: 'V1', value: Math.abs(this.Vp), unit: 'V' },
    { name: 'I1', value: Math.abs(this.Ip), unit: 'A', warn: Math.abs(this.Ip) > 3.7 },
    { name: 'I2', value: this.Is, unit: 'A', warn: this.Is > this.Irated },
    { name: 'P2', value: this.P2 || 0, unit: 'W' },
    { name: 'S', value: this.S, unit: 'VA' },
    { name: 'k', value: this.VpRef ? (this.Vp / this.VpRef) : 0, unit: '', warn: turns ? false : true },
    { name: 'Tw', value: this.thermal.T, unit: '°C', warn: this.thermal.T > this.thermal.Tmax },
    { name: 'st', value: this.thermal.dead ? 'DEAD' : (this.thermal.T > 100 ? 'HOT' : 'OK'), unit: '' }
  ];
};

root.EEE.Devices = {
  DCSupply: DCSupply, Rheostat: Rheostat, DCMachine: DCMachine,
  Motor3P: Motor3P, Motor1P: Motor1P, SyncGen: SyncGen, Transformer: Transformer,
  Coupling: Coupling,
  Meter: Meter, MeterRack: MeterRack, LoadBank: LoadBank, uid: uid
};

})(typeof window !== 'undefined' ? window : globalThis);
