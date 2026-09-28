import { spriteAsyncMotor3P } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** async_motor_3p - panel layout, terminals and front-panel controls. */
export const motor3p: EquipmentEntry = {
    label: '3φ Async Motor', model: 'M-4/EV', color: '#56b6f7', icon: 'rotate-cw',
    sprite: spriteAsyncMotor3P,
    layout: { w: 360, h: 479, terms: [
      { k: 'PE', x: 139, y: 159 },
      // 9 jacks, 3x3 grid. Column x: 131 / 162 / 193. Row y: 270 / 299 / 329.
      //
      // B1 and B2 used to sit at (42.2, 104.0) and (77.1, 104.0) — those are
      // the TRANSFORMER's jack coordinates, pasted in by mistake. They fell
      // outside this panel entirely, so two terminals floated off the top-left
      // corner and no wire could reach them. They belong on the grid like
      // everything else.
      { k: 'W2', x: 131, y: 270 },
      { k: 'U2', x: 162, y: 270 },
      { k: 'W1', x: 193, y: 270 },
      { k: 'A2', x: 131, y: 299 },
      { k: 'A3', x: 162, y: 299 },
      { k: 'D1', x: 193, y: 299 },
      { k: 'B1', x: 131, y: 329 },
      { k: 'B2', x: 162, y: 329 },
      { k: 'C2', x: 193, y: 329 },
      // Shaft port on the painted flange. Must equal the flange CENTRE in
      // device space: 825 * 360/896 = 331.5, 596 * 479/1192 = 239.5. This was
      // 358,273 — the coordinates of a flange that was itself drawn outside
      // the SVG, so the dot marked nothing.
      { k: 'SHAFT', x: 332, y: 240, mech: 1 }
    ]}
  };
