// EEE-2152 Lab · Equipment sprites — FAITHFUL PANEL RENDERINGS
// Modelled 1:1 on ElettronicaVeneta lab panels: every printed label,
// every banana jack in its real position and colour, every schematic line.
// Reference: References/simplified-image-diagram/*.jpg + References/text-diagram/*.md
//
// Interface contract (consumed by lab.js):
//   EQUIPMENT[kind] = { label, model, color, icon, sprite(), layout: { w, h, terms: [{k,x,y}] } }
//   sprite() returns an SVG string sized to layout.w × layout.h.
//   layout.terms[].x/y are SVG-space coordinates — lab.js drops a clickable
//   dot there so wiring lands on the printed jack.
(function (root) {
'use strict';

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function svgOpen(w, h) {
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
    '" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';
}
function shade(hex, f) {
  f = f == null ? 0.55 : f;
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f)) | 0;
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f)) | 0;
  const b = Math.max(0, Math.min(255, (n & 255) * f)) | 0;
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Coloured banana jack. Colours from the reference photos.
const JACK_COLOR = { red: '#c0392b', black: '#1c1c1c', yellow: '#e6b800', blue: '#1a4f9e', green: '#2d8a4a', grey: '#4a4a4a' };
function jack(x, y, color, r) {
  r = r || 7.5;
  const base = JACK_COLOR[color] || color;
  const dark = shade(base, 0.55);
  const hole = Math.max(2.6, r - 4.4);
  return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + dark + '" stroke="#0a0a0a" stroke-width="0.9"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="' + (r - 1.6) + '" fill="' + base + '" stroke="#000" stroke-width="0.5"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="' + hole + '" fill="#0a0a0a"/>' +
    '<ellipse cx="' + (x - r * 0.35) + '" cy="' + (y - r * 0.42) + '" rx="' + (r * 0.32) + '" ry="' + (r * 0.18) + '" fill="#fff" opacity="0.34"/>';
}
function label(x, y, str, opts) {
  opts = opts || {};
  return '<text x="' + x + '" y="' + y + '" text-anchor="' + (opts.anchor || 'start') +
    '" font-family="Arial,Helvetica,sans-serif" font-size="' + (opts.size || 8.5) +
    '" font-weight="' + (opts.weight || '600') + '" fill="' + (opts.color || '#111') + '">' + esc(str) + '</text>';
}
function txt(x, y, str, opts) {
  opts = opts || {};
  return '<text x="' + x + '" y="' + y + '" text-anchor="' + (opts.anchor || 'start') +
    '" font-family="Arial,Helvetica,sans-serif" font-size="' + (opts.size || 6) +
    '" font-weight="' + (opts.weight || '400') + '" fill="' + (opts.color || '#111') + '">' + esc(str) + '</text>';
}
function screw(x, y) {
  return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#a8a89e" stroke="#333" stroke-width="0.7"/>' +
    '<line x1="' + (x - 1.8) + '" y1="' + y + '" x2="' + (x + 1.8) + '" y2="' + y + '" stroke="#333" stroke-width="0.8"/>';
}
function panel(x, y, w, h) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="#e9e9e1" stroke="#1a1a1a" stroke-width="2.2"/>' +
    '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="3" fill="none" stroke="#444" stroke-width="0.6"/>';
}
function warningStrip(x, y, w, h) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#e8720c" stroke="#8a3f00" stroke-width="1"/>' +
    '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (w - 4) + '" height="' + (h - 4) + '" fill="none" stroke="#8a3f00" stroke-width="0.5"/>';
}

/* ═══════════════════════════════════════════════════════════
   M1-2/EV · DC MOTOR / GENERATOR
   Printed jacks: PE (yellow) · A2 (black) · D3 (red) · D1 (red)
                 A1 (red) · D2 (red) · F1 (black) · F2 (red)
   ═══════════════════════════════════════════════════════════ */
