/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { jack, label, txt, screw, panel } from '../_shared/svg.js';
export function spriteMeter(opts: { mode: string }) {
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
  // Main reading + unit.
  //
  // These used to be painted constants - '220.0' / '1.400' - so the meter's
  // OWN LCD read a fixed number forever while only the sidebar updated. The
  // value node is now bound with data-live and the render loop writes it each
  // frame. The key is the model's readout name, which is just the mode: 'V'
  // or 'A' (see Meter.readouts()).
  //
  // Written inline rather than with _lv()/_lu(): those helpers hardcode the
  // rack's green-on-black dialect and a centred anchor, which is wrong on
  // this panel's dark-on-blue LCD and would shift the digits off the bezel.
  const liveKey = isV ? 'V' : 'A';
  const idle = isV ? '0.0' : '0.000';
  s += '<text x="256" y="168" data-live="' + liveKey + '" text-anchor="end" ' +
    'font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="700" ' +
    'fill="#08161f">' + idle + '</text>';
  s += '<text x="268" y="168" data-live-unit="' + liveKey + '" text-anchor="start" ' +
    'font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" ' +
    'fill="#08161f">' + (isV ? 'V' : 'A') + '</text>';
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
