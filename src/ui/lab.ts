/**
 * Laboratory environment controller.
 *
 * Owns the bench: equipment placement, drag, palette, context menu, undo, the
 * run loop, and the live meter panel. This is the port of the old `lab.js`,
 * and the two APIs it talks to changed under it:
 *
 *   old  EEE.simulate(netlist, dt)      new  sim.step(dt)
 *   old  d.model.readouts()             new  sim.readoutsFor(d.id)
 *   old  EEE.Devices[kind]              new  DEVICE_KINDS[kind]
 *   old  dev.terminals = {}  (copied)   new  (nothing - the model derives it)
 *
 * That last line is the whole point of the refactor. The old place() built a
 * fresh terminal table from the sprite layout and bolted it onto the model at
 * runtime; the model could not be constructed correctly outside that one code
 * path. Now every model reads its own layout at construction, so a device is
 * correct wherever it is built - in the lab, in a test, or from a save file.
 */

import { refreshIcons } from './icons.js';
import { Netlist } from '../engine/netlist.js';
import { Simulator } from '../engine/simulator.js';
import type { Device, Readout, Solution } from '../engine/types.js';
import {
  EQUIPMENT,
  DCSupply, DCMachine, Motor3P, Motor1P, SyncGen, Transformer,
  MeterRack, Rheostat, LoadBank, Coupling, Meter
} from '../devices/index.js';
import type { EquipmentEntry } from '../devices/_shared/types.js';
import { Wiring } from './wiring.js';
import type { WireDevice } from './wiring.js';

/* ────────────────────────────────────────────────────────────────
   Bench entry

   One placed device: the model, where it sits, how big it is, and how far
   it is rotated. `x`/`y`/`w`/`h` are always the NATIVE, unrotated box - the
   rotation is a CSS transform and the wire layer compensates for it.
   ──────────────────────────────────────────────────────────────── */

export interface DeviceEntry {
  id: string;
  kind: string;
  model: Device;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  /** Rotor angle accumulator, drives the [data-spin] group. */
  _spinAngle?: number;
}

/** One undo record. */
type UndoAction =
  | { type: 'deleteDevice'; data: { id: string; kind: string; x: number; y: number; wires: Array<{ aDev: string; aTerm: string; bDev: string; bTerm: string }> } }
  | { type: 'deleteWire'; data: { aDev: string; aTerm: string; bDev: string; bTerm: string } }
  | { type: 'clearAll'; data: null };

/** One row of the right-click menu. A separator is `{ sep: true }`. */
type CtxItem =
  | { sep: true }
  | {
      icon: string;
      label: string;
      key?: string;
      danger?: boolean;
      action: () => void;
    };

export interface LabDeps {
  surface: HTMLElement;
  world?: HTMLElement;
  wireLayer: HTMLElement | SVGElement;
  smokeLayer: HTMLElement | SVGElement;
  palList: HTMLElement;
  palPresets: HTMLElement;
  meterList: HTMLElement;
  statusEl: HTMLElement;
  titleEl: HTMLElement;
  toast?: HTMLElement;
  /**
   * Fired whenever the bench gains or loses unsaved changes.
   *
   * The shell owns the floating Save button, so the lab reports the state
   * rather than painting it — the lab has no idea a FAB exists.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

/** A preset bench: builds its devices and optionally energises them. */
export interface Preset {
  label: string;
  sub?: string;
  danger?: boolean;
  build: (lab: Lab) => void;
  setup?: (lab: Lab) => void;
}

/* ────────────────────────────────────────────────────────────────
   Motion tuning

   A real 3-phase motor turns at 2820 rpm - 295 rad/s, about 47 turns a
   second. No display shows that, and trying to is worse than not trying:
   at 60 fps the rotor mark advances ~126 degrees per frame, so it does not
   read as spinning, it strobes. Worse, the old code advanced the angle by a
   fixed amount PER FRAME with no dt, so the same bench spun 2.4x faster on a
   144 Hz screen than on a 60 Hz one.

   The fix is to stop pretending the rotation is literal and make it
   perceptual. A tanh saturates the visual speed: slow shafts turn at
   something close to their true rate (so spin-up is legible), and anything
   past OMEGA_REF converges on OMEGA_VIS_MAX - fast enough to read as
   "spinning hard", slow enough that the mark never aliases. Blur and a drop
   in opacity take over above the knee so a fast shaft looks like a swept
   disc, which is exactly how a real shaft reads to the eye.
   ──────────────────────────────────────────────────────────────── */

/** Ceiling on visual angular speed (rad/s). 55 rad/s is ~53 deg/frame at
 *  60 fps - fast, clearly turning, and comfortably under the aliasing edge. */
const OMEGA_VIS_MAX = 55;

/**
 * Angular speed (rad/s) at which the visual rotation is ~76% of the ceiling.
 *
 * ABSOLUTE, deliberately NOT normalised per machine.
 *
 * Normalising by each machine's rated speed is the obvious-looking choice and
 * it is wrong twice. It maps "at full load" to the SAME visual rate for every
 * machine - a 2850 rpm motor and a 1250 rpm generator both land on 54.4 rad/s
 * and become indistinguishable, which defeats the point of a lab that exists
 * to show that one turns faster than the other. And it makes the visual speed
 * disagree with the tachometer beside it: 50% of rated reads as full speed.
 *
 * An absolute reference keeps the mapping monotonic, so the faster shaft
 * always reads as faster:
 *
 *   1250 rpm  (131 rad/s) -> 37.1 rad/s   35 deg/frame at 60 fps
 *   2850 rpm  (298 rad/s) -> 52.4 rad/s   50 deg/frame at 60 fps
 *
 * Both comfortably under the ~180 deg/frame aliasing edge, and 15 rad/s
 * apart - the two machines are visibly different at a glance.
 *
 * (The previous value, 80, saturated too early: it gave 51.0 vs 54.9 rad/s,
 * a 7% difference that read as identical at a glance. Raising it to 160 is
 * the whole fix; it is a retune of one number, not a new mechanism.)
 */
const OMEGA_REF = 160;

/** Rotor speed (rad/s) above which a machine is considered running. */
const OMEGA_RUNNING = 2;

/** Peak motion blur, in CSS pixels at 100% zoom. */
const BLUR_MAX_PX = 2.2;

/**
 * Rumble period bounds, seconds.
 *
 * RUMBLE_FAST is 0.075 s, about 13 Hz. That ceiling is not aesthetic: a 60 fps
 * display can draw roughly 15 distinct positions per second, and past that the
 * frames sample the animation at effectively random phases so the jitter reads
 * as noise. The old floor of 0.04 s was 25 Hz - well past the point where a
 * buzz is representable.
 */
const RUMBLE_SLOW = 0.13;
const RUMBLE_FAST = 0.075;

/**
 * Rendered size, in px, of each front-panel control type.
 *
 * These MUST match the widths in assets/style.css (.pctl-toggle 22,
 * .pctl-dial 30, .pctl-button 30). The layout x/y is the CENTRE of the
 * painted knob, so the overlay's top-left has to be backed off by half the
 * box. Reading it from one table here rather than guessing per call keeps
 * the offset and the CSS from drifting apart.
 */
const CONTROL_SIZE: Record<string, number> = {
  toggle: 22,
  dial: 58,
  select: 20,
  button: 30
};

let _idc = 0;
/** Monotonic, collision-free device id within a session. */
function uid(p: string): string {
  _idc += 1;
  return p + '_' + _idc + '_' + Math.random().toString(36).slice(2, 6);
}

export class Lab {
  surface: HTMLElement;
  world: HTMLElement;
  wireLayer: HTMLElement | SVGElement;
  smokeLayer: HTMLElement | SVGElement;
  palList: HTMLElement;
  palPresets: HTMLElement;
  meterList: HTMLElement;
  statusEl: HTMLElement;
  titleEl: HTMLElement;
  toast: HTMLElement | undefined;
  onDirtyChange: ((dirty: boolean) => void) | undefined;

  /**
   * True when the bench has changes that are not on the server.
   *
   * Flipped by `_sync()`, which is the single choke point every topology
   * change already passes through — placing a device, adding a wire, a
   * preset load, a clear. Using that one hook means no mutation site had to
   * be found and instrumented, and a future one cannot forget.
   */
  dirty = false;

  /**
   * Depth of programmatic edits that must NOT mark the bench dirty.
   *
   * `restoreBench` calls `place()` per device and `_sync()` per wire, so a
   * load would otherwise leave the bench looking unsaved the instant it was
   * loaded. A counter rather than a boolean because loading a bench can nest
   * (a preset load inside a restore), and an inner `resume` that reset a
   * boolean would let the outer half re-dirty it.
   */
  private _dirtyHold = 0;

  netlist: Netlist;
  sim: Simulator;
  devices: DeviceEntry[] = [];
  running = false;
  rafId: number | null = null;
  lastT = 0;
  smoke: unknown[] = [];

  /**
   * Seconds in the last simulated step. Read by the animation code so the
   * rotor integrates at the same wall-clock rate regardless of frame rate.
   * Seeded at 1/60 so a redraw outside the loop still has a sane step.
   */
  _animDt = 1 / 60;

  /** Pan / zoom. `k` is scale; `x`/`y` are the world translate. */
  view = { x: 0, y: 0, k: 1 };

  selectedId: string | null = null;
  private _ctxEl: HTMLElement | null = null;
  private _tooltipEl: HTMLElement | null = null;

  private undoStack: UndoAction[] = [];
  private readonly UNDO_MAX = 40;

  wiring: Wiring;

  /** Presets registered by the experiment catalogue. */
  presets: Record<string, Preset> = {};

  constructor(deps: LabDeps) {
    this.surface = deps.surface;
    this.world = deps.world || deps.surface;
    this.wireLayer = deps.wireLayer;
    this.smokeLayer = deps.smokeLayer;
    this.palList = deps.palList;
    this.palPresets = deps.palPresets;
    this.meterList = deps.meterList;
    this.statusEl = deps.statusEl;
    this.titleEl = deps.titleEl;
    this.toast = deps.toast;
    this.onDirtyChange = deps.onDirtyChange;

    this.netlist = new Netlist();
    this.sim = new Simulator(this.netlist);

    this.wiring = new Wiring({
      surface: this.surface,
      world: this.world,
      wireLayer: this.wireLayer,
      owner: this,
      onChange: () => this._sync()
    });

    this._bindPalette();
    this._bindView();
    this._bindContextMenu();
    this._bindKeyboard();
    this._bindTooltip();
    this._bindWireHover();
    this._reset();
    this._renderPalette();
    this._applyView();
  }

  /* ═════════════ netlist reset ═════════════ */

  private _reset(): void {
    this.netlist = new Netlist();
    // Re-point the simulator at the fresh netlist. Constructing a new one is
    // cheaper and safer than mutating the old one's internal buffers, and it
    // resets the seeded RNG so a cleared bench reproduces exactly.
    this.sim = new Simulator(this.netlist);
    this.devices = [];
    this.smoke = [];
  }

  clear(): void {
    // Clearing an already-empty bench is a no-op, not an edit. Without this
    // the trailing `_sync()` would mark a pristine bench unsaved and the
    // floating Save button would appear over nothing.
    const wasEmpty = this.devices.length === 0 && this.wiring.wires.length === 0;

    this.stop();
    this._reset();
    this.wiring.clear();
    this.world.querySelectorAll('.device').forEach((n) => n.remove());
    // Plumes are keyed by device id and would otherwise outlive the bench,
    // since _renderSmoke only sweeps them while the loop is running.
    (this.smokeLayer as HTMLElement).querySelectorAll('[data-smoke]').forEach((n) => n.remove());
    this.titleEl.textContent = 'Laboratory \u00b7 Empty Bench';
    this._renderMeters();

    if (wasEmpty) {
      this._dirtyHold += 1;
      try { this._sync(); } finally { this._dirtyHold -= 1; }
    } else {
      this._sync();
    }
  }

