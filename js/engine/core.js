// EEE Lab Simulator - Core Engine: netlist + MNA solver + thermal + real-life noise
(function (root) {
'use strict';

function Netlist() {
  this.devices = new Map();
  this.wires = new Map();
  this._nets = null;
  this._netOf = null;
}
Netlist.prototype.addDevice = function (d) { this.devices.set(d.id, d); this._nets = null; return d; };
Netlist.prototype.removeDevice = function (id) { this.devices.delete(id); this._nets = null; };
Netlist.prototype.addWire = function (w) { this.wires.set(w.id, w); this._nets = null; return w; };
Netlist.prototype.removeWire = function (id) { this.wires.delete(id); this._nets = null; };
Netlist.prototype.computeNets = function () {
  if (this._nets) return this._nets;
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; }
    return r;
  }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); }
  this.devices.forEach(function (d) {
    const t = d.terminals || {};
    for (const k in t) find(d.id + ':' + k);
  });
  // Structural bonds: terminals a device declares as electrically identical
  // (an input row whose posts are all one node). Declaring them is not enough
  // — without this they each become their own net and a wire landed on the
  // "wrong" post never closes the loop.
  this.devices.forEach(function (d) {
    if (!Array.isArray(d.bonds)) return;
    d.bonds.forEach(function (pair) {
      union(d.id + ':' + pair[0], d.id + ':' + pair[1]);
    });
  });
  this.wires.forEach(function (w) { if (parent.has(w.a) && parent.has(w.b)) union(w.a, w.b); });
  const groups = new Map();
  parent.forEach(function (_, k) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(k);
  });
  const nets = [];
  const netOf = new Map();
  let id = 0;
  groups.forEach(function (terms) {
    nets.push({ id: id, terminals: terms });
    terms.forEach(function (t) { netOf.set(t, id); });
    id++;
  });
  this._nets = nets;
  this._netOf = netOf;
  return nets;
};
Netlist.prototype.netOf = function (devId, term) {
  this.computeNets();
  return this._netOf.get(devId + ':' + term);
};

function solveLinear(A, b, n) {
  const M = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array(n + 1);
    for (let j = 0; j < n; j++) row[j] = A[i][j];
    row[n] = b[i];
    M[i] = row;
  }
  for (let col = 0; col < n; col++) {
    let piv = col, best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-13) continue;
    if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
    const d = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = Math.abs(M[r][r]) > 1e-13 ? s / M[r][r] : 0;
  }
  return x;
}

