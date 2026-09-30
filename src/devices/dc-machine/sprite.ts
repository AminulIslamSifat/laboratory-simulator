/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { jack, label, txt, screw, panel } from '../_shared/svg.js';
export function spriteDCMachine() {
  // Traced on the reference photo's own pixel grid (motor.jpg, 1195x896),
  // emitted at bench scale — same convention as spritePowerSupply().
  const W = 360, H = 270;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 1195 896" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ---- orange warning strips flanking the machine ----
  s += '<rect x="110" y="140" width="56" height="520" rx="6" fill="#e8720c" stroke="#8a3f00" stroke-width="2.4"/>';
  s += '<rect x="1030" y="140" width="56" height="520" rx="6" fill="#e8720c" stroke="#8a3f00" stroke-width="2.4"/>';
  s += '<g transform="translate(138,400) rotate(-90)">' +
    txt(0, -10, 'WARNING !  ATTENZIONE !', { size: 22, weight: '700', anchor: 'middle' }) +
    txt(0, 18, 'MECHANICAL PARTS IN MOVEMENT', { size: 13, anchor: 'middle' }) +
    txt(0, 38, 'PARTI MECCANICHE IN MOVIMENTO', { size: 13, anchor: 'middle' }) +
    '</g>';
  s += '<g transform="translate(1058,400) rotate(90)">' +
    txt(0, -10, 'WARNING !  ATTENZIONE !', { size: 22, weight: '700', anchor: 'middle' }) +
    txt(0, 18, 'MECHANICAL PARTS IN MOVEMENT', { size: 13, anchor: 'middle' }) +
    txt(0, 38, 'PARTI MECCANICHE IN MOVIMENTO', { size: 13, anchor: 'middle' }) +
    '</g>';

  // ---- machine casing + white terminal plate ----
  s += '<rect x="150" y="80" width="900" height="720" rx="38" fill="#5b615f" stroke="#111" stroke-width="3"/>';
  s += '<rect x="205" y="285" width="790" height="452" rx="8" fill="#f4f5ef" stroke="#141414" stroke-width="4"/>';
  s += '<rect x="217" y="297" width="766" height="428" rx="4" fill="none" stroke="#3a3a3a" stroke-width="1.4"/>';
  s += screw(233, 313) + screw(967, 313) + screw(233, 709) + screw(967, 709);

  // ---- printed nameplate (top strip of the plate) ----
  s += txt(430, 320, 'mod. M1-2/EV    Amax = 0 / 220V    V = 1,4A    V = 220V', { size: 14, weight: '600' });
  s += txt(430, 338, "V'A = 1,8A    Vnsc. = 220V    n = 3000 rpm (m/min)    S1", { size: 14 });
  s += txt(430, 356, 'EXC. COMP.   EXC. SERIES   P = 300W   (F1 - F0) = (D0 - 24)', { size: 14 });
  s += txt(430, 374, 'V = 220V S1   I = 1,4A   EXC. SEP.   (D1 - D2)', { size: 14 });
  s += txt(430, 392, 'I = 1,4A   EXC. SERIES   (F1 - F2)', { size: 14 });
  s += txt(920, 322, 'GEN', { size: 16, weight: '700', anchor: 'end' });
  s += txt(920, 348, 'MOT', { size: 16, weight: '700', anchor: 'end' });

  // ---- printed schematic: traced from motor.jpg ----
  // Topology (verified against the reference photo):
  //   A2  --(over the top)--> MG top brush
  //   D3/D1 --[vertical commutating zigzag]--> rail --> up into A1 (upper centre)
  //   A1  --(drop + switch/diode)--> MG left brush
  //   D2 (lower centre) ----------> MG bottom brush
  //   MG right brush --[vertical series zigzag]--> F1
  //   F2  --(bottom return)--> rail
  s += '<g stroke="#111" stroke-width="2.6" fill="none" stroke-linejoin="round" stroke-linecap="round">';
  // NET 1: A2 -> MG TOP brush. A2 rises straight up on its own vertical,
  // crosses the top on a dedicated rail, drops into the MG top brush.
  s += '<path d="M 386 500 L 386 452 L 676 452 L 676 499"/>';
  // NET 2: A1 -> MG BOTTOM brush. A1 is an ARMATURE terminal: it runs alone,
  // clear of every other line, straight to the MG bottom brush. Nothing else
  // rides this wire.
  s += '<path d="M 536 520 L 536 520 L 640 520 L 640 605 L 676 605"/>';
  // switch sits on its own stub off the A1 jack (kept as the plate draws it)
  s += '<path d="M 536 520 L 576 520"/>';
  s += '<circle cx="580" cy="520" r="5.5" fill="#111" stroke="none"/>';
  s += '<path d="M 580 520 L 598 510"/>';
  s += '<circle cx="606" cy="520" r="5.5" fill="#111" stroke="none"/>';
  s += '<path d="M 606 520 L 626 520 L 626 552"/>';
  // NET 3: D1 + D2 tied together, then through the left resistor.
  // D3 drops to the node; D1 rises to the node; D2 drops to the node.
  // This node is a SEPARATE net from A1/MG.
  s += '<path d="M 379 558 L 420 558 L 420 596"/>';
  s += '<path d="M 379 616 L 420 616 L 420 596"/>';
  // node -> left resistor -> up into the A1 jack (D-branch termination)
  s += '<path d="M 420 596 L 434 586 L 446 606 L 458 586 L 470 606 L 482 586 L 494 606 L 506 586 L 518 596"/>';
  // resistor right end rises into A1's jack (536,520) — does NOT touch the MG
  s += '<path d="M 518 596 L 518 520 L 536 520"/>';
  // D2 (lower centre) ties DOWN into that D-node only
  s += '<path d="M 536 588 L 536 596"/>';
  // NET 4: F1 <-> F2 through the right resistor. One continuous chain:
  // F1 down into the resistor top, zigzag, then out the bottom to F2.
  s += '<path d="M 846 472 L 846 486"/>';
  s += '<path d="M 846 486 L 858 496 L 846 506 L 858 516 L 846 526 L 858 536 L 846 546 L 858 556 L 846 566 L 846 574"/>';
  s += '<path d="M 846 574 L 846 600 L 866 600"/>';
  s += '</g>';
  s += '<circle cx="676" cy="552" r="50" fill="#fafaf4" stroke="#111" stroke-width="3.2"/>';
  s += label(676, 546, 'MG', { size: 36, weight: '700', anchor: 'middle' });
  s += txt(676, 574, 'M / G', { size: 13, anchor: 'middle' });
  // heavy brush bars on the MG circle (top + bottom), as on the plate
  s += '<rect x="662" y="494" width="28" height="10" fill="#111"/>';
  s += '<rect x="662" y="600" width="28" height="10" fill="#111"/>';

  // ---- banana jacks (positions + colours traced from the photo) ----
  // left column
  s += jack(389, 445, 'yellow', 23); s += label(356, 452, 'PE', { anchor: 'end', size: 20 });
  s += jack(386, 500, 'black', 23);  s += label(353, 507, 'A2', { anchor: 'end', size: 20 });
  s += jack(379, 558, 'red', 23);    s += label(346, 565, 'D3', { anchor: 'end', size: 20 });
  s += jack(379, 616, 'red', 23);    s += label(346, 623, 'D1', { anchor: 'end', size: 20 });
  // centre column: upper blank, lower = A1
  s += jack(536, 520, 'red', 23);    s += label(536, 500, 'A1', { anchor: 'middle', size: 20 });
  s += jack(536, 588, 'red', 23);    s += label(536, 628, 'D2', { anchor: 'middle', size: 20 });
  // right-of-centre = D2
  s += jack(640, 570, 'red', 23);    s += label(640, 628, 'A1', { anchor: 'middle', size: 20 });
  // field
  s += jack(846, 472, 'black', 23);  s += label(874, 479, 'F1', { anchor: 'start', size: 20 });
  s += jack(866, 600, 'red', 23);    s += label(894, 607, 'F2', { anchor: 'start', size: 20 });

  // ---- bottom title ----
  s += txt(600, 682, 'MOTORE / GENERATORE CC', { size: 20, weight: '700', anchor: 'middle' });
  s += txt(600, 708, 'MOTEUR / GENERATEUR CC     MOTOR / GENERADOR CC', { size: 15, anchor: 'middle' });

  // ---- output shaft + coupling flange (right face) ----
  // Painted only: no electrical terminal. The flange is where a Coupling
  // device's mech port visually attaches. Rotor mark spins with rpm.
  //
  // Flange centre is x=1140, not 1160. At 1160 with r=46 the right edge landed
  // at 1206 in a viewBox only 1195 wide, so 11px of the flange was shaved off
  // by the SVG edge — the same overflow that threw the 3-phase motor's shaft
  // clean out of its panel, just caught earlier because this one is only
  // slightly too far right. 1140 + 46 = 1186, comfortably inside.
  //
  // The SHAFT terminal moves with it: 1140 * 360/1195 = 343.4 in device space.
  s += '<rect x="1030" y="410" width="110" height="60" rx="6" fill="#8f9391" stroke="#111" stroke-width="3"/>';
  s += '<circle cx="1140" cy="440" r="46" fill="#c8ccc9" stroke="#111" stroke-width="3"/>';
  s += '<circle cx="1140" cy="440" r="30" fill="#a8adab" stroke="#333" stroke-width="2"/>';
  s += '<g data-spin="1" transform-origin="1140 440">';
  s += '<rect x="1136" y="400" width="8" height="80" rx="3" fill="#b23b30" stroke="#111" stroke-width="1.6"/>';
  s += '</g>';
  s += '<circle cx="1140" cy="440" r="9" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
  s += txt(1140, 505, 'SHAFT', { size: 13, weight: '700', anchor: 'middle' });

  return s + '</svg>';
}
