import { spriteDCMachine } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** dc_machine - panel layout, terminals and front-panel controls. */
export const dcMachine: EquipmentEntry = {
    label: 'DC Motor / Generator', model: 'M1-2/EV', color: '#56b6f7', icon: 'cog',
    sprite: spriteDCMachine,
    layout: { w: 360, h: 270, terms: [
      { k: 'PE', x: 117, y: 134 },
      { k: 'A2', x: 116, y: 151 },
      { k: 'D3', x: 114, y: 168 },
      { k: 'D1', x: 114, y: 186 },
      // Photo had A1/D2 swapped. Upper centre = shorted A1 tap, lower = D2,
      // right = main A1. Both A1 keys fold into one net.
      { k: 'A1', x: 161, y: 157 },
      { k: 'D2', x: 161, y: 177 },
      { k: 'A1', x: 193, y: 172 },
      { k: 'F1', x: 255, y: 142 },
      { k: 'F2', x: 261, y: 181 },
      // Mechanical shaft port — sits on the painted flange centre.
      // A coupling's MA/MB snaps here. Carries torque, not current.
      // Flange is at viewBox (1140,440): 1140 * 360/1195 = 343.4,
      // 440 * 270/896 = 132.6. Must track the flange if it ever moves.
      { k: 'SHAFT', x: 343, y: 133, mech: 1 }
    ]}
  };