function simulate(netlist, dt) {
  dt = dt || 1 / 60;
  const nets = netlist.computeNets();
  const n = nets.length;
  if (n === 0) return { V: [], Ivs: [], netOf: function () {}, nets: nets };

  const supplies = [];
  netlist.devices.forEach(function (d) {
    if (d.type === 'dc_supply' && d.enabled) {
      // Let the device recompute its rail table BEFORE we read it. A proper
      // supply decides per-rail whether it is live (variac wound up? breaker
      // tripped? tap selected?) — that state can change on any frame, so the
      // rails must be rebuilt here rather than baked once at construction.
      if (typeof d.refreshRails === 'function') {
        try { d.refreshRails(); } catch (e) { console.error('refreshRails fail', d.id, e); }
      }
      if (d._Veff == null || d._Veff > d.V) d._Veff = d.V;
      supplies.push(d);
      // Extra rails the device exposes (3φ lines, ±24 V, ±50 V …).
      // Each is an independent ideal source so the lines sit at different
      // potentials — without this a "3-phase" output is a single node and
      // no current can ever flow between lines.
      //
      // A rail marked `open: true` is NOT stamped. That is the only correct
      // representation of a de-energised output: an ideal source at V=0 is a
      // dead short across its own terminals, which would clamp every net it
      // touches to ground. "Off" has to mean absent, not zero.
      if (Array.isArray(d.auxLines)) {
        d.auxLines.forEach(function (L) {
          if (L.open) return;
          supplies.push({
            id: d.id, pos: L.pos, neg: L.neg,
            V: L.V, _Veff: L.V, Imax: L.Imax != null ? L.Imax : 10,
            _aux: true, _rail: L.rail, _parent: d
          });
        });
      }
    } else if (d.type === 'dc_supply') {
      d._vsIndex = -1;
    }
  });

  const netOf = function (id, t) { return netlist.netOf(id, t); };
  let V = [], Ivs = [];

  // CV/CC loop: solve, check supply current, fold voltage back if over limit
  for (let iter = 0; iter < 8; iter++) {
    const size = n + supplies.length;
    const G = new Array(size);
    for (let i = 0; i < size; i++) G[i] = new Array(size).fill(0);
    const I = new Array(size).fill(0);
    const mna = { G: G, I: I };

    supplies.forEach(function (d, k) {
      const p = netOf(d.id, d.pos || '+'), q = netOf(d.id, d.neg || '-');
      if (p === undefined || q === undefined || p === q) return;
      const r = n + k;
      G[p][r] += 1; G[q][r] -= 1;
      G[r][p] += 1; G[r][q] -= 1;
      I[r] = d._Veff;
      d._vsIndex = k;
    });

    netlist.devices.forEach(function (d) {
      if (d.type !== 'dc_supply' && typeof d.stamp === 'function') {
        // netlist is passed so multi-terminal instruments (the meter rack)
        // can tell a WIRED post from a merely-declared one.
        try { d.stamp(mna, netOf, netlist); } catch (e) { console.error('stamp fail', d.id, e); }
      }
    });

    // tiny leakage to ground on every net so isolated nets resolve instead of being pinned to 0
    for (let i = 0; i < n; i++) G[i][i] += 1e-9;

    // Ground reference: walk the supply list and take the FIRST one whose '-'
    // terminal actually resolves to a live net. Taking supplies[0] blindly was
    // safe when every supply was guaranteed stamped; now a de-energised output
    // is simply absent from the list, and a rail whose neg net has not been
    // created yet resolves to undefined. If we grounded on that we would pin a
    // dangling index and every node would float to a nonsense potential.
    let gnd = 0;
    for (let si = 0; si < supplies.length; si++) {
      const gq = netOf(supplies[si].id, supplies[si].neg || '-');
      if (gq !== undefined && gq !== null && gq < n) { gnd = gq; break; }
    }
    for (let c = 0; c < size; c++) G[gnd][c] = 0;
    G[gnd][gnd] = 1; I[gnd] = 0;

    let x;
    try { x = solveLinear(G, I, size); } catch (e) {
      console.error('solve fail', e);
      x = new Array(size).fill(0);
    }
    V = x.slice(0, n);
    Ivs = x.slice(n);

    let adjusted = false;
    supplies.forEach(function (d, k) {
      const i = Math.abs(Ivs[k] || 0);
      if (!isFinite(i)) return;

      if (d._aux) {
        // A rail of a balanced set must NOT be folded independently: scaling
        // L1 alone while L2/L3 keep their values destroys the zero-sum
        // property the "neutral" reference depends on, and the motor would
        // see a nonsense phase set. Instead we REPORT the overcurrent to the
        // parent supply, which decides whether to trip its breaker — and a
        // tripped breaker drops the whole rail (open:true) on the next
        // refreshRails(). That is how a real breaker behaves: it does not
        // sag the line, it removes it.
        if (d._parent && typeof d._parent.noteRailCurrent === 'function') {
          d._parent.noteRailCurrent(d._rail, i, d.Imax);
        }
        return;
      }

      // The MAIN stamped source is the parent supply itself, and it owns the
      // variable DC rail. Report its current under that rail's key — without
      // this the vdc ammeter reads zero and the breaker can never trip, even
      // though the fold-back below is clamping the output perfectly.
      if (typeof d.noteRailCurrent === 'function') {
        d.noteRailCurrent('vdc', i, d.Imax);
      }

      if (i > d.Imax) {
        d._Veff = Math.max(0, d._Veff * (d.Imax / i) * 0.97);
        adjusted = true;
      } else if (d._Veff < d.V && i < d.Imax * 0.9) {
        d._Veff = Math.min(d.V, d._Veff * 1.05 + 0.5);
        adjusted = true;
      }
    });
    if (!adjusted) break;
  }

  // Hand each supply its own rail currents for this step so it can update
  // per-rail ammeters, thermal state and breaker logic in update(). The main
  // supply owns slot `_vsIndex`; every aux rail is tagged with its rail key.
  supplies.forEach(function (d, k) {
    const i = Math.abs(Ivs[k] || 0);
    if (d._aux) {
      if (d._parent && typeof d._parent.noteRailCurrent === 'function') {
        d._parent.noteRailCurrent(d._rail, i, d.Imax);
      }
    } else if (typeof d.noteRailCurrent === 'function') {
      // Main source = the supply's own variable DC rail.
      d.noteRailCurrent('vdc', i, d.Imax);
    }
  });

  const sol = { V: V, Ivs: Ivs, netOf: netOf, nets: nets, dt: dt, supplies: supplies };
  netlist.devices.forEach(function (d) {
    if (typeof d.update === 'function') {
      try { d.update(dt, sol); } catch (e) { console.error('update fail', d.id, e); }
    }
  });

  // ── mechanical pass ──────────────────────────────────────────────
  // Runs AFTER every electrical update so each machine's omega is fresh.
  // A coupling joins two rotating machines and forces them to one speed:
  // the inertias decide the shared omega, exactly like a rigid shaft.
  // Machines with a live `primeRpm` act as an infinite-inertia source and
  // drag the other side to that speed instead of being dragged themselves.
  // devices is a Map, not an array — .get() by id, never .find().
  netlist.devices.forEach(function (d) {
    if (d.type !== 'coupling') return;
    const A = netlist.devices.get(d._mechA);
    const B = netlist.devices.get(d._mechB);
    if (!A || !B) return;
    if (typeof A.omega !== 'number' || typeof B.omega !== 'number') return;

    // A machine may not declare J (older models did not). Fall back to a
    // sane rotor inertia rather than dividing by undefined and producing
    // NaN, which would poison both omegas for the rest of the run.
    const Ja = (typeof A.J === 'number' && isFinite(A.J) && A.J > 0) ? A.J : 0.03;
    const Jb = (typeof B.J === 'number' && isFinite(B.J) && B.J > 0) ? B.J : 0.03;

    // Tell both machines the coupling owns their speed this frame, so their
    // own update() does not try to drive omega from primeRpm and fight us.
    A._coupled = true;
    B._coupled = true;

    // A driven side (primeRpm>0) pins the speed; an undriven side just
    // follows. If BOTH are driven, the inertia-weighted mean wins.
    let target;
    if (A.primeRpm > 0 && B.primeRpm > 0) {
      target = (A.omega * Ja + B.omega * Jb) / (Ja + Jb);
    } else if (A.primeRpm > 0) {
      target = A.omega;
    } else if (B.primeRpm > 0) {
      target = B.omega;
    } else {
      target = (A.omega * Ja + B.omega * Jb) / (Ja + Jb);
    }

    // coupling loss torque is proportional to the speed mismatch
    const dOmega = B.omega - A.omega;
    d.T = d.joint * Math.abs(dOmega) / Math.max(dt, 1e-4) * (Ja + Jb) * 0.5;
    if (!isFinite(d.T)) d.T = 0;
    d.slipped = Math.abs(d.T) > d.Tmax;

    // slack (slipped) coupling only pulls partway
    const pull = d.slipped ? 0.15 : 1.0;
    const k = Math.min(1, dt / 0.15) * pull;
    A.omega += (target - A.omega) * k;
    B.omega += (target - B.omega) * k;
    if (!isFinite(A.omega)) A.omega = 0;
    if (!isFinite(B.omega)) B.omega = 0;
  });
  return sol;
}

