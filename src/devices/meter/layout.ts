import { spriteMeter } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** meter - panel layout, terminals and front-panel controls. */
export const meter: EquipmentEntry = {
    label: 'Panel Meter', model: 'AZ-VIPS/VIDC', color: '#dce3f0', icon: 'gauge',
    sprite: function () { return spriteMeter({ mode: 'V' }); },
    // One V / A meter. V mode uses +/− (high-Z, parallels the load);
    // A mode uses in/out (shunt, sits in series with the load).
    layout: { w: 260, h: 180, terms: [
      { k: '+',   x: 200, y: 79 },
      { k: '-',   x: 200, y: 129 },
      { k: 'in',  x: 60,  y: 79 },
      { k: 'out', x: 60,  y: 129 }
    ]}
  };
