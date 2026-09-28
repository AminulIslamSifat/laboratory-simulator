/**
 * Small helpers shared by the device models.
 *
 * The recurring hazard in every `update()` is that `netOf()` returns
 * `undefined` for a terminal that is declared but not wired. Indexing `V`
 * with `undefined` yields `undefined`, and `undefined - undefined` produces
 * NaN, which then propagates into omega, into the thermal integrator, and
 * finally into every readout on the bench. These helpers make the unwired
 * case an explicit zero instead of a silent NaN.
 */

import type { Solution } from '../types.js';

/** Potential at a terminal, or 0 V if it is not part of any net. */
export function netVoltage(sol: Solution, deviceId: string, terminal: string): number {
  const n = sol.netOf(deviceId, terminal);
  if (n === undefined) return 0;
  const v = sol.V[n];
  return Number.isFinite(v) ? v : 0;
}

/** Potential difference across two terminals of one device. */
export function netDiff(
  sol: Solution,
  deviceId: string,
  pos: string,
  neg: string
): number {
  return netVoltage(sol, deviceId, pos) - netVoltage(sol, deviceId, neg);
}

/** Minimal shape needed to stamp into the matrix. */
interface StampTarget {
  G: Float64Array;
  I?: Float64Array;
  n: number;
}

/**
 * Conductance stamp between two nets.
 *
 * No-op when either net is missing or they are the same net. Stamping across
 * a shorted pair would add `g` to the diagonal twice and subtract it twice,
 * cancelling to zero, but it is clearer to skip outright.
 */
export function stampConductance(
  mna: StampTarget,
  a: number | undefined,
  b: number | undefined,
  g: number
): void {
  if (a === undefined || b === undefined || a === b) return;
  if (!Number.isFinite(g) || g === 0) return;
  const n = mna.n;
  mna.G[a * n + a] += g;
  mna.G[b * n + b] += g;
  mna.G[a * n + b] -= g;
  mna.G[b * n + a] -= g;
}

/**
 * Norton equivalent of an EMF in series with a resistance: a conductance plus
 * a current injection into each terminal.
 *
 * @param sign +1 when the EMF drives a to b, -1 for b to a
 */
export function stampNorton(
  mna: StampTarget,
  a: number | undefined,
  b: number | undefined,
  g: number,
  emf: number,
  sign = 1
): void {
  if (a === undefined || b === undefined || a === b) return;
  if (!Number.isFinite(g) || g === 0) return;
  const n = mna.n;
  mna.G[a * n + a] += g;
  mna.G[b * n + b] += g;
  mna.G[a * n + b] -= g;
  mna.G[b * n + a] -= g;
  const inj = Number.isFinite(emf) ? g * emf * sign : 0;
  if (mna.I) {
    mna.I[a] += inj;
    mna.I[b] -= inj;
  }
}
