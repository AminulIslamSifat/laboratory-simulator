/**
 * Shared vocabulary for the solver and the device library.
 *
 * These interfaces exist because the old build had none. That is precisely
 * why `core.js` contained this line:
 *
 *     const Ja = (typeof A.J === 'number' && isFinite(A.J) && A.J > 0) ? A.J : 0.03;
 *
 * `A.J` had been `undefined` once, `undefined * something` produced NaN, and
 * NaN poisoned both coupled omegas for the rest of the run. The guard was a
 * bandage over a missing type. With `Machine` below, the compiler refuses to
 * let that happen at all.
 */

import type { Thermal } from './thermal.js';
import type { Netlist } from './netlist.js';
import type { Rng } from './rng.js';

/** One line on a device's meter panel. */
export interface Readout {
  /** Stable key, also used to bind SVG `data-live` nodes. */
  name: string;
  /** Human label. Falls back to `name` when absent. */
  label?: string;
  value: number | string;
  unit: string;
  warn?: boolean;
}

/**
 * Modified Nodal Analysis system.
 *
 * Flat and row-major because this is allocated and solved up to eight times
 * per frame. The old nested-array version created ~40 000 short-lived arrays
 * per second just to throw them away.
 */
export interface Mna {
  /** Conductance matrix, n×n row-major. */
  G: Float64Array;
  /** Current-injection vector, length n. */
  I: Float64Array;
  /** System size, including voltage-source rows. */
  n: number;
}

/** Resolves `deviceId:terminal` to a net index, or undefined if unwired. */
export type NetOf = (deviceId: string, terminal: string) => number | undefined;

/** A connected set of terminals at one potential. */
export interface Net {
  id: number;
  terminals: string[];
}

export interface Solution {
  /** Node potentials, length = number of nets. */
  V: Float64Array;
  /** Current through each ideal source, same order as `supplies`. */
  Ivs: Float64Array;
  netOf: NetOf;
  nets: Net[];
  dt: number;
  supplies: SourceLike[];
  /** Set when the matrix was rank-deficient — readings are suspect. */
  singular: boolean;
  /** Net indices with no conducting path to the rest of the bench. */
  floatingNodes: number[];
  /**
   * Seeded random stream for this step.
   *
   * Passed through the solution rather than reached for globally so that a
   * device's `update()` has no hidden dependency on process state — and so
   * a test can pin the sequence by handing in a known RNG.
   */
  rng: Rng;
  /** Seconds of simulated time elapsed since the run started. */
  time: number;
}

/** Anything that can act as an ideal voltage source in the stamp. */
export interface SourceLike {
  id: string;
  pos: string;
  neg: string;
  /** Commanded EMF. */
  V: number;
  /** Folded-back EMF actually stamped this iteration. */
  _Veff: number;
  Imax: number;
  _vsIndex?: number;
  _aux?: boolean;
  _rail?: string;
  _parent?: SupplyDevice;
  noteRailCurrent?(rail: string, current: number, imax: number): void;
}

/**
 * Base contract every piece of bench equipment satisfies.
 *
 * `stamp` and `update` are optional because some devices are purely
 * mechanical (a shaft coupling) or purely observational (a meter rack that
 * only reads).
 */
export interface Device {
  id: string;
  type: string;
  label: string;
  terminals: Record<string, number>;

  /**
   * Terminal pairs the device declares as electrically identical — the two
   * posts of one input bank, for example. Without these, each post becomes
   * its own net and a wire on the "wrong" one never closes the loop.
   */
  bonds?: Array<[string, string]>;

  thermal?: Thermal;

  /** Contribute to the conductance matrix. Must be side-effect free. */
  stamp?(mna: Mna, netOf: NetOf, netlist: Netlist): void;

  /** Integrate state forward one step, using the freshly solved potentials. */
  update?(dt: number, sol: Solution): void;

  /** Snapshot the panel for display. MUST be pure and cheap. */
  readouts?(): Readout[];

  /** Front-panel interaction routed from the HTML control overlays. */
  setControl?(id: string, value: number | string | boolean): void;

  /** V / A / W selector on a multi-mode display. */
  setDisplayMode?(displayId: string, mode: string): void;
}

/**
 * A multi-rail bench supply.
 *
 * One box, several independent sources. `auxLines` is rebuilt every frame by
 * `refreshRails()` so a tripped breaker is already absent from the next
 * stamp, and rail currents are reported back through `noteRailCurrent()` for
 * ammeter display, thermal state and breaker logic.
 */
export interface SupplyDevice extends Device {
  /** Master isolator closed and e-stop not latched. */
  enabled: boolean;
  /** Commanded output of the main variable-DC rail. */
  V: number;
  /** Folded-back EMF actually stamped. Never exceeds `V`. */
  _Veff: number;
  Imax: number;
  pos: string;
  neg: string;
  /** Rebuilt on demand; read by the solver at the top of each step. */
  auxLines: AuxRail[];
  refreshRails(): void;
  noteRailCurrent(rail: string, current: number, imax: number): void;
}

/** One auxiliary output of a supply — a 3φ line, a fixed DC tap. */
export interface AuxRail {
  /** Which rail this line belongs to, e.g. `vac`, `f3p`, `d24`. */
  rail: string;
  pos: string;
  neg: string;
  V?: number;
  Imax?: number;
  /**
   * True when the rail is de-energised. An open rail is omitted from the
   * stamp entirely — an ideal source at V = 0 would be a dead short.
   */
  open?: boolean;
  /** Mains frequency for lines that feed a machine. */
  f?: number;
}

/** A rotating machine — anything the mechanical pass can couple. */
export interface Machine extends Device {
  /** Rotor inertia, kg·m². Required, not optional: see the note above. */
  J: number;
  /** Angular velocity, rad/s. */
  omega: number;
  /** Prime-mover speed. > 0 means this side pins the shaft speed. */
  primeRpm: number;
  /** Set by the mechanical pass when a coupling owns this machine's speed. */
  _coupled?: boolean;
}

/** Runtime check for the mechanical pass. */
export function isMachine(d: Device): d is Machine {
  const m = d as Partial<Machine>;
  return typeof m.J === 'number' && typeof m.omega === 'number';
}

/** Runtime check for the supply device. */
export function isSupply(d: Device): d is SupplyDevice {
  return d.type === 'dc_supply';
}
