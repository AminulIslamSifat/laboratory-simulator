import { spriteLoadBank } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** load_bank - panel layout, terminals and front-panel controls. */
export const loadBank: EquipmentEntry = {
    label: 'Load Bank', model: 'RESISTIVE', color: '#8b95aa', icon: 'layers',
    sprite: spriteLoadBank,
    layout: { w: 260, h: 180, terms: [
      { k: 'A', x: 50,  y: 140 },
      { k: 'B', x: 210, y: 140 }
    ]}
  };
