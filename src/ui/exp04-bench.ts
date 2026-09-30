/**
 * Exp 04 — the REAL bench, as saved from a working session.
 *
 * This is a verbatim copy of `benches/Real-exp4.json`. It is kept here, in
 * `src/`, rather than imported from `benches/` for two reasons:
 *
 *   1. `benches/` is a RUNTIME write target. The bench API writes saved
 *      experiments into it. A preset that imports from a folder the app also
 *      writes to would change meaning depending on what was last saved.
 *   2. A preset is source. It ships in the bundle, so it has to be a module.
 *
 * It is a separate file from `presets.ts` because it is DATA, and 170 lines of
 * coordinates wedged between two preset definitions makes both harder to read.
 *
 * Do not hand-edit the numbers. Re-save the bench in the lab, then copy the
 * JSON back over this file.
 */

/** One device, exactly as the save format stores it. */
export interface SavedDevice {
  id: string;
  kind: string;
  x: number;
  y: number;
  rot?: number;
  state?: Record<string, unknown>;
}

/** One wire, exactly as the save format stores it. */
export interface SavedWire {
  aDev: string;
  aTerm: string;
  bDev: string;
  bTerm: string;
}

export interface SavedBench {
  devices: SavedDevice[];
  wires: SavedWire[];
}

/**
 * Saved ids of the two rheostats.
 *
 * The bench has TWO of the same kind, so "the rheostat" is ambiguous and the
 * old index-into-the-list trick silently swaps them the moment the device
 * order changes. Naming them here means `setup()` can address the right one by
 * intent, not by position.
 *
 * Which is which is decided by the wiring, not by preference:
 *   - FIELD sits in the loop F2 -> A_BOT ... A_TOP -> DIN2+ -> DIN2- -> F1
 *   - LOAD  sits in the loop A1 -> AA+2 ... B_RED -> AA-2 (the d4 shunt)
 */
export const EXP04_IDS = {
  FIELD_RH: 'rheostat_6_34rl',
  LOAD_RH: 'rheostat_5_hjvd'
} as const;

export const EXP04_BENCH: SavedBench = {
  devices: [
    { id: 'power_supply_1_2xww', kind: 'power_supply', x: 101.03192085169374, y: 227.94089405150737, rot: 0 },
    { id: 'async_motor_3p_2_pc5k', kind: 'async_motor_3p', x: 556.254451468586, y: 132.74018548001052, rot: 270 },
    { id: 'coupling_3_g9x2', kind: 'coupling', x: 1040, y: 240, rot: 0 },
    { id: 'dc_machine_4_oan0', kind: 'dc_machine', x: 1281.9526750412601, y: 200.98820300687078, rot: 180 },
    { id: 'rheostat_5_hjvd', kind: 'rheostat', x: 1099.545933980693, y: 957.5232566291082, rot: 0 },
    { id: 'rheostat_6_34rl', kind: 'rheostat', x: 1677.5853717524544, y: 608.9726487621313, rot: 0 },
    { id: 'meter_rack_7_xxyk', kind: 'meter_rack', x: 977.3200357810117, y: 492.2813641623828, rot: 0 }
  ],
  wires: [
    // Mechanical: 3φ prime mover -> coupling -> DC machine.
    { aDev: 'async_motor_3p_2_pc5k', aTerm: 'SHAFT', bDev: 'coupling_3_g9x2', bTerm: 'MA' },
    { aDev: 'coupling_3_g9x2', aTerm: 'MB', bDev: 'dc_machine_4_oan0', bTerm: 'SHAFT' },
    // Load rheostat, both elements in series (A_BOT -> B_TOP).
    { aDev: 'rheostat_5_hjvd', aTerm: 'A_BOT', bDev: 'rheostat_5_hjvd', bTerm: 'B_TOP' },
    // Prime mover in star: line on the phase starts, star point on the ends.
    { aDev: 'async_motor_3p_2_pc5k', aTerm: 'V2', bDev: 'async_motor_3p_2_pc5k', bTerm: 'U2' },
    { aDev: 'async_motor_3p_2_pc5k', aTerm: 'U2', bDev: 'async_motor_3p_2_pc5k', bTerm: 'W2' },
    { aDev: 'power_supply_1_2xww', aTerm: '3P-L2', bDev: 'async_motor_3p_2_pc5k', bTerm: 'U1' },
    { aDev: 'async_motor_3p_2_pc5k', aTerm: 'V1', bDev: 'power_supply_1_2xww', bTerm: '3P-L3' },
    { aDev: 'power_supply_1_2xww', aTerm: '3P-L1', bDev: 'async_motor_3p_2_pc5k', bTerm: 'W1' },
    // FIELD loop: F2 -> [rheostat] -> DIN2+ -> DIN2- -> F1.
    { aDev: 'dc_machine_4_oan0', aTerm: 'F2', bDev: 'rheostat_6_34rl', bTerm: 'A_BOT' },
    { aDev: 'rheostat_6_34rl', aTerm: 'A_TOP', bDev: 'meter_rack_7_xxyk', bTerm: 'DIN2+' },
    { aDev: 'dc_machine_4_oan0', aTerm: 'F1', bDev: 'meter_rack_7_xxyk', bTerm: 'DIN2-' },
    // Armature voltmeter (DIN 1, across A1/A2).
    { aDev: 'meter_rack_7_xxyk', aTerm: 'DIN1-', bDev: 'dc_machine_4_oan0', bTerm: 'A2' },
    { aDev: 'dc_machine_4_oan0', aTerm: 'A1', bDev: 'meter_rack_7_xxyk', bTerm: 'DIN1+' },
    // LOAD loop through the d4 wattmeter shunt: A1 -> AA+2 -> [rheostat] -> AA-2 -> A2.
    { aDev: 'dc_machine_4_oan0', aTerm: 'A1', bDev: 'meter_rack_7_xxyk', bTerm: 'AA+' },
    { aDev: 'dc_machine_4_oan0', aTerm: 'A2', bDev: 'meter_rack_7_xxyk', bTerm: 'AA-' },
    { aDev: 'meter_rack_7_xxyk', aTerm: 'AA+2', bDev: 'rheostat_5_hjvd', bTerm: 'A_TOP' },
    { aDev: 'rheostat_5_hjvd', aTerm: 'B_RED', bDev: 'meter_rack_7_xxyk', bTerm: 'AA-2' }
  ]
};