function spriteDCMachine() {
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

  // ---- printed schematic: MG circle + series field winding ----
  s += '<g stroke="#111" stroke-width="2.6" fill="none">';
  s += '<path d="M 730 512 L 836 512 L 836 522"/>';
  s += '<path d="M 730 592 L 836 592 L 836 582"/>';
  s += '<path d="M 836 522 L 850 530 L 836 540 L 850 550 L 836 560 L 850 570 L 836 580 L 850 590 L 836 592"/>';
  s += '<path d="M 866 472 L 866 512 L 836 512"/>';
  s += '<path d="M 700 552 L 730 552"/>';
  s += '</g>';
  s += '<circle cx="676" cy="552" r="50" fill="#fafaf4" stroke="#111" stroke-width="3.2"/>';
  s += label(676, 546, 'MG', { size: 36, weight: '700', anchor: 'middle' });
  s += txt(676, 574, 'M / G', { size: 13, anchor: 'middle' });
  s += '<circle cx="600" cy="552" r="12" fill="#b23b30" stroke="#111" stroke-width="2"/>';

  // ---- banana jacks (positions + colours traced from the photo) ----
  // left column
  s += jack(389, 445, 'yellow', 23); s += label(356, 452, 'PE', { anchor: 'end', size: 20 });
  s += jack(386, 500, 'black', 23);  s += label(353, 507, 'A2', { anchor: 'end', size: 20 });
  s += jack(379, 558, 'red', 23);    s += label(346, 565, 'D3', { anchor: 'end', size: 20 });
  s += jack(379, 616, 'red', 23);    s += label(346, 623, 'D1', { anchor: 'end', size: 20 });
  // centre column: upper blank, lower = A1
  s += jack(536, 520, 'red', 23);
  s += jack(536, 588, 'red', 23);    s += label(536, 628, 'A1', { anchor: 'middle', size: 20 });
  // right-of-centre = D2
  s += jack(640, 570, 'red', 23);    s += label(640, 628, 'D2', { anchor: 'middle', size: 20 });
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

/* ═══════════════════════════════════════════════════════════
   M-4/EV · THREE-PHASE ASYNCHRONOUS MOTOR
   Printed jacks: PE (yellow) · W2 / U2 / W1 (black, top row)
                  A2 · A3 · D1 (left column)
                  B1 · B2 (centre column) · C2 (right)
   ═══════════════════════════════════════════════════════════ */
function spriteAsyncMotor3P() {
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

/* ═══════════════════════════════════════════════════════════
   M-R/CV · SINGLE-PHASE ASYNCHRONOUS MOTOR
   Printed jacks: Aux2 (grey) · Z2 (grey) · C (red) · [2nd C terminal red]
                  Run (grey) · U2 (grey) · PE (yellow)
   ═══════════════════════════════════════════════════════════ */
function spriteAsyncMotor1P() {
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

/* ═══════════════════════════════════════════════════════════
   GMS · THREE-PHASE SYNCHRONOUS GENERATOR
   Printed jacks: F2 · W1 · V1 · U1 (left column)
                  V2 · U2 · W2 (middle column)
                  F1 (top right) · G (bottom right)
   ═══════════════════════════════════════════════════════════ */
function spriteSyncGen() {
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

/* ═══════════════════════════════════════════════════════════
   308T · RHEOSTAT (two-unit bench: grey front + green rear)
   Printed jacks: Unit A wiper (red) · Unit A fixed (black)
                  Unit B wiper (red) · Unit B yellow · Unit B red
   ═══════════════════════════════════════════════════════════ */
// ─── SHAFT COUPLING · rigid collar linking two machine shafts ──────
// Two flanges with a solid barrel between them. Purely mechanical: the
// device has NO electrical terminals, only mech ports MA / MB used by the
// solver's mechanical pass to equalise the two machines' omega.
function spriteCoupling() {
  const W = 200, H = 120;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 400 240" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';
  // left flange
  s += '<rect x="40" y="60" width="34" height="120" rx="6" fill="#c8ccc9" stroke="#111" stroke-width="2.6"/>';
  s += '<circle cx="57" cy="120" r="9" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
  // barrel between flanges
  s += '<rect x="74" y="88" width="152" height="64" rx="4" fill="#8f9391" stroke="#111" stroke-width="2.6"/>';
  for (let i = 0; i < 5; i++) {
    s += '<line x1="' + (94 + i * 26) + '" y1="92" x2="' + (94 + i * 26) + '" y2="148" stroke="#5c605e" stroke-width="2"/>';
  }
  // right flange
  s += '<rect x="226" y="60" width="34" height="120" rx="6" fill="#c8ccc9" stroke="#111" stroke-width="2.6"/>';
  s += '<circle cx="243" cy="120" r="9" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
  // keyway highlight
  s += '<rect x="120" y="112" width="60" height="16" rx="3" fill="#6a6e6c" stroke="#111" stroke-width="1.4"/>';
  s += txt(200, 210, 'RIGID COUPLING', { size: 15, weight: '700', anchor: 'middle' });
  s += txt(40, 36, 'MA', { size: 12, weight: '700', anchor: 'middle' });
  s += txt(360, 36, 'MB', { size: 12, weight: '700', anchor: 'middle' });
  // mech port stubs at the flange centres, matching layout MA/MB coords
  s += '<circle cx="16" cy="120" r="11" fill="#f4f5ef" stroke="#111" stroke-width="2.4"/>';
  s += '<circle cx="384" cy="120" r="11" fill="#f4f5ef" stroke="#111" stroke-width="2.4"/>';
  return s + '</svg>';
}

function spriteRheostat() {
  // Two 308T rheostat units (grey front + green rear) traced from
  // resistance.jpg — drawn in the reference's own pixel grid.
  const W = 320, H = 366;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="60 140 560 640" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  function vents(x0, y0, x1, y1, col) {
    let o = '';
    for (let y = y0; y < y1; y += 14) {
      o += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + (y - 16) +
        '" stroke="' + col + '" stroke-width="2" opacity="0.5"/>';
    }
    return o;
  }

  function unit(x, bodyFill, edge, wiperJackCol, fixedJackCol, tag) {
    const w = 240;
    let o = '';
    // body
    o += '<rect x="' + x + '" y="150" width="' + w + '" height="600" rx="14" fill="' + bodyFill + '" stroke="#222" stroke-width="3"/>';
    o += '<rect x="' + (x + 8) + '" y="158" width="' + (w - 16) + '" height="584" rx="10" fill="none" stroke="' + edge + '" stroke-width="1.2"/>';
    // top wiper assembly
    o += '<rect x="' + (x + 46) + '" y="128" width="148" height="46" rx="6" fill="#c8ccc9" stroke="#222" stroke-width="2.4"/>';
    o += '<rect x="' + (x + 58) + '" y="176" width="124" height="150" rx="4" fill="#b7bbb8" stroke="#333" stroke-width="1.6"/>';
    o += '<rect x="' + (x + 108) + '" y="176" width="24" height="150" fill="#8f9391" stroke="#333" stroke-width="1"/>';
    for (let i = 0; i < 9; i++) {
      const yy = 184 + i * 16;
      o += '<line x1="' + (x + 66) + '" y1="' + yy + '" x2="' + (x + 100) + '" y2="' + yy + '" stroke="#f0f0ec" stroke-width="2"/>';
      o += '<line x1="' + (x + 140) + '" y1="' + yy + '" x2="' + (x + 174) + '" y2="' + yy + '" stroke="#f0f0ec" stroke-width="2"/>';
    }
    // wiper slider + red handle
    o += '<rect x="' + (x + 96) + '" y="150" width="48" height="30" rx="5" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
    o += '<rect x="' + (x + 104) + '" y="158" width="32" height="14" rx="3" fill="#c0392b" stroke="#111" stroke-width="1.2"/>';
    // ventilation slots on both shoulders
    o += vents(x + 14, 200, x + 54, 330, '#3c4040');
    o += vents(x + w - 54, 200, x + w - 14, 330, '#3c4040');
    o += vents(x + 14, 380, x + 54, 510, '#3c4040');
    o += vents(x + w - 54, 380, x + w - 14, 510, '#3c4040');
    // wiper output jack (red) + lead
    o += jack(x + 120, 490, wiperJackCol, 22);
    o += '<path d="M ' + (x + 120) + ' 490 L ' + (x + 168) + ' 540 L ' + (x + 168) + ' 620" stroke="#111" stroke-width="4" fill="none"/>';
    // fixed terminal (black) at the base
    o += jack(x + w - 34, 686, fixedJackCol, 22);
    o += '<rect x="' + x + '" y="708" width="' + w + '" height="42" rx="8" fill="' + bodyFill + '" stroke="#222" stroke-width="2.4"/>';
    o += txt(x + 12, 734, tag, { size: 13, weight: '700' });
    return o;
  }

  // ---- grey (front) unit ----
  s += unit(70, '#b9bdba', '#6e7270', 'red', 'black', 'Unit A');
  // caution label on the grey unit
  s += '<rect x="92" y="600" width="150" height="86" rx="4" fill="#e8c014" stroke="#8a6a00" stroke-width="1.6"/>';
  s += '<polygon points="216,608 236,644 196,644" fill="none" stroke="#111" stroke-width="2"/>';
  s += '<text x="216" y="640" text-anchor="middle" font-size="18" font-weight="700" fill="#111">!</text>';
  s += txt(100, 618, 'ATTENZIONE', { size: 9, weight: '700' });
  s += txt(100, 630, 'NON INTRODURRE', { size: 8 });
  s += txt(100, 641, 'OGGETTI METALLICI', { size: 8 });
  s += txt(100, 656, 'CAUTION', { size: 9, weight: '700' });
  s += txt(100, 668, 'DO NOT INSERT ANY', { size: 8 });
  s += txt(100, 679, 'METALLIC OBJECT', { size: 8 });

  // ---- green (rear) unit ----
  s += unit(370, '#4f7a4f', '#2c4a2c', 'red', 'red', 'Unit B');
  // TESTED sticker
  s += '<ellipse cx="490" cy="556" rx="46" ry="19" fill="#d8e8cf" stroke="#3a6a3a" stroke-width="1.8"/>';
  s += txt(490, 562, 'TESTED', { size: 15, weight: '700', anchor: 'middle' });
  // MAX TEST VOLTAGE label
  s += '<rect x="412" y="592" width="156" height="42" rx="3" fill="#e8c014" stroke="#8a6a00" stroke-width="1.6"/>';
  s += txt(490, 611, 'MAX TEST VOLTAGE', { size: 11, weight: '700', anchor: 'middle' });
  s += txt(490, 628, '1500V', { size: 13, weight: '700', anchor: 'middle' });
  // rating plate
  s += '<rect x="418" y="644" width="150" height="42" fill="#fbfbf6" stroke="#111" stroke-width="1.4"/>';
  s += '<line x1="418" y1="658" x2="568" y2="658" stroke="#111" stroke-width="0.8"/>';
  s += '<line x1="418" y1="672" x2="568" y2="672" stroke="#111" stroke-width="0.8"/>';
  s += '<line x1="478" y1="644" x2="478" y2="686" stroke="#111" stroke-width="0.8"/>';
  s += txt(422, 655, 'CODE', { size: 7 });
  s += txt(482, 655, '3061', { size: 7 });
  s += txt(422, 669, '500', { size: 7 });
  s += txt(482, 669, '0,001', { size: 7 });
  s += txt(422, 683, '0,010', { size: 7 });
  s += txt(482, 683, '20', { size: 7 });
  // yellow + red terminals at the base of the green unit
  s += jack(430, 712, 'yellow', 20);
  s += jack(548, 712, 'red', 20);
  s += '<path d="M 430 712 L 452 750" stroke="#c9a800" stroke-width="5" fill="none"/>';
  s += '<path d="M 548 712 L 578 750" stroke="#c0392b" stroke-width="5" fill="none"/>';

  return s + '</svg>';
}

/* ═══════════════════════════════════════════════════════════
   AV-1/EV · POWER SUPPLY
   All printed jacks:
     Variable AC out:  L1 · L2 · L3 · L4 · PE
     Variable DC out:  + · −
     Fixed 3φ 400V:    L1 · L2 · L3 · L4 · PE
     Fixed DC 6/12/24: + · −
     Fixed DC 50V:     + · −
   ═══════════════════════════════════════════════════════════ */
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = 226 0 741 845 so reference coords are used verbatim.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
// AV-1/EV POWER SUPPLY (mod. AV-1/EV, ElettronicaVeneta)
// Drawn 1:1 in the reference photo pixel space.
// Reference plate: x 254..938, y 34..781.
// viewBox = "226 0 741 845" so every coordinate below is a raw
// reference-photo pixel. No pre-offsetting anywhere.
function spritePowerSupply() {
  // Drawn in the reference photo's own pixel grid (viewBox 741 x 845) but
  // emitted at bench scale, so the panel sits alongside the other kit.
  const W = 385, H = 439;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="226 0 741 845" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ---- bench case + white plate (raw coords) ----
  s += '<rect x="226" y="5" width="740" height="836" rx="12" fill="#cfd0cb" stroke="#1a1a1a" stroke-width="2.4"/>';
  s += '<rect x="238" y="17" width="716" height="812" rx="6" fill="#ffffff" stroke="#2a2a2a" stroke-width="1.6"/>';
  s += '<rect x="254" y="34" width="683" height="747" fill="none" stroke="#1a1a1a" stroke-width="3"/>';
  s += '<rect x="321" y="833" width="60" height="12" rx="4" fill="#8a8a86" stroke="#222" stroke-width="1.2"/>';
  s += '<rect x="811" y="833" width="60" height="12" rx="4" fill="#8a8a86" stroke="#222" stroke-width="1.2"/>';

  // ---- band dividers ----
  s += '<line x1="254" y1="372" x2="937" y2="372" stroke="#1a1a1a" stroke-width="2.4"/>';
  s += '<line x1="254" y1="610" x2="937" y2="610" stroke="#1a1a1a" stroke-width="2.4"/>';
  s += '<line x1="527" y1="372" x2="527" y2="610" stroke="#1a1a1a" stroke-width="2.4"/>';
  s += '<line x1="730" y1="372" x2="730" y2="610" stroke="#1a1a1a" stroke-width="2.4"/>';

  // ================= LOCAL HELPERS (raw ref coords) =================

  // multi-line printed heading; anchor is the CENTRE of the block
  function head(cx, y, lines, size, weight) {
    let o = '';
    const st = size + 0.9;
    for (let i = 0; i < lines.length; i++) {
      o += txt(cx, y + i * st, lines[i], {
        size: size, anchor: 'middle',
        weight: (weight || (i === 0 ? '700' : '400'))
      });
    }
    return o;
  }

  // ESAM digital meter module, 102 x 52.
  //
  // `dispId` wires the module to one of the model's channels. _lv()/  _lu()
  // (the live-text helpers at the bottom of this file) were written long ago
  // but NEVER CALLED, so every ESAM on this panel was a painted constant and
  // _updateSpriteReadouts() walked the device looking for [data-live] nodes
  // that did not exist. Emitting them here is what finally makes the panel
  // read live.
  function esam(x, y, dispId) {
    let o = '';
    o += '<rect x="' + x + '" y="' + y + '" width="102" height="52" rx="2" fill="#0b0c0e" stroke="#2b2d31" stroke-width="1.6"/>';
    o += '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="96" height="46" fill="#1b1c1e"/>';
    o += '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="96" height="9" fill="#1c4f8f"/>';
    o += '<rect x="' + (x + 3) + '" y="' + (y + 40) + '" width="96" height="9" fill="#1c4f8f"/>';
    if (dispId) {
      // Seven-segment style readout, centred in the window. The unit sits to
      // the right so the digits keep a stable position as the value grows.
      o += '<rect x="' + (x + 6) + '" y="' + (y + 15) + '" width="90" height="23" fill="#0d1013"/>';
      o += _lv(x + 48, y + 33, dispId, 17);
      o += _lu(x + 90, y + 33, dispId, 8);
    } else {
      o += txt(x + 34, y + 36, 'ESAM', { size: 13, weight: '700', color: '#cfe4ff' });
    }
    return o;
  }

  // large variac dial, outer radius 56
  function variac(cx, cy) {
    let o = '';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="56" fill="#d2d5d4" stroke="#6a6e6c" stroke-width="1.8"/>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="50" fill="#e6e8e7" stroke="#b0b4b2" stroke-width="0.8"/>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="43" fill="#c6cac9" stroke="#9aa09e" stroke-width="1"/>';
    // dark arc hugging the upper-left of the dial, as printed on the panel
    o += '<path d="M ' + (cx - 41.6) + ' ' + (cy + 24) + ' A 48 48 0 0 1 ' + (cx - 16.4) + ' ' + (cy - 45.1) + '" fill="none" stroke="#111" stroke-width="3.5"/>';
    // rotation arrow above the dial
    o += '<path d="M ' + (cx - 30) + ' ' + (cy - 62) + ' A 36 36 0 0 1 ' + (cx + 33) + ' ' + (cy - 60) + '" fill="none" stroke="#111" stroke-width="1.8"/>';
    o += '<path d="M ' + (cx + 33) + ' ' + (cy - 60) + ' l -10 -5 l 1 10 z" fill="#111"/>';
    return o;
  }

  // AEG miniature circuit-breaker block
  function aeg(x, y, w, h, poles) {
    let o = '';
    o += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#f2f2ee" stroke="#1a1a1a" stroke-width="1.4"/>';
    o += txt(x + 6, y + 16, 'AEG', { size: 11, weight: '700', color: '#c0392b' });
    o += '<line x1="' + (x + 3) + '" y1="' + (y + 21) + '" x2="' + (x + w - 3) + '" y2="' + (y + 21) + '" stroke="#2b6cb0" stroke-width="1.4"/>';
    const bw = (w - 8) / poles;
    for (let i = 0; i < poles; i++) {
      const bx = x + 4 + i * bw;
      o += '<rect x="' + bx + '" y="' + (y + 24) + '" width="' + (bw - 2) + '" height="' + (h * 0.42) + '" fill="#f6f6f2" stroke="#666" stroke-width="0.7"/>';
      o += '<rect x="' + (bx + 1) + '" y="' + (y + 26) + '" width="' + (bw - 4) + '" height="' + (h * 0.34) + '" fill="#22262a"/>';
    }
    o += '<path d="M ' + (x + 2) + ' ' + (y + h - 14) + ' q ' + (w / 2) + ' 12 ' + (w - 4) + ' 0" fill="none" stroke="#111" stroke-width="8"/>';
    o += '<path d="M ' + (x + 2) + ' ' + (y + h - 14) + ' q ' + (w / 2) + ' 12 ' + (w - 4) + ' 0" fill="none" stroke="#33383c" stroke-width="3.5"/>';
    return o;
  }

  // E.TN / S.T.N modular switch block
  function etn(x, y, w, h, mods, tag, tagColor) {
    let o = '';
    o += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#eeeee9" stroke="#1a1a1a" stroke-width="1.4"/>';
    o += txt(x + 4, y + 14, tag, { size: 9, weight: '700', color: tagColor || '#1c4f8f' });
    const mw = w / mods;
    for (let i = 0; i < mods; i++) {
      const mx = x + i * mw;
      if (i) o += '<line x1="' + mx + '" y1="' + y + '" x2="' + mx + '" y2="' + (y + h) + '" stroke="#9a9a94" stroke-width="1"/>';
      o += '<path d="M ' + (mx + mw * 0.2) + ' ' + (y + h * 0.5) + ' l 0 -' + (h * 0.24) + ' l ' + (mw * 0.6) + ' 0" fill="none" stroke="#555" stroke-width="1.1"/>';
      o += '<rect x="' + (mx + mw * 0.18) + '" y="' + (y + h * 0.5) + '" width="' + (mw * 0.26) + '" height="' + (h * 0.3) + '" fill="#dcdcd6" stroke="#666" stroke-width="0.7"/>';
      o += '<rect x="' + (mx + mw * 0.58) + '" y="' + (y + h * 0.5) + '" width="' + (mw * 0.26) + '" height="' + (h * 0.3) + '" fill="#dcdcd6" stroke="#666" stroke-width="0.7"/>';
    }
    o += txt(x + 4, y + h - 13, 'ON=1', { size: 5.5, color: '#555' });
    o += txt(x + 4, y + h - 5, '13=3', { size: 5.5, color: '#555' });
    return o;
  }

  // blanking cap / round grey button
  function roundCap(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#c2c6c5" stroke="#8d918f" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 4) + '" fill="#d9dcdb" stroke="#9aa09e" stroke-width="1.4"/>';
  }

  // printed jack: coloured ring, black bore (radius 14)
  function pjack(cx, cy, color, r) {
    r = r || 14;
    const base = JACK_COLOR[color] || color;
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + shade(base, 0.55) + '" stroke="#0a0a0a" stroke-width="1.6"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 3) + '" fill="' + base + '" stroke="#000" stroke-width="0.9"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 9) + '" fill="#080808"/>' +
      '<ellipse cx="' + (cx - r * 0.35) + '" cy="' + (cy - r * 0.42) + '" rx="' + (r * 0.3) + '" ry="' + (r * 0.16) + '" fill="#fff" opacity="0.3"/>';
  }

  // earth (PE) symbol
  function earth(cx, cy) {
    return '<g stroke="#111" stroke-width="1.6" fill="none">' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy + 10) + '"/>' +
      '<line x1="' + (cx - 11) + '" y1="' + (cy + 10) + '" x2="' + (cx + 11) + '" y2="' + (cy + 10) + '"/>' +
      '<line x1="' + (cx - 7) + '" y1="' + (cy + 15) + '" x2="' + (cx + 7) + '" y2="' + (cy + 15) + '"/>' +
      '<line x1="' + (cx - 3) + '" y1="' + (cy + 20) + '" x2="' + (cx + 3) + '" y2="' + (cy + 20) + '"/>' +
      '</g>';
  }

  // rotary selector: round knob on a vertical shaft
  function rotary(cx, cy, w, len, r) {
    let o = '';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#3a3d3c" stroke="#151515" stroke-width="1.6"/>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 4) + '" fill="#555958"/>';
    o += '<rect x="' + (cx - w / 2) + '" y="' + cy + '" width="' + w + '" height="' + len + '" rx="3" fill="#4a4d4c" stroke="#1a1a1a" stroke-width="1.2"/>';
    o += '<rect x="' + (cx - w / 2 + 2) + '" y="' + cy + '" width="' + (w - 4) + '" height="' + len + '" fill="#6b6f6e"/>';
    o += '<rect x="' + (cx - 2) + '" y="' + (cy - r + 4) + '" width="4" height="' + (r - 2) + '" fill="#e8e8e4"/>';
    return o;
  }

  // large black cam switch (top-left ON/OFF)
  function bigKnob(cx, cy, r, angleDeg) {
    let o = '';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#33363a" stroke="#111" stroke-width="1.6"/>';
    o += '<g transform="rotate(' + angleDeg + ' ' + cx + ' ' + cy + ')">';
    o += '<rect x="' + (cx - 5) + '" y="' + (cy - 5) + '" width="' + (r + 17) + '" height="10" rx="2" fill="#1c1d1c" stroke="#0a0a0a" stroke-width="1"/>';
    o += '<rect x="' + (cx - 1) + '" y="' + (cy - 2) + '" width="' + (r + 8) + '" height="4" fill="#5a5d5c"/>';
    o += '</g>';
    return o;
  }

  // ================== TOP BAND : VARIABLE LINE ==================

  s += head(407, 51, [
    'LIGNE VARIABLE DE 0 A 440V 50/2 A CA TRIPHASEE 3 A',
    'LINEA VARIABLE 0 A 450 V A CA TRIPASEE 2 A'
  ], 6.6);
  s += head(750, 51, [
    'LINEA VARIABLE DE CAPACIDAD DE 0 A 500V DC 3.5E 3 A 190V DC 2 A',
    'LINEA PUENTE DE ALIMENTACION / FONTE DE ALIMENTACAO'
  ], 6.6);

  // digital meters — wired to the model's two front-panel channels
  s += esam(299, 81, 'm1');
  s += esam(788, 83, 'm2');

  // ON/OFF cam switch with its two tap markers
  s += '<circle cx="456" cy="70" r="2.6" fill="#111"/>';
  s += txt(461, 73, 'L1A', { size: 7.5 });
  s += '<circle cx="598" cy="70" r="2.6" fill="#111"/>';
  s += txt(603, 73, 'L5A', { size: 7.5 });
  s += txt(443, 118, 'ON', { size: 8, weight: '700' });
  s += bigKnob(481, 111, 23, 38);

  // variac
  s += variac(652, 165);

  // main breaker group: AEG + E.TN
  s += txt(341, 140, 'ON', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(341, 150, 'MARCHE', { size: 8, weight: '700', anchor: 'middle' });
  s += aeg(298, 190, 179, 67, 4);
  s += etn(477, 190, 80, 67, 2, 'E.TN');
  s += txt(517, 182, 'M', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(341, 272, 'OFF', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(341, 282, 'ARRET', { size: 8, weight: '700', anchor: 'middle' });

  // P1 sub-panel
  s += txt(850, 182, 'P1', { size: 8, weight: '700', anchor: 'middle' });
  s += etn(824, 190, 52, 67, 2, 'E.TN');

  // S1 rotary
  s += txt(652, 288, 'S1', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(618, 326, 'ON', { size: 6.5, anchor: 'end' });
  s += txt(686, 326, 'OFF', { size: 6.5, anchor: 'start' });
  s += rotary(652, 330, 30, 37, 24);

  // ---- variable AC outlet: L1 L2 L3 L4 PE ----
  const acX = [319, 361, 404, 446, 489];
  const acC = ['black', 'black', 'black', 'blue', 'yellow'];
  const acL = ['L1', 'L2', 'L3', 'L4', 'PE'];
  for (let i = 0; i < 5; i++) {
    s += pjack(acX[i], 330, acC[i], 14);
    s += txt(acX[i], 312, acL[i], { size: 9, weight: '700', anchor: 'middle' });
  }
  s += earth(489, 344);

  // blanking cap between the AC and DC outlets
  s += roundCap(527, 331, 8);

  // ---- variable DC outlet: + / - ----
  s += pjack(829, 330, 'red', 14);
  s += pjack(871, 330, 'black', 14);
  s += txt(829, 312, '+', { size: 11, weight: '700', anchor: 'middle' });
  s += txt(871, 312, '-', { size: 11, weight: '700', anchor: 'middle' });

  // ================== MIDDLE BAND : FIXED LINES ==================

  // ---------- LEFT CELL : three-phase fixed 400 V ----------
  s += head(391, 384, [
    'THREE-PHASE FIXED LINE 400 V 10 A',
    'LINEA FIJA TRIFASICA 400 V 10 A',
    'LIGNE FIXE TRIPHASEE 400 V 10 A',
    'LINHA FIXA TRIFASICA 400 V 10 A',
    'LINEA FIJA TRIFASICA 400 V 10 A'
  ], 6.4);
  s += txt(341, 424, 'ON', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(341, 434, 'MARCHE', { size: 8, weight: '700', anchor: 'middle' });
  s += aeg(298, 442, 106, 67, 4);
  s += roundCap(468, 447, 21);
  s += txt(341, 520, 'OFF', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(341, 530, 'ARRET', { size: 8, weight: '700', anchor: 'middle' });
  for (let i = 0; i < 5; i++) {
    s += pjack(acX[i], 578, acC[i], 14);
    s += txt(acX[i], 558, acL[i], { size: 9, weight: '700', anchor: 'middle' });
  }
  s += earth(489, 592);

  // ---------- MIDDLE CELL : fixed 6/12/24 V DC ----------
  s += head(628, 384, [
    'FIXED LINE 6/12/24 V DC 2 A',
    'LINEA FIJA 6/12/24 V DC 2 A',
    'LIGNE FIXE 6/12/24 V DC 2 A',
    'LINHA FIXA 6/12/24 V DC 2 A',
    'LINEA FIJA 220 V DC 5 A'
  ], 6.4);
  s += txt(576, 424, 'P2', { size: 8, weight: '700', anchor: 'middle' });
  s += etn(550, 442, 52, 67, 2, 'E.TN');
  s += roundCap(681, 447, 21);

  // A1 / S0 / 24 selector
  s += txt(662, 510, 'A1', { size: 7, anchor: 'end' });
  s += txt(681, 504, 'S0', { size: 7, anchor: 'middle' });
  s += txt(700, 510, '24', { size: 7 });
  s += rotary(681, 530, 26, 20, 15);

  s += txt(575, 552, 'ON', { size: 7.5, weight: '700', anchor: 'middle' });
  s += txt(575, 562, 'MARCHE', { size: 7.5, weight: '700', anchor: 'middle' });
  s += '<circle cx="575" cy="578" r="12" fill="#1c1d1c" stroke="#0a0a0a" stroke-width="1.4"/>';
  s += '<circle cx="575" cy="578" r="6" fill="#3d4040"/>';
  s += txt(575, 596, 'OFF', { size: 7.5, weight: '700', anchor: 'middle' });
  s += txt(575, 605, 'ARRET', { size: 7.5, weight: '700', anchor: 'middle' });

  s += pjack(660, 578, 'red', 14);
  s += pjack(702, 578, 'black', 14);
  s += txt(660, 556, '+', { size: 11, weight: '700', anchor: 'middle' });
  s += txt(702, 556, '-', { size: 11, weight: '700', anchor: 'middle' });

  // ---------- RIGHT CELL : fixed 50 V DC ----------
  s += head(833, 384, [
    'FIXED LINE 50 V DC 2 A',
    'LINEA FIJA 50 V DC 2 A',
    'LIGNE FIXE 50 V DC 2 A',
    'LINHA FIXA 50 V DC 2 A',
    'LINEA FIJA 220 V DC 5 A'
  ], 6.4);
  s += roundCap(765, 446, 21);
  s += '<circle cx="765" cy="509" r="8" fill="#c2c6c5" stroke="#8d918f" stroke-width="1.4"/>';
  s += txt(853, 424, 'P3', { size: 8, weight: '700', anchor: 'middle' });
  s += etn(815, 442, 76, 67, 3, 'E.TN');

  s += txt(772, 552, 'ON', { size: 7.5, weight: '700', anchor: 'middle' });
  s += txt(772, 562, 'MARCHE', { size: 7.5, weight: '700', anchor: 'middle' });
  s += rotary(772, 578, 22, 10, 13);
  s += txt(772, 601, 'OFF', { size: 7.5, weight: '700', anchor: 'middle' });
  s += txt(772, 609, 'RESET', { size: 7.5, weight: '700', anchor: 'middle' });

  s += pjack(830, 578, 'red', 14);
  s += pjack(872, 578, 'black', 14);
  s += txt(830, 556, '+', { size: 11, weight: '700', anchor: 'middle' });
  s += txt(872, 556, '-', { size: 11, weight: '700', anchor: 'middle' });

  // ================== BOTTOM BAND : MAIN LINE ==================

  // main incoming group: AEG + fuse + two E.TN modules
  s += txt(365, 652, 'ON', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(365, 662, 'MARCHE', { size: 8, weight: '700', anchor: 'middle' });
  s += aeg(299, 664, 100, 66, 4);
  s += '<rect x="399" y="664" width="26" height="66" fill="#eeeee9" stroke="#1a1a1a" stroke-width="1.4"/>';
  s += '<circle cx="412" cy="678" r="9" fill="#111"/>';
  s += txt(412, 681, 'U>A', { size: 5, weight: '700', color: '#c0392b', anchor: 'middle' });
  s += '<rect x="404" y="694" width="16" height="22" fill="#dcdcd6" stroke="#666" stroke-width="0.8"/>';
  s += etn(425, 664, 27, 66, 1, 'E.TN');
  s += etn(452, 664, 52, 66, 2, 'E.TN');
  s += txt(365, 737, 'OFF', { size: 8, weight: '700', anchor: 'middle' });
  s += txt(365, 746, 'ARRET', { size: 8, weight: '700', anchor: 'middle' });

  // ---- MAIN LINE heading + main switch ----
  s += head(598, 622, ['MAIN LINE', 'LIGNE GENERALE', 'LINEA GENERAL'], 6.4);
  s += head(598, 650, ['MAIN SWITCH', 'SIT REG', 'MT GERAL'], 6.4);
  s += rotary(576, 700, 26, 30, 18);

  // ---- LINE blanking cap ----
  s += head(665, 622, ['LINE', 'LIGNE', 'LINE', 'LINE'], 6.2);
  s += roundCap(665, 694, 21);

  // ---- EMERGENCY mushroom ----
  s += head(757, 618, ['EMERGENCY', 'EFOUENE', 'EMERGENCA', 'EMERGENCY', 'EMERGENCY'], 5.6);
  s += '<circle cx="758" cy="695" r="38" fill="#efd372" stroke="#d8b83c" stroke-width="1"/>';
  s += '<circle cx="758" cy="695" r="28" fill="#c62828" stroke="#8e1b1b" stroke-width="1.4"/>';
  s += '<circle cx="758" cy="695" r="20" fill="#e03a38" stroke="#a51f1f" stroke-width="1"/>';
  s += '<defs><path id="emgArc" d="M 726 690 A 34 34 0 0 1 790 690"/></defs>';
  s += '<text font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" fill="#111">' +
    '<textPath href="#emgArc" startOffset="50%" text-anchor="middle">EMERGENCY</textPath></text>';

  // ---- START push button ----
  s += head(853, 622, ['STAAT', 'VIALIS', 'PARTIA', 'NAAANCIA'], 5.6);
  s += '<circle cx="853" cy="694" r="23" fill="#141514" stroke="#000" stroke-width="1.4"/>';
  s += '<circle cx="853" cy="694" r="17" fill="#2c9e49" stroke="#14702c" stroke-width="1.4"/>';
  s += '<circle cx="853" cy="694" r="11" fill="#3ab95a" opacity="0.85"/>';

  s += '<path d="M 300 733 q 12 14 4 26 q -10 -6 -8 -18 z" fill="#c0392b"/>';
  s += '<path d="M 296 742 q 10 12 2 22 q -9 -7 -7 -16 z" fill="#e05a3a"/>';
  s += '<path d="M 305 728 q 14 16 6 30 q -12 -8 -9 -22 z" fill="#8e1b1b"/>';
  s += '<path d="M 290 748 q 9 10 3 18 q -8 -6 -6 -13 z" fill="#555"/>';
  s += txt(332, 766, 'Elettronica', { size: 14, weight: '700', color: '#555' });
  s += txt(428, 766, 'Veneta', { size: 14, weight: '700', color: '#c0392b' });

  s += txt(650, 740, 'POWER SUPPLY', { size: 11, weight: '700', anchor: 'middle' });
  s += txt(590, 754, 'ALIMENTATION', { size: 7, anchor: 'middle' });
  s += txt(728, 754, 'FUENTE DE ALIMENTACION', { size: 7, anchor: 'middle' });
  s += txt(590, 764, 'ALIMENTATORE', { size: 7, anchor: 'middle' });
  s += txt(728, 764, 'FONTE DE ALIMENTACAO', { size: 7, anchor: 'middle' });
  s += txt(868, 754, 'mod. AV-1/EV', { size: 10, weight: '700', anchor: 'middle' });

  s += '</g>';
  return s + '</svg>';
}

/* ═══════════════════════════════════════════════════════════
   AZ-VIPS METER (single panel-meter module for V or A)
   ═══════════════════════════════════════════════════════════ */
function spriteMeter(opts) {
  opts = opts || {};
  const mode = opts.mode || 'V';
  const isV = mode === 'V';
  // AZ-VIPS (voltmeter) / AZ-VIDC (ammeter) module, traced from multimeter.jpg.
  // The reference is a 4-field panel; on the bench we show ONE clear reading
  // with its unit, plus the mode-correct input terminals.
  const W = 260, H = 180;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 520 360" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ---- panel ----
  s += '<rect x="6" y="6" width="508" height="348" rx="8" fill="#e9e9e1" stroke="#1a1a1a" stroke-width="3"/>';
  s += '<rect x="14" y="14" width="492" height="332" rx="5" fill="none" stroke="#8a8a84" stroke-width="1"/>';
  s += screw(26, 26) + screw(494, 26) + screw(26, 334) + screw(494, 334);

  // ---- header ----
  s += txt(260, 46, isV ? 'AZ-VIPS' : 'AZ-VIDC', { size: 22, weight: '700', anchor: 'middle' });
  s += txt(260, 66, isV ? 'DC VOLTMETER' : 'DC AMMETER', { size: 12, anchor: 'middle' });
  s += txt(260, 82, isV ? 'VOLTAGE MEASUREMENT' : 'CURRENT MEASUREMENT', { size: 9, anchor: 'middle', color: '#555' });

  // ---- blue LCD ----
  s += '<rect x="150" y="100" width="220" height="112" rx="4" fill="#0e2a3a" stroke="#111" stroke-width="2.4"/>';
  s += '<rect x="157" y="107" width="206" height="98" fill="#3f96d4" stroke="#1d5a8a" stroke-width="1"/>';
  // main reading + unit, mode-correct (centred so it never clips)
  s += txt(256, 168, isV ? '220.0' : '1.400', { size: 38, weight: '700', anchor: 'end', color: '#08161f' });
  s += txt(268, 168, isV ? 'V' : 'A', { size: 26, weight: '700', anchor: 'start', color: '#08161f' });
  s += txt(260, 194, isV ? 'DC · RANGE 500V' : 'DC · RANGE 2A', { size: 9, anchor: 'middle', color: '#0a2a3a' });
  // small mode tag inside LCD
  s += txt(184, 128, isV ? 'V' : 'A', { size: 12, weight: '700', color: '#0a2a3a' });
  s += '<line x1="175" y1="136" x2="193" y2="136" stroke="#0a2a3a" stroke-width="1.4"/>';

  // ---- left connectors (SYNC SCOPY / AZ POWER SUPPLY) ----
  s += '<rect x="34" y="104" width="100" height="46" rx="3" fill="#cfcfc8" stroke="#555" stroke-width="1.2"/>';
  s += '<rect x="40" y="112" width="40" height="18" rx="2" fill="#3a3a3a" stroke="#111" stroke-width="1"/>';
  s += '<rect x="86" y="112" width="40" height="18" rx="2" fill="#3a3a3a" stroke="#111" stroke-width="1"/>';
  s += txt(84, 168, 'SYNC', { size: 8, anchor: 'middle', color: '#555' });

  // ---- button bar ----
  s += '<rect x="157" y="222" width="206" height="28" rx="3" fill="#1c1c1c" stroke="#111" stroke-width="1"/>';
  const btn = ['RANGE', 'HOLD', 'MIN/MAX', 'ON'];
  for (let i = 0; i < 4; i++) {
    const bx = 168 + i * 50;
    s += '<rect x="' + bx + '" y="228" width="40" height="16" rx="3" fill="#c0392b" stroke="#7a1a12" stroke-width="0.8"/>';
    s += txt(bx + 20, 254, btn[i], { size: 6, anchor: 'middle', color: '#333' });
  }

  // ---- measurement jack pair (right) ----
  s += jack(400, 158, 'red', 18);
  s += jack(400, 258, 'red', 18);
  s += '<path d="M 400 176 L 400 196 L 382 196" stroke="#c0392b" stroke-width="3" fill="none"/>';

  // ---- auxiliary jack pair (left) ----
  s += jack(120, 158, 'red', 18);
  s += jack(120, 258, 'red', 18);
  s += '<path d="M 120 176 L 120 196 L 138 196" stroke="#c0392b" stroke-width="3" fill="none"/>';
  s += txt(96, 202, 'ALARM', { size: 9, weight: '600', anchor: 'end' });

  // ---- terminal labels ----
  if (isV) {
    s += txt(120, 300, '+', { size: 22, weight: '700', anchor: 'middle' });
    s += txt(400, 300, '-', { size: 22, weight: '700', anchor: 'middle' });
    s += txt(400, 136, 'V', { size: 12, weight: '700', anchor: 'middle' });
  } else {
    s += txt(120, 300, 'IN', { size: 18, weight: '700', anchor: 'middle' });
    s += txt(400, 300, 'OUT', { size: 18, weight: '700', anchor: 'middle' });
    s += txt(400, 136, 'A', { size: 12, weight: '700', anchor: 'middle' });
  }

  return s + '</svg>';
}

/* ═══════════════════════════════════════════════════════════
   LOAD BANK · resistive load step switch
   ═══════════════════════════════════════════════════════════ */
function spriteLoadBank() {
  const W = 260, H = 180;
  let s = svgOpen(W, H);
  s += '<rect x="8" y="8" width="244" height="164" rx="4" fill="#d8d8d0" stroke="#1a1a1a" stroke-width="1.8"/>';
  s += screw(16, 16) + screw(244, 16) + screw(16, 164) + screw(244, 164);
  s += label(130, 30, 'LOAD BANK · RESISTIVE STEPS', { size: 6.4, weight: '700', anchor: 'middle' });

  // step switches — 5 toggle groups with indicator lamps
  for (let i = 0; i < 5; i++) {
    const x = 30 + i * 42;
    s += '<rect x="' + x + '" y="56" width="32" height="50" rx="3" fill="#1c1c1c" stroke="#333" stroke-width="0.8"/>';
    s += txt(x + 16, 68, 'S' + (i + 1), { size: 4.6, anchor: 'middle', color: '#fff', weight: '600' });
    s += '<circle cx="' + (x + 16) + '" cy="92" r="6" fill="#c81414" stroke="#7a0a0a" stroke-width="0.6"/>';
  }
  // jacks
  s += jack(50, 140, 'red', 6);   s += label(50, 158, 'A', { size: 6, weight: '700', anchor: 'middle' });
  s += jack(210, 140, 'black', 6); s += label(210, 158, 'B', { size: 6, weight: '700', anchor: 'middle' });
  return s + '</svg>';
}

/* ═══════════════════════════════════════════════════════════
   AZ MODULE RACK · the whole bench bay (bonus, matches photo)
   ═══════════════════════════════════════════════════════════ */
// ════════════════════════════════════════════════════════════════
//  EEE-2152 measurement rack — full traced rebuild
//  Every module drawn in REFERENCE pixel coords (1195 x 896).
//  Bay boundaries are the measured x-values from the reference photo.

// ─── shared primitives ────────────────────────────────────────────
function _rr(x,y,w,h,f,st,sw,rx){ return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'"'+(rx?' rx="'+rx+'"':'')+' fill="'+(f||'none')+'" stroke="'+(st||'none')+'" stroke-width="'+(sw||0)+'"/>'; }
function _cc(cx,cy,r,f,st,sw){ return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+(f||'none')+'" stroke="'+(st||'none')+'" stroke-width="'+(sw||0)+'"/>'; }
function _tt(x,y,t,sz,wt,c,a){ return '<text x="'+x+'" y="'+y+'" font-family="Helvetica,Arial,sans-serif" font-size="'+sz+'" font-weight="'+(wt||'400')+'" fill="'+(c||'#111')+'" text-anchor="'+(a||'middle')+'">'+t+'</text>'; }
function _lv(x,y,id,sz){ return '<text x="'+x+'" y="'+y+'" data-live="'+id+'" font-family="Helvetica,Arial,sans-serif" font-size="'+sz+'" font-weight="700" fill="#8ef0b8" text-anchor="middle"></text>'; }
function _screw(x,y){ return _cc(x,y,4,'#c8c8c0','#666',0.8)+'<line x1="'+(x-3)+'" y1="'+y+'" x2="'+(x+3)+'" y2="'+y+'" stroke="#666" stroke-width="0.8"/>'; }
function _screws(x,y,w,h){ return _screw(x+12,y+12)+_screw(x+w-12,y+12)+_screw(x+12,y+h-12)+_screw(x+w-12,y+h-12); }
function _jack(cx,cy,r){ r=r||7; return _cc(cx,cy,r,'#c81414','#000',1.2)+_cc(cx,cy,r*0.42,'#151515'); }
function _socket(cx,cy,r){ return _cc(cx,cy,r||8,'#151515','#000',1.2); }
function _lamp(cx,cy,r,c){ r=r||22; c=c||'#c81414'; return _cc(cx,cy,r,'#0a0a0a','#000',1.4)+_cc(cx,cy,r*0.78,c)+_cc(cx-r*0.28,cy-r*0.28,r*0.22,'rgba(255,255,255,0.4)'); }
function _led(cx,cy,r,c){ r=r||6; c=c||'#888'; return _cc(cx,cy,r,'#0a0a0a','#000',1)+_cc(cx,cy,r*0.75,c); }
function _btnRed(cx,cy){ return _rr(cx-8,cy-4,16,8,'#c81414','#7a0e0e',0.7,4); }
function _db9(x,y,w){ w=w||44; return _rr(x,y,w,16,'#3a3a3a','#111',1)+_rr(x+3,y+3,w-6,10,'#1a1a1a'); }
function _outlet(cx,cy,r){ r=r||22; return _cc(cx,cy,r,'#f2f2ea','#444',1.4)+_cc(cx-r*0.35,cy-r*0.15,r*0.11,'#222')+_cc(cx+r*0.35,cy-r*0.15,r*0.11,'#222')+_cc(cx,cy+r*0.35,r*0.11,'#222'); }
function _lcdBezel(x,y,w,h){ return _rr(x,y,w,h,'#e8e8e0','#000',1.5,3); }
function _lcdBlue(x,y,w,h){ return _rr(x,y,w,h,'#5aa8de','#0a2530',1.2); }
function _iwy(x,y){ return _rr(x,y,44,58,'#1a1a1a','#000',1.2)+_tt(x+22,y+22,'ON',7,'700','#fff')+_tt(x+22,y+42,'DO',7,'700','#fff')+_tt(x+22,y+62,'OFF',7,'700','#fff'); }

// ─── ROW 1 · BAY 1 · SYNC SCOPY ────────────────────────────────────
// ref bay: x68..206 y101..241

// ─── traced VIPS #1 (Row 1 Bay 2) ─────────────────────────────────
// Merged into the rack at ref bay x206..479, y101..241.
// ─── shared primitives ────────────────────────────────────────────

// ─── ROW 1 · BAY 2 · AZ-VIPS #1 (traced) ──────────────────────────
// ref bay: x206..479, y101..241. All coords are reference pixels.

// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────


// ─── shared primitives ────────────────────────────────────────────

// Live unit letter (V / A / W) beside an LCD number.
function _lu(x,y,id,sz){ return '<text x="'+x+'" y="'+y+'" data-live-unit="'+id+'" font-family="Helvetica,Arial,sans-serif" font-size="'+(sz||10)+'" font-weight="700" fill="#8ef0b8" text-anchor="middle"></text>'; }

function spriteVIPSModule(){
  // ref bay x206..479 y101..241
  var s = '';
  s += _rr(206,101,273,140,'#ecece4','#444',1);
  s += _screw(216,112)+_screw(469,112)+_screw(216,230)+_screw(469,230);
  s += _tt(474,116,'AZ-VIPS',12,'700','#111','end');
  s += _rr(217,120,93,92,'#e0e0d8','#111',1.3,3);
  s += _rr(225,128,77,58,'#5aa8de','#0a2530',1);
  // live readout + its unit; the V / A / W switch and the + / − input
  // banks for this display live on the control strip (see spriteControlPanelA)
  s += _lv(259,170,'d1',22);
  s += _lu(297,180,'d1',12);
  s += _tt(415,124,'VOLTAGE MEASUREMENT',6,'700','#333');
  s += _tt(415,132,'TEMP -20/150C',5.5,'400','#333');
  s += _jack(330,155,8);
  s += '<path d="M330,163 L330,172 L335,177 L325,183 L335,189 L330,195 L330,203" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(330,210,8);
  s += _tt(365,185,'RAUDS',6,'400','#333');
  s += _cc(350,148,8,'#8a8a86','#000',1.2)+_cc(350,148,3.5,'#151515');
  s += _cc(376,148,8,'#8a8a86','#000',1.2)+_cc(376,148,3.5,'#151515');
  s += _cc(402,148,8,'#8a8a86','#000',1.2)+_cc(402,148,3.5,'#151515');
  s += _cc(428,148,8,'#8a8a86','#000',1.2)+_cc(428,148,3.5,'#151515');
  s += _tt(350,140,'A1',5.5,'400','#333')+_tt(376,140,'B1',5.5,'400','#333')+_tt(402,140,'B2',5.5,'400','#333')+_tt(428,140,'D',5.5,'400','#333');
  s += _jack(350,170,7)+_jack(376,170,7)+_jack(402,170,7);
  s += _jack(350,208,7)+_jack(376,208,7)+_jack(402,208,7);
  s += _tt(350,222,'R',5.5,'400','#333')+_tt(376,222,'D',5.5,'400','#333')+_tt(402,222,'C',5.5,'400','#333');
  s += '<path d="M410,170 L440,170 L440,208 L410,208" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _tt(465,182,'VOLTAGE',5,'400','#333')+_tt(465,190,'REAL RANGE',4.5,'400','#333')+_tt(465,198,'AS HOLD',4.5,'400','#333');
  return s;
}

function spriteSYNCSCOPY(){
  // ref bay x68..206 y101..241
  var s = '';
  s += _rr(68,101,138,140,'#ecece4','#333',1);
  s += _screw(78,112)+_screw(196,112)+_screw(78,230)+_screw(196,230);
  // SYNC SCOPY labelled box with two DB9 connectors
  s += _rr(84,122,82,32,'#f4f4ee','#333',1);
  s += _tt(125,131,'SYNC SCOPY',5,'700','#333');
  s += _db9(88,138,34)+_db9(126,138,34);
  // AZ POWER SUPPLY label
  s += _tt(116,164,'AZ POWER SUPPLY',6,'700','#333');
  // framed Schuko outlet
  s += _rr(88,174,56,54,'#f4f4ee','#333',1.2,2);
  s += _cc(116,201,20,'#dcdcd4','#555',1.2);
  s += _cc(108,197,2.2,'#222')+_cc(124,197,2.2,'#222')+_cc(116,209,2.2,'#222');
  // ALARM pair on right edge
  s += _jack(183,160,8);
  s += '<path d="M183,168 L183,175 L188,180 L178,186 L188,192 L183,198 L183,204" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(183,210,8);
  s += _tt(160,182,'ALARM',5.5,'400','#333');
  return s;
}

// ─── ROW 1 · BAY 3 · MINS SCOPY ────────────────────────────────────
// ref bay: x479..719 y101..241
function spriteMINSSCOPY(){
  // ref bay x479..719 y101..241
  var s = '';
  s += _rr(479,101,240,140,'#ecece4','#333',1);
  s += _screw(490,112)+_screw(707,112)+_screw(490,230)+_screw(707,230);
  // MINS SCOPY labelled box
  s += _rr(495,122,105,32,'#f4f4ee','#333',1);
  s += _tt(547,131,'MINS SCOPY',5,'700','#333');
  s += _db9(500,138,42)+_db9(550,138,42);
  s += _tt(547,165,'AC TONER OUTPUT',6,'700','#333');
  // dark DIN rounded-hex body
  s += '<path d="M525,178 L562,175 L600,190 L600,220 L562,235 L525,232 Z" fill="#1a1a1a" stroke="#000" stroke-width="1.3"/>';
  s += _rr(548,188,26,30,'#2a2a2a','#111',1,2);
  s += _cc(556,197,2.5,'#555')+_cc(566,197,2.5,'#555');
  s += _rr(553,205,16,4,'#333')+_rr(553,212,16,4,'#333');
  // ALARM pair + zigzag
  s += _jack(575,155,8);
  s += '<path d="M575,163 L575,172 L580,177 L570,183 L580,189 L575,195 L575,203" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(575,210,8);
  s += _tt(548,186,'ALARM',5.5,'400','#333');
  // LCD bezel + buttons on right
  s += _rr(612,120,93,92,'#e0e0d8','#111',1.3,3);
  s += _rr(620,128,77,58,'#5aa8de','#0a2530',1);
  s += _lv(654,170,'d2',22);
  s += _lu(692,180,'d2',12);
  return s;
}

// ─── ROW 1 · BAY 4 · AZ-VIPS #2 (mirrored of Bay 2) ────────────────
// ref bay: x719..893 y101..241
function spriteVIPS2(){
  // ref bay x719..894 y101..241 — jack cluster + label only
  var s = '';
  s += _rr(719,101,175,140,'#ecece4','#333',1);
  s += _screw(729,112)+_screw(884,112)+_screw(729,230)+_screw(884,230);
  s += _tt(888,116,'AZ-VIPS',12,'700','#111','end');
  s += _tt(805,124,'VOLTAGE MEASUREMENT',5.5,'700','#333');
  s += _tt(805,132,'TEMP -20/150C',5,'400','#333');
  s += _jack(748,155,8);
  s += '<path d="M748,163 L748,172 L753,177 L743,183 L753,189 L748,195 L748,203" stroke="#333" stroke-width="0.9" fill="none"/>';
  s += _jack(748,210,8);
  s += _tt(780,185,'RAUDS',5.5,'400','#333');
  s += _cc(775,148,8,'#8a8a86','#000',1.2)+_cc(775,148,3.5,'#151515');
  s += _cc(800,148,8,'#8a8a86','#000',1.2)+_cc(800,148,3.5,'#151515');
  s += _cc(825,148,8,'#8a8a86','#000',1.2)+_cc(825,148,3.5,'#151515');
  s += _cc(850,148,8,'#8a8a86','#000',1.2)+_cc(850,148,3.5,'#151515');
  s += _tt(775,140,'A1',5.5,'400','#333')+_tt(800,140,'B1',5.5,'400','#333')+_tt(825,140,'B2',5.5,'400','#333')+_tt(850,140,'D',5.5,'400','#333');
  s += _jack(775,170,7)+_jack(800,170,7)+_jack(825,170,7);
  s += _jack(775,208,7)+_jack(800,208,7)+_jack(825,208,7);
  s += _tt(775,222,'R',5.5,'400','#333')+_tt(800,222,'D',5.5,'400','#333')+_tt(825,222,'C',5.5,'400','#333');
  s += '<path d="M835,170 L865,170 L865,208 L835,208" stroke="#333" stroke-width="0.9" fill="none"/>';
  return s;
}

function spriteOutletBay(){
  // ref bay x894..1122 y101..241
  var s = '';
  s += _rr(894,101,228,140,'#c8c8c2','#333',1);
  s += _screw(905,112)+_screw(1112,112)+_screw(905,230)+_screw(1112,230);
  // white framed square with Schuko
  s += _rr(920,128,96,100,'#f4f4ee','#111',1.4,3);
  s += _cc(968,178,34,'#c8c8c2','#333',1.2);
  s += _cc(956,178,3,'#222')+_cc(980,178,3,'#222');
  s += '<path d="M951,158 L951,152 M985,158 L985,152" stroke="#333" stroke-width="1.2"/>';
  s += '<path d="M962,204 L962,210 M974,204 L974,210" stroke="#333" stroke-width="1.2"/>';
  return s;
}

// ─── ROW 2 · BAY 1 · AA POWER SUPPLY + DC MULTIMETER ───────────────
// ref bay: x68..223 y264..398
function spriteAAPower(){
  // ref bay x68..223 y264..398
  var s = '';
  s += _rr(68,264,155,134,'#ecece4','#333',1);
  s += _screw(78,274)+_screw(213,274)+_screw(78,388)+_screw(213,388);
  s += _tt(135,320,'AA POWER SUPPLY',5.5,'700','#333');
  s += _rr(105,340,60,56,'#f4f4ee','#111',1.4,2);
  s += _cc(135,368,22,'#dcdcd4','#555',1.2);
  s += _cc(126,364,2.5,'#222')+_cc(144,364,2.5,'#222')+_cc(135,379,2.5,'#222');
  s += '<path d="M127,351 L127,346 M143,351 L143,346" stroke="#333" stroke-width="1.2"/>';
  s += '<path d="M127,385 L127,390 M143,385 L143,390" stroke="#333" stroke-width="1.2"/>';
  s += _rr(168,307,50,32,'#f4f4ee','#111',1);
  s += _tt(193,320,'DC MULTIMETER',4.2,'700','#111');
  s += _tt(193,331,'600V - 25A',4.2,'400','#333');
  s += _jack(184,292,8);
  s += _cc(213,292,8,'#151515','#000',1.2)+_cc(213,292,3.5,'#000');
  s += _jack(184,358,8);
  s += _cc(213,358,8,'#151515','#000',1.2)+_cc(213,358,3.5,'#000');
  s += _tt(184,283,'+',5.5,'700','#333')+_tt(213,283,'-',5.5,'700','#333');
  s += _tt(184,370,'-',5.5,'700','#333')+_tt(213,370,'-',5.5,'700','#333');
  return s;
}

// ─── ROW 2 · BAY 2 · DIN METER PAIR ────────────────────────────────
// ref bay: x223..479 y264..398 — two grey DIN boxes with blue LCDs
function spriteDINMeters(){
  // ref bay x223..479 y264..398
  var s = '';
  s += _rr(223,264,256,134,'#ecece4','#333',1);
  s += _screw(233,274)+_screw(469,274)+_screw(233,388)+_screw(469,388);
  s += _tt(470,278,'AZ-VIDC',8,'700','#111','end');
  function meter(x0, disp){
    var t = '';
    t += _rr(x0,295,95,96,'#9a9a94','#333',1.2);
    t += _rr(x0+6,301,83,18,'#5a5a56','#222',0.8);
    t += _tt(x0+26,314,'ENTER',3.2,'400','#ddd');
    t += _tt(x0+64,314,'CLEAR',3.2,'400','#ddd');
    t += _rr(x0+6,323,83,50,'#3a3a38','#111',1);
    t += _rr(x0+10,327,75,42,'#5aa8de','#0a2530',1);
    t += _lv(x0+44,357,disp,16);
    t += _lu(x0+66,364,disp,8);
    t += _rr(x0+6,378,83,10,'#3a3a38','#111',0.8);
    return t;
  }
  s += meter(230, 'd3');
  s += meter(333, 'd4');
  s += _jack(440,290,8);
  s += _cc(462,290,8,'#151515','#000',1.2)+_cc(462,290,3.5,'#000');
  s += _rr(425,305,52,32,'#f4f4ee','#111',1);
  s += _tt(451,318,'DC DIKJOSTER',3.6,'700','#111');
  s += _tt(451,329,'010Y - 25A',3.6,'400','#333');
  s += _jack(440,360,8);
  s += _cc(462,360,8,'#151515','#000',1.2)+_cc(462,360,3.5,'#000');
  s += _tt(440,283,'+',5,'700','#333')+_tt(462,283,'-',5,'700','#333');
  s += _tt(440,370,'-',5,'700','#333')+_tt(462,370,'-',5,'700','#333');
  return s;
}

// ─── ROW 2 · BAY 3 · ROUND OUTLET ──────────────────────────────────
function spriteOutletR2(){
  // ref bay x479..685 y264..398 — grey DIN panel with framed Schuko
  var s = '';
  s += _rr(479,264,206,134,'#c8c8c2','#333',1);
  s += _screw(489,274)+_screw(676,274)+_screw(489,388)+_screw(676,388);
  s += _rr(496,300,96,96,'#f4f4ee','#111',1.4,2);
  s += _cc(544,348,34,'#c8c8c2','#333',1.2);
  s += _cc(534,348,3,'#222')+_cc(554,348,3,'#222');
  s += '<path d="M529,330 L529,324 M559,330 L559,324" stroke="#333" stroke-width="1.2"/>';
  s += '<path d="M529,366 L529,372 M559,366 L559,372" stroke="#333" stroke-width="1.2"/>';
  return s;
}

// ─── ROW 2 · BAY 4 · COUNTER + AC OUTPUT ───────────────────────────
// ref bay: x685..893 y264..398
function spriteCounter(){
  // ref bay x685..893 y264..398 — counter + AC 250SE OUTPUT
  var s = '';
  s += _rr(685,264,208,134,'#ecece4','#333',1);
  s += _screw(695,274)+_screw(884,274)+_screw(695,388)+_screw(884,388);
  // wide counter bezel
  s += _rr(700,308,140,66,'#2a2a2a','#000',1.5);
  s += _rr(710,318,120,46,'#0a0a0a','#111',1);
  s += '<text x="770" y="352" font-family="monospace" font-size="30" font-weight="700" fill="#e02020" text-anchor="middle">00000</text>';
  s += _tt(770,388,'COUNT 000-000',5,'400','#333');
  // red + jack above
  s += _jack(825,292,8);
  s += _tt(812,295,'+',5.5,'700','#333');
  // AOG circle
  s += _cc(825,336,10,'#f4f4ee','#111',1.2);
  s += _tt(825,339,'AOG',4.5,'700','#333');
  // hex connector
  s += '<polygon points="850,308 875,308 883,332 875,356 850,356 842,332" fill="#2a2a2a" stroke="#000" stroke-width="1.3"/>';
  s += _rr(853,318,22,26,'#1a1a1a','#111',1);
  s += _cc(864,326,2.2,'#ccc')+_cc(864,336,2.2,'#ccc');
  s += _tt(862,290,'AC 250SE OUTPUT',5.2,'700','#333');
  s += _cc(825,375,9,'#151515','#000',1.2)+_cc(825,375,4,'#000');
  s += _tt(800,378,'LOTING',4.8,'400','#333');
  s += _tt(800,386,'DET OUT',4.8,'400','#333');
  return s;
}

// ─── METER CONTROL STRIPS ──────────────────────────────────────────
// Each display gets a V / A / W switch and a two-row input bank: the top
// row is the + input and the bottom row is the − input, and every post in
// one row is the SAME electrical node — they exist only so a wire can land
// on whichever post is convenient and close the loop. The posts and buttons
// themselves are HTML overlays placed from the meter_rack layout; only the
// panel and its labels are painted here.
//
// They live on the rack's empty lower panels rather than beside the LCDs:
// the art is 1195 px mapped into 560 device px, so a Row-1 LCD is barely
// 36 px wide on the bench and could never carry readable controls.
// The V / A / W switches are HTML overlays placed from the meter_rack
// layout, positioned right beside each display's LCD. There is nothing to
// paint here — the panel and its jacks are already in spriteAAPower() and
// spriteDINMeters(); the jacks get their clickable terminals from the
// layout, and the switches sit on top of the pixels next to each LCD.

function spriteIWYBay(){
  // ref bay x68..479 y420..554 — IWY + LETI/LOPS + bypass diagram + AZ68 lamps
  var s = '';
  s += _rr(68,420,411,134,'#ecece4','#333',1);
  s += _screw(78,430)+_screw(469,430)+_screw(78,544)+_screw(469,544);
  // IWY switch
  s += _tt(115,490,'IWY',7,'700','#111');
  s += _rr(133,455,62,80,'#f0f0ea','#111',1.4,3);
  s += _rr(140,462,26,66,'#2a2a2a','#111',1);
  s += _cc(153,478,3,'#888')+_cc(153,510,3,'#888');
  s += _tt(178,478,'ON',5.5,'700','#111');
  s += _tt(178,496,'OO',5.5,'700','#111');
  s += _tt(178,516,'ON',5.5,'700','#111');
  s += _rr(196,468,6,20,'#bcd');s += _rr(196,500,6,20,'#bcd');
  s += _tt(226,497,'ON',7,'700','#111');
  // LETI row
  s += _tt(300,432,'LETI',5.5,'700','#333')+_tt(330,432,'LETI',5.5,'700','#333')+_tt(360,432,'LETI',5.5,'700','#333');
  s += _cc(300,447,9,'#2a2a2a','#000',1.2)+_cc(300,447,4,'#000');
  s += _cc(330,447,9,'#2a2a2a','#000',1.2)+_cc(330,447,4,'#000');
  s += _jack(360,447,9);
  // dashed bypass diagram w/ 3 knife switches + 3 ⊗
  s += '<line x1="300" y1="470" x2="420" y2="470" stroke="#333" stroke-width="0.8" stroke-dasharray="3,2"/>';
  s += '<path d="M300,447 L300,470 M330,447 L330,470 M360,447 L360,470" stroke="#333" stroke-width="0.8"/>';
  s += '<path d="M300,470 L300,500 M330,470 L330,500 M360,470 L360,500" stroke="#333" stroke-width="0.8"/>';
  s += '<path d="M300,485 L330,480 M330,485 L360,480 M360,485 L390,480" stroke="#333" stroke-width="0.8"/>';
  s += _tt(408,455,'ANY',5.5,'400','#333');
  s += _cc(390,470,7,'#f0f0ea','#333',1)+'<path d="M385,465 L395,475 M395,465 L385,475" stroke="#333" stroke-width="0.8"/>';
  s += _cc(415,470,7,'#f0f0ea','#333',1)+'<path d="M410,465 L420,475 M420,465 L410,475" stroke="#333" stroke-width="0.8"/>';
  s += _cc(440,470,7,'#f0f0ea','#333',1)+'<path d="M435,465 L445,475 M445,465 L435,475" stroke="#333" stroke-width="0.8"/>';
  // LOPS row
  s += _tt(300,520,'LOPS',5.5,'700','#333')+_tt(330,520,'LOPS',5.5,'700','#333')+_tt(360,520,'LOPS',5.5,'700','#333');
  s += _cc(300,535,9,'#2a2a2a','#000',1.2)+_cc(300,535,4,'#000');
  s += _cc(330,535,9,'#2a2a2a','#000',1.2)+_cc(330,535,4,'#000');
  s += _jack(360,535,9);
  // AZ68 + 3 lamps at right
  s += _tt(468,432,'AZ68',10,'700','#111','end');
  s += _lamp(408,464,15,'#c81414');
  s += _tt(408,488,'SD',5.5,'700','#333');
  s += _lamp(395,517,15,'#c81414');
  s += _lamp(440,517,15,'#c81414');
  return s;
}

function spriteAZ68_R3(){ return ''; }

// ─── ROW 3 · BAY 3 · AZ67 (2 lamps + SEG SCOPY) ────────────────────
// ref bay: x685..894 y420..554
function spriteAZ67_R3(){
  // ref bay x479..685 y420..554 — AZ67
  var s = '';
  s += _rr(479,420,206,134,'#ecece4','#333',1);
  s += _screw(489,430)+_screw(675,430)+_screw(489,544)+_screw(675,544);
  s += _tt(675,432,'AZ67',10,'700','#111','end');
  // AMT socket top-left
  s += _tt(540,448,'AMT',5,'700','#333');
  s += _cc(540,462,8,'#2a2a2a','#000',1.2)+_cc(540,462,3.5,'#000');
  s += _tt(522,478,'A',5,'400','#333')+_tt(558,478,'A',5,'400','#333');
  // two big lamps
  s += _lamp(520,500,26,'#c81414');
  s += _lamp(575,500,26,'#c81414');
  // SEG SCOPY diagram on right
  s += _tt(615,448,'SEG',4.5,'400','#333')+_tt(615,455,'SCOPY',4.5,'400','#333');
  s += '<line x1="605" y1="462" x2="672" y2="462" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="605" y1="466" x2="672" y2="466" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="605" y1="470" x2="672" y2="470" stroke="#333" stroke-width="0.7"/>';
  s += '<path d="M614,462 L614,500 M666,462 L666,500" stroke="#333" stroke-width="0.8"/>';
  s += _jack(640,483,7);
  s += _tt(658,478,'LNT',4.5,'400','#333');
  s += '<path d="M640,490 L640,500" stroke="#333" stroke-width="0.8"/>';
  s += '<line x1="630" y1="502" x2="650" y2="502" stroke="#333" stroke-width="1.4"/>';
  s += '<line x1="630" y1="507" x2="650" y2="507" stroke="#333" stroke-width="1.4"/>';
  s += '<path d="M640,507 L632,515 M640,507 L648,515" stroke="#333" stroke-width="0.8"/>';
  s += _cc(624,515,6,'#f0f0ea','#333',0.9)+'<path d="M620,511 L628,519 M628,511 L620,519" stroke="#333" stroke-width="0.7"/>';
  s += _cc(656,515,6,'#f0f0ea','#333',0.9)+'<path d="M652,511 L660,519 M660,511 L652,519" stroke="#333" stroke-width="0.7"/>';
  s += _cc(614,522,7,'#2a2a2a','#000',1.2)+_cc(614,522,3,'#000');
  s += _cc(666,522,7,'#2a2a2a','#000',1.2)+_cc(666,522,3,'#000');
  s += _tt(614,538,'LNT',4.5,'400','#333')+_tt(666,538,'NAUO',4.5,'400','#333');
  return s;
}

// ─── ROW 4 · BAY 1 · BENCH CONNECTIONS (canonical wired bay) ───────
// ref bay: x68..289 y576..706
function spriteBenchBay(){
  // ref bay x893..1122 y576..706 — bench connections, 4 clickable term dots.
  // Terms: V+, V- (left column), in, out (right column).
  //   V+ / V-  : the voltmeter movement — d1's AZ-VIPS reads across these.
  //   in / out : the shared series shunt — the rack's ammeter movement.
  var s = '';
  s += _rr(893,576,229,130,'#c8c8c2','#333',1);
  s += _screws(893,576,229,130);
  s += _tt(1008,596,'BENCH CONNECTIONS',7,'700','#333');
  // left column — voltage posts
  s += _jack(939,623,10)+_jack(939,672,10);
  s += _tt(912,627,'V+',9,'700','#111','end')+_tt(912,676,'V\u2212',9,'700','#111','end');
  // right column — series current posts
  s += _jack(1020,623,10)+_jack(1020,672,10);
  s += _tt(1046,627,'IN',9,'700','#111','start')+_tt(1046,676,'OUT',9,'700','#111','start');
  // orange markers beside each jack (cue that these are the live binding posts)
  s += _rr(927,634,24,3,'#e87820','none',0);
  s += _rr(927,683,24,3,'#e87820','none',0);
  s += _rr(1008,634,24,3,'#e87820','none',0);
  s += _rr(1008,683,24,3,'#e87820','none',0);
  return s;
}

// ─── ROW 4 · BAY 2 · IWY + LETI (denser row 4 variant) ─────────────
function spriteIWYBay_R4(){
  // ref bay x289..479 — IWY switch + LETI/LOPS cluster with interconnect diagram
  var s = '';
  s += _screws(289,576,190,130);
  s += _iwy(300,598);
  // top LETI row
  s += _tt(372,590,'LETI',6,'700','#222')+_tt(404,590,'LETI',6,'700','#222')+_tt(436,590,'LETI',6,'700','#222');
  s += _socket(372,606)+_socket(404,606)+_jack(436,606,6);
  // interconnect wire diagram
  s += _rr(358,620,90,26,'none','#888',1);
  s += _cc(368,633,3,'#333')+_cc(420,633,3,'#333')+_cc(410,633,3,'#333');
  s += _tt(395,646,'AMT',5.5,'400','#333');
  // bottom LOPS row
  s += _tt(372,664,'LOPS',6,'700','#222')+_tt(404,664,'LOPS',6,'700','#222')+_tt(436,664,'LOPS',6,'700','#222');
  s += _socket(372,682)+_socket(404,682)+_jack(436,682,6);
  return s;
}

// ─── ROW 4 · BAY 3 · AZ68 + orange hanging module ──────────────────
function spriteAZ68_R4(){
  // ref bay x479..685 y576..706 — AZ68: 1 top lamp, 2 lamps on dark box, SD label
  var s = '';
  s += _rr(479,576,206,130,'#ecece4','#333',1);
  s += _screw(489,586)+_screw(675,586)+_screw(489,696)+_screw(675,696);
  s += _tt(675,588,'AZ68',10,'700','#111','end');
  // top lamp
  s += _lamp(565,618,20,'#c81414');
  s += _tt(565,646,'M0',5.5,'700','#333');
  // dark device box with 2 lamps + red button
  s += _rr(520,662,150,44,'#3a3a38','#111',1.4);
  s += _lamp(558,678,19,'#c81414');
  s += _lamp(605,678,19,'#c81414');
  s += _rr(632,660,10,20,'#c81414','#7a0e0e',1);
  s += _cc(535,662,5,'#1a1a1a','#000',1);
  s += _cc(660,662,5,'#1a1a1a','#000',1);
  return s;
}

// ─── ROW 4 · BAY 4 · AZ67 (red + green) + orange module ────────────
function spriteAZ67_R4(){
  // ref bay x685..893 y576..706 — AZ67: AMT, red+green lamps, SEG SCOPY diagram
  var s = '';
  s += _rr(685,576,208,130,'#ecece4','#333',1);
  s += _screw(695,586)+_screw(884,586)+_screw(695,696)+_screw(884,696);
  s += _tt(884,588,'AZ67',10,'700','#111','end');
  // AMT
  s += _tt(745,600,'AMT',5,'700','#333');
  s += _cc(745,614,8,'#2a2a2a','#000',1.2)+_cc(745,614,3.5,'#000');
  s += _tt(728,632,'A',5,'400','#333')+_tt(762,632,'A',5,'400','#333');
  // red + green lamps
  s += _lamp(722,662,19,'#c81414');
  s += _lamp(775,662,19,'#1eaa1e');
  // SEG SCOPY diagram right
  s += _tt(858,600,'SEG',4.5,'400','#333')+_tt(858,607,'SCOPY',4.5,'400','#333');
  s += '<line x1="840" y1="614" x2="900" y2="614" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="840" y1="618" x2="900" y2="618" stroke="#333" stroke-width="0.7"/>';
  s += '<line x1="840" y1="622" x2="900" y2="622" stroke="#333" stroke-width="0.7"/>';
  s += '<path d="M845,614 L845,660 M893,614 L893,660" stroke="#333" stroke-width="0.8"/>';
  s += _jack(869,635,7);
  s += _tt(886,632,'LNT',4.5,'400','#333');
  s += '<path d="M869,642 L869,652" stroke="#333" stroke-width="0.8"/>';
  s += '<line x1="860" y1="654" x2="878" y2="654" stroke="#333" stroke-width="1.3"/>';
  s += '<line x1="860" y1="658" x2="878" y2="658" stroke="#333" stroke-width="1.3"/>';
  s += _cc(855,668,6,'#f0f0ea','#333',0.8)+'<path d="M851,664 L859,672 M859,664 L851,672" stroke="#333" stroke-width="0.7"/>';
  s += _cc(884,668,6,'#f0f0ea','#333',0.8)+'<path d="M880,664 L888,672 M888,664 L880,672" stroke="#333" stroke-width="0.7"/>';
  s += _cc(845,680,6,'#2a2a2a','#000',1.2)+_cc(845,680,2.5,'#000');
  s += _cc(893,680,6,'#2a2a2a','#000',1.2)+_cc(893,680,2.5,'#000');
  s += _tt(845,694,'SDV',4,'400','#333')+_tt(893,694,'NUU',4,'400','#333');
  return s;
}

//  MASTER · spriteMeterRack — assembles all 13 modules
function spriteMeterRack(){
  var W = 560, H = 420;
  var s = '<svg width="'+W+'" height="'+H+'" viewBox="0 0 1195 896" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ─── cabinet ───
  s += _rr(0,0,1195,896,'#9a9a9a');
  s += _rr(37,0,1124,30,'#a2a2a2');
  s += _rr(37,30,35,850,'#3a3a3a','#111',1.4);
  s += _rr(1126,30,35,850,'#3a3a3a','#111',1.4);
  s += _rr(37,811,1124,85,'#a2a2a2');
  s += _rr(68,101,1063,710,'#ecece4','#333',1.6);
  s += _screw(82,115)+_screw(1117,115)+_screw(82,797)+_screw(1117,797);

  // row separators (double lines)
  s += _rr(68,241,1063,1.2,'#555')+_rr(68,264,1063,1.2,'#555');
  s += _rr(68,398,1063,1.2,'#555')+_rr(68,420,1063,1.2,'#555');
  s += _rr(68,554,1063,1.2,'#555')+_rr(68,576,1063,1.2,'#555');
  s += _rr(68,706,1063,1.2,'#555')+_rr(68,727,1063,1.2,'#555');

  // ─── ROW 1 (y101..241) — bays 68|206|479|719|893|1126 ───
  s += _rr(206,101,1.4,140,'#888');
  s += _rr(479,101,1.4,140,'#888');
  s += _rr(719,101,1.4,140,'#888');
  s += _rr(893,101,1.4,140,'#888');
  s += spriteSYNCSCOPY();
  s += spriteVIPSModule();   // traced module (already correct)
  s += spriteMINSSCOPY();
  s += spriteVIPS2();
  s += spriteOutletBay();

  // ─── ROW 2 (y264..398) — bays 68|223|479|685|893|1126 ───
  s += _rr(223,264,1.4,134,'#888');
  s += _rr(479,264,1.4,134,'#888');
  s += _rr(685,264,1.4,134,'#888');
  s += _rr(893,264,1.4,134,'#888');
  s += spriteAAPower();
  s += spriteDINMeters();
  s += spriteOutletR2();
  s += spriteCounter();

  // ─── ROW 3 (y420..554) — bays 68|479|685|1122 ───
  s += _rr(479,420,1.4,134,'#888');
  s += _rr(685,420,1.4,134,'#888');
  s += spriteIWYBay();
  s += spriteAZ67_R3();
  // bay 3 — blank panel
  s += _rr(685,420,437,134,'#c8c8c2','#333',1);
  s += _screw(695,430)+_screw(1112,430)+_screw(695,544)+_screw(1112,544);

  // ─── ROW 4 (y576..706) — bays 68|289|479|685|893|1122 ───
  s += _rr(289,576,1.4,130,'#888');
  s += _rr(479,576,1.4,130,'#888');
  s += _rr(685,576,1.4,130,'#888');
  s += _rr(893,576,1.4,130,'#888');
  // bay 1 — blank panel
  s += _rr(68,576,221,130,'#c8c8c2','#333',1);
  s += _screw(78,586)+_screw(279,586)+_screw(78,696)+_screw(279,696);
  s += spriteIWYBay_R4();
  s += spriteAZ68_R4();
  s += spriteAZ67_R4();
  // bay 5 — blank panel
  s += _rr(893,576,229,130,'#c8c8c2','#333',1);
  s += _screw(903,586)+_screw(1112,586)+_screw(903,696)+_screw(1112,696);

  // ─── BOTTOM STRIP (y727..811) ───
  s += _screw(82,741)+_screw(294,741)+_screw(412,741)+_screw(554,741)+_screw(751,741)+_screw(1117,741);
  s += _screw(82,797)+_screw(294,797)+_screw(412,797)+_screw(554,797)+_screw(751,797)+_screw(1117,797);

  return s + '</svg>';
}

/* ═══════════════════════════════════════════════════════════
   M-13/EV · SINGLE-PHASE TRANSFORMER
   Printed jacks (left column): P230 (red) · PE (yellow, with earth)
                                B1 · B2 (red, link "B")
   Secondary, two columns: 2U1 2U3 2U4 2U2 (inner, 200 V group)
                           3U1 3U3 3U2 (outer, 115+115 V group)
   Tapped secondary: 3U2–3U3 = 115 V · 3U3–3U1 = 115 V
                     2U1–2U3 = 53 V · 2U3–2U4 = 94 V · 2U4–2U2 = 53 V
   ═══════════════════════════════════════════════════════════ */
function spriteSinglePhaseTransformer() {
  // Traced on single_phase_transformer.jpg (896x1192, EXIF-rotated).
  // Emitted at bench scale with the same convention as the other panels.
  const W = 360, H = 270;
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 1195 896" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  // ---- panel body + fixing screws ----
  s += '<rect x="50" y="30" width="1095" height="850" rx="26" fill="#d9d9d3" stroke="#111" stroke-width="4"/>';
  s += '<rect x="74" y="54" width="1047" height="802" rx="10" fill="none" stroke="#9a9a90" stroke-width="1.4"/>';
  s += screw(65, 55) + screw(1130, 55) + screw(65, 855) + screw(1130, 855);

  // ---- winding coil path (n half-loop bumps between y0 and y1) ----
  function coil(x, y0, y1, amp, n) {
    let d = 'M ' + x + ' ' + y0;
    const step = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const y = y0 + step * i;
      d += ' Q ' + (x + amp) + ' ' + (y + step / 2) + ' ' + x + ' ' + (y + step);
    }
    return d;
  }

  // ---- laminated core ----
  s += '<line x1="512" y1="210" x2="512" y2="690" stroke="#111" stroke-width="9"/>';
  s += '<line x1="530" y1="210" x2="530" y2="690" stroke="#111" stroke-width="9"/>';

  // ---- primary winding ----
  s += '<path d="' + coil(400, 210, 690, 24, 12) + '" fill="none" stroke="#111" stroke-width="4"/>';

  // ---- secondary: TWO separate windings on the shared core ----
  // 2U1…2U2 and 3U1…3U2 are different coils, not one long string. They were
  // drawn as a single coil from y=195 to y=705, which made the panel read as
  // one continuous winding and made it look like 2U2 fed straight into 3U1.
  // They are independent secondaries — a 200 V section and a 230 V section —
  // which you series up or use on their own. The gap between them is the
  // whole point: it is what tells a student these are two windings.
  s += '<path d="' + coil(636, 170, 445, 30, 8) + '" fill="none" stroke="#111" stroke-width="4.5"/>';
  s += '<path d="' + coil(636, 550, 700, 30, 5) + '" fill="none" stroke="#111" stroke-width="4.5"/>';

  // ---- primary wiring ----
  // P230 (top red, y=230) -> coil top
  s += '<path d="M 166 230 L 400 230" fill="none" stroke="#111" stroke-width="3"/>';
  // bottom red jack (y=690) -> coil bottom, with the tap/switch break
  s += '<path d="M 166 690 L 330 690 L 330 630" fill="none" stroke="#111" stroke-width="3"/>';
  s += '<circle cx="330" cy="618" r="6" fill="#f4f5ef" stroke="#111" stroke-width="2.4"/>';
  s += '<line x1="330" y1="612" x2="366" y2="648" stroke="#111" stroke-width="2.4"/>';
  s += '<circle cx="372" cy="654" r="6" fill="#f4f5ef" stroke="#111" stroke-width="2.4"/>';
  s += '<path d="M 372 660 L 372 690 L 400 690" fill="none" stroke="#111" stroke-width="3"/>';
  // PE (yellow, y=450) gets NO wire. The earth symbol drawn under the jack is
  // the whole indication — that is how the real panel prints it, and it is
  // what the model does: PE is not a node on any winding. The previous version
  // drew a line from the jack toward the core, which crossed the primary
  // winding on the way and implied an electrical connection that does not
  // exist. Ground has no connection to the coil, and the drawing now says so.
  // 230V sits INSIDE the primary coil loop
  s += txt(340, 405, '230V', { size: 22, weight: '700', anchor: 'middle' });

  // ---- secondary taps · short stubs, INNER column offset LOWER ----
  // OUTER (x800): 2U1 · 2U4 · 3U1 · 3U2   INNER (x920): 2U3 · 2U2 · 3U3
  // 2U1 is high and alone; 2U3 sits below-right of it, as printed.
  // Traced off the reference: INNER column (2U3/2U2/3U3) hugs the winding
  // at x≈705; OUTER column (2U1/2U4/3U1/3U2) sits far right at x≈955.
  const TAPS = [
    ['2U1', 955, 170], ['2U3', 760, 270], ['2U4', 955, 365],
    ['2U2', 760, 445], ['3U1', 955, 550], ['3U3', 760, 630],
    ['3U2', 955, 700]
  ];
  TAPS.forEach(function (t) {
    s += '<path d="M 664 ' + t[2] + ' L ' + t[1] + ' ' + t[2] + '" fill="none" stroke="#111" stroke-width="3"/>';
  });

  // ---- printed tap voltages, sitting in the gap between the winding and
  //      the jack columns (was overlapping the outer jack row at x=755) ----
  // Section voltages, each sitting between the two taps it spans.
  //
  // These carry the MODEL's values (Transformer.sections in
  // src/engine/devices/transformer.ts), not the ones printed on the reference
  // photo. The photo reads 53 / 147 / 200 down the 2U coil, which would make
  // 2U1–2U2 a 400 V winding and the pair 630 V in series. The model treats it
  // as a 200 V winding (53 / 94 / 53) and the 3U as 230 V (115 / 115), which
  // is what the 400 V / 230 V nameplate actually supports. Panel and solver
  // have to agree or a student measures one number and reads another.
  s += txt(700, 220, '53V',  { size: 22, weight: '700', anchor: 'middle' });
  s += txt(700, 317, '94V',  { size: 22, weight: '700', anchor: 'middle' });
  s += txt(700, 405, '53V',  { size: 22, weight: '700', anchor: 'middle' });
  s += txt(700, 590, '115V', { size: 22, weight: '700', anchor: 'middle' });
  s += txt(700, 665, '115V', { size: 22, weight: '700', anchor: 'middle' });

  // ---- earth symbol, directly below the YELLOW earth jack ----
  s += '<g stroke="#111" stroke-width="2.4" fill="none">' +
    '<line x1="140" y1="500" x2="140" y2="516"/>' +
    '<line x1="114" y1="516" x2="166" y2="516"/>' +
    '<line x1="124" y1="527" x2="156" y2="527"/>' +
    '<line x1="133" y1="538" x2="147" y2="538"/>' +
    '</g>';

  // ---- link "B" : two SMALL red jacks with a switch between them,
  //      sitting BETWEEN the top red jack and the yellow jack (as printed). ----
  s += '<circle cx="186" cy="345" r="6" fill="none" stroke="#111" stroke-width="2.2"/>';
  s += '<circle cx="210" cy="345" r="6" fill="none" stroke="#111" stroke-width="2.2"/>';
  s += '<line x1="191" y1="341" x2="205" y2="333" stroke="#111" stroke-width="2.2"/>';
  s += txt(198, 318, 'B', { size: 22, weight: '700', anchor: 'middle' });

  // ---- jacks · primary side (red top · B-pair · yellow · red bottom) ----
  s += jack(140, 230, 'red', 28);      // P230  (top red)
  s += jack(140, 450, 'yellow', 28);   // PE    (yellow, earth below)
  s += jack(140, 690, 'red', 28);      // bottom red (unlabelled)
  s += jack(140, 345, 'red', 20);      // B1    (small, beside the B switch)
  s += jack(256, 345, 'red', 20);      // B2


  // ---- jacks · secondary side, two tight columns (big domes, as printed) ----
  s += jack(955, 170, 'grey', 40);   // 2U1
  s += jack(955, 365, 'grey', 40);   // 2U4
  s += jack(955, 550, 'grey', 40);   // 3U1
  s += jack(955, 700, 'grey', 40);   // 3U2
  s += jack(760, 270, 'grey', 40);   // 2U3
  s += jack(760, 445, 'grey', 40);   // 2U2
  s += jack(760, 630, 'grey', 40);   // 3U3

  // ---- printed jack labels ----
  // The third red jack carries NO printed label on the real panel.
  s += txt(100, 238, 'P230', { size: 20, weight: '700', anchor: 'end' });
  s += txt(100, 440, 'PE',   { size: 20, weight: '700', anchor: 'end' });
  s += txt(100, 353, 'B1',   { size: 20, weight: '700', anchor: 'end' });
  s += txt(298, 353, 'B2',   { size: 20, weight: '700' });

  s += label(1008, 178, '2U1', { size: 22, weight: '700', anchor: 'start' });
  s += label(1008, 373, '2U4', { size: 22, weight: '700', anchor: 'start' });
  s += label(1008, 558, '3U1', { size: 22, weight: '700', anchor: 'start' });
  s += label(1008, 700, '3U2', { size: 22, weight: '700', anchor: 'start' });
  s += label(792,  300, '2U3', { size: 20, weight: '700', anchor: 'start' });
  s += label(792,  475, '2U2', { size: 20, weight: '700', anchor: 'start' });
  s += label(792,  660, '3U3', { size: 20, weight: '700', anchor: 'start' });

  // ---- model no. · TOP-RIGHT of the panel (as printed) ----
  // ---- model no. · TOP-RIGHT ----
  s += txt(1000, 130, 'mod. M-13/EV', { size: 26, weight: '700', anchor: 'end' });

  // ---- multilingual title block · centre, right of the core ----
  s += txt(540, 745, 'SINGLE-PHASE TRANSFORMER', { size: 21, weight: '700' });

  // ---- nameplate ratings · BOTTOM-LEFT (kept clear of the title block) ----
  s += txt(200, 740, '760VA',   { size: 22, weight: '700' });
  s += txt(200, 772, '50Hz',    { size: 22, weight: '700' });
  s += txt(300, 740, 'U1=230V', { size: 22, weight: '700' });
  s += txt(300, 772, 'I1=3.7A', { size: 22, weight: '700' });
  s += txt(400, 740, 'U2=400V-230V', { size: 20, weight: '700' });
  s += txt(400, 772, 'I2=1A-1.7A',   { size: 20, weight: '700' });

  return s + '</svg>';
}

/* ═══════════════════════════════════════════════════════════
   REGISTRY · kind → { label, model, color, icon, sprite(), layout }
   Terminal coordinates below MUST match the printed jacks drawn
   inside each sprite(), because lab.js overlays clickable dots there.
   ═══════════════════════════════════════════════════════════ */
const EQUIPMENT = {

  // Color system: rotating=#56b6f7  power=#5cd4a0  load=#8b95aa  measure=#dce3f0
  dc_machine: {
    label: 'DC Motor / Generator', model: 'M1-2/EV', color: '#56b6f7', icon: 'cog',
    sprite: spriteDCMachine,
    layout: { w: 360, h: 270, terms: [
      { k: 'PE', x: 117, y: 134 },
      { k: 'A2', x: 116, y: 151 },
      { k: 'D3', x: 114, y: 168 },
      { k: 'D1', x: 114, y: 186 },
      { k: 'A1', x: 161, y: 177 },
      { k: 'D2', x: 193, y: 172 },
      { k: 'F1', x: 255, y: 142 },
      { k: 'F2', x: 261, y: 181 },
      // Mechanical shaft port — sits on the painted flange centre.
      // A coupling's MA/MB snaps here. Carries torque, not current.
      // Flange is at viewBox (1140,440): 1140 * 360/1195 = 343.4,
      // 440 * 270/896 = 132.6. Must track the flange if it ever moves.
      { k: 'SHAFT', x: 343, y: 133, mech: 1 }
    ]}
  },

  async_motor_3p: {
    label: '3φ Async Motor', model: 'M-4/EV', color: '#56b6f7', icon: 'rotate-cw',
    sprite: spriteAsyncMotor3P,
    layout: { w: 360, h: 479, terms: [
      { k: 'PE', x: 139, y: 159 },
      // 9 jacks, 3x3 grid. Column x: 131 / 162 / 193. Row y: 270 / 299 / 329.
      //
      // B1 and B2 used to sit at (42.2, 104.0) and (77.1, 104.0) — those are
      // the TRANSFORMER's jack coordinates, pasted in by mistake. They fell
      // outside this panel entirely, so two terminals floated off the top-left
      // corner and no wire could reach them. They belong on the grid like
      // everything else.
      { k: 'W2', x: 131, y: 270 },
      { k: 'U2', x: 162, y: 270 },
      { k: 'W1', x: 193, y: 270 },
      { k: 'A2', x: 131, y: 299 },
      { k: 'A3', x: 162, y: 299 },
      { k: 'D1', x: 193, y: 299 },
      { k: 'B1', x: 131, y: 329 },
      { k: 'B2', x: 162, y: 329 },
      { k: 'C2', x: 193, y: 329 },
      // Shaft port on the painted flange. Must equal the flange CENTRE in
      // device space: 825 * 360/896 = 331.5, 596 * 479/1192 = 239.5. This was
      // 358,273 — the coordinates of a flange that was itself drawn outside
      // the SVG, so the dot marked nothing.
      { k: 'SHAFT', x: 332, y: 240, mech: 1 }
    ]}
  },

  async_motor_1p: {
    label: '1φ Async Motor', model: 'M-R/CV', color: '#56b6f7', icon: 'rotate-cw',
    sprite: spriteAsyncMotor1P,
    layout: { w: 360, h: 270, terms: [
      { k: 'Aux2', x: 134, y: 121 },
      { k: 'Z2',   x: 155, y: 121 },
      { k: 'C',    x: 188, y: 121 },
      { k: 'C2',   x: 230, y: 121 },
      { k: 'Run',  x: 208, y: 148 },
      { k: 'U2',   x: 208, y: 167 },
      { k: 'PE',   x: 236, y: 160 },
      // Shaft port on the painted flange at device(314,141).
      { k: 'SHAFT', x: 314, y: 141, mech: 1 }
    ]}
  },

  single_phase_transformer: {
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
  },

  sync_gen: {
    label: 'Sync Generator', model: 'GMS', color: '#bb9af7', icon: 'waves',
    sprite: spriteSyncGen,
    layout: { w: 400, h: 138, terms: [
      { k: 'F2', x: 216, y: 53 },
      { k: 'W1', x: 216, y: 68 },
      { k: 'V1', x: 216, y: 83 },
      { k: 'U1', x: 216, y: 98 },
      { k: 'V2', x: 240, y: 68 },
      { k: 'U2', x: 240, y: 83 },
      { k: 'W2', x: 240, y: 98 },
      { k: 'F1', x: 288, y: 53 },
      { k: 'G',  x: 288, y: 98 },
      // Shaft port on the painted handle at device(30,72).
      { k: 'SHAFT', x: 30, y: 72, mech: 1 }
    ]}
  },

  rheostat: {
    label: 'Rheostat / Load', model: '308T', color: '#ff9e64', icon: 'sliders-horizontal',
    sprite: spriteRheostat,
    layout: { w: 320, h: 366, terms: [
      { k: 'A_TOP', x: 74,  y: 200 },
      { k: 'A_BOT', x: 123, y: 312 },
      { k: 'B_TOP', x: 246, y: 200 },
      { k: 'B_YEL', x: 211, y: 327 },
      { k: 'B_RED', x: 279, y: 327 }
    ]}
  },

  power_supply: {
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
  },



  load_bank: {
    label: 'Load Bank', model: 'RESISTIVE', color: '#8b95aa', icon: 'layers',
    sprite: spriteLoadBank,
    layout: { w: 260, h: 180, terms: [
      { k: 'A', x: 50,  y: 140 },
      { k: 'B', x: 210, y: 140 }
    ]}
  },

  meter: {
    label: 'Panel Meter', model: 'AZ-VIPS/VIDC', color: '#dce3f0', icon: 'gauge',
    sprite: function () { return spriteMeter({ mode: 'V' }); },
    // One V / A meter. V mode uses +/− (high-Z, parallels the load);
    // A mode uses in/out (shunt, sits in series with the load).
    layout: { w: 260, h: 180, terms: [
      { k: '+',   x: 200, y: 79 },
      { k: '-',   x: 200, y: 129 },
      { k: 'in',  x: 60,  y: 79 },
      { k: 'out', x: 60,  y: 129 }
    ]}
  },

  coupling: {
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
  },

  meter_rack: {
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
  }
};



root.EEE = root.EEE || {};
root.EEE.Sprites = {
  EQUIPMENT: EQUIPMENT,
  esc: esc,
  // direct sprite functions, useful for previews
  DCMachine: spriteDCMachine,
  AsyncMotor3P: spriteAsyncMotor3P,
  AsyncMotor1P: spriteAsyncMotor1P,
  SyncGen: spriteSyncGen,
  Transformer: spriteSinglePhaseTransformer,
  Rheostat: spriteRheostat,
  PowerSupply: spritePowerSupply,
  Coupling: spriteCoupling,
  MeterRack: spriteMeterRack
};

})(typeof window !== 'undefined' ? window : globalThis);
