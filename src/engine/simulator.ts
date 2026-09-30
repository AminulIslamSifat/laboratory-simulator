/**
 * The solver loop.
 *
 * Pipeline per step:
 *   1. Reduce devices + wires to equipotential nets (cached by the netlist).
 *   2. Refresh every supply's rail table — a breaker that tripped last frame
 *      must already be absent from the stamp this frame.
 *   3. Build and solve the MNA system, folding supply voltage back if a rail
 *      exceeds its current limit. Up to 8 iterations.
 *   4. Hand each device its branch currents, then call update() so state
 *      (omega, temperature, readings) advances.
 *   5. Run the mechanical pass over shaft couplings, once omegas are fresh.
 *   6. Snapshot every device's readouts ONCE into a cache.
 *
 * Step 6 exists for two reasons. Both the sidebar and the on-sprite LCDs read
 * every device's panel, and each was calling `readouts()` independently — so
 * every device's readout method ran twice per frame. Snapshotting once halves
 * that work. It also means a renderer never re-enters device code mid-draw,
 * so the sidebar, the sprite and a test all see the same object graph.
 *
 * Note this is a performance and separation concern, NOT a correctness one:
 * `readouts()` is required to be pure and side-effect free, so calling it
 * twice was never returning two different answers.
 */

import { Netlist } from './netlist.js';
import { Thermal } from './thermal.js';
import { solveLinear } from './linalg.js';
import { Rng, reseed, getRng } from './rng.js';
import type {
  Device,
  Mna,
  NetOf,
  Readout,
  Solution,
  SourceLike,
  Machine,
  SupplyDevice,
  AuxRail
} from './types.js';
import { isMachine, isSupply } from './types.js';

/** Iterations of the supply fold-back loop before we accept the result. */
const FOLD_BACK_ITERATIONS = 8;

/** Conductance bled from every node to ground so isolated nets resolve. */
const NODE_LEAKAGE = 1e-9;

/** Largest timestep we will integrate. A tab-switch must not jump 30 s. */
const MAX_DT = 0.1;

export interface SimStats {
  /** Wall-clock milliseconds spent inside the last `step()`. */
  stepMs: number;
  /** MNA systems solved during the last step (1…8). */
  iterations: number;
  /** Nets in the current topology. */
  netCount: number;
  /** Devices with a `stamp()` that threw during the last step. */
  stampErrors: number;
}

export class Simulator {
  readonly netlist: Netlist;
  rng: Rng;

  /** Simulated seconds since the run began. */
  time = 0;

  /** Last solution produced, or null before the first step. */
  last: Solution | null = null;

  readonly stats: SimStats = {
    stepMs: 0,
    iterations: 0,
    netCount: 0,
    stampErrors: 0
  };

  /** Bumped whenever the topology changes, so UIs can invalidate caches. */
  revision = 0;

  /**
   * Readouts are snapshotted here once per step and read back by every
   * renderer. Keyed by device id.
   */
  private readoutCache = new Map<string, Readout[]>();

  /** Pre-allocated MNA buffers, grown on demand and reused every step. */
  private gBuf: Float64Array = new Float64Array(0);
  private iBuf: Float64Array = new Float64Array(0);

  constructor(netlist: Netlist = new Netlist(), seed?: number) {
    this.netlist = netlist;
    this.rng = seed === undefined ? getRng() : new Rng(seed);
  }

  /** Restart the random stream and simulated clock. */
  reseed(seed?: number): void {
    this.rng = seed === undefined ? getRng() : new Rng(seed);
    if (seed !== undefined) reseed(seed);
  }

  reset(): void {
    this.time = 0;
    this.last = null;
    this.readoutCache.clear();
    this.revision++;
  }

