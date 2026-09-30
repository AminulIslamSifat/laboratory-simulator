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
    ],
    // Two independent wiper dials, one per element. Drag vertically to move
    // that unit's wiper, which sets its pos in 0..1 and changes R = 500*pos.
    // Both sit at the MIDDLE of their track (viewBox y=235 -> device y=54):
    // unit A viewBox x=190 -> device 74, unit B viewBox x=490 -> device 246.
    controls: [
      { id: 'posA', type: 'dial', x: 74,  y: 54, min: 0, max: 1, unit: '', title: 'Unit A wiper (R = 500 x pos)' },
      { id: 'posB', type: 'dial', x: 246, y: 54, min: 0, max: 1, unit: '', title: 'Unit B wiper (R = 500 x pos)' }
    ]}
  };
