// EEE-2152 Lab · Laboratory environment controller
// Owns the bench, equipment placement, drag, palette, context menu, undo, and run loop.
(function (root) {
'use strict';
const EEE = root.EEE;

let _idc = 0;
function uid(p) { return p + '_' + (++_idc) + '_' + Math.random().toString(36).slice(2, 6); }

function Lab(deps) {
  this.surface   = deps.surface;      // clipped viewport
  this.world     = deps.world || deps.surface;  // transformed world
  this.wireLayer = deps.wireLayer;
  this.smokeLayer= deps.smokeLayer;
  this.palList   = deps.palList;
  this.palPresets= deps.palPresets;
  this.meterList = deps.meterList;
  this.statusEl  = deps.statusEl;
  this.titleEl   = deps.titleEl;
  this.toast     = deps.toast;

  this.netlist = null;
  this.devices = [];      // [{ id, kind, model (EEE device), x, y }]
  this.running = false;
  this.rafId = null;
  this.lastT = 0;
  this.smoke = [];

  // pan / zoom state
  this.view = { x: 0, y: 0, k: 1 };

  // selection & context menu state
  this.selectedId = null;
  this._ctxEl = null;
  this._tooltipEl = null;

  // undo stack: { type, data }
  this.undoStack = [];
  this.UNDO_MAX = 40;

  this.wiring = new EEE.Wiring({
    surface: this.surface,
    world: this.world,
    wireLayer: this.wireLayer,
    owner: this,
    onChange: this._sync.bind(this)
  });
  // wiring._syncMech() reads owner.devices to find a coupling's model and
  // stamp _mechA/_mechB. Set the reference directly so the two objects can
  // never drift apart.
  this.wiring.owner = this;

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
Lab.prototype._reset = function () {
  this.netlist = new EEE.Netlist();
  this.devices = [];
  this.smoke = [];
};

Lab.prototype.clear = function () {
  this.stop();
  this._reset();
  this.wiring.clear();
  this.world.querySelectorAll('.device').forEach(function (n) { n.remove(); });
  this.titleEl.textContent = 'Laboratory · Empty Bench';
  this._renderMeters();
  this._sync();
};

/* ═════════════ view: pan + zoom ═════════════ */
Lab.prototype._applyView = function () {
  this.world.style.transform =
    'translate(' + this.view.x + 'px,' + this.view.y + 'px) scale(' + this.view.k + ')';
};

Lab.prototype._bindView = function () {
  const self = this;
  const surf = this.surface;
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;

  surf.addEventListener('mousedown', function (e) {
    if (e.target.closest('.device')) return;   // device drag handles itself
    if (e.button === 2) return;                 // right-click handled by context menu
    if (e.button !== 0) return;
    // Deselect device when clicking empty space
    self.deselectAll();
    dragging = true; moved = false;
    sx = e.clientX; sy = e.clientY;
    ox = self.view.x; oy = self.view.y;
    surf.classList.add('panning');
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    self.view.x = ox + dx;
    self.view.y = oy + dy;
    self._applyView();
  });

  window.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    surf.classList.remove('panning');
    // swallow the click that follows a pan so it doesn't clear a pending pick
    self.wiring._suppressClick = moved;
    setTimeout(function () { self.wiring._suppressClick = false; }, 0);
    if (moved) surf.classList.add('panned');
  });

  // wheel zoom about cursor
  surf.addEventListener('wheel', function (e) {
    e.preventDefault();
    const rect = surf.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const old = self.view.k;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const k = Math.min(3.5, Math.max(0.25, old * factor));
    // keep the world point under the cursor fixed
    self.view.x = mx - (mx - self.view.x) * (k / old);
    self.view.y = my - (my - self.view.y) * (k / old);
    self.view.k = k;
    self._applyView();
    surf.classList.add('panned');
  }, { passive: false });

  // double-click empty space = fit all devices
  surf.addEventListener('dblclick', function (e) {
    if (e.target.closest('.device')) return;
    self.fitView();
  });
};

Lab.prototype.fitView = function () {
  if (!this.devices.length) {
    this.view = { x: 0, y: 0, k: 1 };
    this._applyView();
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  this.devices.forEach(function (d) {
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
};

/* ═════════════ equipment ═════════════ */
Lab.prototype._renderPalette = function () {
  const self = this;
  const reg = EEE.Sprites.EQUIPMENT;
  Object.keys(reg).forEach(function (kind) {
    const eq = reg[kind];
    const btn = document.createElement('button');
    btn.className = 'pal-item';
    btn.innerHTML = '<span class="pi-ico" style="color:' + eq.color + '"><i data-lucide="' + eq.icon + '" class="lucide-icon xs"></i></span>' +
      '<span class="pi-name">' + eq.label + '<span class="pi-sub">' + eq.model + '</span></span>';
    btn.addEventListener('click', function () { self.place(kind); });
    self.palList.appendChild(btn);
  });
  if (window.lucide) lucide.createIcons();
};

Lab.prototype._bindPalette = function () {
  const self = this;
  this.palPresets.addEventListener('click', function (e) {
    const b = e.target.closest('.pal-item');
    if (!b || !b.dataset.preset) return;
    self.loadPreset(b.dataset.preset);
  });
};

Lab.prototype.loadPreset = function (key) {
  const p = EEE.PRESETS && EEE.PRESETS[key];
  if (!p || !p.build) { this._toast('Preset not found: ' + key, 'err'); return; }
  this.stop();
  p.build(this);
  // build() places and wires the bench; setup() energises it. The supply
  // model boots with every rail OFF behind an open isolator, so without this
  // a preset is a correctly-wired dead bench — which is what every preset
  // was before the setup hook existed.
  if (typeof p.setup === 'function') {
    try { p.setup(this); } catch (e) { console.error('preset setup failed', key, e); }
  }
  this._renderMeters();
  this._sync();
  this.wiring.render();
  this._toast('Loaded · ' + p.label, 'ok');
};

Lab.prototype.loadPresetList = function (presets) {
  const self = this;
  this.palPresets.innerHTML = '';
  Object.keys(presets).forEach(function (key) {
    const p = presets[key];
    const btn = document.createElement('button');
    btn.className = 'pal-item preset' + (p.danger ? ' danger' : '');
    btn.dataset.preset = key;
    const ico = p.danger ? 'flame' : 'flask-conical';
    btn.innerHTML = '<span class="pi-ico"><i data-lucide="' + ico + '" class="lucide-icon xs"></i></span>' +
      '<span class="pi-name">' + p.label + '<span class="pi-sub">' + (p.sub || '') + '</span></span>';
    self.palPresets.appendChild(btn);
  });
  if (window.lucide) lucide.createIcons();
};

Lab.prototype.place = function (kind, x, y) {
  const reg = EEE.Sprites.EQUIPMENT[kind];
  if (!reg) return;

  // Fix stale header: update title when first device is placed
  if (this.devices.length === 0) {
    this.titleEl.textContent = 'Laboratory \u00b7 Custom Bench';
  }

  const id = uid(kind);
  const dev = this._newDevice(kind, id);
  if (!dev) return;

  // Align model terminals with the sprite's terminal set (they use printed
  // reference labels — 1..7, A1..D3, DC+/AC-L etc.). The netlist only ever
  // knows terminal names, so both sides must agree.
  dev.terminals = {};
  reg.layout.terms.forEach(function (t) { dev.terminals[t.k] = 1; });

  if (x == null) {
    const n = this.devices.length;
    x = 40 + (n % 4) * 260;
    y = 30 + Math.floor(n / 4) * 220;
  }
  const entry = {
    id: id,
    kind: kind,
    model: dev,
    x: x,
    y: y,
    w: reg.layout.w,
    h: reg.layout.h,
    // Rotation in degrees, clockwise: 0 / 90 / 180 / 270. Not an arbitrary
    // angle — the panel art is axis-aligned and a 37° motor just looks broken.
    // `w`/`h` stay the NATIVE (unrotated) size; the visual rotation is a CSS
    // transform and the wire layer compensates in pointOf().
    rot: 0
  };
  this.devices.push(entry);
  this.netlist.addDevice(dev);
  dev._labId = id;

  this._renderDevice(entry);
  this._sync();
  return entry;
};

Lab.prototype._newDevice = function (kind, id) {
  const D = EEE.Devices;
  try {
    if (kind === 'dc_machine')     return new D.DCMachine({ id: id });
    if (kind === 'async_motor_3p') return new D.Motor3P({ id: id });
    if (kind === 'async_motor_1p') return new D.Motor1P({ id: id });
    if (kind === 'sync_gen')       return new D.SyncGen({ id: id });
    if (kind === 'single_phase_transformer') return new D.Transformer({ id: id });
    if (kind === 'rheostat')       return new D.Rheostat({ id: id, tA: 'A_TOP', tB: 'A_BOT' });
    if (kind === 'power_supply')   return new D.DCSupply({ id: id, pos: 'DC+', neg: 'DC-' });
    if (kind === 'meter_rack')     return new D.MeterRack({ id: id });
    if (kind === 'load_bank')      return new D.LoadBank({ id: id });
    if (kind === 'coupling')       return new D.Coupling({ id: id });
    if (kind === 'meter')          return new D.Meter({ id: id, mode: 'V' });
  } catch (e) { console.error('device create failed', kind, e); }
  return null;
};

/* ═════════════ rendering ═════════════ */
Lab.prototype._renderDevice = function (entry) {
  const reg = EEE.Sprites.EQUIPMENT[entry.kind];
  const el = document.createElement('div');
  el.className = 'device';
  el.dataset.id = entry.id;
  el.style.left = entry.x + 'px';
  el.style.top  = entry.y + 'px';
  el.style.width = entry.w + 'px';
  el.style.height = entry.h + 'px';
  el.innerHTML = reg.sprite();

  // terminals as visible bubble connectors over the SVG
  // (labels are already printed inside the sprite SVG — no overlay needed)
  const self = this;
  reg.layout.terms.forEach(function (t) {
    const dot = document.createElement('div');
    dot.className = 'term' + (t.black ? ' black' : '') + (t.bank ? ' bank' : '') + (t.mech ? ' mech' : '');
    dot.dataset.term = t.k;
    // remember the intended CENTRE: banks are wider than they are tall, so
    // offsetLeft + width/2 alone would drift. pointOf() reads these.
    dot.dataset.cx = t.x;
    dot.dataset.cy = t.y;
    // Tight dots are for jacks painted close together on the panel art — a
    // 20px hitbox would overlap its neighbour and steal its clicks.
    // Mech ports are a big bolt: 24px so they are easy to grab.
    const w = t.mech ? 24 : (t.bank ? 16 : (t.tight ? 12 : 20));
    const h = t.mech ? 24 : (t.bank ? 9 : (t.tight ? 12 : 20));
    dot.style.left = (t.x - w / 2) + 'px';
    dot.style.top  = (t.y - h / 2) + 'px';
    dot.title = t.k;
    el.appendChild(dot);
  });

  // Meter-display mode switches. SVG can't take clicks reliably under the
  // world transform, so these are HTML overlays exactly like the terminals.
  (reg.layout.buttons || []).forEach(function (b) {
    const btn = document.createElement('button');
    btn.className = 'mbtn';
    btn.dataset.disp = b.d;
    btn.dataset.mode = b.m;
    btn.textContent = b.m;
    btn.title = b.m === 'V' ? 'read voltage' : b.m === 'A' ? 'read current' : 'read power';
    btn.style.left = (b.x - 7) + 'px';
    btn.style.top  = (b.y - 5) + 'px';
    el.appendChild(btn);
  });

  // Panel controls (switches, dials, selectors, push buttons). These are HTML
  // overlays for the same reason the terminals are: SVG geometry cannot take
  // clicks reliably once the world transform is applied on top of it, and a
  // dial needs pointer capture that SVG text/circle simply does not offer.
  // Each control routes through model.setControl(id, value) so the sprite
  // stays pure drawing and all panel logic lives in the device model.
  (reg.layout.controls || []).forEach(function (c) {
    const ctl = document.createElement('div');
    ctl.className = 'pctl pctl-' + c.type + (c.danger ? ' danger' : '') + (c.ok ? ' ok' : '');
    ctl.dataset.ctl = c.id;
    ctl.dataset.ctlType = c.type;
    if (c.min != null) { ctl.dataset.min = c.min; ctl.dataset.max = c.max; }
    if (c.options) ctl.dataset.options = c.options.join(',');
    if (c.unit) ctl.dataset.unit = c.unit;
    ctl.title = c.title || c.id;
    ctl.style.left = c.x + 'px';
    ctl.style.top  = c.y + 'px';
    el.appendChild(ctl);
  });

  el.addEventListener('click', function (e) {
    const b = e.target.closest('.mbtn');
    if (!b) return;
    e.stopPropagation();
    if (entry.model && entry.model.setDisplayMode) {
      entry.model.setDisplayMode(b.dataset.disp, b.dataset.mode);
      self._updateSpriteReadouts();
      self._renderMeters();
    }
  });

  this.world.appendChild(el);
  this._bindDrag(el, entry);
  this._bindControls(el, entry);
  this._applyRotation(el, entry);
  self._updateSpriteReadouts();
  return el;
};

/**
 * Apply a device's rotation as a CSS transform about its own centre.
 *
 * Rotating about the centre (not the top-left) is what keeps a device from
 * jumping sideways when you rotate it: the layout box keeps its native w x h
 * and its top-left stays put, so the centre is a fixed point and the panel
 * pivots in place.
 *
 * `data-rot` on the element is the single source of truth for the wire layer.
 * Wiring.pointOf() reads it back and rotates the terminal coordinate by the
 * same angle, which is what keeps wires attached to their jacks instead of to
 * where the jacks used to be.
 */
Lab.prototype._applyRotation = function (el, entry) {
  entry.rot = (((entry.rot || 0) % 360) + 360) % 360;
  el.dataset.rot = String(entry.rot);
  el.style.transformOrigin = '50% 50%';
  el.style.transform = entry.rot ? 'rotate(' + entry.rot + 'deg)' : '';
};

/** Rotate one device by `delta` degrees (default +90, clockwise). */
Lab.prototype.rotateDevice = function (devId, delta) {
  const entry = this.devices.find(function (d) { return d.id === devId; });
  if (!entry) return;

  const before = entry.rot || 0;
  entry.rot = (((before + (delta == null ? 90 : delta)) % 360) + 360) % 360;

  const el = this.world.querySelector('.device[data-id="' + devId + '"]');
  if (el) this._applyRotation(el, entry);

  // Wires are drawn in world space from pointOf(), so they have to be redrawn
  // the instant the terminal coordinates move. Forgetting this is what makes
  // a rotated device's wires hang in mid-air.
  this.wiring.render();
  this._toast('Rotated \u00b7 ' + entry.rot + '\u00b0', '');
};

/* ============ panel controls ============ */
// One delegated listener per device element. `toggle` and `button` fire on
// click; `select` cycles its option list; `dial` needs a press-and-drag so
// the pointer is captured on mousedown and released on the window.
Lab.prototype._bindControls = function (el, entry) {
  const self = this;

  function push(ctl, value) {
    if (!entry.model || typeof entry.model.setControl !== 'function') return;
    entry.model.setControl(ctl.dataset.ctl, value);
    self._updateSpriteReadouts();
    self._renderMeters();
  }

  el.addEventListener('click', function (e) {
    const ctl = e.target.closest('.pctl');
    if (!ctl) return;
    e.stopPropagation();
    const type = ctl.dataset.ctlType;
    if (type === 'toggle') {
      ctl.classList.toggle('on');
      push(ctl, ctl.classList.contains('on'));
    } else if (type === 'button') {
      ctl.classList.add('pressed');
      setTimeout(function () { ctl.classList.remove('pressed'); }, 160);
      push(ctl, true);
    } else if (type === 'select') {
      const opts = (ctl.dataset.options || '').split(',').map(Number);
      const cur = Number(ctl.dataset.value != null ? ctl.dataset.value : opts[0]);
      const idx = Math.max(0, opts.indexOf(cur));
      const next = opts[(idx + 1) % opts.length];
      ctl.dataset.value = next;
      ctl.dataset.label = next;
      push(ctl, next);
    }
  });

  // Dials: press and drag vertically to wind the variac. A vertical drag is
  // used rather than a rotational one because the panel is viewed top-down
  // and a knob has no unambiguous angle under a pan/zoom transform.
  el.addEventListener('mousedown', function (e) {
    const ctl = e.target.closest('.pctl-dial');
    if (!ctl) return;
    e.preventDefault();
    e.stopPropagation();
    const min = Number(ctl.dataset.min || 0);
    const max = Number(ctl.dataset.max || 100);
    let val = Number(ctl.dataset.value || 0);
    const sy = e.clientY;
    const sv = val;
    const k = self.view.k || 1;
    ctl.classList.add('winding');

    function move(ev) {
      const span = (max - min);
      val = sv + (sy - ev.clientY) / k * (span / 200);
      val = Math.max(min, Math.min(max, val));
      val = Math.round(val * 10) / 10;
      ctl.dataset.value = val;
      push(ctl, val);
    }
    function up() {
      ctl.classList.remove('winding');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
};


Lab.prototype._bindDrag = function (el, entry) {
  const self = this;
  el.addEventListener('mousedown', function (e) {
    if (e.target.closest('.term')) return;
    if (e.target.closest('.mbtn')) return;
    if (e.target.closest('.pctl')) return;
    if (e.button === 2) return; // right-click handled by context menu
    e.preventDefault();
    e.stopPropagation();

    // Select on click
    self.selectDevice(entry.id);

    const k = self.view.k || 1;
    const sx = e.clientX, sy = e.clientY;
    const ox = entry.x, oy = entry.y;
    let moved = false;
    function move(ev) {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
      // divide screen delta by zoom so the device tracks the cursor at any scale
      entry.x = ox + (ev.clientX - sx) / k;
      entry.y = oy + (ev.clientY - sy) / k;
      el.style.left = entry.x + 'px';
      el.style.top  = entry.y + 'px';
      self.wiring.render();
    }
    function up() {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (moved) self._snapCoupling(entry);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
};

/* ═════════════ coupling snap ═════════════ */
// A coupling is only useful if its ports meet a machine's shaft. Rather than
// ask the user to eyeball a 12px alignment, we look for the nearest SHAFT
// port within reach of each coupling port and translate the coupling so the
// two centres coincide. No rotation — couplings are drawn axis-aligned.
Lab.prototype._snapCoupling = function (entry) {
  const reg = EEE.Sprites.EQUIPMENT[entry.kind];
  if (!reg || entry.kind !== 'coupling') return;
  const SNAP = 90;   // how far a port may reach to find a shaft, in world px

  // Every SHAFT port currently on the bench, in world coords.
  const shafts = [];
  const self = this;
  this.devices.forEach(function (d) {
    if (d.id === entry.id) return;
    const r = EEE.Sprites.EQUIPMENT[d.kind];
    if (!r) return;
    r.layout.terms.forEach(function (t) {
      if (t.k !== 'SHAFT') return;
      shafts.push({ dev: d.id, x: d.x + t.x, y: d.y + t.y });
    });
  });
  if (!shafts.length) return;

  // Try each of the coupling's own mech ports: snap it so that port lands
  // exactly on the closest shaft. First match wins.
  const ports = reg.layout.terms.filter(function (t) { return t.mech; });
  for (let i = 0; i < ports.length; i++) {
    const p = ports[i];
    const px = entry.x + p.x, py = entry.y + p.y;
    let best = null, bestD = SNAP;
    shafts.forEach(function (s) {
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestD) { bestD = d; best = s; }
    });
    if (best) {
      entry.x = best.x - p.x;
      entry.y = best.y - p.y;
      const el = this.world.querySelector('.device[data-id="' + entry.id + '"]');
      if (el) { el.style.left = entry.x + 'px'; el.style.top = entry.y + 'px'; }
      this.wiring.render();
      this._toast('Coupling snapped to shaft', 'ok');
      return;
    }
  }
};

/* ═════════════ selection ═════════════ */
Lab.prototype.selectDevice = function (id) {
  // Deselect previous
  if (this.selectedId) {
    const prev = this.world.querySelector('.device[data-id="' + this.selectedId + '"]');
    if (prev) prev.classList.remove('selected');
  }
  this.selectedId = id;
  if (id) {
    const el = this.world.querySelector('.device[data-id="' + id + '"]');
    if (el) el.classList.add('selected');
  }
};

Lab.prototype.deselectAll = function () {
  this.selectDevice(null);
};

/* ═════════════ undo system ═════════════ */
Lab.prototype._pushUndo = function (action) {
  this.undoStack.push(action);
  if (this.undoStack.length > this.UNDO_MAX) this.undoStack.shift();
};

Lab.prototype.undo = function () {
  const action = this.undoStack.pop();
  if (!action) { this._toast('Nothing to undo', ''); return; }

  if (action.type === 'deleteDevice') {
    // Re-place the device
    const d = action.data;
    const entry = this.place(d.kind, d.x, d.y);
    if (entry) {
      // Restore original ID so wires reconnect
      this.netlist.removeDevice(entry.id);
      entry.id = d.id;
      entry.model.id = d.id;
      entry.model._labId = d.id;
      const el = this.world.querySelector('.device[data-id="' + entry.id + '"]');
      // We placed a new one, need to fix its data-id
      const newEl = this.world.querySelector('.device[data-id="' + entry.id + '"]');
      if (newEl) newEl.dataset.id = d.id;
      this.netlist.removeDevice(entry.id);
      this.netlist.addDevice(entry.model);
      // Restore wires
      if (d.wires && d.wires.length) {
        const self = this;
        d.wires.forEach(function (w) {
          self.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
        });
      }
      this._renderMeters();
      this._sync();
    }
    this._toast('Undone · device restored', 'ok');
  } else if (action.type === 'deleteWire') {
    const w = action.data;
    this.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
    this._toast('Undone · wire restored', 'ok');
  } else if (action.type === 'clearAll') {
    // Bulk restore — just reload from snapshot
    this._toast('Full undo not supported for clear-all', 'warn');
  }
};

/* ═════════════ context menu ═════════════ */
Lab.prototype._bindContextMenu = function () {
  const self = this;

  // Prevent default browser context menu on bench surface
  this.surface.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    self._closeCtx();

    const devEl = e.target.closest('.device');
    const wireHit = e.target.closest('.wirehit');

    if (devEl) {
      self._showDeviceCtx(e.clientX, e.clientY, devEl.dataset.id);
    } else if (wireHit) {
      self._showWireCtx(e.clientX, e.clientY, wireHit.dataset.wid);
    } else {
      self._showBenchCtx(e.clientX, e.clientY);
    }
  });

  // Close context menu on any left-click or scroll
  document.addEventListener('mousedown', function (e) {
    if (self._ctxEl && !self._ctxEl.contains(e.target)) {
      self._closeCtx();
    }
  });
  this.surface.addEventListener('wheel', function () { self._closeCtx(); });
};

Lab.prototype._closeCtx = function () {
  if (this._ctxEl) { this._ctxEl.remove(); this._ctxEl = null; }
};

Lab.prototype._createCtx = function (x, y, items) {
  this._closeCtx();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';

  // Keep within viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  if (x + 200 > vw) x = vw - 210;
  if (y + items.length * 36 > vh) y = vh - items.length * 36 - 10;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const self = this;
  items.forEach(function (item) {
    if (item.sep) {
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
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      self._closeCtx();
      item.action();
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  this._ctxEl = menu;
  if (window.lucide) lucide.createIcons();
};

Lab.prototype._showDeviceCtx = function (x, y, devId) {
  const self = this;
  this.selectDevice(devId);
  const entry = this.devices.find(function (d) { return d.id === devId; });
  if (!entry) return;
  const reg = EEE.Sprites.EQUIPMENT[entry.kind];

  this._createCtx(x, y, [
    { icon: 'copy', label: 'Duplicate', key: 'Ctrl+D', action: function () { self.duplicateDevice(devId); } },
    { icon: 'info', label: reg.label + ' · ' + reg.model, action: function () { self._showDeviceInfo(devId); } },
    { sep: true },
    { icon: 'rotate-cw', label: 'Rotate 90° Right', key: 'R', action: function () { self.rotateDevice(devId, 90); } },
    { icon: 'rotate-ccw', label: 'Rotate 90° Left', action: function () { self.rotateDevice(devId, -90); } },
    { icon: 'undo-2', label: 'Reset Rotation', action: function () {
      const e2 = self.devices.find(function (d) { return d.id === devId; });
      if (!e2) return;
      const was = e2.rot || 0;
      e2.rot = 0;
      const el = self.world.querySelector('.device[data-id="' + devId + '"]');
      if (el) self._applyRotation(el, e2);
      self.wiring.render();
      if (was) self._toast('Rotation reset', '');
    } },
    { sep: true },
    { icon: 'trash-2', label: 'Delete Device', key: 'Del', danger: true, action: function () { self.removeDeviceWithUndo(devId); } }
  ]);
};

Lab.prototype._showWireCtx = function (x, y, wireId) {
  const self = this;
  this._createCtx(x, y, [
    { icon: 'trash-2', label: 'Delete Wire', danger: true, action: function () { self.removeWireWithUndo(wireId); } }
  ]);
};

Lab.prototype._showBenchCtx = function (x, y) {
  const self = this;
  const items = [
    { icon: 'maximize-2', label: 'Fit View', key: 'Dbl-click', action: function () { self.fitView(); } },
    { icon: 'rotate-ccw', label: 'Reset Zoom', action: function () { self.view = { x: 0, y: 0, k: 1 }; self._applyView(); } }
  ];
  if (this.devices.length) {
    items.push({ sep: true });
    items.push({ icon: 'trash-2', label: 'Clear All Devices', danger: true, action: function () { self.clearWithUndo(); } });
  }
  if (this.undoStack.length) {
    items.push({ sep: true });
    items.push({ icon: 'undo-2', label: 'Undo', key: 'Ctrl+Z', action: function () { self.undo(); } });
  }
  this._createCtx(x, y, items);
};

/* ═════════════ keyboard shortcuts ═════════════ */
Lab.prototype._bindKeyboard = function () {
  const self = this;
  document.addEventListener('keydown', function (e) {
    // Only handle when lab is visible
    if (document.getElementById('lab').classList.contains('hidden')) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (self.selectedId && !e.target.closest('input, textarea')) {
        e.preventDefault();
        self.removeDeviceWithUndo(self.selectedId);
      }
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      if (self.selectedId) {
        e.preventDefault();
        self.duplicateDevice(self.selectedId);
      }
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      self.undo();
    } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
      // Rotate the selection a quarter turn. Shift+R goes the other way, so
      // you can back out of an overshoot without three more presses.
      if (self.selectedId && !e.target.closest('input, textarea')) {
        e.preventDefault();
        self.rotateDevice(self.selectedId, e.shiftKey ? -90 : 90);
      }
    } else if (e.key === 'Escape') {
      self._closeCtx();
      self.deselectAll();
      self.wiring._clearPending();
    }
  });
};

/* ═════════════ device operations with undo ═════════════ */
Lab.prototype.removeDeviceWithUndo = function (id) {
  const entry = this.devices.find(function (d) { return d.id === id; });
  if (!entry) return;

  // Snapshot wires connected to this device for undo
  const connectedWires = this.wiring.wires.filter(function (w) {
    return w.aDev === id || w.bDev === id;
  }).map(function (w) {
    return { aDev: w.aDev, aTerm: w.aTerm, bDev: w.bDev, bTerm: w.bTerm };
  });

  this._pushUndo({
    type: 'deleteDevice',
    data: { id: entry.id, kind: entry.kind, x: entry.x, y: entry.y, wires: connectedWires }
  });

  this.removeDevice(id);
  this.deselectAll();
  this._toast('Device removed · Ctrl+Z to undo', '');
};

Lab.prototype.removeWireWithUndo = function (wireId) {
  const w = this.wiring.wires.find(function (wire) { return wire.id === wireId; });
  if (!w) return;
  this._pushUndo({
    type: 'deleteWire',
    data: { aDev: w.aDev, aTerm: w.aTerm, bDev: w.bDev, bTerm: w.bTerm }
  });
  this.wiring.remove(wireId);
  this._toast('Wire removed · Ctrl+Z to undo', '');
};

Lab.prototype.clearWithUndo = function () {
  if (!this.devices.length) return;
  this._pushUndo({ type: 'clearAll', data: null });
  this.clear();
  this._toast('Bench cleared', '');
};

Lab.prototype.duplicateDevice = function (id) {
  const entry = this.devices.find(function (d) { return d.id === id; });
  if (!entry) return;
  const ne = this.place(entry.kind, entry.x + 40, entry.y + 40);
  if (ne) {
    this.selectDevice(ne.id);
    this._toast('Duplicated · ' + EEE.Sprites.EQUIPMENT[entry.kind].label, 'ok');
  }
};

Lab.prototype._showDeviceInfo = function (id) {
  const entry = this.devices.find(function (d) { return d.id === id; });
  if (!entry) return;
  const reg = EEE.Sprites.EQUIPMENT[entry.kind];
  const th = entry.model.thermal;
  let info = reg.label + ' (' + reg.model + ')';
  if (th) {
    info += ' · T=' + th.T.toFixed(1) + '°C';
    if (th.dead) info += ' · BURNT';
  }
  this._toast(info, th && th.dead ? 'err' : '');
};

/* ═════════════ tooltip on hover ═════════════ */
Lab.prototype._bindTooltip = function () {
  const self = this;
  this.surface.addEventListener('mouseover', function (e) {
    const devEl = e.target.closest('.device');
    if (!devEl) { self._hideTooltip(); return; }
    const id = devEl.dataset.id;
    const entry = self.devices.find(function (d) { return d.id === id; });
    if (!entry) return;
    const reg = EEE.Sprites.EQUIPMENT[entry.kind];
    const th = entry.model.thermal;
    let html = '<strong>' + reg.label + '</strong> · ' + reg.model;
    if (th) {
      html += ' · ' + th.T.toFixed(0) + '°C';
      if (th.dead) html += ' <span class="tt-dead">BURNT</span>';
    }
    self._showTooltip(html, e.clientX, e.clientY);
  });
  this.surface.addEventListener('mousemove', function (e) {
    if (self._tooltipEl) {
      self._tooltipEl.style.left = (e.clientX + 14) + 'px';
      self._tooltipEl.style.top = (e.clientY + 14) + 'px';
    }
  });
  this.surface.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.device')) {
      self._hideTooltip();
    }
  });
};

Lab.prototype._showTooltip = function (html, x, y) {
  this._hideTooltip();
  const el = document.createElement('div');
  el.className = 'dev-tooltip';
  el.innerHTML = html;
  el.style.left = (x + 14) + 'px';
  el.style.top = (y + 14) + 'px';
  document.body.appendChild(el);
  this._tooltipEl = el;
};

Lab.prototype._hideTooltip = function () {
  if (this._tooltipEl) { this._tooltipEl.remove(); this._tooltipEl = null; }
};

/* ═════════════ wire hover highlight ═════════════ */
Lab.prototype._bindWireHover = function () {
  const wl = this.wireLayer;
  wl.style.pointerEvents = 'auto';
  wl.addEventListener('mouseover', function (e) {
    const hit = e.target.closest('.wirehit');
    if (!hit) return;
    const wid = hit.dataset.wid;
    const seg = wl.querySelector('.wireseg[data-wc]');
    // Find corresponding visual wire (they're rendered in pairs)
    const hits = Array.from(wl.querySelectorAll('.wirehit'));
    const idx = hits.indexOf(hit);
    const segs = Array.from(wl.querySelectorAll('.wireseg'));
    if (segs[idx]) segs[idx].classList.add('hovered');
  });
  wl.addEventListener('mouseout', function (e) {
    const hit = e.target.closest('.wirehit');
    if (!hit) return;
    const hits = Array.from(wl.querySelectorAll('.wirehit'));
    const idx = hits.indexOf(hit);
    const segs = Array.from(wl.querySelectorAll('.wireseg'));
    if (segs[idx]) segs[idx].classList.remove('hovered');
  });
};

/* ═════════════ run loop ═════════════ */
Lab.prototype.start = function () {
  if (this.running) return;
  if (!this.devices.length) { this._toast('Nothing on the bench', 'err'); return; }
  this.running = true;
  this.lastT = performance.now();
  this._loop();
  this._toast('Energised — solver running', 'ok');
};

Lab.prototype.stop = function () {
  this.running = false;
  if (this.rafId) cancelAnimationFrame(this.rafId);
  this.rafId = null;
  // drop all supplies
  this.devices.forEach(function (d) {
    if (d.model.type === 'dc_supply') d.model.enabled = false;
  });
  this._renderMeters();
  this._updateSpriteReadouts();
};

Lab.prototype._loop = function () {
  const self = this;
  if (!this.running) return;
  this.rafId = requestAnimationFrame(function () { self._loop(); });
  const now = performance.now();
  let dt = (now - this.lastT) / 1000;
  this.lastT = now;
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) dt = 1 / 60;

  try {
    // energise supplies
    this.devices.forEach(function (d) {
      if (d.model.type === 'dc_supply') d.model.enabled = true;
    });
    EEE.simulate(this.netlist, dt);
  } catch (e) {
    console.error('sim error', e);
    this._toast('Solver error: ' + e.message, 'err');
    this.stop();
    return;
  }

  this._renderMeters();
  this._updateSpriteReadouts();
  this._renderSmoke();
};

/* ═════════════ live meter displays ═════════════ */
// Walk every device on the bench and push its current readouts into any
// SVG text node tagged data-live="<readout name>" — so the rack's own LCDs
// show the live value, not a painted constant.
Lab.prototype._updateSpriteReadouts = function () {
  const self = this;
  this.devices.forEach(function (d) {
    const el = self.world.querySelector('.device[data-id="' + d.id + '"]');
    if (!el) return;
    const liveEls = el.querySelectorAll('[data-live]');
    if (!liveEls.length) return;
    const ros = d.model.readouts ? d.model.readouts() : [];
    const byName = {};
    ros.forEach(function (r) { byName[r.name] = r; });
    liveEls.forEach(function (node) {
      const r = byName[node.getAttribute('data-live')];
      if (!r) { node.textContent = '--'; return; }
      const v = typeof r.value === 'number'
        ? (Math.abs(r.value) >= 100 ? r.value.toFixed(1) : Math.abs(r.value) >= 1 ? r.value.toFixed(2) : r.value.toFixed(3))
        : r.value;
      node.textContent = v;
      node.setAttribute('fill', r.warn ? '#c81010' : '#0a1a24');
    });
    // unit letter beside each LCD number
    el.querySelectorAll('[data-live-unit]').forEach(function (node) {
      const r = byName[node.getAttribute('data-live-unit')];
      node.textContent = (r && r.unit) ? r.unit : '';
    });
    // Reflect panel control state from the model. A click alone is not
    // enough: START clears the e-stop latch and RESET re-arms a breaker, and
    // the button has to follow. Driving this from model state means the
    // visual can never disagree with the physics.
    const rail = d.model.rails;
    el.querySelectorAll('.pctl').forEach(function (ctl) {
      const id = ctl.dataset.ctl;
      let on = null;
      if (id === 'master') on = !!d.model.master;
      else if (id === 'vdcOn' || id === 'vacOn' || id === 'f3pOn' || id === 'd24On' || id === 'd50On') {
        const key = id.replace('On', '');
        on = !!(rail && rail[key] && rail[key].on);
      } else if (id === 'tap' && rail) {
        ctl.dataset.value = rail.d24.tap;
        ctl.textContent = rail.d24.tap;
      }
      if (on !== null && ctl.dataset.ctlType === 'toggle') ctl.classList.toggle('on', on);

      // e-stop latches down; any tripped breaker lights the reset button
      if (ctl.classList.contains('danger')) ctl.classList.toggle('latched', !!d.model.estop);
      if (id === 'reset' && rail) {
        const anyTrip = Object.keys(rail).some(function (k) { return rail[k].tripped; });
        ctl.classList.toggle('latched', anyTrip);
      }
    });

    // reflect which mode each display is currently in
    if (d.model.channels) {
      d.model.channels.forEach(function (c) {
        el.querySelectorAll('.mbtn[data-disp="' + c.id + '"]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.mode === c.mode);
        });
      });
    }

    // Spin any rotor marked data-spin="1". The group carries a
    // transform-origin in SVG coords, so we only supply the rotation.
    const spinners = el.querySelectorAll('[data-spin]');
    if (spinners.length) {
      const omega = (typeof d.model.omega === 'number') ? d.model.omega : 0;
      // accumulate angle so slow rotors still visibly turn
      d._spinAngle = (d._spinAngle || 0) + omega * 0.05;
      if (!isFinite(d._spinAngle)) d._spinAngle = 0;
      const deg = (d._spinAngle * 180 / Math.PI) % 360;
      spinners.forEach(function (g) {
        const ox = g.getAttribute('transform-origin') || '0 0';
        g.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' ' + ox.replace(/\s+/g, ' ') + ')');
      });
    }
  });
};

/* ═════════════ meters panel ═════════════ */
Lab.prototype._renderMeters = function () {
  const self = this;
  if (!this.devices.length) {
    this.meterList.innerHTML = '<p class="meter-empty">No devices on the bench yet.</p>';
    return;
  }
  let html = '';
  this.devices.forEach(function (d) {
    const reg = EEE.Sprites.EQUIPMENT[d.kind];
    const ros = d.model.readouts ? d.model.readouts() : [];
    const dead = d.model.thermal && d.model.thermal.dead;
    const dotColor = dead ? 'var(--red)' : (reg.color || 'var(--green)');
    html += '<div class="meter-card' + (dead ? ' dead' : '') + '">';
    html += '<div class="meter-card-head"><span class="mc-dot" style="background:' + dotColor + '"></span>' + reg.label + ' · ' + reg.model;
    html += '<button class="mc-del" data-del="' + d.id + '" title="remove"><i data-lucide="x" class="lucide-icon xs"></i></button></div>';
    html += '<div class="meter-card-body">';
    if (!ros.length) html += '<div class="meter-row"><span class="mr-k">no readouts</span></div>';
    ros.forEach(function (r) {
      const v = typeof r.value === 'number'
        ? (Math.abs(r.value) >= 100 ? r.value.toFixed(1) : Math.abs(r.value) >= 1 ? r.value.toFixed(2) : r.value.toFixed(3))
        : r.value;
      html += '<div class="meter-row"><span class="mr-k">' + (r.label || r.name) + '</span>';
      html += '<span class="mr-val-group"><span class="mr-v' + (r.warn ? ' warn' : '') + '">' + v + '</span><span class="mr-u">' + (r.unit || '') + '</span></span></div>';
    });
    html += '</div></div>';
  });
  this.meterList.innerHTML = html;
  if (window.lucide) lucide.createIcons();
};

Lab.prototype._onMeterClick = function (e) {
  const del = e.target.closest('[data-del]');
  if (!del) return;
  this.removeDevice(del.dataset.del);
};

Lab.prototype.removeDevice = function (id) {
  const entry = this.devices.find(function (d) { return d.id === id; });
  if (!entry) return;
  const el = this.world.querySelector('.device[data-id="' + id + '"]');
  if (el) el.remove();
  this.netlist.removeDevice(id);
  this.wiring.removeDevice(id);
  this.devices = this.devices.filter(function (d) { return d.id !== id; });
  this._renderMeters();
  this._sync();
};

/* ═════════════ status / smoke ═════════════ */
// Push the drawn wires into the netlist so the solver actually sees
// them. Wiring stores {aDev,aTerm,bDev,bTerm}; the netlist wants
// {id, a:"dev:term", b:"dev:term"}.
Lab.prototype._sync = function () {
  this.netlist.wires.clear();
  this.wiring.wires.forEach(function (w) {
    const id = w.id;
    const a = w.aDev + ':' + w.aTerm;
    const b = w.bDev + ':' + w.bTerm;
    this.netlist.wires.set(id, { id: id, a: a, b: b });
  }, this);
  this.netlist._nets = null;   // force re-union

  const n = this.devices.length;
  const w = this.wiring.wires.length;
  if (!n) {
    this._setStatus('Bench ready · add equipment from the left', '');
    this.titleEl.textContent = 'Laboratory \u00b7 Empty Bench';
  } else {
    this._setStatus(n + ' device' + (n === 1 ? '' : 's') + ' \u00b7 ' + w + ' wire' + (w === 1 ? '' : 's'), '');
  }
  // Fix broken overlay: hide empty-state hint when devices exist
  var hint = document.getElementById('bench-hint');
  if (hint) hint.style.display = n ? 'none' : '';
};

Lab.prototype._setStatus = function (text, cls) {
  this.statusEl.textContent = text;
  this.statusEl.className = 'meter-foot' + (cls ? ' ' + cls : '');
};

Lab.prototype._renderSmoke = function () {
  let s = '';
  this.devices.forEach(function (d) {
    const th = d.model.thermal;
    if (!th || !th.smoke) return;
    const cx = d.x + d.w / 2, cy = d.y + 20;
    const n = Math.ceil(th.smoke * 5);
    for (let i = 0; i < n; i++) {
      const off = (i - n / 2) * 11;
      s += '<circle class="smoke-puff" cx="' + (cx + off) + '" cy="' + cy + '" r="' + (6 + i) + '" style="animation-delay:' + (i * 0.22) + 's"/>';
    }
  });
  this.smokeLayer.innerHTML = s;
};

Lab.prototype._toast = function (msg, cls) {
  if (!this.toast) return;
  const el = this.toast;
  el.textContent = msg;
  el.className = 'toast ' + (cls || '');
  clearTimeout(this._toastT);
  this._toastT = setTimeout(function () { el.className = 'toast hidden ' + (cls || ''); }, 2400);
};

root.EEE = root.EEE || {};
root.EEE.Lab = Lab;

})(typeof window !== 'undefined' ? window : globalThis);