  /**
   * Advance the simulation.
   *
   * @param dt seconds since the previous step. Clamped to MAX_DT.
   */
  step(dt: number): Solution {
    const t0 = performance.now();
    const h = clampDt(dt);
    this.time += h;

    const nets = this.netlist.computeNets();
    const netCount = nets.length;

    // ── 1. Gather sources ────────────────────────────────────────
    const supplies = this.collectSources();

    const netOf: NetOf = (id, term) => this.netlist.netOf(id, term);

    const size = netCount + supplies.length;
    this.ensureCapacity(size);

    let V = new Float64Array(netCount);
    let Ivs = new Float64Array(supplies.length);
    let singular = false;
    let floatingNodes: number[] = [];
    let iterations = 0;

    // ── 2. Fold-back loop ────────────────────────────────────────
    for (let iter = 0; iter < FOLD_BACK_ITERATIONS; iter++) {
      iterations++;
      const G = this.gBuf;
      const I = this.iBuf;
      G.fill(0, 0, size * size);
      I.fill(0, 0, size);
      const mna: Mna = { G, I, n: size };

      // Ideal voltage sources: one extra row/column each.
      for (let k = 0; k < supplies.length; k++) {
        const s = supplies[k];
        const p = netOf(s.id, s.pos);
        const q = netOf(s.id, s.neg);
        if (p === undefined || q === undefined || p === q) {
          s._vsIndex = -1;
          continue;
        }
        const r = netCount + k;
        G[p * size + r] += 1;
        G[q * size + r] -= 1;
        G[r * size + p] += 1;
        G[r * size + q] -= 1;
        I[r] = s._Veff;
        s._vsIndex = k;
      }

      // Every non-source device contributes conductance.
      let stampErrors = 0;
      for (const d of this.netlist.devices.values()) {
        if (d.type === 'dc_supply') continue;
        if (typeof d.stamp !== 'function') continue;
        try {
          d.stamp(mna, netOf, this.netlist);
        } catch (err) {
          stampErrors++;
          reportOnce(`stamp:${d.id}`, `stamp failed on ${d.id}`, err);
        }
      }
      this.stats.stampErrors = stampErrors;

      // Bleed every node to ground so a genuinely isolated net resolves to
      // a number instead of making the whole matrix singular.
      for (let i = 0; i < netCount; i++) G[i * size + i] += NODE_LEAKAGE;

      // Ground reference: the first supply whose negative terminal resolves.
      // Taking supplies[0] blindly is unsafe now that a de-energised rail is
      // simply absent from the list.
      let ground = 0;
      for (const s of supplies) {
        const gq = netOf(s.id, s.neg);
        if (gq !== undefined && gq < netCount) {
          ground = gq;
          break;
        }
      }
      for (let c = 0; c < size; c++) G[ground * size + c] = 0;
      G[ground * size + ground] = 1;
      I[ground] = 0;

      const result = solveLinear(G, I, size);
      singular = result.singular;
      floatingNodes = result.badColumns.filter((c) => c < netCount);

      V = result.x.slice(0, netCount);
      Ivs = result.x.slice(netCount);

      // ── 3. Fold back any supply over its current limit ──────────
      let adjusted = false;
      for (let k = 0; k < supplies.length; k++) {
        const s = supplies[k];
        const i = Math.abs(Ivs[k] || 0);
        if (!Number.isFinite(i)) continue;

        if (s._aux) {
          // A balanced 3φ set must NOT be folded per-line: scaling L1 alone
          // while L2/L3 hold their values destroys the zero-sum property the
          // neutral reference depends on, and the motor sees a nonsense phase
          // set. Report the overload to the parent, which decides whether to
          // trip the breaker — and a tripped breaker removes the whole rail.
          s._parent?.noteRailCurrent?.(s._rail ?? '', i, s.Imax);
          continue;
        }

        s.noteRailCurrent?.('vdc', i, s.Imax);

        if (i > s.Imax) {
          s._Veff = Math.max(0, s._Veff * (s.Imax / i) * 0.97);
          adjusted = true;
        } else if (s._Veff < s.V && i < s.Imax * 0.9) {
          s._Veff = Math.min(s.V, s._Veff * 1.05 + 0.5);
          adjusted = true;
        }
      }

      if (!adjusted) break;
    }

    // ── 4. Publish final branch currents to each supply ───────────
    for (let k = 0; k < supplies.length; k++) {
      const s = supplies[k];
      const i = Math.abs(Ivs[k] || 0);
      if (s._aux) {
        s._parent?.noteRailCurrent?.(s._rail ?? '', i, s.Imax);
      } else {
        s.noteRailCurrent?.('vdc', i, s.Imax);
      }
    }

    const sol: Solution = {
      V,
      Ivs,
      netOf,
      nets,
      dt: h,
      supplies,
      singular,
      floatingNodes,
      rng: this.rng,
      time: this.time
    };

    // ── 5. Electrical update ────────────────────────────────────
    for (const d of this.netlist.devices.values()) {
      if (typeof d.update !== 'function') continue;
      try {
        d.update(h, sol);
      } catch (err) {
        reportOnce(`update:${d.id}`, `update failed on ${d.id}`, err);
      }
    }

    // ── 6. Mechanical pass ──────────────────────────────────────
    this.mechanicalPass(h);

    // ── 7. Snapshot readouts once ───────────────────────────────
    this.snapshotReadouts();

    this.last = sol;
    this.stats.stepMs = performance.now() - t0;
    this.stats.iterations = iterations;
    this.stats.netCount = netCount;
    return sol;
  }

