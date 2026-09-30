import { spriteAsyncMotor3P } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** async_motor_3p - panel layout, terminals and front-panel controls. */
export const motor3p: EquipmentEntry = {
    label: '3φ Async Motor', model: 'M-4/EV', color: '#56b6f7', icon: 'rotate-cw',
    sprite: spriteAsyncMotor3P,
    layout: { w: 360, h: 479, terms: [
      { k: 'PE', x: 139, y: 159 },
      // 6 jacks, 2 rows x 3 cols. Column x: 131 / 166 / 200. Row y: 270 / 322.
      //   top row:  V2  U2  W2
      //   bot row:  W1  V1  U1
      // Each is wired separately to M in the sprite.
      { k: 'V2', x: 131, y: 270 },
      { k: 'U2', x: 166, y: 270 },
      { k: 'W2', x: 200, y: 270 },
      { k: 'W1', x: 131, y: 322 },
      { k: 'V1', x: 166, y: 322 },
      { k: 'U1', x: 200, y: 322 },
      // Shaft port on the painted flange, now on the BOTTOM face. Must equal
      // the flange CENTRE in device space: 450 * 360/896 = 180.8,
      // 1085 * 479/1192 = 435.9.
      { k: 'SHAFT', x: 181, y: 436, mech: 1 }
    ]}
  };
