import { spriteCoupling } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** coupling - panel layout, terminals and front-panel controls. */
export const coupling: EquipmentEntry = {
    label: 'Shaft Coupling', model: 'RIGID', color: '#ff9e64', icon: 'link',
    sprite: spriteCoupling,
    // Mechanical ports only — no electrical terminals. `mech:1` marks them so
    // the renderer styles them differently and wiring.js knows not to push a
    // current through them.
    // Ports sit ON the flange centres. 24px hitbox so they are easy to grab —
    // a mech port is a big bolt, not a tiny banana jack.
    layout: { w: 200, h: 120, terms: [
      { k: 'MA', x: 12,  y: 60, mech: 1 },
      { k: 'MB', x: 188, y: 60, mech: 1 }
    ]}
  };
