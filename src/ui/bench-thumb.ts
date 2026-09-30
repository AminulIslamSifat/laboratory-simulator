/**
 * Tiny bench thumbnails for the experiment hub.
 *
 * ─── Why SVG from positions, not a screenshot ───
 *
 * The hub lists every experiment a student has. A real screenshot per bench
 * would mean the server rendering the app headlessly, or the client storing a
 * PNG per save — hundreds of kB each, for an image nobody looks at closely.
 *
 * A bench is a handful of rectangles at known coordinates. The listing already
 * carries each device's kind and x/y, so the miniature is a pure function of
 * data the hub already has, costs nothing to store, and scales crisply.
 *
 * ─── Why no device art ───
 *
 * Drawing the real sprites would mean shipping the sprite registry into the
 * hub and re-rendering SVG per row. A coloured block per device, tinted by
 * category, is legible at 96×64 and reads as a wiring diagram rather than a
 * picture of a bench. That is the right level of fidelity for a list.
 */

import type { BenchLayoutItem } from './bench-server.js';

/** Colour by device family, so a hub row reads at a glance. */
const TINT: Record<string, string> = {
  dc_machine: '#56b6f7',
  async_motor_3p: '#5cd4a0',
  async_motor_1p: '#5cd4a0',
  sync_gen: '#d4a853',
  single_phase_transformer: '#c58af9',
  rheostat: '#f76c7e',
  power_supply: '#56b6f7',
  meter_rack: '#8a94a6',
  load_bank: '#d4a853',
  coupling: '#8a94a6',
  meter: '#8a94a6'
};

/** Fallback tint for a kind this table does not know. */
const DEFAULT_TINT = '#6b7688';

/** Nominal device footprint in bench units, used only to size the block. */
const DEV_W = 150;
const DEV_H = 120;

const VIEW_W = 96;
const VIEW_H = 64;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/**
 * Render a bench layout as an inline SVG string.
 *
 * Returns a placeholder when there is nothing to draw, so a row never renders
 * as an empty gap that looks like a bug.
 *
 * The scale is computed from the actual bounding box rather than assumed, so
 * a bench of two devices and a bench of twenty both fill the same 96×64 box
 * instead of one being a speck and the other overflowing.
 */
export function benchThumb(layout: BenchLayoutItem[]): string {
  if (!layout.length) {
    return '<div class="bt bt-empty"><i data-lucide="layout-grid" class="lucide-icon xs"></i></div>';
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of layout) {
    if (d.x < minX) minX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.x + DEV_W > maxX) maxX = d.x + DEV_W;
    if (d.y + DEV_H > maxY) maxY = d.y + DEV_H;
  }

  // Guard against a degenerate box (one device, or all at the same point),
  // which would divide by zero below.
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  // Fit the box inside the view with a small margin, preserving aspect ratio
  // so a wide bench does not stretch its devices into slivers.
  const pad = 4;
  const k = Math.min((VIEW_W - pad * 2) / spanX, (VIEW_H - pad * 2) / spanY);
  const ox = (VIEW_W - spanX * k) / 2 - minX * k;
  const oy = (VIEW_H - spanY * k) / 2 - minY * k;

  let out = '<svg class="bt" viewBox="0 0 ' + VIEW_W + ' ' + VIEW_H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">';
  out += '<rect x="0" y="0" width="' + VIEW_W + '" height="' + VIEW_H + '" rx="3" fill="rgba(0,0,0,.28)" />';

  for (const d of layout) {
    const tint = TINT[d.k] || DEFAULT_TINT;
    const w = Math.max(2, DEV_W * k);
    const h = Math.max(2, DEV_H * k);
    const x = ox + d.x * k;
    const y = oy + d.y * k;
    out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
           '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
           '" rx="1.5" fill="' + esc(tint) + '" fill-opacity="0.75" stroke="' +
           esc(tint) + '" stroke-opacity="0.9" stroke-width="0.5" />';
  }

  out += '</svg>';
  return out;
}
