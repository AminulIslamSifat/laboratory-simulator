/**
 * Exp 05 — the REAL bench, as saved from a working session.
 *
 * Pulled from MongoDB (roll 2403123, name "Real-exp5", saved 2026-10-06).
 *
 * This is a verbatim copy of the saved bench data. It is kept here, in
 * `src/`, rather than imported from `benches/` for two reasons:
 *
 *   1. `benches/` is a RUNTIME write target. The bench API writes saved
 *      experiments into it. A preset that imports from a folder the app also
 *      writes to would change meaning depending on what was last saved.
 *   2. A preset is source. It ships in the bundle, so it has to be a module.
 *
 * It is a separate file from `presets.ts` because it is DATA, and coordinates
 * wedged between two preset definitions makes both harder to read.
 *
 * Do not hand-edit the numbers. Re-save the bench in the lab, pull from
 * MongoDB, then copy the JSON back over this file.
 */

import type { SavedBench } from './exp04-bench.js';

export const EXP05_BENCH: SavedBench = {
  devices: [
    {
      id: 'power_supply_11_h1jw',
      kind: 'power_supply',
      x: 47.236859304018,
      y: -144.59270391811773,
      rot: 0,
      state: {
        master: true,
        estop: false,
        enabled: true,
        rails: {
          vdc: { on: false, set: 0 },
          vac: { on: true, set: 230, f: 50 },
          f3p: { on: false, set: 400 },
          d24: { on: false, set: 24, tap: 24 },
          d50: { on: false, set: 50 }
        }
      }
    },
    {
      id: 'async_motor_1p_12_kdh1',
      kind: 'async_motor_1p',
      x: 595.8117819329279,
      y: -129.45453424729152,
      rot: 0,
      state: { omega: 0 }
    },
    {
      id: 'meter_rack_13_wte8',
      kind: 'meter_rack',
      x: -197.41533726914062,
      y: 659.0069298711128,
      rot: 0,
      state: {
        modes: {
          d1: 'V',
          d2b: 'V',
          d2: 'V',
          d3: 'A'
        }
      }
    }
  ],
  wires: [
    { aDev: 'async_motor_1p_12_kdh1', aTerm: 'Z1', bDev: 'async_motor_1p_12_kdh1', bTerm: 'C' },
    { aDev: 'async_motor_1p_12_kdh1', aTerm: 'Z2', bDev: 'async_motor_1p_12_kdh1', bTerm: 'U2' },
    { aDev: 'power_supply_11_h1jw', aTerm: 'AC-N', bDev: 'meter_rack_13_wte8', bTerm: 'N' },
    { aDev: 'power_supply_11_h1jw', aTerm: 'AC-L3', bDev: 'meter_rack_13_wte8', bTerm: 'L3' },
    { aDev: 'meter_rack_13_wte8', aTerm: 'N', bDev: 'async_motor_1p_12_kdh1', bTerm: 'U2' },
    { aDev: 'async_motor_1p_12_kdh1', aTerm: 'U1', bDev: 'async_motor_1p_12_kdh1', bTerm: 'C2' },
    { aDev: 'async_motor_1p_12_kdh1', aTerm: 'U1', bDev: 'meter_rack_13_wte8', bTerm: 'C' }
  ]
};
