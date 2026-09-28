/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { jack, label, txt } from '../_shared/svg.js';
export function spriteSyncGen() {
  // grid (three_phase_sync_generator.jpg). viewBox spans the whole machine.
  // Left col: F2/W1/V1/U1 · mid col: V2/U2/W2 · right: F1, G, PE
  const W = 400, H = 138;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="70 45 1075 370" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ---- shaft + handle (left) ----
  s += '<rect x="120" y="225" width="118" height="26" fill="#9a9d9b" stroke="#333" stroke-width="2"/>';
  s += '<rect x="82" y="196" width="84" height="84" rx="13" fill="#d9cfa8" stroke="#6a6040" stroke-width="2.4"/>';
  // ---- spinning rotor mark on the shaft ----
  // The bare paint above never moved; this is the element the solver spins.
  s += '<g data-spin="1" transform-origin="150 238">';
  s += '<rect x="120" y="234" width="118" height="8" rx="3" fill="#b23b30" stroke="#111" stroke-width="1.6"/>';
  s += '</g>';
  s += '<circle cx="150" cy="238" r="9" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
  s += txt(150, 288, 'SHAFT', { size: 11, weight: '700', anchor: 'middle' });

  // ---- machine body ----
  s += '<rect x="232" y="58" width="868" height="332" rx="12" fill="#5a5f5d" stroke="#111" stroke-width="3"/>';
  s += '<rect x="244" y="70" width="846" height="308" rx="6" fill="none" stroke="#3a3d3c" stroke-width="1.4"/>';

  // ---- orange strip (right) ----
  s += '<rect x="1058" y="118" width="82" height="230" rx="6" fill="#e8720c" stroke="#8a3f00" stroke-width="2.4"/>';
  s += '<g transform="translate(1099,233) rotate(90)">' +
    txt(0, -14, 'SAFETY RULES IN MOTION', { size: 13, weight: '700', anchor: 'middle' }) +
    txt(0, 4, 'REDUCE THE RISK OF ACCIDENT', { size: 10, anchor: 'middle' }) +
    txt(0, 20, 'NEVER OPERATE WITHOUT', { size: 10, anchor: 'middle' }) +
    txt(0, 36, 'PROTECTION', { size: 10, anchor: 'middle' }) +
    '</g>';

  // ---- white terminal plate ----
  s += '<rect x="588" y="108" width="404" height="240" rx="6" fill="#f4f5ef" stroke="#141414" stroke-width="3.4"/>';
  s += '<rect x="596" y="116" width="388" height="224" rx="3" fill="none" stroke="#3a3a3a" stroke-width="1"/>';

  // ---- header ----
  s += txt(720, 126, 'THREE-PHASE SYNCHRONOUS GENERATOR', { size: 10, weight: '700', anchor: 'middle' });
  s += txt(745, 138, 'I=8mA  V2A/K1,6A  U=400V+-129rms  P=350W', { size: 7.2, anchor: 'middle' });
  s += txt(745, 147, 'cesting/SH   pr2   Nv20V', { size: 7.2, anchor: 'middle' });
  s += txt(745, 156, 'RATING   U4BI>20Hz', { size: 7.2, anchor: 'middle' });
  s += txt(745, 165, 'V1.3A   U=400V+-1239rm', { size: 7.2, anchor: 'middle' });
  s += '<line x1="912" y1="118" x2="912" y2="192" stroke="#111" stroke-width="1.6"/>';
  s += '<line x1="942" y1="118" x2="942" y2="192" stroke="#111" stroke-width="1.6"/>';
  s += txt(927, 136, 'MOT', { size: 11, weight: '700', anchor: 'middle' });
  s += txt(927, 178, 'GEN', { size: 11, weight: '700', anchor: 'middle' });

  // ---- printed schematic (drawn UNDER the jacks, like the reference) ----
  s += '<g stroke="#111" stroke-width="1.6" fill="none">';
  s += '<path d="M 651 185 L 651 170 L 748 170 L 748 218"/>';
  s += '<path d="M 651 225 L 748 232"/>';
  s += '<path d="M 651 265 L 748 248"/>';
  s += '<path d="M 651 305 L 748 262"/>';
  s += '<path d="M 715 225 L 748 236"/>';
  s += '<path d="M 715 265 L 748 248"/>';
  s += '<path d="M 715 305 L 748 258"/>';
  s += '<path d="M 845 205 L 845 218"/>';
  s += '<path d="M 845 290 L 845 303"/>';
  s += '</g>';

  // ---- GMS 3~ circle ----
  s += '<circle cx="782" cy="245" r="27" fill="#fafaf4" stroke="#111" stroke-width="2.6"/>';
  s += label(782, 242, 'GMS', { size: 15, weight: '700', anchor: 'middle' });
  s += label(782, 261, '3~', { size: 12, weight: '700', anchor: 'middle' });

  // ---- field winding + arrow ----
  s += '<g stroke="#111" stroke-width="1.8" fill="none">';
  s += '<path d="M 845 218 L 855 224 L 845 231 L 855 238 L 845 245 L 855 252 L 845 259 L 855 266 L 845 273 L 855 280 L 845 287 L 845 290"/>';
  s += '<path d="M 870 288 L 870 212"/>';
  s += '<path d="M 870 212 L 864 224 L 876 224 Z" fill="#111"/>';
  s += '</g>';

  // ---- jacks ----
  s += jack(651, 190, 'black', 16);
  s += jack(651, 228, 'black', 16);
  s += jack(651, 266, 'black', 16);
  s += jack(651, 304, 'black', 16);
  s += jack(715, 228, 'black', 16);
  s += jack(715, 266, 'black', 16);
  s += jack(715, 304, 'black', 16);
  s += jack(845, 190, 'black', 16);
  s += jack(845, 304, 'red', 17);
  s += jack(978, 235, 'yellow', 16);

  // ---- labels ----
  s += label(632, 196, 'F2', { size: 13, anchor: 'end' });
  s += '<text x="630" y="231" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="600" fill="#111" stroke="#f4f5ef" stroke-width="3.5" paint-order="stroke">W1</text>';
  s += '<text x="630" y="271" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="600" fill="#111" stroke="#f4f5ef" stroke-width="3.5" paint-order="stroke">V1</text>';
  s += '<text x="630" y="311" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="600" fill="#111" stroke="#f4f5ef" stroke-width="3.5" paint-order="stroke">U1</text>';
  s += '<text x="732" y="236" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#111" stroke="#f4f5ef" stroke-width="3.5" paint-order="stroke">V2</text>';
  s += '<text x="732" y="276" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#111" stroke="#f4f5ef" stroke-width="3.5" paint-order="stroke">U2</text>';
  s += '<text x="732" y="316" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="600" fill="#111" stroke="#f4f5ef" stroke-width="3.5" paint-order="stroke">W2</text>';
  s += label(872, 191, 'F1', { size: 13, anchor: 'start' });
  s += label(872, 311, 'G', { size: 13, anchor: 'start' });
  s += label(978, 285, 'PE', { size: 13, anchor: 'middle' });

  // ---- earth symbol above PE ----
  s += '<g stroke="#111" stroke-width="1.8" fill="none" transform="translate(978,182)">' +
    '<line x1="-10" y1="0" x2="10" y2="0"/>' +
    '<line x1="-7" y1="7" x2="7" y2="7"/>' +
    '<line x1="-4" y1="14" x2="4" y2="14"/>' +
    '</g>';

  // ---- bottom title ----
  s += txt(760, 368, 'THREE-PHASE SYNCHRONOUS GENERATOR', { size: 14, weight: '700', anchor: 'middle' });
  s += txt(760, 384, 'GENERATORE SINCRONO TRIFASE   GENERADOR SINCRONO TRIFASICO', { size: 10.5, anchor: 'middle' });

  return s + '</svg>';
}
