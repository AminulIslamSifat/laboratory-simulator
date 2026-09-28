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
}

/** A preset bench: builds its devices and optionally energises them. */
export interface Preset {
  label: string;
  sub?: string;
  danger?: boolean;
  build: (lab: Lab) => void;
  setup?: (lab: Lab) => void;
}

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

  netlist: Netlist;
  sim: Simulator;
  devices: DeviceEntry[] = [];
  running = false;
  rafId: number | null = null;
  lastT = 0;
  smoke: unknown[] = [];

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
    this.stop();
    this._reset();
    this.wiring.clear();
    this.world.querySelectorAll('.device').forEach((n) => n.remove());
    this.titleEl.textContent = 'Laboratory \u00b7 Empty Bench';
    this._renderMeters();
    this._sync();
  }

  /* ═════════════ view: pan + zoom ═════════════ */

  _applyView(): void {
    this.world.style.transform =
      'translate(' + this.view.x + 'px,' + this.view.y + 'px) scale(' + this.view.k + ')';
  }

  private _bindView(): void {
    const surf = this.surface;
    let dragging = false;
    let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;

    surf.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.device')) return;  // device drag handles itself
      if (e.button === 2) return;                                // context menu
      if (e.button !== 0) return;
      this.deselectAll();
      dragging = true;
      moved = false;
      sx = e.clientX; sy = e.clientY;
      ox = this.view.x; oy = this.view.y;
      surf.classList.add('panning');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      this.view.x = ox + dx;
      this.view.y = oy + dy;
      this._applyView();
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      surf.classList.remove('panning');
      // Swallow the click that follows a pan so it does not clear a pending pick.
      this.wiring._suppressClick = moved;
      setTimeout(() => { this.wiring._suppressClick = false; }, 0);
      if (moved) surf.classList.add('panned');
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
    const wW = (maxX - minX) + pad * 2;
    const wH = (maxY - minY) + pad * 2;
    const k = Math.min(1.2, Math.min(vw / wW, vh / wH));
    this.view.k = k;
    this.view.x = (vw - (maxX - minX) * k) / 2 - minX * k;
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
        case 'rheostat':                 return new Rheostat({ id, tA: 'A_TOP', tB: 'A_BOT' });
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

  place(kind: string, x?: number, y?: number): DeviceEntry | null {
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
      rot: 0
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
      dot.style.left = (t.x - w / 2) + 'px';
      dot.style.top = (t.y - h / 2) + 'px';
      dot.title = t.k;
      el.appendChild(dot);
    });

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
      ctl.style.left = c.x + 'px';
      ctl.style.top = c.y + 'px';
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
    el.addEventListener('mousedown', (e: MouseEvent) => {
      const ctl = (e.target as HTMLElement).closest('.pctl-dial') as HTMLElement | null;
      if (!ctl) return;
      e.preventDefault();
      e.stopPropagation();

      const min = Number(ctl.dataset.min || 0);
      const max = Number(ctl.dataset.max || 100);
      let val = Number(ctl.dataset.value || 0);
      const sy = e.clientY;
      const sv = val;
      const k = this.view.k || 1;
      ctl.classList.add('winding');

      const move = (ev: MouseEvent): void => {
        const span = max - min;
        val = sv + ((sy - ev.clientY) / k) * (span / 200);
        val = Math.max(min, Math.min(max, val));
        val = Math.round(val * 10) / 10;
        ctl.dataset.value = String(val);
        push(ctl, val);
      };
      const up = (): void => {
        ctl.classList.remove('winding');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  /* ═════════════ drag ═════════════ */

  private _bindDrag(el: HTMLElement, entry: DeviceEntry): void {
    el.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.term')) return;
      if (target.closest('.mbtn')) return;
      if (target.closest('.pctl')) return;
      if (e.button === 2) return;   // context menu
      e.preventDefault();
      e.stopPropagation();

      this.selectDevice(entry.id);

      const k = this.view.k || 1;
      const sx = e.clientX, sy = e.clientY;
      const ox = entry.x, oy = entry.y;
      let moved = false;

      const move = (ev: MouseEvent): void => {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
        // Divide the screen delta by zoom so the device tracks the cursor at
        // any scale.
        entry.x = ox + (ev.clientX - sx) / k;
        entry.y = oy + (ev.clientY - sy) / k;
        el.style.left = entry.x + 'px';
        el.style.top = entry.y + 'px';
        this.wiring.render();
      };
      const up = (): void => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        if (moved) this._snapCoupling(entry);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
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

      if (d.wires && d.wires.length) {
        d.wires.forEach((w) => this.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm));
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
    this.surface.addEventListener('wheel', () => this._closeCtx());
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
    this._renderMeters();
    this._updateSpriteReadouts();
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

    try {
      // Energise supplies before stepping. The supply model boots with every
      // rail off behind an open isolator, so a preset is otherwise a
      // correctly-wired dead bench.
      this.devices.forEach((d) => {
        const m = d.model as Device & { type?: string; enabled?: boolean };
        if (m.type === 'dc_supply') m.enabled = true;
      });

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

      const ros = this.sim.readoutsFor(d.id);
      const byName = new Map<string, Readout>();
      ros.forEach((r) => byName.set(r.name, r));

      el.querySelectorAll('[data-live]').forEach((node) => {
        const key = node.getAttribute('data-live') as string;
        const r = byName.get(key);
        if (!r) return;
        const v = typeof r.value === 'number' ? formatReading(r.value) : r.value;
        (node as Element).textContent = String(v);
      });
      el.querySelectorAll('[data-live-unit]').forEach((node) => {
        const key = node.getAttribute('data-live-unit') as string;
        const r = byName.get(key);
        if (r) (node as Element).textContent = r.unit || '';
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

      // Spin any rotor marked data-spin="1". The group carries a
      // transform-origin in SVG coords, so we only supply the rotation.
      const spinners = el.querySelectorAll('[data-spin]');
      if (spinners.length) {
        const omega = typeof model.omega === 'number' ? model.omega : 0;
        // Accumulate angle so slow rotors still visibly turn.
        d._spinAngle = (d._spinAngle || 0) + omega * 0.05;
        if (!isFinite(d._spinAngle)) d._spinAngle = 0;
        const deg = ((d._spinAngle * 180) / Math.PI) % 360;
        spinners.forEach((g) => {
          const ox = g.getAttribute('transform-origin') || '0 0';
          g.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' ' + ox.replace(/\s+/g, ' ') + ')');
        });
      }
    });
  }

  /* ═════════════ meters panel ═════════════ */

  _renderMeters(): void {
    if (!this.devices.length) {
      this.meterList.innerHTML = '<p class="meter-empty">No devices on the bench yet.</p>';
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
  }

  private _setStatus(text: string, cls: string): void {
    this.statusEl.textContent = text;
    this.statusEl.className = 'meter-foot' + (cls ? ' ' + cls : '');
  }

  private _renderSmoke(): void {
    let s = '';
    this.devices.forEach((d) => {
      const th = (d.model as Device & { thermal?: { smoke: number } }).thermal;
      if (!th || !th.smoke) return;
      const cx = d.x + d.w / 2;
      const cy = d.y + 20;
      const n = Math.ceil(th.smoke * 5);
      for (let i = 0; i < n; i++) {
        const off = (i - n / 2) * 11;
        s += '<circle class="smoke-puff" cx="' + (cx + off) + '" cy="' + cy +
          '" r="' + (6 + i) + '" style="animation-delay:' + (i * 0.22) + 's"/>';
      }
    });
    (this.smokeLayer as HTMLElement).innerHTML = s;
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
