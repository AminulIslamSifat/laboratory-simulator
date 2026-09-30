import { spriteMeterRack } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/**
 * meter_rack - panel layout, terminals and front-panel controls.
 *
 * COORDINATE RULE: every x/y here is the CENTRE of a painted feature, in
 * DEVICE pixels (the panel is 560 x 420). The sprite paints in a 1195 x 896
 * viewBox, so a ref coordinate converts as ref * 560/1195 horizontally and
 * ref * 420/896 vertically - and those are NOT the same number (0.46862 vs
 * 0.46875). Using the X scale for Y put every AZ-VIPS hitbox 9-13px above
 * its jack. Every value below is computed with the right one.
 *
 * If you move a jack in sprite.ts, recompute its entry here. There is no
 * checker that can see into the SVG and prove the two agree - the layout
 * test only proves the model and this list match.
 */
export const meterRack: EquipmentEntry = {
  label: 'Measurement Rack', model: 'AZ-VIPS/VIDC', color: '#dce3f0', icon: 'activity',
  sprite: spriteMeterRack,
  layout: {
    w: 560, h: 420,
    terms: [
      // --- AZ-VIPS #1 (Row 1, Bay 2) ---
      // Row 1 is the grey binding posts (ref y148 -> dev y 69.4): the INPUT
      // side, L1 L2 L3 with N on the right, exactly as the bench is wired.
      // Row 2 (the red jacks at ref y170) is unused and carries no terminal.
      // Row 3 (ref y208 -> dev y 97.5) is the outgoing side.
      { k: "L1", x: 164, y: 69.4, tight: 1 },
      { k: "L2", x: 176.2, y: 69.4, tight: 1 },
      { k: "L3", x: 188.4, y: 69.4, tight: 1 },
      { k: "N", x: 200.6, y: 69.4, tight: 1 },
      { k: "R", x: 164, y: 97.5, tight: 1 },
      { k: "D2", x: 176.2, y: 97.5, tight: 1 },
      { k: "C", x: 188.4, y: 97.5, tight: 1 },

      // --- AZ-VIPS #2 (Row 1, Bay 4) - same bank, right of the monitor ---
      { k: "L1b", x: 381.9, y: 69.4, tight: 1 },
      { k: "L2b", x: 391.3, y: 69.4, tight: 1 },
      { k: "L3b", x: 400.7, y: 69.4, tight: 1 },
      { k: "Nb", x: 410, y: 69.4, tight: 1 },
      { k: "Rb", x: 381.9, y: 97.5, tight: 1 },
      { k: "D2b", x: 391.3, y: 97.5, tight: 1 },
      { k: "Cb", x: 400.7, y: 97.5, tight: 1 },

      // --- AA power-supply bay (Row 2, Bay 1) ---
      { k: "AA+", x: 86.2, y: 136.9, tight: 1 },
      { k: "AA-", x: 99.8, y: 136.9, tight: 1 },
      { k: "AA+2", x: 86.2, y: 167.8, tight: 1 },
      { k: "AA-2", x: 99.8, y: 167.8, tight: 1 },

      // --- DIN meter bay (Row 2, Bay 2) ---
      { k: "DIN1+", x: 206.2, y: 135.9, tight: 1 },
      { k: "DIN1-", x: 216.5, y: 135.9, tight: 1 },
      { k: "DIN2+", x: 206.2, y: 168.8, tight: 1 },
      { k: "DIN2-", x: 216.5, y: 168.8, tight: 1 },

      // Series-ammeter jacks removed. The real rack has no terminal in
      // this bay; current is sensed between the row-1 N post and the
      // row-3 leftmost (R) jack. See MeterRack.seriesPos / seriesNeg.
    ],
    // V / A / W switches, one trio per display, each on its painted well
    // and BELOW its monitor - never on top of it.
    buttons: [
      // AZ-VIPS #1 - wells ref 239/269/299, row ref y224
      { d: "d1", m: "V", x: 112, y: 105 },       { d: "d1", m: "A", x: 126.1, y: 105 },       { d: "d1", m: "W", x: 140.1, y: 105 },
      // AZ-VIPS #2 - wells ref 739/769/799, row ref y210
      { d: "d2b", m: "V", x: 346.3, y: 98.4 },       { d: "d2b", m: "A", x: 360.4, y: 98.4 },       { d: "d2b", m: "W", x: 374.4, y: 98.4 },
      // DIN d3 - wells ref 247/269/291, row ref y382
      { d: "d3", m: "V", x: 115.7, y: 179.1 },       { d: "d3", m: "A", x: 126.1, y: 179.1 },       { d: "d3", m: "W", x: 136.4, y: 179.1 },
      // DIN d4 - wells ref 333/355/377, row ref y382
      { d: "d4", m: "V", x: 156.1, y: 179.1 },       { d: "d4", m: "A", x: 166.4, y: 179.1 },       { d: "d4", m: "W", x: 176.7, y: 179.1 }
    ]
  }
};
