/**
 * Measurement and contact imperfection.
 *
 * Both functions take an explicit `Rng` rather than reaching for a global.
 * That is what makes a bench reproducible: the same seed and the same wiring
 * give the same readings, on any machine, forever.
 *
 * They live in their own module so a device can import them without pulling
 * in the whole solver, and so there is no import cycle between the device
 * library and the simulator that drives it.
 */

import type { Rng } from './rng.js';

/**
 * Contact resistance for a freshly made connection, in ohms.
 *
 * Mostly a clean few milliohms. About 1.5% of the time it is a bad joint —
 * a dirty post or a probe not quite seated — at half an ohm to several ohms.
 * That occasional high-resistance connection is exactly the gremlin that
 * makes a real lab session confusing, so it is worth simulating.
 */
export function contactResistance(rng: Rng): number {
  if (rng.next() < 0.015) return rng.range(0.5, 3.5);
  return rng.range(0.002, 0.022);
}

/**
 * Add Gaussian measurement noise to a reading.
 *
 * Scaled to the magnitude of the value plus a small absolute floor, so a
 * near-zero reading still flickers its last digit the way a real DMM does.
 *
 * @param value  the true quantity
 * @param rng    seeded stream
 * @param relErr relative standard deviation (default 0.4%)
 * @param absErr absolute noise floor, in the reading's own units
 */
export function meterNoise(
  value: number,
  rng: Rng,
  relErr = 0.004,
  absErr = 0
): number {
  const sigma = Math.abs(value) * relErr + absErr;
  return value + rng.gauss() * sigma;
}
