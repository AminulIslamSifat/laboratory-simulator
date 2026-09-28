import { spriteMeterRack } from './sprite.js';
import type { EquipmentEntry } from '../_shared/types.js';

/** meter_rack - panel layout, terminals and front-panel controls. */
export const meterRack: EquipmentEntry = {
    label: 'Measurement Rack', model: 'AZ-VIPS/VIDC', color: '#dce3f0', icon: 'activity',
    sprite: spriteMeterRack,
    // Two access points per measurement section:
    //  - AZ-VIPS top jacks (Row 1, Bay 2) — the printed A1/A2/B1/B2/R/D binding posts
    //  - Bench connections (Row 4, Bay 1) — the canonical wired terminals
    // viewBox (514,196)@9r etc. scaled to device px by w/1195 = 560/1195.
    // All coordinates below are DEVICE pixels (ref px × 560/1195 = ref × 0.46862).
    layout: {
      w: 560, h: 420,
      terms: [
      // ─── AZ-VIPS measurement posts (Row 1 Bay 2) — traced jack positions ───
      // Painted 12.2px apart horizontally and 13.3px between rows. Both
      // gaps are smaller than a 20px dot, so mark them tight (12px) or the
      // hitboxes stack three-deep and steal each other's clicks.
      { k: 'A1', x: 164.0, y: 70.8, tight: 1 },
      { k: 'B1', x: 176.2, y: 70.8, tight: 1 },
      { k: 'B2', x: 188.4, y: 70.8, tight: 1 },
      { k: 'D',  x: 200.6, y: 70.8, tight: 1 },
      { k: 'R',  x: 164.0, y: 84.1, tight: 1 },
      { k: 'D2', x: 176.2, y: 84.1, tight: 1 },
      { k: 'C',  x: 188.4, y: 84.1, tight: 1 },

      // ─── AA POWER SUPPLY bay jacks (Row 2 Bay 1, spriteAAPower) ───
      // Painted at ref (184,292)(213,292) top and (184,358)(213,358) bottom.
      // Each column is one node: top+ and bot+ are the same wire, same for −.
      // tight:1 shrinks the clickable dot so the two columns (13.6px apart)
      // stop overlapping — the painted jacks stay put, only the hitbox shrinks.
      { k: 'AA+',  x: 86.2, y: 136.8, tight: 1 },
      { k: 'AA-',  x: 99.8, y: 136.8, tight: 1 },
      { k: 'AA+2', x: 86.2, y: 167.8, tight: 1 },
      { k: 'AA-2', x: 99.8, y: 167.8, tight: 1 },

      // ─── DIN meter bay jacks (Row 2 Bay 2, spriteDINMeters) ───
      // Top pair (ref 440/462,290) is display d3's input.
      // Bottom pair (ref 440/462,360) is display d4's input.
      // Top/bottom of the SAME column are shorted — the loop closes either way.
      // nudge x outward by 2px each side for a touch more horizontal air.
      { k: 'DIN1+', x: 204.2, y: 135.9, tight: 1 },
      { k: 'DIN1-', x: 218.5, y: 135.9, tight: 1 },
      { k: 'DIN2+', x: 204.2, y: 168.7, tight: 1 },
      { k: 'DIN2-', x: 218.5, y: 168.7, tight: 1 },

      // ─── Shared rack series-shunt posts (bottom-right of AA supply bay) ───
      { k: 'in',  x: 478.0, y: 291.9 },
      { k: 'out', x: 478.0, y: 314.9 }
      ],
      // V / A / W switches — one trio sitting on the panel right beside each LCD.
      // d1/d2 LCDs live on Row 1 (d1 ref x225..302,y128..186 → dev ~x105..141);
      // d3/d4 LCDs live on Row 2 Bay 2 (ref x236/339,y323..373 → dev ~x110..176).
      buttons: [
        { d: 'd1', m: 'V', x: 106.0, y: 63.0 }, { d: 'd1', m: 'A', x: 121.0, y: 63.0 }, { d: 'd1', m: 'W', x: 136.0, y: 63.0 },
        { d: 'd2', m: 'V', x: 291.0, y: 63.0 }, { d: 'd2', m: 'A', x: 306.0, y: 63.0 }, { d: 'd2', m: 'W', x: 321.0, y: 63.0 },
        { d: 'd3', m: 'V', x: 118.5, y: 176.0 }, { d: 'd3', m: 'A', x: 133.5, y: 176.0 }, { d: 'd3', m: 'W', x: 148.5, y: 176.0 },
        { d: 'd4', m: 'V', x: 166.5, y: 176.0 }, { d: 'd4', m: 'A', x: 181.5, y: 176.0 }, { d: 'd4', m: 'W', x: 196.5, y: 176.0 }
      ]
    }
  };
