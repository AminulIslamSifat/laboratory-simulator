/**
 * SVG primitives shared by every panel.
 *
 * These are pure string builders — no DOM, no state. `sprites.js` had them at
 * IIFE scope; they move here unchanged so a per-device sprite file imports
 * exactly the two or three it needs instead of pulling in 2,200 lines.
 *
 * Everything is typed, and every helper returns a string. That is the only
 * contract a sprite needs: given no arguments (or an options bag), produce
 * the SVG that represents this device at its declared panel size.
 *
 * The `_`-prefixed block at the bottom came from the rack's own drawing
 * dialect — terse three-letter names because the measurement rack has ~30
 * of them in a row and the long form drowned the layout. They are kept
 * verbatim so the rack SVG moves across without a single character changed.
 */

/** Escape `&`, `<`, `>` for use inside SVG text nodes. */
export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Open an `<svg>` element.
 *
 * Panels that trace a reference photo use a viewBox larger than the device
 * size and let the browser scale it down — that is why `spriteDCMachine()`
 * declares `viewBox="0 0 1195 896"` inside a 360×270 box. Coordinates inside
 * such a sprite are in the reference's pixel grid, while `layout.terms` is
 * always in DEVICE pixels. The two spaces are related by `device.w / viewBox.w`
 * and the mismatch is a recurring source of floating clickable dots.
 */
export function svgOpen(w: number, h: number): string {
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
    '" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">';
}

/** Darken (or, with f > 1, lighten) a hex colour by a multiplicative factor. */
export function shade(hex: string, f = 0.55): string {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f)) | 0;
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f)) | 0;
  const b = Math.max(0, Math.min(255, (n & 255) * f)) | 0;
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Banana-jack colours, sampled from the reference photos. */
export const JACK_COLOR: Record<string, string> = {
  red:    '#c0392b',
  black:  '#1c1c1c',
  yellow: '#e6b800',
  blue:   '#1a4f9e',
  green:  '#2d8a4a',
  grey:   '#4a4a4a'
};

/**
 * A coloured banana jack.
 *
 * Four concentric shapes: dark rim, coloured body, black centre hole, and a
 * small specular highlight so the jack reads as a physical socket and not a
 * flat disc. `color` may be a palette key ('red') or a raw hex string.
 */
export function jack(x: number, y: number, color: string, r = 7.5): string {
  const base = JACK_COLOR[color] || color;
  const dark = shade(base, 0.55);
  const hole = Math.max(2.6, r - 4.4);
  return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + dark + '" stroke="#0a0a0a" stroke-width="0.9"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="' + (r - 1.6) + '" fill="' + base + '" stroke="#000" stroke-width="0.5"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="' + hole + '" fill="#0a0a0a"/>' +
    '<ellipse cx="' + (x - r * 0.35) + '" cy="' + (y - r * 0.42) + '" rx="' + (r * 0.32) + '" ry="' + (r * 0.18) + '" fill="#fff" opacity="0.34"/>';
}

/** Options for `label()` and `txt()`. */
export interface TextOpts {
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  weight?: string;
  color?: string;
}

/** Bold panel label (default 8.5px, weight 600). */
export function label(x: number, y: number, str: string, opts: TextOpts = {}): string {
  return '<text x="' + x + '" y="' + y + '" text-anchor="' + (opts.anchor || 'start') +
    '" font-family="Arial,Helvetica,sans-serif" font-size="' + (opts.size || 8.5) +
    '" font-weight="' + (opts.weight || '600') + '" fill="' + (opts.color || '#111') + '">' + esc(str) + '</text>';
}

/** Fine print (default 6px, weight 400). */
export function txt(x: number, y: number, str: string, opts: TextOpts = {}): string {
  return '<text x="' + x + '" y="' + y + '" text-anchor="' + (opts.anchor || 'start') +
    '" font-family="Arial,Helvetica,sans-serif" font-size="' + (opts.size || 6) +
    '" font-weight="' + (opts.weight || '400') + '" fill="' + (opts.color || '#111') + '">' + esc(str) + '</text>';
}

/** A single countersunk screw. */
export function screw(x: number, y: number): string {
  return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#a8a89e" stroke="#333" stroke-width="0.7"/>' +
    '<line x1="' + (x - 1.8) + '" y1="' + y + '" x2="' + (x + 1.8) + '" y2="' + y + '" stroke="#333" stroke-width="0.8"/>';
}

/** A light-grey panel with a hairline inner border. */
export function panel(x: number, y: number, w: number, h: number): string {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="#e9e9e1" stroke="#1a1a1a" stroke-width="2.2"/>' +
    '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="3" fill="none" stroke="#444" stroke-width="0.6"/>';
}

/** The orange warning strip every ElettronicaVeneta panel carries. */
export function warningStrip(x: number, y: number, w: number, h: number): string {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#e8720c" stroke="#8a3f00" stroke-width="1"/>' +
    '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (w - 4) + '" height="' + (h - 4) + '" fill="none" stroke="#8a3f00" stroke-width="0.5"/>';
}

/* ────────────────────────────────────────────────────────────────
   Rack drawing dialect

   The measurement rack sprite is drawn from dozens of small rectangles,
   circles and text nodes laid out on a 1195-unit reference grid. Full names
   would have made the function unreadable, so the original author used
   three-letter helpers. Kept as-is.
   ──────────────────────────────────────────────────────────────── */

/** Rect. All args optional except x/y/w/h. */
export function _rr(x: number, y: number, w: number, h: number, f?: string, st?: string, sw?: number, rx?: number): string {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' +
    (rx ? ' rx="' + rx + '"' : '') + ' fill="' + (f || 'none') + '" stroke="' + (st || 'none') +
    '" stroke-width="' + (sw || 0) + '"/>';
}

