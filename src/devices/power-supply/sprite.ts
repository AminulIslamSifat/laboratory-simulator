/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { shade, JACK_COLOR, jack, txt, panel, _lv, _lu } from '../_shared/svg.js';
export function spritePowerSupply() {
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
  function head(cx?: any, y?: any, lines?: any, size?: any, weight?: any) {
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
  function esam(x?: any, y?: any, dispId?: any) {
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
  function variac(cx?: any, cy?: any) {
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
  function aeg(x?: any, y?: any, w?: any, h?: any, poles?: any) {
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
  function etn(x?: any, y?: any, w?: any, h?: any, mods?: any, tag?: any, tagColor?: any) {
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
  function roundCap(cx?: any, cy?: any, r?: any) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#c2c6c5" stroke="#8d918f" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 4) + '" fill="#d9dcdb" stroke="#9aa09e" stroke-width="1.4"/>';
  }

  // printed jack: coloured ring, black bore (radius 14)
  function pjack(cx?: any, cy?: any, color?: any, r?: any) {
    r = r || 14;
    const base = JACK_COLOR[color] || color;
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + shade(base, 0.55) + '" stroke="#0a0a0a" stroke-width="1.6"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 3) + '" fill="' + base + '" stroke="#000" stroke-width="0.9"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 9) + '" fill="#080808"/>' +
      '<ellipse cx="' + (cx - r * 0.35) + '" cy="' + (cy - r * 0.42) + '" rx="' + (r * 0.3) + '" ry="' + (r * 0.16) + '" fill="#fff" opacity="0.3"/>';
  }

  // earth (PE) symbol
  function earth(cx?: any, cy?: any) {
    return '<g stroke="#111" stroke-width="1.6" fill="none">' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy + 10) + '"/>' +
      '<line x1="' + (cx - 11) + '" y1="' + (cy + 10) + '" x2="' + (cx + 11) + '" y2="' + (cy + 10) + '"/>' +
      '<line x1="' + (cx - 7) + '" y1="' + (cy + 15) + '" x2="' + (cx + 7) + '" y2="' + (cy + 15) + '"/>' +
      '<line x1="' + (cx - 3) + '" y1="' + (cy + 20) + '" x2="' + (cx + 3) + '" y2="' + (cy + 20) + '"/>' +
      '</g>';
  }

  // rotary selector: round knob on a vertical shaft
  function rotary(cx?: any, cy?: any, w?: any, len?: any, r?: any) {
    let o = '';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#3a3d3c" stroke="#151515" stroke-width="1.6"/>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 4) + '" fill="#555958"/>';
    o += '<rect x="' + (cx - w / 2) + '" y="' + cy + '" width="' + w + '" height="' + len + '" rx="3" fill="#4a4d4c" stroke="#1a1a1a" stroke-width="1.2"/>';
    o += '<rect x="' + (cx - w / 2 + 2) + '" y="' + cy + '" width="' + (w - 4) + '" height="' + len + '" fill="#6b6f6e"/>';
    o += '<rect x="' + (cx - 2) + '" y="' + (cy - r + 4) + '" width="4" height="' + (r - 2) + '" fill="#e8e8e4"/>';
    return o;
  }

  // large black cam switch (top-left ON/OFF)
  function bigKnob(cx?: any, cy?: any, r?: any, angleDeg?: any) {
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
