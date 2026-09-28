import { spriteSinglePhaseTransformer } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** single_phase_transformer - panel layout, terminals and front-panel controls. */
export const transformer: EquipmentEntry = {
    label: '1φ Transformer', model: 'M-13/EV', color: '#e0af68', icon: 'zap',
    sprite: spriteSinglePhaseTransformer,
    // Coordinates are DEVICE pixels, not viewBox units — the sprite's
    // viewBox is 1195x896 inside a 360x270 box, so every jack position
    // is multiplied by 360/1195 ≈ 0.30126. lab.js drops the clickable dot
    // in this space; getting it wrong floats the dots off the panel.
    layout: { w: 360, h: 270, terms: [
      { k: 'P230', x: 42.2,  y: 69.3 },
      { k: 'B1',   x: 42.2, y: 104.0 },
      { k: 'B2',   x: 77.1, y: 104.0 },
      { k: 'PE',   x: 42.2, y: 135.6 },
      { k: 'P0',   x: 42.2,  y: 207.9 },
      { k: '2U1',  x: 287.7, y: 51.2 },
      { k: '2U4',  x: 287.7, y: 110.0 },
      { k: '3U1',  x: 287.7, y: 165.7 },
      { k: '3U2',  x: 287.7, y: 210.9 },
      { k: '2U3',  x: 229.0, y: 81.4 },
      { k: '2U2',  x: 229.0, y: 134.1 },
      { k: '3U3',  x: 229.0, y: 189.8 }
    ]}
  };
