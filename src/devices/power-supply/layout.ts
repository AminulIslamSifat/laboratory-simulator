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
    //
    // Positions are DEVICE pixels, computed from the sprite's raw reference
    // grid via  dev.x = (raw.x - 226) * 385/741   dev.y = raw.y * 439/845.
    //
    // The switches sit ON the AEG breaker blocks the sprite paints, because
    // that is what they are: on this machine the AEG block IS the line's
    // on/off. The previous coordinates came from a different reference grid,
    // so every toggle floated in empty panel space a hundred pixels from its
    // own painted switch - the user clicked the AEG picture and nothing
    // happened, while an invisible hitbox sat somewhere else entirely.
    controls: [
      // ── variable line (top band) ──
      // One AEG block drives both variable rails; DC on the left pole, AC on
      // the right, as printed. Both overlays land on that block.
      { id: 'vdcOn', type: 'toggle', x: 61.0,  y: 116.1, title: 'Variable DC line ON/OFF (AEG)' },
      { id: 'vacOn', type: 'toggle', x: 107.0, y: 116.1, title: 'Variable AC line ON/OFF (AEG)' },
      // The big white variac is painted at raw (652,165) in the sprite's
      // 741x845 grid, i.e. device (221.3, 85.7) with a 29px radius. Both
      // variable rails are driven from that ONE physical knob, so the dial
      // overlay sits exactly on it - not off in empty panel space where it
      // could not be grabbed. The winding range is the AC rail's 0-440 V, the
      // wider of the two; the DC rail shares the shaft and is scaled in the
      // model.
      { id: 'vacV',  type: 'dial',   x: 221.3, y: 85.7,  min: 0, max: 440, unit: 'V', title: 'Variable line 0-440 V (variac)' },
      { id: 'vdcV',  type: 'dial',   x: 310.7, y: 114.3, min: 0, max: 250, unit: 'V', title: 'Variable DC 0-250 V' },
      { id: 'vacF',  type: 'select', x: 324.2, y: 94.6,  options: [50, 60], unit: 'Hz', title: 'Mains frequency 50 / 60 Hz' },

      // ── fixed 3-phase 400 V (middle band, left cell) ──
      { id: 'f3pOn', type: 'toggle', x: 64.9, y: 247.0, title: 'Fixed 3-phase 400 V ON/OFF (AEG)' },

      // ── fixed 6/12/24 V DC (middle band, centre cell) ──
      { id: 'd24On', type: 'toggle', x: 236.4, y: 232.2, title: 'Fixed 6/12/24 V DC ON/OFF' },
      { id: 'tap',   type: 'select', x: 236.4, y: 275.3, options: [6, 12, 24], unit: 'V', title: 'Low-voltage DC tap' },

      // ── fixed 50 V DC (middle band, right cell) ──
      { id: 'd50On', type: 'toggle', x: 280.0, y: 231.7, title: 'Fixed 50 V DC ON/OFF' },

      // ── main line (bottom band) ──
      // The main AEG block is the incoming isolator; START / e-stop sit to its
      // right exactly where the sprite paints the green and red mushrooms.
      { id: 'master', type: 'toggle', x: 63.9, y: 362.1, title: 'Main isolator (AEG)' },
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
