/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { jack, label, txt } from '../_shared/svg.js';
export function spriteRheostat() {
  // Two 308T rheostat units (grey front + green rear) traced from
  // resistance.jpg — drawn in the reference's own pixel grid.
  const W = 320, H = 366;
  // Keep the ORIGINAL viewBox. Changing it shifts every painted element's
  // device-space position, which desyncs the layout.ts term coordinates from
  // the jacks they are supposed to mark — the whole panel drifts.
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="60 140 560 640" ' +
    'xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';

  function vents(x0?: any, y0?: any, x1?: any, y1?: any, col?: any) {
    let o = '';
    for (let y = y0; y < y1; y += 14) {
      o += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + (y - 16) +
        '" stroke="' + col + '" stroke-width="2" opacity="0.5"/>';
    }
    return o;
  }

  function unit(x?: any, bodyFill?: any, edge?: any, wiperJackCol?: any, fixedJackCol?: any, tag?: any) {
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
    // wiper slider + red handle. Tagged data-wiper with the unit code
    // (the trailing 'A'/'B' of the tag), so the lab can slide each unit's
    // handle independently to its own model position.
    const wiperCode = String(tag).slice(-1);
    o += '<g data-wiper="' + wiperCode + '">';
    o += '<rect x="' + (x + 96) + '" y="150" width="48" height="30" rx="5" fill="#2b2e2d" stroke="#111" stroke-width="2"/>';
    o += '<rect x="' + (x + 104) + '" y="158" width="32" height="14" rx="3" fill="#c0392b" stroke="#111" stroke-width="1.2"/>';
    o += '</g>';
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
  // ---- resistance monitor LCD on unit A ----
  // Sits on the lower body of unit A (y=330..430), clear of the wiper track
  // above and the caution label below. Read live from the model's `R` readout
  // via the data-live hook in _updateSpriteReadouts().
  s += '<rect x="92" y="336" width="160" height="66" rx="8" fill="#101410" stroke="#111" stroke-width="3"/>';
  s += '<rect x="100" y="344" width="144" height="50" rx="4" fill="#0a1410" stroke="#2a3a2a" stroke-width="1.2"/>';
  s += '<text x="172" y="382" text-anchor="middle" font-family="monospace" font-size="30" font-weight="700" fill="#39ff88" data-live="RA">0</text>';
  s += '<text x="172" y="392" text-anchor="middle" font-family="monospace" font-size="11" fill="#39ff88" data-live-unit="RA">ohm</text>';
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
  // ---- resistance monitor LCD on unit B ----
  // Mirrors unit A's monitor. Reads the green element's RB via data-live.
  s += '<rect x="392" y="336" width="160" height="66" rx="8" fill="#101410" stroke="#111" stroke-width="3"/>';
  s += '<rect x="400" y="344" width="144" height="50" rx="4" fill="#0a1410" stroke="#2a3a2a" stroke-width="1.2"/>';
  s += '<text x="472" y="382" text-anchor="middle" font-family="monospace" font-size="30" font-weight="700" fill="#39ff88" data-live="RB">0</text>';
  s += '<text x="472" y="392" text-anchor="middle" font-family="monospace" font-size="11" fill="#39ff88" data-live-unit="RB">ohm</text>';
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