  /**
   * Rebuild the bench from a serialised snapshot.
   *
   * Lives here rather than in the app shell because a PRESET needs it too.
   * The old copy was a private function in `app.ts`, so a preset could only
   * rebuild a bench by calling `place()` and `wiring.add()` itself — which
   * means re-deriving the id-restoration dance below, and getting it wrong.
   *
   * The subtlety, unchanged from the original: `place()` mints a FRESH id and
   * renders the DOM node with it, but the wires in the snapshot reference the
   * SAVED ids. The node has to be found while it still carries the fresh id,
   * then both the entry and the node re-pointed at the saved one. Querying
   * after the swap looks for a node that does not exist yet, and every wire
   * then fails to draw against a device the lab cannot find.
   */
  loadBench(data: { devices: readonly unknown[]; wires: readonly unknown[] }): void {
    this.clear();

    const devices = data.devices as Array<{
      id: string; kind: string; x: number; y: number; rot?: number;
      state?: Record<string, unknown>;
    }>;
    const wires = data.wires as Array<{
      aDev: string; aTerm: string; bDev: string; bTerm: string;
    }>;

    devices.forEach((d) => {
      const entry = this.place(d.kind, d.x, d.y);
      if (!entry) return;

      const freshId = entry.id;
      const node = this.world.querySelector('.device[data-id="' + freshId + '"]') as HTMLElement | null;

      this.netlist.removeDevice(freshId);
      entry.id = d.id;
      entry.model.id = d.id;
      this.netlist.addDevice(entry.model);

      if (node) node.dataset.id = d.id;

      // Rotation BEFORE the wires: the first render must already have the
      // terminals where the wires expect them.
      entry.rot = d.rot || 0;
      if (node) this.applyRotationPublic(node, entry);

      // Restore the panel: isolator, rail switches, variac, wiper dials, rotor
      // speed. Geometry alone is not the experiment — a bench that reloads
      // with every switch off is a dead bench that looks broken.
      const m = entry.model as { setState?: (s: Record<string, unknown>) => void };
      if (d.state && typeof m.setState === 'function') m.setState(d.state);
    });

    wires.forEach((w) => {
      this.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
    });

    this._renderMeters();
    this._sync();
    this.wiring.render();
  }

  /* ═════════════ view: pan + zoom ═════════════ */

  _applyView(): void {
    this.world.style.transform =
      'translate(' + this.view.x + 'px,' + this.view.y + 'px) scale(' + this.view.k + ')';
  }

  private _bindView(): void {
    const surf = this.surface;

    /* Pointer Events, not Mouse Events.
     *
     * The old handlers were mouse-only, which on a phone meant the bench
     * could not be panned at all: the browser claimed every drag as a page
     * scroll, `mousemove` never fired, and the surface sat there. Pointer
     * Events unify mouse, touch and pen into one stream, and pointer capture
     * keeps a drag bound to the surface even when the finger leaves it.
     *
     * Multi-touch is tracked by pointer id: one pointer pans, two pinch-zoom
     * about their midpoint. That is the whole gesture vocabulary anyone
     * expects on a canvas, and it costs one Map. */

    // pointerId -> latest surface-local position
    const active = new Map<number, { x: number; y: number }>();
    let panning = false;
    let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    // Pinch baseline: separation when the second finger landed, and the zoom
    // it started from. Storing both makes the scale absolute rather than
    // accumulating rounding error frame by frame.
    let pinchDist = 0;
    let pinchK = 1;

    const local = (e: PointerEvent): { x: number; y: number } => {
      const r = surf.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const pts = (): Array<{ x: number; y: number }> => [...active.values()];

    const pairDist = (): number => {
      const p = pts();
      if (p.length < 2) return 0;
      return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    };

    const pairMid = (): { x: number; y: number } => {
      const p = pts();
      return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    };

    surf.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.device')) return;  // device drag handles itself

      /* A wire is a CLICK target, not a drag handle - and it must never be
       * captured.
       *
       * setPointerCapture() retargets every subsequent event for that pointer
       * to the capturing element, and the spec is explicit that this includes
       * the compatibility `click`: it is still dispatched to the capture
       * target even after capture is released on pointerup. Capturing here
       * therefore rewrote the target of the click that follows from `.wirehit`
       * to the surface itself, the wireLayer's delegated handler never matched
       * `.wirehit`, and every wire became undeletable. The hover highlight
       * kept working, because that rides `mouseover`, which capture does not
       * retarget - which is exactly what made this look like a wiring bug.
       *
       * Deleting a wire is a discrete click with no drag to track, so it needs
       * no capture: bail before the gesture bookkeeping and the browser fires
       * an ordinary click at the path, where the wireLayer handler is waiting. */
      if ((e.target as HTMLElement).closest('.wirehit')) return;

      if (e.button === 2) return;                                // context menu
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      active.set(e.pointerId, local(e));

      if (active.size === 1) {
        this.deselectAll();
        panning = true;
        moved = false;
        sx = e.clientX; sy = e.clientY;
        ox = this.view.x; oy = this.view.y;
        surf.classList.add('panning');
      } else if (active.size === 2) {
        // A second finger means pinch, not pan. Dropping the pan flag here is
        // what stops the view jumping when a finger is added mid-drag.
        panning = false;
        pinchDist = pairDist();
        pinchK = this.view.k;
        moved = true;
      }

      try { surf.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }

      /* Only the MOUSE path needs preventDefault.
       *
       * On the mouse it suppresses the native drag-select that would otherwise
       * start when you pan across the bench. On touch it is both unnecessary
       * and dangerous: `touch-action: none` already stops the browser from
       * scrolling, and cancelling a pointerdown tells the engine not to emit
       * the compatibility mouse events - including the `click` that the
       * wiring layer relies on to place a terminal pick. Wiring would go dead
       * on exactly the devices this change is for. */
      if (e.pointerType === 'mouse') e.preventDefault();
    });

    surf.addEventListener('pointermove', (e: PointerEvent) => {
      if (!active.has(e.pointerId)) return;
      active.set(e.pointerId, local(e));

      if (active.size >= 2) {
        /* Pinch: identical maths to the wheel, with the ratio of finger
         * separations standing in for exp(-deltaY). The world point under
         * the midpoint stays fixed, which is what makes it read as the bench
         * being held rather than sliding around under the fingers. */
        const d = pairDist();
        if (pinchDist > 0 && d > 0) {
          const mid = pairMid();
          const old = this.view.k;
          const k = Math.min(3.5, Math.max(0.25, pinchK * (d / pinchDist)));
          this.view.x = mid.x - (mid.x - this.view.x) * (k / old);
          this.view.y = mid.y - (mid.y - this.view.y) * (k / old);
          this.view.k = k;
          this._applyView();
          surf.classList.add('panned');
        }
        return;
      }

      if (!panning) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      this.view.x = ox + dx;
      this.view.y = oy + dy;
      this._applyView();
    });

    const endPointer = (e: PointerEvent): void => {
      if (!active.has(e.pointerId)) return;
      active.delete(e.pointerId);

      if (active.size === 0) {
        if (panning) {
          surf.classList.remove('panning');
          // Swallow the click that follows a pan so it does not clear a
          // pending terminal pick.
          this.wiring._suppressClick = moved;
          setTimeout(() => { this.wiring._suppressClick = false; }, 0);
          if (moved) surf.classList.add('panned');
        }
        panning = false;
        pinchDist = 0;
      } else if (active.size === 1) {
        // One finger of a pinch lifted: hand the gesture back to a pan,
        // re-anchored on the finger still down, so the bench does not snap.
        const p = pts()[0];
        const r = surf.getBoundingClientRect();
        panning = true;
        sx = p.x + r.left; sy = p.y + r.top;
        ox = this.view.x; oy = this.view.y;
        pinchDist = 0;
      }
    };

    surf.addEventListener('pointerup', endPointer);
    surf.addEventListener('pointercancel', endPointer);

    /* Double-tap to fit, for touch.
     *
     * dblclick does fire on mobile, but only after a ~300ms delay and only if
     * the two taps land on the same pixel - too fussy for a deliberate
     * gesture. Track taps by hand: two pointerups inside 300ms and 24px. */
    let lastTap = 0, lastTapX = 0, lastTapY = 0;
    surf.addEventListener('pointerup', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;   // desktop keeps dblclick
      if (moved || active.size > 0) return;    // a pan, or a finger still down
      const t = Date.now();
      if (t - lastTap < 300 &&
          Math.abs(e.clientX - lastTapX) < 24 &&
          Math.abs(e.clientY - lastTapY) < 24) {
        if (!(e.target as HTMLElement).closest('.device')) this.fitView();
        lastTap = 0;
        return;
      }
      lastTap = t; lastTapX = e.clientX; lastTapY = e.clientY;
    });

