/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { txt } from '../_shared/svg.js';
export function spriteCoupling() {
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
