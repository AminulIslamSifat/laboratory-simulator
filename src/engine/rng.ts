/**
 * Deterministic pseudo-random source.
 *
 * Every stochastic element in the simulator — contact resistance, meter
 * noise, thermal jitter — draws from here instead of `Math.random()`.
 *
 * Why this matters more than it looks:
 *   · A lab report needs numbers you can reproduce. Same seed, same wiring,
 *     same readings — every time.
 *   · The solver becomes testable. You cannot assert on a random walk.
 *   · Two students on different machines can compare benches bit-for-bit.
 *
 * The previous build called `Math.random()` from inside `readouts()`, which
 * meant the rack LCD and the sidebar showed *different* values for the same
 * meter. One stream, sampled once per frame, fixes that at the root.
 */

/** Seed used when the caller does not care. Arbitrary but fixed. */
export const DEFAULT_SEED = 0x5eed1234;

/**
 * mulberry32 — 32-bit state, fast, and a distribution far better than
 * measurement noise will ever need.
 */
export class Rng {
  private state: number;

  constructor(seed: number = DEFAULT_SEED) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Standard normal, Box–Muller. */
  gauss(): number {
    const u1 = this.next() || Number.EPSILON;
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Derive an independent stream from this one.
   *
   * Devices get their own fork so that placing an extra meter on the bench
   * cannot shift the noise sequence of every device placed after it. Without
   * this, adding a device silently changes readings that have nothing to do
   * with it — the classic reason "it worked yesterday".
   */
  fork(salt: number): Rng {
    let h = (this.next() * 0xffffffff) >>> 0;
    h = (h ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return new Rng((h ^ (h >>> 16)) >>> 0);
  }

  /** Current internal state, so a run can be resumed or recorded. */
  snapshot(): number {
    return this.state;
  }
}

/** Process-wide stream. Tests replace this to pin a run. */
let globalRng = new Rng(DEFAULT_SEED);

export function getRng(): Rng {
  return globalRng;
}

export function setRng(rng: Rng): void {
  globalRng = rng;
}

/** Restart the global stream. Called on Clear and on bench load. */
export function reseed(seed: number = DEFAULT_SEED): void {
  globalRng = new Rng(seed);
}