    // Wheel zoom about the cursor.
    surf.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = surf.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const old = this.view.k;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const k = Math.min(3.5, Math.max(0.25, old * factor));
      // Keep the world point under the cursor fixed.
      this.view.x = mx - (mx - this.view.x) * (k / old);
      this.view.y = my - (my - this.view.y) * (k / old);
      this.view.k = k;
      this._applyView();
      surf.classList.add('panned');
    }, { passive: false });

    surf.addEventListener('dblclick', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.device')) return;
      this.fitView();
    });
  }

  fitView(): void {
    if (!this.devices.length) {
      this.view = { x: 0, y: 0, k: 1 };
      this._applyView();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.devices.forEach((d) => {
      minX = Math.min(minX, d.x); minY = Math.min(minY, d.y);
      maxX = Math.max(maxX, d.x + d.w); maxY = Math.max(maxY, d.y + d.h);
    });
    const pad = 60;
    const rect = this.surface.getBoundingClientRect();
    const vw = rect.width || 900, vh = rect.height || 600;

    // The palette is a FLOATING overlay: 16px in from the left, 210px wide,
    // z-index 20, sitting on top of the bench. Centring against the full
    // surface width therefore parked the left edge of the bench UNDERNEATH
    // it - a device placed there had its whole left column (the AEG switches
    // on the power supply) unreachable, because every click landed on the
    // palette instead. Centre into the strip that is actually visible: to the
    // right of the palette, with the same 16px gutter it uses on the left.
    const PALETTE_INSET = 16 + 210 + 16; // left gutter + panel width + gap
    const availX = PALETTE_INSET;
    const availW = Math.max(200, vw - PALETTE_INSET);

    const wW = (maxX - minX) + pad * 2;
    const wH = (maxY - minY) + pad * 2;
    const k = Math.min(1.2, Math.min(availW / wW, vh / wH));
    this.view.k = k;
    this.view.x = availX + (availW - (maxX - minX) * k) / 2 - minX * k;
    this.view.y = (vh - (maxY - minY) * k) / 2 - minY * k;
    this._applyView();
  }

  /* ═════════════ equipment palette ═════════════ */

  private _renderPalette(): void {
    Object.keys(EQUIPMENT).forEach((kind) => {
      const eq = EQUIPMENT[kind];
      const btn = document.createElement('button');
      btn.className = 'pal-item';
      btn.innerHTML =
        '<span class="pi-ico" style="color:' + eq.color + '">' +
        '<i data-lucide="' + eq.icon + '" class="lucide-icon xs"></i></span>' +
        '<span class="pi-name">' + eq.label +
        '<span class="pi-sub">' + eq.model + '</span></span>';
      btn.addEventListener('click', () => this.place(kind));
      this.palList.appendChild(btn);
    });
    refreshIcons();
  }

  private _bindPalette(): void {
    this.palPresets.addEventListener('click', (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest('.pal-item') as HTMLElement | null;
      if (!b || !b.dataset.preset) return;
      this.loadPreset(b.dataset.preset);
    });
  }

  /** Register the preset catalogue this lab exposes. */
  loadPresetList(presets: Record<string, Preset>): void {
    this.presets = presets;
    this.palPresets.innerHTML = '';
    Object.keys(presets).forEach((key) => {
      const p = presets[key];
      const btn = document.createElement('button');
      btn.className = 'pal-item preset' + (p.danger ? ' danger' : '');
      btn.dataset.preset = key;
      const ico = p.danger ? 'flame' : 'flask-conical';
      btn.innerHTML =
        '<span class="pi-ico"><i data-lucide="' + ico + '" class="lucide-icon xs"></i></span>' +
        '<span class="pi-name">' + p.label +
        '<span class="pi-sub">' + (p.sub || '') + '</span></span>';
      this.palPresets.appendChild(btn);
    });
    refreshIcons();
  }

  loadPreset(key: string): void {
    const p = this.presets[key];
    if (!p || !p.build) { this._toast('Preset not found: ' + key, 'err'); return; }
    this.stop();
    p.build(this);
    // build() places and wires the bench; setup() energises it. The supply
    // model boots with every rail OFF behind an open isolator, so without this
    // a preset is a correctly-wired dead bench - which is what every preset
    // was before the setup hook existed.
    if (typeof p.setup === 'function') {
      try { p.setup(this); } catch (e) { console.error('preset setup failed', key, e); }
    }
    this._renderMeters();
    this._sync();
    this.wiring.render();
    this._toast('Loaded \u00b7 ' + p.label, 'ok');
  }

  /* ═════════════ placement ═════════════ */

  /**
   * Build the model for a palette kind.
   *
   * A plain switch rather than a table lookup, because every constructor
   * takes a DIFFERENT options bag and only some of them matter here. The
   * rheostat needs its terminal pair named; the supply needs its main rail
   * terminals; the meter needs a mode. A generic `new Ctor({id})` would build
   * a working-looking device whose defaults happen to be wrong for the bench.
   */
  private _newDevice(kind: string, id: string): Device | null {
    try {
      switch (kind) {
        case 'dc_machine':               return new DCMachine({ id });
        case 'async_motor_3p':           return new Motor3P({ id });
        case 'async_motor_1p':           return new Motor1P({ id });
        case 'sync_gen':                 return new SyncGen({ id });
        case 'single_phase_transformer': return new Transformer({ id });
        case 'rheostat':                 return new Rheostat({ id });
        case 'power_supply':             return new DCSupply({ id, pos: 'DC+', neg: 'DC-' });
        case 'meter_rack':               return new MeterRack({ id });
        case 'load_bank':                return new LoadBank({ id });
        case 'coupling':                 return new Coupling({ id });
        case 'meter':                    return new Meter({ id, mode: 'V' });
        default:                         return null;
      }
    } catch (e) {
      console.error('device create failed', kind, e);
      return null;
    }
  }

  place(kind: string, x?: number, y?: number, rot?: number): DeviceEntry | null {
    const reg: EquipmentEntry | undefined = EQUIPMENT[kind];
    if (!reg) return null;

    if (this.devices.length === 0) {
      this.titleEl.textContent = 'Laboratory \u00b7 Custom Bench';
    }

    const id = uid(kind);
    const dev = this._newDevice(kind, id);
    if (!dev) return null;

    // NOTE: no terminal patching here. The model read its own layout at
    // construction, so it already knows exactly the jacks this panel draws.
    // The old build assigned `dev.terminals` from the sprite registry at this
    // point, which meant a device built any other way - a test, a save-file
    // loader - had the wrong terminals and dropped wires in silence.

    if (x == null || y == null) {
      const n = this.devices.length;
      x = 40 + (n % 4) * 260;
      y = 30 + Math.floor(n / 4) * 220;
    }

    const entry: DeviceEntry = {
      id,
      kind,
      model: dev,
      x,
      y,
      w: reg.layout.w,
      h: reg.layout.h,
      // Rotation in degrees, clockwise: 0 / 90 / 180 / 270. Not an arbitrary
      // angle - the panel art is axis-aligned and a 37-degree motor just looks
      // broken. `w`/`h` stay the NATIVE unrotated size; the visual rotation is
      // a CSS transform and the wire layer compensates in pointOf().
      //
      // The rotation is taken AT PLACEMENT so _renderDevice can apply it in
      // the same pass. A preset that set entry.rot AFTER place() returned
      // rendered the sprite upright, because place() had already drawn it -
      // which is why a rotated motor still stood vertical and its shaft never
      // met the coupling.
      rot: rot || 0
    };

    this.devices.push(entry);
    this.netlist.addDevice(dev);

    this._renderDevice(entry);
    this._sync();
    return entry;
  }

  /* ═════════════ rendering ═════════════ */

  private _renderDevice(entry: DeviceEntry): void {
    const reg = EQUIPMENT[entry.kind];
    const el = document.createElement('div');
    el.className = 'device';
    el.dataset.id = entry.id;
    el.style.left = entry.x + 'px';
    el.style.top = entry.y + 'px';
    el.style.width = entry.w + 'px';
    el.style.height = entry.h + 'px';
    el.innerHTML = reg.sprite();

    // Terminals as invisible bubble connectors over the SVG. The labels are
    // already printed inside the sprite - these are hit targets, not labels.
    reg.layout.terms.forEach((t) => {
      const dot = document.createElement('div');
      dot.className = 'term' + (t.mech ? ' mech' : '');
      dot.dataset.term = t.k;
      // Remember the intended CENTRE: some posts are wider than they are tall,
      // so offsetLeft + width/2 alone would drift. pointOf() reads these.
      dot.dataset.cx = String(t.x);
      dot.dataset.cy = String(t.y);
      // Tight dots are for jacks painted close together - a 20px hitbox would
      // overlap its neighbour and steal its clicks. Mech ports are a big bolt:
      // 24px so they are easy to grab.
      const w = t.mech ? 24 : (t.tight ? 12 : 20);
      const h = t.mech ? 24 : (t.tight ? 12 : 20);
      // Width and height MUST be set here, not left to the stylesheet.
      // `.term` in style.css declares width:20px/height:20px, and a property
      // the inline style does not set comes from the stylesheet. The centring
      // maths below uses `w` (12px for a tight dot), so a 20px CSS box landed
      // with its centre at (x+4, y+4): every tight terminal on the rack was
      // drawn 4px down-right of its declared position, and the oversized
      // boxes overlapped into a blob. Setting both here makes this code the
      // one source of truth for the box, so the maths and the element agree.
      dot.style.width = w + 'px';
      dot.style.height = h + 'px';
      dot.style.left = (t.x - w / 2) + 'px';
      dot.style.top = (t.y - h / 2) + 'px';
      dot.title = t.k;
      el.appendChild(dot);
    });

    // Honour a rotation the caller set before render. A preset that rotates
    // a machine (e.g. turning the 3φ motor so its bottom-mounted shaft faces
    // the coupling) sets entry.rot right after place(); without this the
    // sprite rendered upright and the mechanical ports did not line up.
    this._applyRotation(el, entry);

    // Meter-display mode switches. SVG cannot take clicks reliably under the
    // world transform, so these are HTML overlays exactly like the terminals.
    (reg.layout.buttons || []).forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'mbtn';
      btn.dataset.disp = b.d;
      btn.dataset.mode = b.m;
      btn.textContent = b.m;
      btn.title = b.m === 'V' ? 'read voltage' : b.m === 'A' ? 'read current' : 'read power';
      btn.style.left = (b.x - 7) + 'px';
      btn.style.top = (b.y - 5) + 'px';
      el.appendChild(btn);
    });

    // Panel controls (switches, dials, selectors, push buttons). HTML overlays
    // for the same reason. Each routes through model.setControl(id, value) so
    // the sprite stays pure drawing and all panel logic lives in the model.
    (reg.layout.controls || []).forEach((c) => {
      const ctl = document.createElement('div');
      ctl.className = 'pctl pctl-' + c.type + (c.danger ? ' danger' : '') + (c.ok ? ' ok' : '');
      ctl.dataset.ctl = c.id;
      ctl.dataset.ctlType = c.type;
      if (c.min != null) { ctl.dataset.min = String(c.min); ctl.dataset.max = String(c.max); }
      if (c.options) ctl.dataset.options = c.options.join(',');
      if (c.unit) ctl.dataset.unit = c.unit;
      ctl.title = c.title || c.id;
      // Centre the control on its layout coordinate, exactly like the term
      // dots above. The layout x/y is the middle of the painted knob, but
      // the CSS sizes differ per type (toggle 22px, dial 30px, button 30px)
      // and the element's origin is its TOP-LEFT. Placing that corner on the
      // centre pushed every control half its own size down and right, which
      // is why the switches sat off their painted breakers.
      const cs = CONTROL_SIZE[c.type] ?? 22;
      ctl.style.left = (c.x - cs / 2) + 'px';
      ctl.style.top = (c.y - cs / 2) + 'px';
      el.appendChild(ctl);
    });

    el.addEventListener('click', (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest('.mbtn') as HTMLElement | null;
      if (!b) return;
      e.stopPropagation();
      const model = entry.model as Device & { setDisplayMode?: (d: string, m: string) => void };
      if (model.setDisplayMode) {
        model.setDisplayMode(b.dataset.disp as string, b.dataset.mode as string);
        this._updateSpriteReadouts();
        this._renderMeters();
      }
    });

    this.world.appendChild(el);
    this._bindDrag(el, entry);
    this._bindControls(el, entry);
    this._applyRotation(el, entry);
    this._updateSpriteReadouts();
  }

  /**
   * Apply a device's rotation as a CSS transform about its own centre.
   *
   * Rotating about the centre (not the top-left) is what keeps a device from
   * jumping sideways when you rotate it: the layout box keeps its native w x h
   * and its top-left stays put, so the centre is a fixed point and the panel
   * pivots in place.
   *
   * `data-rot` is the single source of truth for the wire layer. pointOf()
   * reads it back and rotates the terminal coordinate by the same angle, which
   * is what keeps wires attached to their jacks instead of to where the jacks
   * used to be.
   */
  /**
   * Public wrapper for `_applyRotation`.
   *
   * The save-file loader needs to restore a device's rotation before the
   * first wire render, which happens outside the class. Rather than make the
   * whole method public and invite misuse, this exposes exactly that one
   * operation.
   */
  applyRotationPublic(el: HTMLElement, entry: DeviceEntry): void {
    this._applyRotation(el, entry);
  }

  private _applyRotation(el: HTMLElement, entry: DeviceEntry): void {
    entry.rot = (((entry.rot || 0) % 360) + 360) % 360;
    el.dataset.rot = String(entry.rot);
    el.style.transformOrigin = '50% 50%';
    el.style.transform = entry.rot ? 'rotate(' + entry.rot + 'deg)' : '';
  }

  /** Rotate one device by `delta` degrees (default +90, clockwise). */
  rotateDevice(devId: string, delta?: number): void {
    const entry = this.devices.find((d) => d.id === devId);
    if (!entry) return;

    const before = entry.rot || 0;
    entry.rot = (((before + (delta == null ? 90 : delta)) % 360) + 360) % 360;

    const el = this.world.querySelector('.device[data-id="' + devId + '"]') as HTMLElement | null;
    if (el) this._applyRotation(el, entry);

    // Wires are drawn in world space from pointOf(), so they have to be
    // redrawn the instant the terminal coordinates move. Forgetting this is
    // what makes a rotated device's wires hang in mid-air.
    this.wiring.render();
    this._toast('Rotated \u00b7 ' + entry.rot + '\u00b0', '');
  }

  /* ═════════════ panel controls ═════════════ */

  /**
   * One delegated listener per device element.
   *
   * `toggle` and `button` fire on click; `select` cycles its option list;
   * `dial` needs a press-and-drag, so the pointer is captured on mousedown and
   * released on the window.
   */
  private _bindControls(el: HTMLElement, entry: DeviceEntry): void {
    const push = (ctl: HTMLElement, value: number | string | boolean): void => {
      const model = entry.model as Device & { setControl?: (id: string, v: number | string | boolean) => void };
      if (typeof model.setControl !== 'function') return;
      model.setControl(ctl.dataset.ctl as string, value);
      this._updateSpriteReadouts();
      this._renderMeters();
    };

    // Seed each dial's current value from the model, so its first drag starts
    // from the real position instead of assuming 0. Without this a dial whose
    // model default is non-zero (the rheostat starts at pos=0.5) jumps on the
    // first pixel of movement.
    const seeds: Record<string, number> = {};
    const m = entry.model as Device & { posA?: number; posB?: number };
    if (typeof m.posA === 'number') seeds.posA = m.posA;
    if (typeof m.posB === 'number') seeds.posB = m.posB;
    el.querySelectorAll('.pctl-dial').forEach((c) => {
      const ctl = c as HTMLElement;
      const id = ctl.dataset.ctl as string;
      if (ctl.dataset.value == null && seeds[id] != null) ctl.dataset.value = String(seeds[id]);
    });

    el.addEventListener('click', (e: MouseEvent) => {
      const ctl = (e.target as HTMLElement).closest('.pctl') as HTMLElement | null;
      if (!ctl) return;
      e.stopPropagation();
      const type = ctl.dataset.ctlType;

      if (type === 'toggle') {
        ctl.classList.toggle('on');
        push(ctl, ctl.classList.contains('on'));
      } else if (type === 'button') {
        ctl.classList.add('pressed');
        setTimeout(() => ctl.classList.remove('pressed'), 160);
        push(ctl, true);
      } else if (type === 'select') {
        const opts = (ctl.dataset.options || '').split(',').map(Number);
        const cur = Number(ctl.dataset.value != null ? ctl.dataset.value : opts[0]);
        const idx = Math.max(0, opts.indexOf(cur));
        const next = opts[(idx + 1) % opts.length];
        ctl.dataset.value = String(next);
        push(ctl, next);
      }
    });

    // Dials: press and drag vertically to wind the variac. A vertical drag is
    // used rather than a rotational one because the panel is viewed top-down
    // and a knob has no unambiguous angle under a pan/zoom transform.
    /* Dials, on pointer events.
     *
     * The gesture is a vertical drag, so on touch the delta is divided by the
     * zoom exactly as it is for the mouse - a finger moving 40 screen pixels
     * should wind the same amount as a cursor moving 40. Shift-to-fine has no
     * touch equivalent, so a two-finger drag would be the natural gesture, but
     * that collides with pinch-to-zoom on the bench; instead the coarse drag
     * simply stays coarse and the quantisation below keeps it usable. */
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      const ctl = (e.target as HTMLElement).closest('.pctl-dial') as HTMLElement | null;
      if (!ctl) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const min = Number(ctl.dataset.min || 0);
      const max = Number(ctl.dataset.max || 100);
      let val = Number(ctl.dataset.value || 0);
      const sy = e.clientY;
      const sv = val;
      const k = this.view.k || 1;
      const pid = e.pointerId;
      ctl.classList.add('winding');
      // Capture so a fast drag that leaves the 20px dial keeps winding rather
      // than stranding mid-turn - the same reason the bench captures. */
      try { (e.target as HTMLElement).setPointerCapture(pid); } catch { /* gone */ }

      const move = (ev: PointerEvent): void => {
        if (ev.pointerId !== pid) return;
        const span = max - min;
        // Full sweep over ~150px of drag (was 200px at span/200), so a narrow
        // range like the rheostat's 0..1 pos is still comfortable to wind.
        //
        // Shift = FINE. The variac covers 0-440 V in 150 px, so ~2.9 V per
        // pixel; in a short-circuit test the current is proportional to that
        // voltage and a single-pixel nudge jumps tens of amps and trips the
        // breaker before the operating point can be found. Holding Shift
        // scales the travel by 0.1 (0.29 V/px), which makes the 0-15 V SC
        // range landable by hand.
        const fine = ev.shiftKey ? 0.1 : 1;
        val = sv + (((sy - ev.clientY) / k) * (span / 150)) * fine;
        val = Math.max(min, Math.min(max, val));
        // Quantise to 1/1000 of the range, not a fixed 0.1. A hard-coded 0.1
        // step collapsed a 0..1 dial to just 11 positions and made small
        // movements snap to the extremes.
        const step = span / 1000;
        val = Math.round(val / step) * step;
        ctl.dataset.value = String(val);
        push(ctl, val);
      };
      const up = (ev: PointerEvent): void => {
        if (ev.pointerId !== pid) return;
        ctl.classList.remove('winding');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  /* ═════════════ drag ═════════════ */

  private _bindDrag(el: HTMLElement, entry: DeviceEntry): void {
    /* Pointer events, for the same reason as the bench: a touch-drag on a
     * device has to be claimed before the browser reads it as a scroll.
     * `touch-action: none` on `.device` does the claiming; this handler is
     * what then makes the drag work with a finger. */
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.term')) return;
      if (target.closest('.mbtn')) return;
      if (target.closest('.pctl')) return;
      if (e.button === 2) return;   // context menu
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      this.selectDevice(entry.id);

      const k = this.view.k || 1;
      const sx = e.clientX, sy = e.clientY;
      const ox = entry.x, oy = entry.y;
      const pid = e.pointerId;
      let moved = false;
      try { el.setPointerCapture(pid); } catch { /* gone */ }

      // Coalesce wire redraws to one per animation frame.
      //
      // `mousemove` fires far faster than the display refreshes - easily 500+
      // times a second on a high-polling mouse - so calling `wiring.render()`
      // directly in the handler redrew the wire layer several times per visible
      // frame. The geometry only needs to be correct ONCE per frame: the
      // browser is going to composite once anyway, and no intermediate position
      // is ever seen. Schedule at most one render per rAF and let the rest of
      // the mousemove burst collapse into it.
      let rafPending = false;
      const scheduleRender = (): void => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (!moved) return;   // a click that never dragged needs no redraw
          this.wiring.render();
        });
      };

      const move = (ev: PointerEvent): void => {
        if (ev.pointerId !== pid) return;
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
        // Divide the screen delta by zoom so the device tracks the cursor at
        // any scale.
        entry.x = ox + (ev.clientX - sx) / k;
        entry.y = oy + (ev.clientY - sy) / k;
        el.style.left = entry.x + 'px';
        el.style.top = entry.y + 'px';
        scheduleRender();
      };
      const up = (ev: PointerEvent): void => {
        if (ev.pointerId !== pid) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        // One final render so the wire lands on the exact drop position, in
        // case the last pointermove's rAF had not fired yet.
        if (moved) { this.wiring.render(); this._snapCoupling(entry); }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  /* ═════════════ coupling snap ═════════════ */

  /**
   * Pull a coupling onto the nearest shaft.
   *
   * A coupling is only useful if its ports meet a machine's shaft. Rather than
   * ask the user to eyeball a 12px alignment, look for the nearest SHAFT port
   * within reach of each coupling port and translate the coupling so the two
   * centres coincide. No rotation - couplings are drawn axis-aligned.
   */
  private _snapCoupling(entry: DeviceEntry): void {
    const reg = EQUIPMENT[entry.kind];
    if (!reg || entry.kind !== 'coupling') return;
    const SNAP = 90;   // how far a port may reach, in world px

    // Every SHAFT port currently on the bench, in world coords.
    const shafts: Array<{ x: number; y: number }> = [];
    this.devices.forEach((d) => {
      if (d.id === entry.id) return;
      const r = EQUIPMENT[d.kind];
      if (!r) return;
      r.layout.terms.forEach((t) => {
        if (t.k !== 'SHAFT') return;
        shafts.push({ x: d.x + t.x, y: d.y + t.y });
      });
    });
    if (!shafts.length) return;

    // Try each of the coupling's own mech ports: snap it so that port lands
    // exactly on the closest shaft. First match wins.
    const ports = reg.layout.terms.filter((t) => t.mech);
    for (const p of ports) {
      const px = entry.x + p.x;
      const py = entry.y + p.y;

      // Index, not an object reference. TypeScript's control-flow analysis
      // does not track a `let` assigned inside a forEach callback, so it
      // narrows the variable to `never` at the use site below and refuses the
      // property access. A plain index sidesteps that entirely.
      let bestIdx = -1;
      let bestD = SNAP;
      for (let i = 0; i < shafts.length; i++) {
        const d = Math.hypot(shafts[i].x - px, shafts[i].y - py);
        if (d < bestD) { bestD = d; bestIdx = i; }
      }

      if (bestIdx >= 0) {
        const best = shafts[bestIdx];
        entry.x = best.x - p.x;
        entry.y = best.y - p.y;
        const el = this.world.querySelector('.device[data-id="' + entry.id + '"]') as HTMLElement | null;
        if (el) { el.style.left = entry.x + 'px'; el.style.top = entry.y + 'px'; }
        this.wiring.render();
        this._toast('Coupling snapped to shaft', 'ok');
        return;
      }
    }
  }

  /* ═════════════ selection ═════════════ */

  selectDevice(id: string | null): void {
    if (this.selectedId) {
      const prev = this.world.querySelector('.device[data-id="' + this.selectedId + '"]');
      if (prev) prev.classList.remove('selected');
    }
    this.selectedId = id;
    if (id) {
      const el = this.world.querySelector('.device[data-id="' + id + '"]');
      if (el) el.classList.add('selected');
    }
  }

  deselectAll(): void {
    this.selectDevice(null);
  }

  /* ═════════════ undo ═════════════ */

  private _pushUndo(action: UndoAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.UNDO_MAX) this.undoStack.shift();
  }

  undo(): void {
    const action = this.undoStack.pop();
    if (!action) { this._toast('Nothing to undo', ''); return; }

    if (action.type === 'deleteDevice') {
      const d = action.data;
      const entry = this.place(d.kind, d.x, d.y);
      if (!entry) return;

      // Restore the original id so the wires reconnect to the right device.
      // The netlist is keyed by id, so a fresh id would leave every saved wire
      // pointing at a device that no longer exists.
      this.netlist.removeDevice(entry.id);
      entry.id = d.id;
      entry.model.id = d.id;
      this.netlist.addDevice(entry.model);

      const el = this.world.querySelector('.device[data-id="' + entry.id + '"]') as HTMLElement | null;
      if (el) el.dataset.id = d.id;

      // Re-add only wires whose OTHER end still exists.
      //
      // The undo record was snapshotted when the device was deleted. Between
      // then and the Ctrl+Z, the opposite device may itself have been removed
      // (or the bench cleared), and re-adding such a wire resurrects a
      // dangling connection pointing at an id no longer in `this.devices`.
      // That is what produced ghost wires like `_5` -> `_6` in saved files:
      // a floating node the solver then warns about, rendered to a terminal
      // that does not exist. Check both ends against the live device list.
      if (d.wires && d.wires.length) {
        const live = new Set(this.devices.map((dev) => dev.id));
        live.add(d.id); // the device we just re-placed
        d.wires.forEach((w) => {
          if (live.has(w.aDev) && live.has(w.bDev)) {
            this.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
          }
        });
      }
      this._renderMeters();
      this._sync();
      this._toast('Undone \u00b7 device restored', 'ok');

    } else if (action.type === 'deleteWire') {
      const w = action.data;
      this.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
      this._toast('Undone \u00b7 wire restored', 'ok');

    } else if (action.type === 'clearAll') {
      // Bulk restore is not supported - there is no snapshot to restore from,
      // only the per-action records above. Say so plainly rather than appear
      // to work and silently do nothing.
      this._toast('Full undo not supported for clear-all', 'warn');
    }
  }

  /* ═════════════ context menu ═════════════ */

  private _bindContextMenu(): void {
    this.surface.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      this._closeCtx();

      const target = e.target as HTMLElement;
      const devEl = target.closest('.device') as HTMLElement | null;
      const wireHit = target.closest('.wirehit') as HTMLElement | null;

      if (devEl) {
        this._showDeviceCtx(e.clientX, e.clientY, devEl.dataset.id as string);
      } else if (wireHit) {
        this._showWireCtx(e.clientX, e.clientY, wireHit.dataset.wid as string);
      } else {
        this._showBenchCtx(e.clientX, e.clientY);
      }
    });

    // Close on any left-click or scroll outside the menu.
    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (this._ctxEl && !this._ctxEl.contains(e.target as Node)) this._closeCtx();
    });
    // Same for touch: a tap anywhere off the menu dismisses it.
    document.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      if (this._ctxEl && !this._ctxEl.contains(e.target as Node)) this._closeCtx();
    });
    this.surface.addEventListener('wheel', () => this._closeCtx());

    /* Long-press, the touch equivalent of right-click.
     *
     * A phone has no button 2, so without this the whole context menu - delete
     * device, rotate, info - is unreachable on mobile. 500ms is the platform
     * convention; the 10px slop cancels it the moment the finger moves, so a
     * drag never pops a menu. */
    let lpTimer: number | null = null;
    let lpx = 0, lpy = 0;
    let lpFired = false;
    const cancelLongPress = (): void => {
      if (lpTimer !== null) { clearTimeout(lpTimer); lpTimer = null; }
    };

    this.surface.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      if ((e.target as HTMLElement).closest('.term')) return;  // wiring tap wins
      lpx = e.clientX; lpy = e.clientY;
      lpFired = false;
      cancelLongPress();
      lpTimer = window.setTimeout(() => {
        lpTimer = null;
        lpFired = true;
        const target = e.target as HTMLElement;
        const devEl = target.closest('.device') as HTMLElement | null;
        const wireHit = target.closest('.wirehit') as HTMLElement | null;
        if (devEl) this._showDeviceCtx(lpx, lpy, devEl.dataset.id as string);
        else if (wireHit) this._showWireCtx(lpx, lpy, wireHit.dataset.wid as string);
        else this._showBenchCtx(lpx, lpy);
      }, 500);
    });

    this.surface.addEventListener('pointermove', (e: PointerEvent) => {
      if (lpTimer === null) return;
      if (Math.abs(e.clientX - lpx) + Math.abs(e.clientY - lpy) > 10) cancelLongPress();
    });

    this.surface.addEventListener('pointerup', cancelLongPress);
    this.surface.addEventListener('pointercancel', cancelLongPress);

    /* Swallow the tap that ends a long-press.
     *
     * The first attempt set `_suppressClick = true` and cleared it on a
     * `setTimeout(0)` - but the timer fires during the 500ms hold, long before
     * the finger lifts, so the flag was already false when the click arrived
     * and the menu opened and closed in the same gesture. The flag has to
     * survive until the click it is suppressing has actually been dispatched,
     * so it is cleared here, in the capture-phase click that follows, and
     * cleared unconditionally so it can never get stuck on. */
    this.surface.addEventListener('click', (e: MouseEvent) => {
      if (!lpFired) return;
      lpFired = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  }

  private _closeCtx(): void {
    if (this._ctxEl) { this._ctxEl.remove(); this._ctxEl = null; }
  }

  private _createCtx(x: number, y: number, items: CtxItem[]): void {
    this._closeCtx();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';

    // Keep within viewport.
    const vw = window.innerWidth, vh = window.innerHeight;
    if (x + 200 > vw) x = vw - 210;
    if (y + items.length * 36 > vh) y = vh - items.length * 36 - 10;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    items.forEach((item) => {
      if ('sep' in item) {
        const sep = document.createElement('div');
        sep.className = 'ctx-sep';
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      if (item.danger) btn.className = 'danger';
      let html = '<i data-lucide="' + item.icon + '" class="lucide-icon xs"></i> ' + item.label;
      if (item.key) html += '<span class="ctx-key">' + item.key + '</span>';
      btn.innerHTML = html;
      btn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this._closeCtx();
        item.action();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    this._ctxEl = menu;
    refreshIcons();
  }

  private _showDeviceCtx(x: number, y: number, devId: string): void {
    this.selectDevice(devId);
    const entry = this.devices.find((d) => d.id === devId);
    if (!entry) return;
    const reg = EQUIPMENT[entry.kind];

    this._createCtx(x, y, [
      { icon: 'copy', label: 'Duplicate', key: 'Ctrl+D', action: () => this.duplicateDevice(devId) },
      { icon: 'info', label: reg.label + ' \u00b7 ' + reg.model, action: () => this._showDeviceInfo(devId) },
      { sep: true },
      { icon: 'rotate-cw', label: 'Rotate 90\u00b0 Right', key: 'R', action: () => this.rotateDevice(devId, 90) },
      { icon: 'rotate-ccw', label: 'Rotate 90\u00b0 Left', action: () => this.rotateDevice(devId, -90) },
      { icon: 'undo-2', label: 'Reset Rotation', action: () => {
        const e2 = this.devices.find((d) => d.id === devId);
        if (!e2) return;
        const was = e2.rot || 0;
        e2.rot = 0;
        const el = this.world.querySelector('.device[data-id="' + devId + '"]') as HTMLElement | null;
        if (el) this._applyRotation(el, e2);
        this.wiring.render();
        if (was) this._toast('Rotation reset', '');
      } },
      { sep: true },
      { icon: 'trash-2', label: 'Delete Device', key: 'Del', danger: true, action: () => this.removeDeviceWithUndo(devId) }
    ]);
  }

  private _showWireCtx(x: number, y: number, wireId: string): void {
    this._createCtx(x, y, [
      { icon: 'trash-2', label: 'Delete Wire', danger: true, action: () => this.removeWireWithUndo(wireId) }
    ]);
  }

  private _showBenchCtx(x: number, y: number): void {
    const items: CtxItem[] = [
      { icon: 'maximize-2', label: 'Fit View', key: 'Dbl-click', action: () => this.fitView() },
      { icon: 'rotate-ccw', label: 'Reset Zoom', action: () => { this.view = { x: 0, y: 0, k: 1 }; this._applyView(); } }
    ];
    if (this.devices.length) {
      items.push({ sep: true });
      items.push({ icon: 'trash-2', label: 'Clear All Devices', danger: true, action: () => this.clearWithUndo() });
    }
    if (this.undoStack.length) {
      items.push({ sep: true });
      items.push({ icon: 'undo-2', label: 'Undo', key: 'Ctrl+Z', action: () => this.undo() });
    }
    this._createCtx(x, y, items);
  }

  /* ═════════════ keyboard ═════════════ */

  private _bindKeyboard(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const labEl = document.getElementById('lab');
      if (!labEl || labEl.classList.contains('hidden')) return;

      const inField = !!(e.target as HTMLElement).closest('input, textarea');

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedId && !inField) {
          e.preventDefault();
          this.removeDeviceWithUndo(this.selectedId);
        }
      } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        if (this.selectedId) {
          e.preventDefault();
          this.duplicateDevice(this.selectedId);
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.undo();
      } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        // Rotate the selection a quarter turn. Shift+R goes the other way, so
        // you can back out of an overshoot without three more presses.
        if (this.selectedId && !inField) {
          e.preventDefault();
          this.rotateDevice(this.selectedId, e.shiftKey ? -90 : 90);
        }
      } else if (e.key === 'Escape') {
        this._closeCtx();
        this.deselectAll();
        this.wiring._clearPending();
      }
    });
  }

  /* ═════════════ device operations with undo ═════════════ */

  removeDeviceWithUndo(id: string): void {
    const entry = this.devices.find((d) => d.id === id);
    if (!entry) return;

    // Snapshot wires connected to this device for undo.
    const connectedWires = this.wiring.wires
      .filter((w) => w.aDev === id || w.bDev === id)
      .map((w) => ({ aDev: w.aDev, aTerm: w.aTerm, bDev: w.bDev, bTerm: w.bTerm }));

    this._pushUndo({
      type: 'deleteDevice',
      data: { id: entry.id, kind: entry.kind, x: entry.x, y: entry.y, wires: connectedWires }
    });

    this.removeDevice(id);
    this.deselectAll();
    this._toast('Device removed \u00b7 Ctrl+Z to undo', '');
  }

  removeWireWithUndo(wireId: string): void {
    const w = this.wiring.wires.find((wire) => wire.id === wireId);
    if (!w) return;
    this._pushUndo({
      type: 'deleteWire',
      data: { aDev: w.aDev, aTerm: w.aTerm, bDev: w.bDev, bTerm: w.bTerm }
    });
    this.wiring.remove(wireId);
    this._toast('Wire removed \u00b7 Ctrl+Z to undo', '');
  }

  clearWithUndo(): void {
    if (!this.devices.length) return;
    this._pushUndo({ type: 'clearAll', data: null });
    this.clear();
    this._toast('Bench cleared', '');
  }

  duplicateDevice(id: string): void {
    const entry = this.devices.find((d) => d.id === id);
    if (!entry) return;
    const ne = this.place(entry.kind, entry.x + 40, entry.y + 40);
    if (ne) {
      this.selectDevice(ne.id);
      this._toast('Duplicated \u00b7 ' + EQUIPMENT[entry.kind].label, 'ok');
    }
  }

  private _showDeviceInfo(id: string): void {
    const entry = this.devices.find((d) => d.id === id);
    if (!entry) return;
    const reg = EQUIPMENT[entry.kind];
    const th = (entry.model as Device & { thermal?: { T: number; dead: boolean } }).thermal;
    let info = reg.label + ' (' + reg.model + ')';
    if (th) {
      info += ' \u00b7 T=' + th.T.toFixed(1) + '\u00b0C';
      if (th.dead) info += ' \u00b7 BURNT';
    }
    this._toast(info, th && th.dead ? 'err' : '');
  }

  /* ═════════════ tooltip on hover ═════════════ */

  private _bindTooltip(): void {
    /* Hover tooltips are meaningless on touch, and worse than useless: a tap
     * fires `mouseover` but no dependable `mouseout`, so the tooltip sticks
     * to the screen until something else is tapped. Skip the whole binding
     * where the primary pointer cannot hover. */
    if (window.matchMedia('(hover: none)').matches) return;

    this.surface.addEventListener('mouseover', (e: MouseEvent) => {
      const devEl = (e.target as HTMLElement).closest('.device') as HTMLElement | null;
      if (!devEl) { this._hideTooltip(); return; }
      const id = devEl.dataset.id as string;
      const entry = this.devices.find((d) => d.id === id);
      if (!entry) return;
      const reg = EQUIPMENT[entry.kind];
      const th = (entry.model as Device & { thermal?: { T: number; dead: boolean } }).thermal;
      let html = '<strong>' + reg.label + '</strong> \u00b7 ' + reg.model;
      if (th) {
        html += ' \u00b7 ' + th.T.toFixed(0) + '\u00b0C';
        if (th.dead) html += ' <span class="tt-dead">BURNT</span>';
      }
      this._showTooltip(html, e.clientX, e.clientY);
    });
    this.surface.addEventListener('mousemove', (e: MouseEvent) => {
      if (this._tooltipEl) {
        this._tooltipEl.style.left = (e.clientX + 14) + 'px';
        this._tooltipEl.style.top = (e.clientY + 14) + 'px';
      }
    });
    this.surface.addEventListener('mouseout', (e: MouseEvent) => {
      const rel = e.relatedTarget as HTMLElement | null;
      if (!rel || !rel.closest || !rel.closest('.device')) this._hideTooltip();
    });
  }

  private _showTooltip(html: string, x: number, y: number): void {
    this._hideTooltip();
    const el = document.createElement('div');
    el.className = 'dev-tooltip';
    el.innerHTML = html;
    el.style.left = (x + 14) + 'px';
    el.style.top = (y + 14) + 'px';
    document.body.appendChild(el);
    this._tooltipEl = el;
  }

  private _hideTooltip(): void {
    if (this._tooltipEl) { this._tooltipEl.remove(); this._tooltipEl = null; }
  }

  /* ═════════════ wire hover highlight ═════════════ */

  private _bindWireHover(): void {
    const wl = this.wireLayer as HTMLElement;
    wl.style.pointerEvents = 'auto';

    const highlight = (hit: HTMLElement, on: boolean): void => {
      const hits = Array.from(wl.querySelectorAll('.wirehit'));
      const idx = hits.indexOf(hit);
      const segs = Array.from(wl.querySelectorAll('.wireseg'));
      if (segs[idx]) segs[idx].classList.toggle('hovered', on);
    };

    wl.addEventListener('mouseover', (e: MouseEvent) => {
      const hit = (e.target as HTMLElement).closest('.wirehit') as HTMLElement | null;
      if (hit) highlight(hit, true);
    });
    wl.addEventListener('mouseout', (e: MouseEvent) => {
      const hit = (e.target as HTMLElement).closest('.wirehit') as HTMLElement | null;
      if (hit) highlight(hit, false);
    });
  }

  /* ═════════════ run loop ═════════════ */

  start(): void {
    if (this.running) return;
    if (!this.devices.length) { this._toast('Nothing on the bench', 'err'); return; }
    this.running = true;
    this.lastT = performance.now();
    this._loop();
    this._toast('Energised \u2014 solver running', 'ok');
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    // Drop every supply so a stopped bench is genuinely dead, not holding a
    // rail live behind the user's back.
    this.devices.forEach((d) => {
      const m = d.model as Device & { type?: string; enabled?: boolean };
      if (m.type === 'dc_supply') m.enabled = false;
    });
    // Re-solve once with every supply dead, so the panel actually drops to
    // zero. Stopping used to leave the last live numbers frozen on the LCDs,
    // which reads as a bench that is still energised.
    this._resettle();
  }

  /** True while the last step reported a rank-deficient matrix. */
  private _wasSingular = false;

  private _loop(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => this._loop());

    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;          // clamp after a tab switch
    if (dt <= 0) dt = 1 / 60;
    this._animDt = dt;

    try {
      // Energise supplies before stepping. The supply model boots with every
      // rail off behind an open isolator, so a preset is otherwise a
      // correctly-wired dead bench.
      //
      // ONLY `enabled`. Do not force `master` here: `master` is the isolator
      // toggle and the user owns it. Stomping it every frame made the panel
      // switch dead — the user flipped the isolator off and the loop silently
      // flipped it back on, so nothing could be turned off or changed.
      this.devices.forEach((d) => {
        const m = d.model as Device & { type?: string; enabled?: boolean };
        if (m.type === 'dc_supply') m.enabled = true;
      });

      // Re-check for a bolted fault every frame, not just on wire changes:
      // the user may wire DC+ to DC- first and only then switch the rail on,
      // in which case no _sync() fires after the rail goes live. This is a
      // net lookup per supply — trivial, and it is the only path that can
      // see a short the solver is blind to.
      this._detectBoltedFaults();

      const sol = this.sim.step(dt);

      // The solver found a rank-deficient matrix: a floating node, not a
      // crash. Say so on the EDGE - once when it starts, once when it clears.
      // Toasting every frame meant the message re-armed its own 2.4 s timer
      // forever and never went away, which is worse than saying nothing.
      if (sol.singular !== this._wasSingular) {
        this._wasSingular = sol.singular;
        this._toast(
          sol.singular
            ? 'Bench has a floating node \u2014 check wiring'
            : 'Wiring OK \u2014 floating node cleared',
          sol.singular ? 'warn' : 'ok'
        );
      }
    } catch (e) {
      console.error('sim error', e);
      this._toast('Solver error: ' + (e as Error).message, 'err');
      this.stop();
      return;
    }

    this._renderMeters();
    this._updateSpriteReadouts();
    this._renderSmoke();
  }

  /* ═════════════ live on-sprite readouts ═════════════ */

  /**
   * Write every device's current readings into its own SVG.
   *
   * The values come from the simulator's per-step snapshot rather than from
   * calling `model.readouts()` here. That is not just a speed thing: the
   * snapshot is taken once at the end of `step()`, so the sidebar, the sprite
   * LCD and anything else asking in the same frame all see the SAME numbers.
   */
  _updateSpriteReadouts(): void {
    this.devices.forEach((d) => {
      const el = this.world.querySelector('.device[data-id="' + d.id + '"]') as HTMLElement | null;
      if (!el) return;

      // Prefer the simulator snapshot (all consumers agree within a frame).
      // Fall back to the model's own readouts() when the bench is idle, so
      // solution-independent values like the rheostat's resistance still show
      // live even before the bench is energised.
      let ros = this.sim.readoutsFor(d.id);
      if (!ros.length && typeof d.model.readouts === 'function') {
        try { ros = d.model.readouts(); } catch { ros = []; }
      }
      const byName = new Map<string, Readout>();
      ros.forEach((r) => byName.set(r.name, r));

      el.querySelectorAll('[data-live]').forEach((node) => {
        const key = node.getAttribute('data-live') as string;
        const r = byName.get(key);
        // Blank the node when its readout is absent this frame. A three-line
        // display swaps its bindings when the mode changes (V shows
        // `d1:L1..L3`, A/W shows the single `d1`), so the nodes that are not
        // in the active set MUST be cleared - skipping them left the old
        // voltage sitting on screen after pressing A or W.
        if (!r) { (node as Element).textContent = ''; return; }
        const v = typeof r.value === 'number' ? formatReading(r.value) : r.value;
        (node as Element).textContent = String(v);
      });
      el.querySelectorAll('[data-live-unit]').forEach((node) => {
        const key = node.getAttribute('data-live-unit') as string;
        const r = byName.get(key);
        (node as Element).textContent = r ? (r.unit || '') : '';
      });

      // Slide each unit's wiper slider to match its model position (0..1).
      // The rheostat paints each handle at the TOP of its track; pos=0 keeps
      // it there and pos=1 sends it to the bottom, so R rises as it drops.
      // data-wiper="A" follows posA, data-wiper="B" follows posB.
      const rh = d.model as Device & { posA?: number; posB?: number };
      if (typeof rh.posA === 'number' || typeof rh.posB === 'number') {
        const track = 170; // viewBox units of travel (y=150..320)
        el.querySelectorAll('[data-wiper]').forEach((g) => {
          const which = (g as Element).getAttribute('data-wiper');
          const pos = which === 'B' ? rh.posB : rh.posA;
          if (typeof pos !== 'number') return;
          const dy = Math.max(0, Math.min(1, pos)) * track;
          (g as Element).setAttribute('transform', 'translate(0 ' + dy.toFixed(1) + ')');
        });
      }

      // Rotate any knob bound to a live control value.
      //
      // data-angle="<controlId>" marks a rotatable group. The control's range
      // (min..max on the .pctl-dial overlay) maps onto a 270-degree sweep
      // centred on straight-up, so min sits at -135deg and max at +135deg -
      // the travel a real single-turn knob has. The group's own centre is
      // parsed back out of its existing transform, which the sprite wrote as
      // `rotate(0 cx cy)`, so no extra data has to be attached to the node.
      el.querySelectorAll('[data-angle]').forEach((g) => {
        const key = (g as Element).getAttribute('data-angle') as string;
        const ctl = el.querySelector('.pctl-dial[data-ctl="' + key + '"]') as HTMLElement | null;
        if (!ctl) return;
        const min = Number(ctl.dataset.min || 0);
        const max = Number(ctl.dataset.max || 100);
        // Read the DEMAND from the model, not `dataset.value` and not the
        // live output.
        //
        //  · `dataset.value` is rewritten every frame by the reflection block
        //    below, so reading it here would snap the knob back the moment the
        //    user let go.
        //  · The live output (`V`) is gated on the rail being switched on, so
        //    on a stopped bench it is always 0 and the knob could never show
        //    where it was wound.
        // `set` is the winding itself - exactly what a variac knob's position
        // means - and it survives the rail being off, which is what a physical
        // knob does too.
        const railKey = key === 'vacV' ? 'vac' : key === 'vdcV' ? 'vdc' : null;
        const rail = railKey
          ? (d.model as Device & { rails?: Record<string, { set: number } | undefined> }).rails?.[railKey]
          : undefined;
        const val = rail && typeof rail.set === 'number' ? rail.set : Number(ctl.dataset.value || 0);
        const frac = max > min ? Math.max(0, Math.min(1, (val - min) / (max - min))) : 0;
        const deg = -135 + 270 * frac;
        // Read cx/cy from the existing transform so the pivot is the knob's
        // own centre, wherever the sprite placed it.
        const cur = (g as Element).getAttribute('transform') || '';
        const m = /rotate\(\s*[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s*\)/.exec(cur);
        const cx = m ? m[1] : '0';
        const cy = m ? m[2] : '0';
        (g as Element).setAttribute('transform', 'rotate(' + deg.toFixed(1) + ' ' + cx + ' ' + cy + ')');
      });

      // Indicator lamps: data-led="<readoutName>" lights when the readout is
      // truthy.
      //
      // `byName` is built from the SIMULATOR SNAPSHOT when the bench is
      // running, and that snapshot carries electrical readings only - it never
      // includes `model.readouts()`. A switch-state readout like `lineLive` is
      // therefore absent from `byName` on exactly the running bench where the
      // lamp matters. So the lamp is keyed off the model's own fields, which
      // are the same three flags the rails are gated on. That makes the lamp
      // agree with the hardware by construction instead of by coincidence.
      const lampModel = d.model as Device & { enabled?: boolean; master?: boolean; estop?: boolean };
      const lineLit = !!lampModel.enabled && !!lampModel.master && !lampModel.estop;
      el.querySelectorAll('[data-led]').forEach((node) => {
        const key = (node as Element).getAttribute('data-led') as string;
        let lit = false;
        // The sprite marks the LINE lamp with data-led="line". Match that
        // exact key - the readout is named `lineLive`, but the DOM marker is
        // `line`, and keying the handler off the readout name instead of the
        // marker left the lamp reading `byName.get('lineLive')`, finding
        // nothing on the snapshot, and painting dark forever.
        if (key === 'line') {
          lit = lineLit;
        } else {
          const r = byName.get(key);
          lit = !!(r && Number(r.value) >= 1);
        }
        (node as Element).setAttribute('fill', lit ? '#ff4d4d' : '#3a1a1a');
      });

      // Throw the AEG breaker handles. data-aeg="<controlId>" tags each pole;
      // the matching .pctl-toggle carries the on/off state. ON lifts the
      // handle by the travel the sprite baked into data-aeg-travel, OFF drops
      // it back to its base. This is what makes the switch read as a switch.
      el.querySelectorAll('[data-aeg]').forEach((g) => {
        const key = (g as Element).getAttribute('data-aeg') as string;
        const ctl = el.querySelector('.pctl-toggle[data-ctl="' + key + '"]') as HTMLElement | null;
        const on = !!ctl && ctl.classList.contains('on');
        const base = Number((g as Element).getAttribute('data-aeg-base') || 0);
        const travel = Number((g as Element).getAttribute('data-aeg-travel') || 0);
        const dy = on ? -travel : 0;
        (g as Element).setAttribute('transform', 'translate(0 ' + (base * 0 + dy).toFixed(1) + ')');
      });

      // Reflect panel control state back onto the overlays.
      const model = d.model as Device & {
        estop?: boolean;
        rails?: Record<string, { V: number; tripped: boolean; tap?: number; on?: boolean }>;
        channels?: Array<{ id: string; mode: string }>;
        omega?: number;
      };

      el.querySelectorAll('.pctl').forEach((ctl) => {
        const c = ctl as HTMLElement;
        const id = c.dataset.ctl as string;
        const rail = model.rails;

        if (id === 'vdcV' && rail) {
          c.dataset.value = String(rail.vdc ? rail.vdc.V : 0);
        } else if (id === 'vacV' && rail) {
          c.dataset.value = String(rail.vac ? rail.vac.V : 0);
        } else if (id === 'tap' && rail && rail.d24) {
          c.dataset.value = String(rail.d24.tap);
          c.textContent = String(rail.d24.tap);
        }

        // e-stop latches down; any tripped breaker lights the reset button.
        if (c.classList.contains('danger')) c.classList.toggle('latched', !!model.estop);
        if (id === 'reset' && rail) {
          const anyTrip = Object.keys(rail).some((k) => rail[k] && rail[k].tripped);
          c.classList.toggle('latched', anyTrip);
        }
      });

      // Reflect which mode each display is currently in.
      if (model.channels) {
        model.channels.forEach((c) => {
          el.querySelectorAll('.mbtn[data-disp="' + c.id + '"]').forEach((b) => {
            b.classList.toggle('active', (b as HTMLElement).dataset.mode === c.mode);
          });
        });
      }

      // Spin any rotor marked data-spin="1".
      //
      // The pivot is named in the sprite as transform-origin="x y" and is read
      // from there - it is the single source of truth for where the shaft is.
      // The transform function takes it as its rotation centre, and the CSS
      // transform-origin property is pinned to 0 0 in style.css. Only ONE of
      // those may resolve to the pivot: transform-origin is a presentation
      // attribute for the CSS property, so when both applied the rotation
      // composed about (2x, 2y) - a phantom point a thousand user units off
      // the panel. The mark orbited the bench instead of turning on its shaft.
      const spinners = el.querySelectorAll('[data-spin]');
      if (spinners.length) {
        const omega = typeof model.omega === 'number' ? Math.abs(model.omega) : 0;

        // Perceptual rate, not literal. See the tuning block above.
        const frac = Math.tanh(omega / OMEGA_REF); // 0..1
        const visOmega = OMEGA_VIS_MAX * frac;

        // Integrate by SECONDS, not frames. This is what makes a 144 Hz
        // screen show the same rotation as a 60 Hz one.
        d._spinAngle = (d._spinAngle || 0) + visOmega * this._animDt;
        if (!isFinite(d._spinAngle)) d._spinAngle = 0;
        // Wrap so a bench left running for an hour does not lose precision.
        d._spinAngle %= Math.PI * 2;
        const deg = (d._spinAngle * 180) / Math.PI;

        // Motion blur, converted out of the sprite's coordinate system.
        //
        // A blur radius is in USER UNITS, and the sprites draw on the reference
        // photo's pixel grid (896 wide for the 3-phase motor) scaled down into
        // the panel's 360 px box. Writing the screen-space number straight into
        // blur() understated it by the viewBox scale AND by the bench zoom: the
        // old blur(1.4px) landed at 0.56 screen px at 100% zoom and less as you
        // zoomed out, which is why a full-speed rotor showed no blur at all.
        // Convert explicitly, and quantise so the filter is not re-rasterised
        // for sub-pixel drift.
        const svgEl = el.querySelector('svg') as SVGSVGElement | null;
        const vbW = svgEl && svgEl.viewBox ? svgEl.viewBox.baseVal.width : 0;
        const userPerPx = vbW > 0 && d.w > 0 ? vbW / d.w : 1;
        const zoom = this.view.k > 0 ? this.view.k : 1;
        const blurPx = BLUR_MAX_PX * Math.max(0, (frac - 0.45) / 0.55);
        const blurUser = Math.round((blurPx * userPerPx) / zoom / 0.05) * 0.05;
        const blurAttr = blurUser >= 0.25 ? 'blur(' + blurUser.toFixed(2) + 'px)' : '';

        // A fast shaft reads as a swept disc: a little dimmer than a static
        // one, but not a ghost. The old -45% took a full-speed rotor down to
        // half opacity, so "spinning fast" looked like "fading out".
        const op = 1 - frac * 0.15;

        spinners.forEach((g) => {
          const ox = (g.getAttribute('transform-origin') || '0 0').trim().replace(/\s+/g, ' ');
          g.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' ' + ox + ')');
          const gs = (g as SVGElement).style;
          if (gs.filter !== blurAttr) gs.filter = blurAttr;
          gs.opacity = op < 0.995 ? op.toFixed(3) : '';
        });

        // Rumble: a running machine is never perfectly still. The period
        // shortens with speed, so idle is dead-still and full speed is a tight
        // buzz rather than a lazy sway.
        if (omega > OMEGA_RUNNING) {
          const dur = RUMBLE_SLOW - frac * (RUMBLE_SLOW - RUMBLE_FAST);
          el.style.setProperty('--rumble-dur', dur.toFixed(3) + 's');
          el.classList.add('rumble');
        } else {
          el.classList.remove('rumble');
        }
      }

      // Thermal tint. Between ambient and Tmax the casing warms up; past Tmax
      // the smoke and the flashing readouts take over, so this stays subtle.
      const th = (d.model as Device & { thermal?: { T: number; Tamb: number; Tmax: number } }).thermal;
      if (th && Number.isFinite(th.T)) {
        const span = th.Tmax - th.Tamb;
        const heat = span > 0 ? Math.max(0, Math.min(1, (th.T - th.Tamb) / span)) : 0;
        if (heat > 0.04) {
          el.style.setProperty('--heat', heat.toFixed(3));
          el.classList.add('hot');
        } else {
          el.classList.remove('hot');
        }
      }

      // Flash any reading the model flagged as an overload, the way a real
      // meter blinks its OL indicator.
      el.querySelectorAll('[data-live]').forEach((node) => {
        const r = byName.get(node.getAttribute('data-live') as string);
        (node as Element).classList.toggle('live-warn', !!(r && r.warn));
      });
    });
  }

  /* ═════════════ meters panel ═════════════ */

  _renderMeters(): void {
    if (!this.devices.length) {
      this.meterList.innerHTML = '<p class="meter-empty">No devices on the bench yet.</p>';
      this._syncMeterOverflow();
      return;
    }

    let html = '';
    this.devices.forEach((d) => {
      const reg = EQUIPMENT[d.kind];
      const ros = this.sim.readoutsFor(d.id);
      const th = (d.model as Device & { thermal?: { dead: boolean } }).thermal;
      const dead = !!(th && th.dead);
      const dotColor = dead ? 'var(--red)' : (reg.color || 'var(--green)');

      html += '<div class="meter-card' + (dead ? ' dead' : '') + '">';
      html += '<div class="meter-card-head"><span class="mc-dot" style="background:' + dotColor + '"></span>' +
        reg.label + ' \u00b7 ' + reg.model +
        '<button class="mc-del" data-del="' + d.id + '" title="remove">' +
        '<i data-lucide="x" class="lucide-icon xs"></i></button></div>';
      html += '<div class="meter-card-body">';

      if (!ros.length) html += '<div class="meter-row"><span class="mr-k">no readouts</span></div>';
      ros.forEach((r) => {
        const v = typeof r.value === 'number' ? formatReading(r.value) : r.value;
        html += '<div class="meter-row"><span class="mr-k">' + (r.label || r.name) + '</span>';
        html += '<span class="mr-val-group"><span class="mr-v' + (r.warn ? ' warn' : '') + '">' + v +
          '</span><span class="mr-u">' + (r.unit || '') + '</span></span></div>';
      });

      html += '</div></div>';
    });

    this.meterList.innerHTML = html;
    refreshIcons();
    this._syncMeterOverflow();
  }

  /**
   * Toggle the fade hint on the sidebar when its list actually overflows.
   *
   * The list owns the scroll (see `.meter-list` in style.css); this only
   * decides whether to show the gradient that says "there is more below".
   * Without it the fade would sit over an empty gap on a two-device bench
   * and look like a rendering bug.
   */
  _syncMeterOverflow(): void {
    const el = this.meterList;
    // +1 absorbs sub-pixel rounding, so a list that is exactly full does not
    // flash a fade on and off every frame.
    const over = el.scrollHeight > el.clientHeight + 1;
    // The panel is the list's parent (`.lab-meters`), derived here rather
    // than taken as another dep — the list is already handed in, and the
    // parent is the only element the fade pseudo-class hangs off.
    el.parentElement?.classList.toggle('scrollable', over);
  }

  private _onMeterClick(e: MouseEvent): void {
    const del = (e.target as HTMLElement).closest('[data-del]') as HTMLElement | null;
    if (!del) return;
    this.removeDevice(del.dataset.del as string);
  }

  /** Remove a device and everything that referenced it. No undo record. */
  removeDevice(id: string): void {
    const entry = this.devices.find((d) => d.id === id);
    if (!entry) return;

    const el = this.world.querySelector('.device[data-id="' + id + '"]') as HTMLElement | null;
    if (el) el.remove();

    this.netlist.removeDevice(id);
    this.wiring.removeDevice(id);
    this.devices = this.devices.filter((d) => d.id !== id);
    this._renderMeters();
    this._sync();
  }

  /* ═════════════ status / sync / smoke ═════════════ */

  /**
   * Detect a bolted fault — a supply whose own output terminals have been
   * wired together.
   *
   * This CANNOT be detected in the solver. `collectSources()` resolves a
   * supply's `pos` and `neg` to nets, and when a wire unions them the two
   * nets are identical, so it skips the source entirely (`if (p === q)
   * continue`). No source stamped means no current, which means fold-back
   * never sees a short and the burst branch is unreachable. A dead short is
   * DEFINED by `p === q`, so the solver is structurally blind to it.
   *
   * The fault has to be caught here, on the topology, where the wiring is
   * still visible. A supply whose `pos` and `neg` land on the same net while
   * the rail is live is a bolted fault: mark the rail exploded, kill the
   * thermal, and let the smoke/burst renderer take it from there.
   *
   * Runs only on topology change (`_sync`), so it costs nothing per frame.
   */
  private _detectBoltedFaults(): void {
    const netOf = (id: string, term: string) => this.netlist.netOf(id, term);

    // Each rail's own output pair, as stamped by `refreshRails()`. The main
    // variable-DC source is not an aux line, so it is listed here explicitly
    // alongside the aux rails. Every entry is a source whose two terminals
    // being unioned means a bolted fault across THAT rail.
    const RAIL_PAIRS: Array<{ key: string; pos: string; neg: string; label: string }> = [
      { key: 'vdc', pos: 'DC+',    neg: 'DC-',    label: 'Variable DC' },
      { key: 'vac', pos: 'AC-L1',  neg: 'AC-N',  label: 'Variable AC' },
      { key: 'f3p', pos: '3P-L1',  neg: '3P-PE', label: 'Fixed 3φ 400 V' },
      { key: 'd24', pos: 'DC+24',  neg: 'DC-24', label: 'Fixed 6/12/24 V' },
      { key: 'd50', pos: 'DC+50',  neg: 'DC-50', label: 'Fixed 50 V' }
    ];

    for (const d of this.devices) {
      const m = d.model as Device & {
        type?: string;
        rails?: Record<string, { on: boolean; tripped: boolean; exploded: boolean; V: number; Imax: number }>;
        warn?: string;
        smoke?: number;
      };
      if (m.type !== 'dc_supply' || !m.rails) continue;

      for (const pair of RAIL_PAIRS) {
        const r = m.rails[pair.key];
        if (!r || r.exploded) continue;

        // Live and commanded above a token voltage. An off/tripped/zero rail
        // is not a fault.
        if (!r.on || r.tripped || r.V <= 0.5) continue;

        const p = netOf(d.id, pair.pos);
        const q = netOf(d.id, pair.neg);
        // Same net = a wire bridges this rail's own output. That is the
        // bolted fault the solver cannot see.
        if (p === undefined || q === undefined || p !== q) continue;

        r.exploded = true;
        r.tripped = true;
        r.on = false;
        m.smoke = 1;
        m.warn = pair.label + ' EXPLODED — output shorted (bolted fault)';
      }
    }
  }

  /**
   * Push the drawn wires into the netlist so the solver actually sees them.
   *
   * Wiring stores `{aDev, aTerm, bDev, bTerm}`; the netlist wants
   * `{id, a: "dev:term", b: "dev:term"}`. The netlist caches its computed
   * nets, so the cache is invalidated here too - without that the solver keeps
   * running the previous frame's topology forever.
   */
  _sync(): void {
    this.netlist.wires.clear();
    this.wiring.wires.forEach((w) => {
      const id = w.id;
      const a = w.aDev + ':' + w.aTerm;
      const b = w.bDev + ':' + w.bTerm;
      this.netlist.wires.set(id, { id, a, b });
    });
    this.netlist.invalidate();
    this._detectBoltedFaults();

    const n = this.devices.length;
    const w = this.wiring.wires.length;
    if (!n) {
      this._setStatus('Bench ready \u00b7 add equipment from the left', '');
      this.titleEl.textContent = 'Laboratory \u00b7 Empty Bench';
    } else {
      this._setStatus(
        n + ' device' + (n === 1 ? '' : 's') + ' \u00b7 ' +
        w + ' wire' + (w === 1 ? '' : 's'),
        ''
      );
    }

    const hint = document.getElementById('bench-hint');
    if (hint) hint.style.display = n ? 'none' : '';

    // Every topology change funnels through here, so this is the one place
    // that has to know about the dirty flag. Guarded by the hold counter so
    // a load or a clear can settle without marking itself unsaved.
    if (this._dirtyHold === 0) this._setDirty(true);

    this._resettle();
  }

  /**
   * Take a fresh snapshot and repaint, for when the bench is NOT running.
   *
   * The readout cache is a snapshot taken at the end of `step()`. While the
   * loop runs, a new snapshot lands every frame and a topology change shows
   * up on its own. While it is stopped NOTHING takes a snapshot - so pulling
   * a wire left the last live numbers frozen on every display, and a meter
   * with nothing on its jacks went on reading 249.4 V. `stop()` de-energised
   * the supplies but never re-solved, so the numbers even survived an
   * explicit Stop.
   */
  private _resettle(): void {
    if (this.running) return;   // the loop snapshots every frame
    if (!this.lastT) return;    // never energised - there is no stale reading
    try {
      this.sim.step(1 / 60);
    } catch {
      // A half-finished edit can be singular; the running loop reports that.
    }
    this._renderMeters();
    this._updateSpriteReadouts();
  }

  /** Set the dirty flag and notify, only when it actually changes. */
  private _setDirty(next: boolean): void {
    if (this.dirty === next) return;
    this.dirty = next;
    if (this.onDirtyChange) this.onDirtyChange(next);
  }

  /**
   * Declare the bench clean. Called by the shell after a successful save.
   *
   * Public because the save path lives in `app.ts` — the lab never saves
   * anything itself, it only knows whether what is on the bench matches what
   * was last written.
   */
  markClean(): void {
    this._setDirty(false);
  }

  /**
   * Run `fn` with dirty-marking suppressed, then mark the bench clean.
   *
   * This is the load/clear path: it rebuilds the surface through the same
   * `place()` and `_sync()` calls a user edit would use, and without the
   * hold every one of them would light the unsaved indicator on a bench that
   * is, by definition, exactly what was just read back.
   */
  withoutDirty(fn: () => void): void {
    this._dirtyHold += 1;
    try {
      fn();
    } finally {
      this._dirtyHold -= 1;
    }
    this._setDirty(false);
  }

  private _setStatus(text: string, cls: string): void {
    this.statusEl.textContent = text;
    this.statusEl.className = 'meter-foot' + (cls ? ' ' + cls : '');
  }

  /**
   * Overheat smoke.
   *
   * Built ONCE per smoking machine, then animated entirely by CSS. The old
   * version assigned `layer.innerHTML` on every frame, which recreated every
   * puff element 60 times a second - and replacing an element restarts its CSS
   * animation from the first keyframe, so the plumes were pinned at
   * scale(.6)/opacity(.5) for as long as the machine smoked. The smoke was not
   * slow, it was frozen solid.
   *
   * Reusing the group and writing only --smoke (density) and the group
   * transform is what lets the animation actually run. Both are compared
   * against the current value first, so a steady machine writes nothing.
   *
   * The group is keyed by device id, so three hot machines keep three
   * independent plumes and a removed device's plume is swept up next frame.
   */
  private _renderSmoke(): void {
    const layer = this.smokeLayer as HTMLElement;
    const want = new Set<string>();

    this.devices.forEach((d) => {
      // A burst fires ONCE, on the frame the flag flips. Checked BEFORE the
      // smoke early-return below: `smoke` may be 0 on a device that has only
      // just exploded (the supply stores its smoke on `model.smoke` and on
      // each rail's thermal, not on `model.thermal`), so gating the burst
      // behind a non-zero smoke level meant a fresh explosion rendered
      // nothing at all. The burst is its own signal and must not depend on
      // the plume's density.
      const ex = this._deviceExploded(d.model);
      if (ex && !layer.querySelector('[data-burst="' + d.id + '"]')) {
        this._spawnBurst(d);
      }

      const th = (d.model as Device & { thermal?: { smoke: number } }).thermal;
      const raw = th && Number.isFinite(th.smoke) ? th.smoke : 0;
      const level = Math.max(0, Math.min(1, raw));
      if (level <= 0.01) return;

      want.add(d.id);
      let g = layer.querySelector('[data-smoke="' + d.id + '"]') as SVGGElement | null;

      if (!g) {
        const NS = 'http://www.w3.org/2000/svg';
        g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'smoke-group');
        g.setAttribute('data-smoke', d.id);

        // Six puffs with deliberately unequal drift, size, period and phase.
        // Evenly spaced puffs of equal size read as a row of circles, not as
        // smoke. dx/dur/size/delay are the only free parameters; the vertical
        // rise is derived from dx so a puff that drifts far also rises far.
        const PUFFS: Array<[number, number, number, number]> = [
          [-6, 2.9, 7, 0.00],
          [4, 2.4, 9, 0.45],
          [-1, 3.3, 6, 0.90],
          [8, 2.7, 10, 1.35],
          [-9, 3.6, 8, 1.80],
          [2, 3.0, 5, 2.25]
        ];
        // `g` is re-bound below the forEach, and TypeScript drops a narrowing
        // across a closure boundary for a `let`. Hold the built group in a
        // const so the narrowing survives into the loop.
        const group = g;
        PUFFS.forEach(([dx, dur, size, delay]) => {
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('class', 'smoke-puff');
          c.setAttribute('r', String(size));
          c.style.setProperty('--dx', dx + 'px');
          c.style.setProperty('--dy', (-46 - Math.abs(dx) * 5) + 'px');
          c.style.setProperty('--dur', dur + 's');
          c.style.setProperty('--delay', delay + 's');
          group.appendChild(c);
        });
        layer.appendChild(group);
      }

      // Position and density: the only things that change per frame.
      const next = 'translate(' + (d.x + d.w / 2).toFixed(1) + ' ' + (d.y + 18).toFixed(1) + ')';
      if (g.getAttribute('transform') !== next) g.setAttribute('transform', next);
      const lvl = level.toFixed(2);
      if (g.style.getPropertyValue('--smoke') !== lvl) g.style.setProperty('--smoke', lvl);
    });

    // Sweep up plumes whose machine stopped smoking or left the bench.
    layer.querySelectorAll('[data-smoke]').forEach((n) => {
      const id = n.getAttribute('data-smoke') as string;
      if (!want.has(id)) n.remove();
    });

    // Bursts are permanent while the device is on the bench — a wreck does
    // not clean itself up. Only a removed device takes its debris with it.
    const live = new Set(this.devices.map((d) => d.id));
    layer.querySelectorAll('[data-burst]').forEach((n) => {
      const id = n.getAttribute('data-burst') as string;
      if (!live.has(id)) n.remove();
    });
  }

  /**
   * One-shot burst: a white-hot flash, a ring, and debris shards.
   *
   * Built on the frame the supply reports `exploded`, then left alone. All
   * motion is CSS keyframe; the only JS is the initial DOM. The stage gets a
   * short shake via a class that removes itself on animationend.
   */
  private _spawnBurst(d: { id: string; x: number; y: number; w: number; h: number }): void {
    const NS = 'http://www.w3.org/2000/svg';
    const layer = this.smokeLayer as HTMLElement;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'burst-group');
    g.setAttribute('data-burst', d.id);
    g.setAttribute('transform', 'translate(' + (d.x + d.w / 2).toFixed(1) + ' ' + (d.y + d.h / 2).toFixed(1) + ')');

    // Flash disc.
    const flash = document.createElementNS(NS, 'circle');
    flash.setAttribute('class', 'burst-flash');
    flash.setAttribute('r', '18');
    g.appendChild(flash);

    // Expanding shock ring.
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('class', 'burst-ring');
    ring.setAttribute('r', '10');
    g.appendChild(ring);

    // Ten shards at uneven angles/radii — even spacing reads as a pattern.
    for (let i = 0; i < 10; i++) {
      const sh = document.createElementNS(NS, 'rect');
      sh.setAttribute('class', 'burst-shard');
      sh.setAttribute('width', '2.4');
      sh.setAttribute('height', '1.2');
      sh.style.setProperty('--ba', (i * 36 + (i % 3) * 11) + 'deg');
      sh.style.setProperty('--bd', (26 + (i % 4) * 9) + 'px');
      sh.style.setProperty('--bdel', ((i % 5) * 0.02) + 's');
      g.appendChild(sh);
    }

    layer.appendChild(g);

    const stage = document.querySelector('.lab-stage');
    if (stage) {
      stage.classList.remove('bench-shake');
      // Reflow so re-adding the class restarts the animation.
      void (stage as HTMLElement).offsetWidth;
      stage.classList.add('bench-shake');
      stage.addEventListener('animationend', () => stage.classList.remove('bench-shake'), { once: true });
    }

    if (this.toast) this._toast('💥 Short circuit — the rail is gone', 'err');
  }

  /**
   * Is this device currently in the exploded state?
   *
   * The flag lives in two places depending on device family: a supply exposes
   * a per-rail `exploded` (surfaced as a top-level boolean once any rail has
   * blown) and also mirrors it on `model.smoke`. Machines carry `thermal.dead`.
   * Check all of them so a burst is never missed because the renderer looked
   * at the wrong field.
   */
  private _deviceExploded(model: unknown): boolean {
    const m = model as {
      exploded?: boolean;
      thermal?: { dead?: boolean };
      rails?: Record<string, { exploded?: boolean }>;
    };
    if (m.exploded === true) return true;
    if (m.thermal && m.thermal.dead === true) return true;
    if (m.rails) {
      for (const r of Object.values(m.rails)) {
        if (r && r.exploded === true) return true;
      }
    }
    return false;
  }

  private _toastT: ReturnType<typeof setTimeout> | undefined;

  _toast(msg: string, cls: string): void {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.className = 'toast ' + (cls || '');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => {
      if (this.toast) this.toast.className = 'toast hidden ' + (cls || '');
    }, 2400);
  }

  /** Wire the meter-panel delete buttons. Called once by the boot code. */
  bindMeterPanel(): void {
    this.meterList.addEventListener('click', (e: MouseEvent) => this._onMeterClick(e));
    // The sidebar is pinned top/bottom on desktop and max-height on mobile,
    // so a window resize changes how much of the list is visible. Re-check
    // the fade hint when that happens.
    window.addEventListener('resize', () => this._syncMeterOverflow());
    this._syncMeterOverflow();
  }
}

/**
 * Format a reading for display.
 *
 * Three significant bands, not a fixed number of decimals: a 250 V rail and a
 * 0.088 A field current are both real numbers on this bench and neither reads
 * well at the other's precision. Small values keep three decimals because
 * that is where the interesting change happens.
 */
export function formatReading(v: number): string {
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
