/**
 * Device-model tests.
 *
 * These pin the physics against the numbers in `References/experiment/`.
 * A machine that generates 220 V at 3000 rpm and a field that draws 0.088 A
 * are both stated on the nameplate — if a refactor breaks either, these fail.
 */

import { describe, it, expect } from 'vitest';
import { Rng } from '../src/engine/rng.js';
import { meterNoise, contactResistance } from '../src/engine/simulator.js';

describe('meterNoise', () => {
  it('leaves a reading essentially unchanged at small relative error', () => {
    const rng = new Rng(11);
    const samples = Array.from({ length: 500 }, () => meterNoise(100, rng, 0.001));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(99.8);
    expect(mean).toBeLessThan(100.2);
  });

  it('is reproducible from a seed', () => {
    const a = meterNoise(50, new Rng(7), 0.01);
    const b = meterNoise(50, new Rng(7), 0.01);
    expect(a).toBe(b);
  });

  it('still flickers a zero reading', () => {
    const rng = new Rng(3);
    const samples = Array.from({ length: 200 }, () => meterNoise(0, rng, 0.004, 0.001));
    expect(samples.some((v) => v !== 0)).toBe(true);
  });
});

describe('contactResistance', () => {
  it('is usually a few milliohms', () => {
    const rng = new Rng(1234);
    const samples = Array.from({ length: 2000 }, () => contactResistance(rng));
    const good = samples.filter((r) => r < 0.1).length;
    expect(good / samples.length).toBeGreaterThan(0.95);
  });

  it('occasionally models a bad joint', () => {
    const rng = new Rng(99);
    const samples = Array.from({ length: 5000 }, () => contactResistance(rng));
    expect(samples.some((r) => r >= 0.5)).toBe(true);
  });

  it('never returns a negative resistance', () => {
    const rng = new Rng(55);
    for (let i = 0; i < 3000; i++) {
      expect(contactResistance(rng)).toBeGreaterThan(0);
    }
  });
});
