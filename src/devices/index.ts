/**
 * Equipment registry.
 *
 * One entry per palette kind. Each device folder owns one device completely:
 * the SVG it paints (`sprite.ts`) and the layout the lab needs to drop
 * clickable dots on printed jacks and route front-panel controls
 * (`layout.ts`). The device model will move in beside them so the terminal
 * list stops being a thing anyone has to remember to sync.
 */

import { dcMachine } from './dc-machine/layout.js';
import { motor3p } from './motor-3p/layout.js';
import { motor1p } from './motor-1p/layout.js';
import { transformer } from './transformer/layout.js';
import { syncGen } from './sync-gen/layout.js';
import { rheostat } from './rheostat/layout.js';
import { powerSupply } from './power-supply/layout.js';
import { loadBank } from './load-bank/layout.js';
import { meter } from './meter/layout.js';
import { coupling } from './coupling/layout.js';
import { meterRack } from './meter-rack/layout.js';
import type { EquipmentRegistry } from './_shared/types.js';

/** Every palette kind the lab can place. */
export const EQUIPMENT: EquipmentRegistry = {
  dc_machine: dcMachine,
  async_motor_3p: motor3p,
  async_motor_1p: motor1p,
  single_phase_transformer: transformer,
  sync_gen: syncGen,
  rheostat: rheostat,
  power_supply: powerSupply,
  load_bank: loadBank,
  meter: meter,
  coupling: coupling,
  meter_rack: meterRack,
};

/* ────────────────────────────────────────────────────────────────
   Electrical models

   Each device folder owns its model beside its sprite and layout. That is
   the point of the refactor: the terminal list a model reads and the
   terminal list the panel draws are the same file, so they cannot drift.
   ──────────────────────────────────────────────────────────────── */

// Imported first, then re-exported, because `DEVICE_KINDS` below needs the
// names in LOCAL scope. A bare `export { X } from './x.js'` re-exports X to
// consumers without ever binding it here.
import { DCSupply } from './power-supply/model.js';
import { DCMachine } from './dc-machine/model.js';
import { Motor3P } from './motor-3p/model.js';
import { Motor1P } from './motor-1p/model.js';
import { SyncGen } from './sync-gen/model.js';
import { Transformer } from './transformer/model.js';
import { MeterRack } from './meter-rack/model.js';
import { Rheostat } from './rheostat/model.js';
import { LoadBank } from './load-bank/model.js';
import { Coupling } from './coupling/model.js';
import { Meter } from './meter/model.js';

export {
  DCSupply, DCMachine, Motor3P, Motor1P, SyncGen,
  Transformer, MeterRack, Rheostat, LoadBank, Coupling, Meter
};

export { netVoltage, netDiff, stampConductance, stampNorton } from './_shared/model-util.js';
export { rpmOf, radOf } from './dc-machine/model.js';

export type { DCSupplyOptions } from './power-supply/model.js';
export type { DCMachineOptions } from './dc-machine/model.js';
export type { Motor3POptions } from './motor-3p/model.js';
export type { Motor1POptions } from './motor-1p/model.js';
export type { SyncGenOptions } from './sync-gen/model.js';
export type { TransformerOptions, Section } from './transformer/model.js';
export type { MeterRackOptions } from './meter-rack/model.js';
export type { RheostatOptions } from './rheostat/model.js';
export type { LoadBankOptions } from './load-bank/model.js';
export type { MeterOptions } from './meter/model.js';

/** A constructor taking an optional config bag and returning a device. */
type DeviceCtor = new (opts?: Record<string, unknown>) => unknown;

/**
 * Palette kind -> the class that implements it.
 *
 * The lab reads this to instantiate whatever the user clicked. It is typed
 * loosely on purpose — every constructor takes a DIFFERENT options bag, and
 * the lab has an untyped click payload at this point. The real type safety
 * lives at the construction call, where each device is built explicitly.
 */
export const DEVICE_KINDS: Record<string, DeviceCtor> = {
  dc_machine: DCMachine as unknown as DeviceCtor,
  async_motor_3p: Motor3P as unknown as DeviceCtor,
  async_motor_1p: Motor1P as unknown as DeviceCtor,
  single_phase_transformer: Transformer as unknown as DeviceCtor,
  sync_gen: SyncGen as unknown as DeviceCtor,
  rheostat: Rheostat as unknown as DeviceCtor,
  power_supply: DCSupply as unknown as DeviceCtor,
  load_bank: LoadBank as unknown as DeviceCtor,
  meter: Meter as unknown as DeviceCtor,
  coupling: Coupling as unknown as DeviceCtor,
  meter_rack: MeterRack as unknown as DeviceCtor,
};