  /**
   * Readouts as of the most recent step.
   *
   * Returns the snapshot taken at the end of `step()`. Never calls into the
   * device, so it is safe to invoke from a render path — and repeated calls
   * within a frame are free.
   */
  readoutsFor(deviceId: string): Readout[] {
    return this.readoutCache.get(deviceId) ?? EMPTY_READOUTS;
  }

  private snapshotReadouts(): void {
    for (const d of this.netlist.devices.values()) {
      if (typeof d.readouts !== 'function') {
        this.readoutCache.delete(d.id);
        continue;
      }
      try {
        this.readoutCache.set(d.id, d.readouts());
      } catch (err) {
        reportOnce(`readouts:${d.id}`, `readouts failed on ${d.id}`, err);
        this.readoutCache.set(d.id, EMPTY_READOUTS);
      }
    }
  }

  /**
   * Walk the supply devices and build the flat source list for the stamp.
   *
   * A supply exposes its main variable-DC rail as itself, plus a set of
   * auxiliary rails (the 3φ lines, the fixed DC taps). Each auxiliary rail is
   * an independent ideal source so the three lines can sit at genuinely
   * different potentials — otherwise a "3-phase" output is one node and no
   * current can ever flow between lines.
   *
   * A rail marked `open` is NOT stamped. That is the only correct way to say
   * "de-energised": an ideal source at V = 0 is a dead short across its own
   * terminals and would clamp every net it touches to ground.
   */
  private collectSources(): SourceLike[] {
    const supplies: SourceLike[] = [];

    for (const d of this.netlist.devices.values()) {
      if (!isSupply(d)) continue;
      const supply: SupplyDevice = d;

      if (!supply.enabled) continue;

      // Let the device rebuild its rail table before we read it. Whether a
      // rail is live can change on any frame — variac wound up, breaker
      // tripped, tap selected — so it cannot be baked once at construction.
      try {
        supply.refreshRails();
      } catch (err) {
        reportOnce(`rails:${d.id}`, `refreshRails failed on ${d.id}`, err);
      }

      // Start every step at the commanded voltage. The fold-back loop below
      // is then free to clamp DOWN within the step if the rail is overloaded,
      // and a rail that has recovered simply comes back up next step.
      //
      // This used to be a one-way clamp — `if (_Veff == null || _Veff > V)` —
      // which could only ever lower the stamped EMF. On the first live step
      // `_Veff` was still 0, so the source stamped 0 V and the only thing that
      // raised it was the slow CV-recovery branch (+5%, +0.5 V per iteration).
      // The bench then crept up on its set voltage instead of reaching it, and
      // a 250 V rail sat at about 4 V with no error anywhere.
      // `refreshRails()` has just published the rail's present output into
      // `supply.V`, so this is the commanded EMF for this step.
      const vCommanded = supply.V;
      supply._Veff = vCommanded;

      supplies.push({
        id: supply.id,
        pos: supply.pos,
        neg: supply.neg,
        V: vCommanded,
        _Veff: supply._Veff,
        Imax: supply.Imax,
        noteRailCurrent: (rail, i, imax) => supply.noteRailCurrent(rail, i, imax)
      });

      for (const line of supply.auxLines as AuxRail[]) {
        if (line.open) continue;
        supplies.push({
          id: supply.id,
          pos: line.pos,
          neg: line.neg,
          V: line.V ?? 0,
          _Veff: line.V ?? 0,
          Imax: line.Imax ?? 10,
          _aux: true,
          _rail: line.rail,
          _parent: supply
        });
      }
    }

    return supplies;
  }

