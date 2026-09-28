import { spriteRheostat } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** rheostat - panel layout, terminals and front-panel controls. */
export const rheostat: EquipmentEntry = {
    label: 'Rheostat / Load', model: '308T', color: '#ff9e64', icon: 'sliders-horizontal',
    sprite: spriteRheostat,
    layout: { w: 320, h: 366, terms: [
      { k: 'A_TOP', x: 74,  y: 200 },
      { k: 'A_BOT', x: 123, y: 312 },
      { k: 'B_TOP', x: 246, y: 200 },
      { k: 'B_YEL', x: 211, y: 327 },
      { k: 'B_RED', x: 279, y: 327 }
    ]}
  };
