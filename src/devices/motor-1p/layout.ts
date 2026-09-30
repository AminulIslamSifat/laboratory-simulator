import { spriteAsyncMotor1P } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** async_motor_1p - panel layout, terminals and front-panel controls. */
export const motor1p: EquipmentEntry = {
    label: '1φ Async Motor', model: 'M-R/CV', color: '#56b6f7', icon: 'rotate-cw',
    sprite: spriteAsyncMotor1P,
    layout: { w: 360, h: 270, terms: [
      { k: 'Z1',   x: 134, y: 121 },
      { k: 'Z2',   x: 155, y: 121 },
      { k: 'C',    x: 188, y: 121 },
      { k: 'C2',   x: 230, y: 121 },
      { k: 'U1',   x: 208, y: 148 },
      { k: 'U2',   x: 208, y: 167 },
      { k: 'PE',   x: 236, y: 160 },
      // Shaft port on the painted flange at device(314,141).
      { k: 'SHAFT', x: 314, y: 141, mech: 1 }
    ]}
  };