  /**
   * Equalise the angular velocity of every pair of machines joined by a
   * coupling.
   *
   * Runs after every electrical update so each machine's omega is fresh. The
   * two inertias decide the shared speed, exactly like a rigid shaft. A side
   * with `primeRpm > 0` acts as an infinite-inertia prime mover and drags the
   * other side instead of being dragged.
   */
  private mechanicalPass(dt: number): void {
    for (const c of this.netlist.devices.values()) {
      if (c.type !== 'coupling') continue;

      const coupling = c as Device & {
        _mechA?: string | null;
        _mechB?: string | null;
        joint: number;
        Tmax: number;
        slipped: boolean;
        T: number;
        omega: number;
      };

      const aId = coupling._mechA;
      const bId = coupling._mechB;
      if (!aId || !bId) continue;

      const a = this.netlist.devices.get(aId);
      const b = this.netlist.devices.get(bId);
      if (!a || !b) continue;
      if (!isMachine(a) || !isMachine(b)) continue;

      const A: Machine = a;
      const B: Machine = b;

      // Tell both sides the coupling owns their speed this frame so their own
      // update() does not try to drive omega from primeRpm and fight us.
      A._coupled = true;
      B._coupled = true;

      const Ja = safeInertia(A.J);
      const Jb = safeInertia(B.J);

      // Shared speed for a rigid shaft. A side with a prime mover pins the
      // speed; otherwise the two inertias decide it.
      //
      // The bug this replaces: when NEITHER side had a prime mover, `target`
      // was the momentum average - which for two machines sitting at rest is
      // zero. The pass then relaxed both omegas toward zero, forever, and a
      // motor with 0.29 N m of developed torque never turned a wheel. The
      // coupling was not a shaft, it was a brake.
      let target: number;
      if (A.primeRpm > 0 && B.primeRpm > 0) {
        target = (A.omega * Ja + B.omega * Jb) / (Ja + Jb);
      } else if (A.primeRpm > 0) {
        target = A.omega;
      } else if (B.primeRpm > 0) {
        target = B.omega;
      } else {
        // No prime mover. The pair must still ACCELERATE under whatever net
        // torque each side develops. Integrate the combined inertia forward
        // by the net torque, then lock both sides to the result.
        //
        // `driveTorque` is each machine's own developed torque, read from its
        // public Te if it exposes one. A machine with no Te contributes none.
        const drive = (x: Machine): number => {
          const t = (x as unknown as { Te?: number }).Te;
          return typeof t === 'number' && Number.isFinite(t) ? t : 0;
        };
        const load = (x: Machine): number => {
          const t = (x as unknown as { Tprime?: number }).Tprime;
          return typeof t === 'number' && Number.isFinite(t) ? t : 0;
        };
        const J = Ja + Jb;
        const netT = drive(A) + drive(B) + load(A) + load(B);
        const shared = (A.omega * Ja + B.omega * Jb) / J;
        target = shared + (netT / J) * dt;
        if (!Number.isFinite(target)) target = shared;
        if (target < 0) target = 0;
      }

      // Coupling loss torque is proportional to the speed mismatch.
      const dOmega = B.omega - A.omega;
      const rawT = ((coupling.joint * Math.abs(dOmega)) / Math.max(dt, 1e-4)) * (Ja + Jb) * 0.5;
      coupling.T = Number.isFinite(rawT) ? rawT : 0;
      coupling.slipped = Math.abs(coupling.T) > coupling.Tmax;

      // A slipped coupling only pulls partway.
      const pull = coupling.slipped ? 0.15 : 1.0;
      const k = Math.min(1, dt / 0.15) * pull;

      A.omega += (target - A.omega) * k;
      B.omega += (target - B.omega) * k;
      if (!Number.isFinite(A.omega)) A.omega = 0;
      if (!Number.isFinite(B.omega)) B.omega = 0;
      if (A.omega < 0) A.omega = 0;
      if (B.omega < 0) B.omega = 0;

      // The coupling body turns with the shaft it locks. Nothing electrical
      // reads this, but the renderer spins the barrel from it - a rigid
      // coupling visibly turning between two turning flanges is the entire
      // reason it is drawn. Left at zero, the barrel sat dead between them.
      coupling.omega = target;
    }
  }

  private ensureCapacity(size: number): void {
    if (this.gBuf.length < size * size) {
      this.gBuf = new Float64Array(size * size);
    }
    if (this.iBuf.length < size) {
      this.iBuf = new Float64Array(size);
    }
  }
}

/* ── helpers ───────────────────────────────────────────────────── */

const EMPTY_READOUTS: Readout[] = [];

function clampDt(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 1 / 60;
  return Math.min(dt, MAX_DT);
}

/**
 * A machine that never declared J gets a sane rotor inertia rather than
 * dividing by `undefined` and producing NaN, which would poison both omegas
 * for the rest of the run.
 *
 * The type system should make this unreachable. It stays as a runtime guard
 * for untyped JSON loaded from a saved bench.
 */
function safeInertia(J: number): number {
  return Number.isFinite(J) && J > 0 ? J : 0.03;
}

/** Errors are reported once per key, not sixty times a second. */
const reportedErrors = new Set<string>();

function reportOnce(key: string, message: string, err: unknown): void {
  if (reportedErrors.has(key)) return;
  reportedErrors.add(key);
  console.error(message, err);
}

// Imperfection models are re-exported here so existing call sites keep
// working, but they are implemented in ./noise.js — a device must be able to
// import them without dragging the solver along and creating a cycle.
export { contactResistance, meterNoise } from './noise.js';
