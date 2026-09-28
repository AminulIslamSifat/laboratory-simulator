/**
 * Layout vocabulary shared by every device panel.
 *
 * A device's visual identity is three things — and they are really ONE thing:
 * the SVG it paints, where its jacks sit so a wire can land on them, and
 * which on-panel controls the user can click.
 *
 * Keeping those three in one folder per device is the entire point of this
 * refactor. The previous build scattered them across two files:
 *
 *   js/lab/sprites.js       — the SVG and a layout map (terms/controls/buttons)
 *   js/engine/devices.js    — the electrical model that reads those terminals
 *
 * Terminals drifted. A jack was drawn that no model declared, the netlist
 * dropped the wire silently, and the bench sat dead with no error anywhere.
 * `tools/check-terminals.mjs` was written to CATCH that drift — but a checker
 * is a seatbelt, not a reason to keep the crash. The real fix is that the
 * drawing and the model cannot physically live apart, so the terminal list is
 * no longer a thing anyone has to remember to sync.
 */

/** One printed jack on a panel. */
export interface TerminalSpec {
  /** Terminal name — matched exactly against `Device.terminals`. */
  k: string;
  /** Device-space x. Pixels, NOT SVG viewBox units. */
  x: number;
  /** Device-space y. */
  y: number;
  /**
   * True for a mechanical port (a shaft flange), not an electrical jack.
   * The renderer styles it differently and the wire pass refuses to route
   * current through it. A coupling's MA/MB are the only users today.
   */
  mech?: 1;
  /**
   * Shrink the clickable hitbox.
   *
   * Rack jacks sit ~12px apart; at the default dot size the hitboxes stack
   * three-deep and steal each other's clicks. The painted jack stays put —
   * only the dot the user aims at shrinks.
   */
  tight?: 1;
}

/**
 * A front-panel control.
 *
 * `toggle` and `button` are the two on/off affordances. `dial` is a
 * continuous rotary control — the variable DC and AC voltages are dials, not
 * toggles, and the differ by whether the model reads a number or a boolean
 * back through `setControl()`. `select` is a discrete position switch (the
 * 50/60 Hz mains selector, the 6/12/24 V tap); it carries a list of allowed
 * values in `options`.
 */
export interface ControlSpec {
  id: string;
  type: 'toggle' | 'button' | 'dial' | 'select';
  x: number;
  y: number;
  title?: string;
  danger?: 1;
  ok?: 1;
  /** Lower bound for a dial, in `unit`. */
  min?: number;
  /** Upper bound for a dial, in `unit`. */
  max?: number;
  /** Unit shown beside the readout ('V', 'Hz'). */
  unit?: string;
  /** Allowed positions for a select. */
  options?: Array<number | string>;
}

/** A V / A / F / W mode switch, one trio per meter window. */
export interface ButtonSpec {
  /** Which meter window this switch belongs to (e.g. 'm1', 'd3'). */
  d: string;
  /** Position: V, A, F or W. */
  m: string;
  x: number;
  y: number;
  title?: string;
}

/** Everything the lab needs to draw and wire a device. */
export interface LayoutSpec {
  /** Panel size in device pixels. */
  w: number;
  h: number;
  terms: TerminalSpec[];
  controls?: ControlSpec[];
  buttons?: ButtonSpec[];
}

/** One entry in the equipment registry. */
export interface EquipmentEntry {
  label: string;
  model: string;
  /** Palette hex — used for the card chip and any highlight. */
  color: string;
  /** Lucide icon name. */
  icon: string;
  /** Returns the SVG string, sized to `layout.w` × `layout.h`. */
  sprite: () => string;
  layout: LayoutSpec;
}

/** The whole registry, keyed by palette kind. */
export type EquipmentRegistry = Record<string, EquipmentEntry>;

/**
 * Build the netlist's terminal table from a panel layout.
 *
 * This is the function that ends the drift class. The old build had two
 * lists: `Device.terminals` (what the model could read) and
 * `EQUIPMENT[kind].layout.terms` (what the sprite drew). Nothing kept them
 * equal, and when they diverged — a jack drawn that no model declared — the
 * netlist dropped the wire in silence and the bench sat dead with no error.
 * `tools/check-terminals.mjs` existed only to CATCH that.
 *
 * Now the layout is the one list. A device's model calls this at construction
 * and gets back exactly the terminals its own panel draws, so a jack cannot
 * exist without a model behind it, and a model cannot read a jack that is not
 * on the panel.
 *
 * Mechanical ports (a coupling's MA/MB, a shaft flange) are included. They
 * are not electrical, but the netlist needs them as named nodes so the wire
 * pass can find them and refuse to route current.
 */
export function terminalsOf(layout: LayoutSpec): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of layout.terms) out[t.k] = 1;
  return out;
}
