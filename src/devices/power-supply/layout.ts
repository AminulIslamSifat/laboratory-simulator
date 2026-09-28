import { spritePowerSupply } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** power_supply - panel layout, terminals and front-panel controls. */
export const powerSupply: EquipmentEntry = {
    label: 'Power Supply', model: 'AV-1/EV', color: '#5cd4a0', icon: 'plug-zap',
    sprite: spritePowerSupply,
    layout: { w: 385, h: 439, terms: [
      // variable AC line (printed L1 L2 L3 L4 PE)
      { k: 'AC-L1', x: 48.3,  y: 171.5 },
      { k: 'AC-L2', x: 70.1,  y: 171.5 },
      { k: 'AC-L3', x: 92.5,  y: 171.5 },
      { k: 'AC-N',  x: 114.3, y: 171.5 },
      { k: 'AC-PE', x: 136.6, y: 170.9 },
      // variable DC line
      { k: 'DC+',   x: 313.3, y: 171.5 },
      { k: 'DC-',   x: 335.1, y: 171.5 },
      // fixed three-phase 400 V line
      { k: '3P-L1', x: 48.3,  y: 300.3 },
      { k: '3P-L2', x: 70.1,  y: 300.3 },
      { k: '3P-L3', x: 92.5,  y: 300.3 },
      { k: '3P-L4', x: 114.3, y: 300.3 },
      { k: '3P-PE', x: 136.6, y: 300.3 },
      // fixed DC 6/12/24 V
      { k: 'DC+24', x: 225.5, y: 300.3 },
      { k: 'DC-24', x: 247.3, y: 300.3 },
      // fixed DC 50 V
      { k: 'DC+50', x: 313.8, y: 300.3 },
      { k: 'DC-50', x: 335.6, y: 300.3 }
    ],

    // Front-panel controls. Coordinates are DEVICE pixels (385 x 439),
    // derived from the sprite's raw reference-photo grid via
    //   dev.x = (ref.x - 226) * 385/741    dev.y = ref.y * 439/845
    // lab.js overlays one HTML element per entry and routes every change
    // through model.setControl(id, value).
    controls: [
      // variable section
      { id: 'vdcOn', type: 'toggle', x: 132.5, y: 57.7,  title: 'Variable line ON/OFF' },
      { id: 'vdcV',  type: 'dial',   x: 221.3, y: 85.7,  min: 0, max: 250, unit: 'V', title: 'Variable DC 0-250 V' },
      { id: 'vacV',  type: 'dial',   x: 310.7, y: 114.3, min: 0, max: 440, unit: 'V', title: 'Variable AC 0-440 V' },
      { id: 'vacF',  type: 'select', x: 324.2, y: 94.6,  options: [50, 60], unit: 'Hz', title: 'Mains frequency 50 / 60 Hz' },
      { id: 'vacOn', type: 'toggle', x: 221.3, y: 171.4, title: 'Variable AC output ON/OFF' },

      // fixed lines
      { id: 'f3pOn', type: 'toggle', x: 125.7, y: 232.2, title: 'Fixed 3-phase 400 V ON/OFF' },
      { id: 'd24On', type: 'toggle', x: 236.4, y: 232.2, title: 'Fixed 6/12/24 V DC ON/OFF' },
      { id: 'tap',   type: 'select', x: 236.4, y: 275.3, options: [6, 12, 24], unit: 'V', title: 'Low-voltage DC tap' },
      { id: 'd50On', type: 'toggle', x: 280.0, y: 231.7, title: 'Fixed 50 V DC ON/OFF' },

      // main line
      { id: 'master', type: 'toggle', x: 181.8, y: 363.7, title: 'Main isolator' },
      { id: 'estop',  type: 'button', x: 276.4, y: 361.1, danger: 1, title: 'Emergency stop (latching)' },
      { id: 'start',  type: 'button', x: 325.8, y: 360.6, ok: 1, title: 'START - clears e-stop and re-arms' },
      { id: 'reset',  type: 'button', x: 283.7, y: 300.3, title: 'Breaker RESET' }
    ],

    // V / A / F mode switches for the two front-panel ESAM windows. Same
    // shape MeterRack uses, so lab.js's existing .mbtn plumbing works.
    buttons: [
      { d: 'm1', m: 'V', x: 37.9,  y: 76.4 },
      { d: 'm1', m: 'A', x: 46.3,  y: 76.4 },
      { d: 'm1', m: 'F', x: 54.5,  y: 76.4 },
      { d: 'm2', m: 'V', x: 292.0, y: 77.4 },
      { d: 'm2', m: 'A', x: 300.3, y: 77.4 },
      { d: 'm2', m: 'F', x: 308.6, y: 77.4 }
    ]
    }
  };
