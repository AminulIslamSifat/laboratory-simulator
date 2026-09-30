/* eslint-disable */
// AUTO-EXTRACTED from js/lab/sprites.js by tools/extract-sprites.mjs.
// Do not hand-edit during the split - re-run the extractor instead.
// After the split is verified and committed this file is the source.

import { jack, label, txt, screw, panel } from '../_shared/svg.js';
export function spriteSinglePhaseTransformer() {
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
  function coil(x?: any, y0?: any, y1?: any, amp?: any, n?: any) {
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
  // Per-segment voltages for the 2U coil: 53 / 147 / 200. Segments add in
  // series, so 2U1-2U3=53, 2U3-2U4=147, 2U4-2U2=200, and 2U1-2U2=400 V.
  // Must stay identical to Transformer.sections in
  // src/devices/transformer/model.ts or a student reads one number and
  // measures another.
  s += txt(700, 220, '53V',  { size: 22, weight: '700', anchor: 'middle' });
  s += txt(700, 317, '147V', { size: 22, weight: '700', anchor: 'middle' });
  s += txt(700, 405, '200V', { size: 22, weight: '700', anchor: 'middle' });
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
