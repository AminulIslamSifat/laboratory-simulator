import { spriteSyncGen } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** sync_gen - panel layout, terminals and front-panel controls. */
export const syncGen: EquipmentEntry = {
    label: 'Sync Generator', model: 'GMS', color: '#bb9af7', icon: 'waves',
    sprite: spriteSyncGen,
    layout: { w: 400, h: 138, terms: [
      { k: 'F2', x: 216, y: 53 },
      { k: 'W1', x: 216, y: 68 },
      { k: 'V1', x: 216, y: 83 },
      { k: 'U1', x: 216, y: 98 },
      { k: 'V2', x: 240, y: 68 },
      { k: 'U2', x: 240, y: 83 },
      { k: 'W2', x: 240, y: 98 },
      { k: 'F1', x: 288, y: 53 },
      { k: 'G',  x: 288, y: 98 },
      // Shaft port on the painted handle at device(30,72).
      { k: 'SHAFT', x: 30, y: 72, mech: 1 }
    ]}
  };