function Thermal(opts) {
  opts = opts || {};
  this.T = opts.T0 != null ? opts.T0 : 25;
  this.Tamb = 25;
  this.C = opts.C != null ? opts.C : 200;
  this.Rth = opts.Rth != null ? opts.Rth : 2;
  this.Tmax = opts.Tmax != null ? opts.Tmax : 130;
  this.Tburn = opts.Tburn != null ? opts.Tburn : 250;
  this.damage = 0;
  this.dead = false;
  this.smoke = 0;
}
Thermal.prototype.step = function (dt, P) {
  if (this.dead) return;
  if (!isFinite(P)) P = 0;
  this.T += dt * (P - (this.T - this.Tamb) / this.Rth) / this.C;
  if (!isFinite(this.T)) this.T = this.Tburn;
  if (this.T > this.Tmax) {
    const over = this.T - this.Tmax;
    this.damage += dt * over * 0.0005;
    this.smoke = Math.min(1, this.smoke + dt * over * 0.002);
  }
  if (this.T > this.Tburn || this.damage >= 1) { this.dead = true; this.smoke = 1; }
};

function contactResistance() {
  const r = Math.random();
  if (r < 0.015) return 0.5 + Math.random() * 3;
  return 0.002 + Math.random() * 0.02;
}
function meterNoise(value, relErr, absErr) {
  relErr = relErr || 0.004; absErr = absErr || 0;
  const sigma = Math.abs(value) * relErr + absErr;
  const u1 = Math.random() || 1e-9, u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return value + z * sigma;
}

root.EEE = root.EEE || {};
root.EEE.Netlist = Netlist;
root.EEE.simulate = simulate;
root.EEE.Thermal = Thermal;
root.EEE.contactResistance = contactResistance;
root.EEE.meterNoise = meterNoise;
root.EEE.solveLinear = solveLinear;

})(typeof window !== 'undefined' ? window : globalThis);