/** Circle. */
export function _cc(cx: number, cy: number, r: number, f?: string, st?: string, sw?: number): string {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (f || 'none') +
    '" stroke="' + (st || 'none') + '" stroke-width="' + (sw || 0) + '"/>';
}

/** Text (Helvetica, default weight 400, default anchor middle). */
export function _tt(x: number, y: number, t: string, sz: number, wt?: string, c?: string, a?: string): string {
  return '<text x="' + x + '" y="' + y + '" font-family="Helvetica,Arial,sans-serif" font-size="' + sz +
    '" font-weight="' + (wt || '400') + '" fill="' + (c || '#111') + '" text-anchor="' + (a || 'middle') + '">' + t + '</text>';
}

/**
 * Live-updating text node.
 *
 * The `data-live` attribute is the binding key — the render loop finds the
 * node by that attribute and writes its `textContent` each frame. Do NOT
 * rebuild the SVG to update a value; rewrite the text node in place.
 */
export function _lv(x: number, y: number, id: string, sz: number): string {
  return '<text x="' + x + '" y="' + y + '" data-live="' + id +
    '" font-family="Helvetica,Arial,sans-serif" font-size="' + sz +
    '" font-weight="700" fill="#8ef0b8" text-anchor="middle"></text>';
}

/** Countersunk screw (rack variant). */
export function _screw(x: number, y: number): string {
  return _cc(x, y, 4, '#c8c8c0', '#666', 0.8) +
    '<line x1="' + (x - 3) + '" y1="' + y + '" x2="' + (x + 3) + '" y2="' + y + '" stroke="#666" stroke-width="0.8"/>';
}

/** Four screws, one per corner of a rectangle. */
export function _screws(x: number, y: number, w: number, h: number): string {
  return _screw(x + 12, y + 12) + _screw(x + w - 12, y + 12) +
    _screw(x + 12, y + h - 12) + _screw(x + w - 12, y + h - 12);
}

/** Small red jack (rack variant, 4mm). */
export function _jack(cx: number, cy: number, r?: number): string {
  r = r || 7;
  return _cc(cx, cy, r, '#c81414', '#000', 1.2) + _cc(cx, cy, r * 0.42, '#151515');
}

/** Black socket. */
export function _socket(cx: number, cy: number, r?: number): string {
  return _cc(cx, cy, r || 8, '#151515', '#000', 1.2);
}

/** Indicator lamp with a highlight so it reads as glass. */
export function _lamp(cx: number, cy: number, r?: number, c?: string): string {
  r = r || 22; c = c || '#c81414';
  return _cc(cx, cy, r, '#0a0a0a', '#000', 1.4) + _cc(cx, cy, r * 0.78, c) +
    _cc(cx - r * 0.28, cy - r * 0.28, r * 0.22, 'rgba(255,255,255,0.4)');
}

/** Small LED. */
export function _led(cx: number, cy: number, r?: number, c?: string): string {
  r = r || 6; c = c || '#888';
  return _cc(cx, cy, r, '#0a0a0a', '#000', 1) + _cc(cx, cy, r * 0.75, c);
}

/** The red mushroom button. */
export function _btnRed(cx: number, cy: number): string {
  return _rr(cx - 8, cy - 4, 16, 8, '#c81414', '#7a0e0e', 0.7, 4);
}

/** A DB9 connector outline. */
export function _db9(x: number, y: number, w?: number): string {
  w = w || 44;
  return _rr(x, y, w, 16, '#3a3a3a', '#111', 1) + _rr(x + 3, y + 3, w - 6, 10, '#1a1a1a');
}

/** A wall outlet. */
export function _outlet(cx: number, cy: number, r?: number): string {
  r = r || 22;
  return _cc(cx, cy, r, '#f2f2ea', '#444', 1.4) +
    _cc(cx - r * 0.35, cy - r * 0.15, r * 0.11, '#222') +
    _cc(cx + r * 0.35, cy - r * 0.15, r * 0.11, '#222') +
    _cc(cx, cy + r * 0.35, r * 0.11, '#222');
}

/** LCD bezel. */
export function _lcdBezel(x: number, y: number, w: number, h: number): string {
  return _rr(x, y, w, h, '#e8e8e0', '#000', 1.5, 3);
}

/** Blue LCD background. */
export function _lcdBlue(x: number, y: number, w: number, h: number): string {
  return _rr(x, y, w, h, '#5aa8de', '#0a2530', 1.2);
}

/** The I/0/II three-position cam switch. */
export function _iwy(x: number, y: number): string {
  return _rr(x, y, 44, 58, '#1a1a1a', '#000', 1.2) +
    _tt(x + 22, y + 22, 'ON',  7, '700', '#fff') +
    _tt(x + 22, y + 42, 'DO',  7, '700', '#fff') +
    _tt(x + 22, y + 62, 'OFF', 7, '700', '#fff');
}

/**
 * Live-updating unit suffix text node.
 *
 * Paired with `_lv`: the value goes in the `data-live` node, the unit in the
 * `data-live-unit` node next to it. Splitting them means the render loop can
 * update a number without rebuilding the string and without re-parsing the
 * whole SVG.
 */
export function _lu(x: number, y: number, id: string, sz?: number): string {
  return '<text x="' + x + '" y="' + y + '" data-live-unit="' + id +
    '" font-family="Helvetica,Arial,sans-serif" font-size="' + (sz || 10) +
    '" font-weight="700" fill="#8ef0b8" text-anchor="middle"></text>';
}
