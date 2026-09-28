/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { esc, jack, label, txt, panel } from '../_shared/svg.js';
export function spriteAsyncMotor3P() {
  // Traced on the reference photo's own pixel grid (three_phase_async_motor.jpg, 896x1192),
  // emitted at bench scale — same convention as spritePowerSupply().
  const W = 360, H = 479;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 896 1192" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ---- grey machine body ----
  s += '<rect x="150" y="180" width="600" height="840" rx="30" fill="#8f9491" stroke="#111" stroke-width="3"/>';

  // ---- orange terminal box on top ----
  s += '<rect x="300" y="86" width="272" height="150" rx="8" fill="#e8720c" stroke="#8a3f00" stroke-width="2.5"/>';
  s += '<rect x="332" y="126" width="208" height="80" rx="3" fill="#f2a03c" stroke="#8a3f00" stroke-width="1.4"/>';
  s += txt(436, 148, 'WARNING ! DANGER ! ATTENZIONE !', { size: 13, weight: '700', anchor: 'middle' });
  s += txt(436, 166, 'MECHANICAL PARTS IN MOTION', { size: 11, anchor: 'middle' });
  s += txt(436, 181, 'PIECES MECANIQUES EN MOUVEMENT', { size: 11, anchor: 'middle' });

  // ---- orange warning panel on the left ----
  s += '<rect x="88" y="470" width="132" height="340" rx="6" fill="#e8720c" stroke="#8a3f00" stroke-width="2.5"/>';
  s += '<g transform="translate(156,640) rotate(-90)">' +
    txt(0, 0, 'WARNING !  ATTENZIONE !', { size: 24, weight: '700', anchor: 'middle' }) +
    txt(0, 27, 'MECHANICAL PARTS IN MOTION', { size: 14, anchor: 'middle' }) +
    txt(0, 47, 'IU PRI MECCANICHE IN MOVIMENTO', { size: 13, anchor: 'middle' }) +
    '</g>';

  // ---- white terminal plate ----
  s += '<rect x="245" y="285" width="455" height="670" rx="6" fill="#f4f5ef" stroke="#141414" stroke-width="4"/>';
  s += '<rect x="256" y="296" width="433" height="648" rx="3" fill="none" stroke="#3a3a3a" stroke-width="1.2"/>';

  // ---- protective-conductor (green) strip behind PE ----
  s += '<rect x="258" y="360" width="92" height="46" fill="#f0f0e6" stroke="#333" stroke-width="1"/>';
  for (let i = 0; i < 7; i++) s += '<rect x="' + (258 + i * 13.1) + '" y="360" width="6.5" height="46" fill="#2d8a4a"/>';

  // ---- PE jack + earth symbol ----
  s += jack(346, 396, 'yellow', 34);
  s += label(346, 456, 'PE', { size: 30, anchor: 'middle' });
  s += '<g stroke="#111" stroke-width="2.6" fill="none" transform="translate(276,378)">' +
    '<line x1="0" y1="-18" x2="0" y2="0"/>' +
    '<line x1="-16" y1="0" x2="16" y2="0"/>' +
    '<line x1="-10" y1="8" x2="10" y2="8"/>' +
    '<line x1="-4" y1="16" x2="4" y2="16"/>' +
    '</g>';

  // ---- theta / thermistor symbol ----
  s += txt(438, 386, 'θ', { size: 30, weight: '700', anchor: 'middle' });
  s += '<path d="M 400 404 L 424 410 L 438 416 L 452 402 L 462 410" stroke="#111" stroke-width="2.4" fill="none"/>';
  s += jack(384, 402, 'red', 15);
  s += jack(476, 410, 'red', 15);
  s += '<g stroke="#111" stroke-width="2.2" fill="none" transform="translate(510,404)">' +
    '<rect x="-7" y="-2" width="14" height="30" rx="7"/>' +
    '<line x1="0" y1="28" x2="0" y2="40"/>' +
    '<line x1="0" y1="-2" x2="0" y2="6"/>' +
    '</g>';

  // ---- M 3~ circle + printed schematic ----
  s += '<circle cx="412" cy="524" r="44" fill="#fafaf4" stroke="#111" stroke-width="3"/>';
  s += label(412, 518, 'M', { size: 34, weight: '700', anchor: 'middle' });
  s += label(412, 552, '3~', { size: 22, weight: '700', anchor: 'middle' });
  s += '<g stroke="#111" stroke-width="2.2" fill="none">' +
    '<path d="M 300 548 L 300 600 L 326 600 L 326 640"/>' +
    '<path d="M 380 558 L 380 600 L 403 600 L 403 640"/>' +
    '<path d="M 444 558 L 444 600 L 480 600 L 480 640"/>' +
    '<path d="M 300 600 L 300 780 L 326 780"/>' +
    '<path d="M 480 715 L 480 780 L 403 780"/>' +
    '</g>';

  // ---- nine terminal jacks (all black on this machine) ----
  const cols = [326, 403, 480], rows = [672, 745, 818];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) s += jack(cols[c], rows[r], 'black', 34);
  }

  // ---- printed labels ----
  s += label(300, 666, 'A2', { anchor: 'end', size: 30 });
  s += label(300, 739, 'A3', { anchor: 'end', size: 30 });
  s += label(300, 812, 'D1', { anchor: 'end', size: 30 });
  s += label(333, 624, 'W2', { anchor: 'middle', size: 30 });
  s += label(412, 634, 'U2', { anchor: 'middle', size: 30 });
  s += label(492, 644, 'W1', { anchor: 'middle', size: 30 });
  s += label(333, 874, 'B1', { anchor: 'middle', size: 30 });
  s += label(412, 874, 'B2', { anchor: 'middle', size: 30 });
  s += label(490, 874, 'C2', { anchor: 'middle', size: 30 });

  // ---- rotating-field logo (top-right) ----
  s += '<g transform="translate(648,342)" stroke="#111" stroke-width="2.4" fill="none">' +
    '<circle cx="0" cy="0" r="16"/>' +
    '<path d="M -14 -6 A 16 16 0 0 1 14 -6"/>' +
    '<path d="M -14 6 A 16 16 0 0 0 14 6"/>' +
    '</g>';

  // ---- model number (upright) ----
  s += label(646, 400, 'mod. M-4/EV', { size: 19, weight: '700', anchor: 'middle' });

  // ---- rating block (upright) ----
  s += '<rect x="524" y="470" width="168" height="176" fill="#fbfbf6" stroke="#111" stroke-width="2"/>';
  s += '<line x1="524" y1="514" x2="692" y2="514" stroke="#111" stroke-width="1.2"/>';
  s += '<line x1="524" y1="558" x2="692" y2="558" stroke="#111" stroke-width="1.2"/>';
  s += '<line x1="524" y1="602" x2="692" y2="602" stroke="#111" stroke-width="1.2"/>';
  s += txt(532, 496, 'Rating = S1', { size: 13, weight: '700' });
  s += txt(532, 540, 'P = 370W', { size: 13 });
  s += txt(532, 584, 'U = 230/400V', { size: 13 });
  s += txt(532, 628, 'I = 1,5/0,87A', { size: 13 });
  s += txt(620, 496, 'n = 2820', { size: 12 });
  s += txt(620, 540, 'f = 50Hz', { size: 12 });
  s += txt(620, 584, 'cos = 0,85', { size: 12 });
  s += txt(620, 628, 'p = 2', { size: 12 });

  // ---- title (upright, bottom of plate) ----
  s += txt(472, 898, 'THREE-PHASE ASYNCHRONOUS MOTOR', { size: 15, weight: '700', anchor: 'middle' });
  s += txt(472, 916, 'MOTEUR ASYNCHRONE TRIPHASE', { size: 14, anchor: 'middle' });
  s += txt(472, 934, 'MOTORE ASINCRONO TRIFASICO', { size: 14, anchor: 'middle' });

  // ---- output shaft + spinning rotor (right face) ----
  //
  // The flange sits INSIDE the viewBox. It used to be drawn at x=1000..1250
  // in a viewBox only 896 wide, so the entire shaft fell off the right edge of
  // the SVG and rendered as a detached blob floating outside the panel, while
  // the SHAFT terminal dot sat on empty space with nothing under it.
  //
  // The comment here used to say "the machine is tall (896 ref px)" — which is
  // true of its HEIGHT and false of its width. 896 is the WIDTH, so anything
  // drawn past 896 simply does not exist. The 1:1 DC machine gets this right
  // because its viewBox is 1195 wide; these coordinates were copied without
  // rescaling.
  //
  // Placed at viewBox (825, 596): right of the body (which ends at x=750) and
  // clear of the 896 edge once the 54px flange radius is added. The layout's
  // SHAFT terminal is the same point in device space — 825 * 360/896 = 331.5,
  // 596 * 479/1192 = 239.5 — so the jack dot lands on the flange centre and a
  // Coupling can actually snap to it.
  s += '<rect x="740" y="565" width="95" height="62" rx="7" fill="#9a9d9b" stroke="#111" stroke-width="3"/>';
  s += '<circle cx="825" cy="596" r="54" fill="#c8ccc9" stroke="#111" stroke-width="3"/>';
  s += '<circle cx="825" cy="596" r="36" fill="#a8adab" stroke="#333" stroke-width="2"/>';
  s += '<g data-spin="1" transform-origin="825 596">';
  s += '<rect x="818" y="546" width="14" height="100" rx="4" fill="#e8720c" stroke="#111" stroke-width="1.8"/>';
  s += '</g>';
  s += '<circle cx="825" cy="596" r="11" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
  s += txt(825, 683, 'SHAFT', { size: 16, weight: '700', anchor: 'middle' });

  return s + '</svg>';
}
