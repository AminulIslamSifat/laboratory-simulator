/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { jack, label, txt, screw } from '../_shared/svg.js';
export function spriteAsyncMotor1P() {
  // Traced on the reference photo's own pixel grid (single_phase_async_motor.jpg, 1195x896),
  // emitted at bench scale — same convention as spritePowerSupply().
  const W = 360, H = 270;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 1195 896" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ---- grey machine body ----
  s += '<rect x="190" y="290" width="830" height="430" rx="26" fill="#8f9491" stroke="#111" stroke-width="3"/>';

  // ---- orange warning bands, left + right ----
  s += '<rect x="228" y="430" width="96" height="300" rx="5" fill="#e8720c" stroke="#8a3f00" stroke-width="2.2"/>';
  s += '<rect x="886" y="430" width="96" height="300" rx="5" fill="#e8720c" stroke="#8a3f00" stroke-width="2.2"/>';
  s += '<g transform="translate(266,580) rotate(-90)">' +
    txt(0, 0, 'WARNING !  ATTENZIONE !', { size: 16, weight: '700', anchor: 'middle' }) +
    txt(0, 19, 'MECHANICAL PARTS IN MOTION', { size: 10, anchor: 'middle' }) +
    txt(0, 34, 'PARTI MECCANICHE IN MOVIMENTO', { size: 10, anchor: 'middle' }) +
    '</g>';
  s += '<g transform="translate(944,580) rotate(90)">' +
    txt(0, 0, 'WARNING !  ATTENZIONE !', { size: 16, weight: '700', anchor: 'middle' }) +
    txt(0, 19, 'MECHANICAL PARTS IN MOTION', { size: 10, anchor: 'middle' }) +
    txt(0, 34, 'PARTI MECCANICHE IN MOVIMENTO', { size: 10, anchor: 'middle' }) +
    '</g>';

  // ---- white terminal plate ----
  s += '<rect x="350" y="295" width="490" height="370" rx="6" fill="#f4f5ef" stroke="#141414" stroke-width="4"/>';
  s += '<rect x="361" y="306" width="468" height="348" rx="3" fill="none" stroke="#3a3a3a" stroke-width="1.2"/>';
  s += screw(371, 318) + screw(819, 318) + screw(371, 654) + screw(819, 654);

  // ---- header ----
  s += '<g transform="translate(380,326)" stroke="#111" stroke-width="1.8" fill="none">' +
    '<circle cx="0" cy="0" r="7"/>' +
    '<path d="M -6 -3 A 7 7 0 0 1 6 -3"/>' +
    '<path d="M -6 3 A 7 7 0 0 0 6 3"/>' +
    '</g>';
  s += txt(560, 324, 'SINGLE-PHASE ASYNCHRONOUS MOTOR', { size: 14, weight: '700', anchor: 'middle' });
  s += txt(560, 341, 'MOTEUR ASYNCHRONE MONOPHASE', { size: 13, anchor: 'middle' });
  s += txt(560, 358, 'MOTORE ASINCRONO MONOFASE', { size: 13, anchor: 'middle' });
  s += label(792, 372, 'mod. M-R/CV', { size: 14, weight: '700', anchor: 'middle' });

  // ---- theta symbol (bottom-left) ----
  s += txt(408, 470, 'θ', { size: 22, weight: '700', anchor: 'middle' });
  s += '<g stroke="#111" stroke-width="1.8" fill="none" transform="translate(410,510)">' +
    '<circle cx="0" cy="0" r="9"/>' +
    '<line x1="-6" y1="0" x2="6" y2="0"/>' +
    '</g>';
  s += jack(410, 490, 'red', 12);

  // ---- printed schematic ----
  s += '<g stroke="#111" stroke-width="2.2" fill="none">' +
    '<path d="M 445 420 L 445 438 L 460 438"/>' +
    '<path d="M 515 420 L 515 438 L 520 438"/>' +
    '<path d="M 520 528 L 640 528 L 690 490"/>' +
    '<path d="M 690 490 L 720 490"/>' +
    '<path d="M 690 535 L 690 555"/>' +
    '<path d="M 625 412 L 660 412"/>' +
    '<path d="M 700 412 L 765 412"/>' +
    '</g>';
  // capacitor symbol
  s += '<line x1="672" y1="402" x2="672" y2="422" stroke="#111" stroke-width="2.6"/>';
  s += '<line x1="690" y1="402" x2="690" y2="422" stroke="#111" stroke-width="2.6"/>';

  // ---- M 1~ circle ----
  s += '<circle cx="486" cy="532" r="38" fill="#fafaf4" stroke="#111" stroke-width="3"/>';
  s += label(486, 528, 'M', { size: 28, weight: '700', anchor: 'middle' });
  s += label(486, 556, '1~', { size: 17, weight: '700', anchor: 'middle' });

  // ---- seven jacks ----
  s += jack(445, 400, 'grey', 22);   // Aux2
  s += jack(515, 400, 'grey', 22);   // Z2
  s += jack(625, 400, 'red', 22);    // C
  s += jack(765, 400, 'red', 22);    // C2
  s += jack(690, 490, 'grey', 22);   // Run
  s += jack(690, 555, 'grey', 22);   // U2
  s += jack(782, 530, 'yellow', 22); // PE

  // ---- printed labels ----
  s += '<g transform="translate(410,378) rotate(-14)">' +
    txt(0, 0, 'Aux2', { size: 18, weight: '700', anchor: 'middle' }) + '</g>';
  s += label(548, 398, 'Z2', { size: 16, anchor: 'start' });
  s += label(625, 378, 'C', { size: 16, anchor: 'middle' });
  s += label(468, 468, 'START', { size: 12, anchor: 'middle' });
  s += label(468, 482, 'DEMARRAGE', { size: 11, anchor: 'middle' });
  s += label(636, 482, 'RUN', { size: 12, anchor: 'end' });
  s += label(636, 496, 'MARCHE', { size: 11, anchor: 'end' });
  s += label(712, 566, 'U2', { size: 17, anchor: 'start' });
  s += label(806, 537, 'PE', { size: 17, anchor: 'start' });

  // ---- rating block ----
  s += txt(400, 610, 'P=370W    U=230V    I=3.6A    f=50Hz', { size: 12.5 });
  s += txt(400, 628, 'n=2850RPM  C=12.5μF  p=2   RATING-S1', { size: 12.5 });

  // ---- earth symbol under PE ----
  s += '<g stroke="#111" stroke-width="2" fill="none" transform="translate(782,558)">' +
    '<line x1="0" y1="0" x2="0" y2="8"/>' +
    '<line x1="-9" y1="8" x2="9" y2="8"/>' +
    '<line x1="-6" y1="14" x2="6" y2="14"/>' +
    '<line x1="-3" y1="20" x2="3" y2="20"/>' +
    '</g>';

  // ---- output shaft + spinning rotor (left face) ----
  // Painted only; the flange is where a Coupling's mech port attaches.
  // data-spin marks the element whose rotation tracks motor rpm.
  s += '<rect x="1052" y="440" width="140" height="54" rx="6" fill="#9a9d9b" stroke="#111" stroke-width="3"/>';
  s += '<circle cx="1044" cy="467" r="48" fill="#c8ccc9" stroke="#111" stroke-width="3"/>';
  s += '<circle cx="1044" cy="467" r="32" fill="#a8adab" stroke="#333" stroke-width="2"/>';
  s += '<g data-spin="1" transform-origin="1044 467">';
  s += '<rect x="1038" y="423" width="12" height="88" rx="4" fill="#e8720c" stroke="#111" stroke-width="1.8"/>';
  s += '</g>';
  s += '<circle cx="1044" cy="467" r="10" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
  s += txt(1044, 545, 'SHAFT', { size: 14, weight: '700', anchor: 'middle' });

  return s + '</svg>';
}
