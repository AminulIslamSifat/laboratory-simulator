/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { svgOpen, jack, label, txt, screw } from '../_shared/svg.js';
export function spriteLoadBank() {
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
