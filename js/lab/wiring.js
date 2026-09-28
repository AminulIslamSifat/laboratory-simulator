// EEE-2152 Lab · Wiring layer
// Terminal-to-terminal connections drawn as bezier wires.
// Click a terminal, click another terminal → wire. Click wire to delete.
(function (root) {
'use strict';

function Wiring(opts) {
  this.surface = opts.surface;          // viewport element (clipped)
  this.world = opts.world || opts.surface;  // transformed world containing devices
  this.wireLayer = opts.wireLayer;      // svg for wires (lives inside world)
  this.owner = opts.owner || null;      // the Lab, for device lookup in _syncMech
  this.wires = [];                      // { id, aDev, aTerm, bDev, bTerm, el }
  this.pending = null;                  // { devId, term }
  this._seq = 0;
  this.onChange = opts.onChange || function () {};
  this._bind();
}

Wiring.prototype._bind = function () {
  const self = this;
  this.surface.addEventListener('click', function (e) {
    const term = e.target.closest('.term');
    if (term) {
      const dev = term.closest('.device');
      self._onTerminal(dev.dataset.id, term.dataset.term);
      return;
    }
    // clicking empty bench cancels a pending pick (but not after a pan drag)
    if (!e.target.closest('.device') && !self._suppressClick) self._clearPending();
  });

  this.wireLayer.addEventListener('click', function (e) {
    const hit = e.target.closest('.wirehit');
    if (hit) self.remove(hit.dataset.wid);
  });
};

Wiring.prototype._onTerminal = function (devId, term) {
  if (!this.pending) {
    this.pending = { devId: devId, term: term };
    this._markPending(devId, term, true);
    return;
  }
  if (this.pending.devId === devId && this.pending.term === term) {
    this._clearPending();
    return;
  }
  this._markPending(this.pending.devId, this.pending.term, false);
  this.add(this.pending.devId, this.pending.term, devId, term);
  this.pending = null;
};

Wiring.prototype._markPending = function (devId, term, on) {
  const el = this.surface.querySelector('.device[data-id="' + devId + '"] .term[data-term="' + term + '"]');
  if (el) el.classList.toggle('pick', on);
};
Wiring.prototype._clearPending = function () {
  if (!this.pending) return;
  this._markPending(this.pending.devId, this.pending.term, false);
  this.pending = null;
};

// A mechanical port (coupling MA/MB) links two DEVICES, not two nets. The
// coupling remembers which machine hangs off each port so core.js's
// mechanical pass can find the pair without re-walking the wire list.
Wiring.prototype._syncMech = function (devId) {
  const devs = (this.owner && this.owner.devices) || [];
  const wires = this.wires;
  const self = this;

  function find(devId) {
    return devs.find(function (d) { return d.id === devId; });
  }

  // A coupling's _mechA / _mechB must name a MACHINE, and only a wire that
  // lands on that machine's SHAFT port counts. Wiring MA to A1 or F2 is an
  // electrical terminal, not a shaft, so it must NOT link the rotors.
  function linkFor(couplingId, portName) {
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      let other = null, otherTerm = null;
      if (w.aDev === couplingId && w.aTerm === portName) { other = w.bDev; otherTerm = w.bTerm; }
      else if (w.bDev === couplingId && w.bTerm === portName) { other = w.aDev; otherTerm = w.aTerm; }
      if (!other) continue;
      if (otherTerm !== 'SHAFT') continue;        // not a shaft port — ignore
      const m = find(other);
      if (m && m.model && typeof m.model.omega === 'number') return other;
    }
    return null;
  }

  const dev = find(devId);
  if (!dev || !dev.model || dev.model.type !== 'coupling') return;
  dev.model._mechA = linkFor(devId, dev.model.mechA);
  dev.model._mechB = linkFor(devId, dev.model.mechB);
};

Wiring.prototype.add = function (aDev, aTerm, bDev, bTerm) {
  // refuse duplicates
  const dup = this.wires.some(function (w) {
    return (w.aDev === aDev && w.aTerm === aTerm && w.bDev === bDev && w.bTerm === bTerm) ||
           (w.aDev === bDev && w.aTerm === bTerm && w.bDev === aDev && w.bTerm === aTerm);
  });
  if (dup) return null;
  const w = { id: 'w' + (++this._seq), aDev: aDev, aTerm: aTerm, bDev: bDev, bTerm: bTerm };
  this.wires.push(w);
  this._syncMech(aDev);
  this._syncMech(bDev);
  this.render();
  this.onChange();
  return w;
};

Wiring.prototype.remove = function (id) {
  const w = this.wires.find(function (x) { return x.id === id; });
  if (!w) return;
  this.wires = this.wires.filter(function (x) { return x.id !== id; });
  this._syncMech(w.aDev);
  this._syncMech(w.bDev);
  this.render();
  this.onChange();
};

Wiring.prototype.removeDevice = function (devId) {
  const before = this.wires.length;
  // every coupling that was attached to this device must forget the link
  const touched = [];
  this.wires.forEach(function (w) {
    if (w.aDev === devId && touched.indexOf(w.bDev) < 0) touched.push(w.bDev);
    if (w.bDev === devId && touched.indexOf(w.aDev) < 0) touched.push(w.aDev);
  });
  this.wires = this.wires.filter(function (w) { return w.aDev !== devId && w.bDev !== devId; });
  const self = this;
  touched.forEach(function (id) { self._syncMech(id); });
  if (this.wires.length !== before) { this.render(); this.onChange(); }
};

Wiring.prototype.clear = function () {
  const self = this;
  const devs = (this.owner && this.owner.devices) || [];
  devs.forEach(function (d) {
    if (d.model && d.model.type === 'coupling') { d.model._mechA = null; d.model._mechB = null; }
  });
  this.wires = [];
  this._clearPending();
  this.render();
  this.onChange();
};

// Returns a point in WORLD coordinates using the device's own offsetLeft/Top
// plus the terminal's offset within the device. This avoids getBoundingClientRect
// which breaks under CSS transforms when devices are dragged.
Wiring.prototype.pointOf = function (devId, term) {
  const dev = this.world.querySelector('.device[data-id="' + devId + '"]');
  if (!dev) return null;
  const t = dev.querySelector('.term[data-term="' + term + '"]');
  if (!t) return null;
  // Device position is set via style.left/top in world-space pixels.
  // Terminal position is relative to the device element.
  const devX = parseFloat(dev.style.left) || 0;
  const devY = parseFloat(dev.style.top) || 0;
  // lab.js records the intended centre on the dot; trust it over
  // offsetLeft+width/2 so non-square bank posts stay exact.
  let termX = parseFloat(t.dataset.cx);
  let termY = parseFloat(t.dataset.cy);
  if (!isFinite(termX)) termX = t.offsetLeft + t.offsetWidth / 2;
  if (!isFinite(termY)) termY = t.offsetTop + t.offsetHeight / 2;
  return {
    x: devX + termX,
    y: devY + termY
  };
};

Wiring.prototype.render = function () {
  let s = '';
  const self = this;
  const WIRE_COLORS = 6;
  this.wires.forEach(function (w, i) {
    const a = self.pointOf(w.aDev, w.aTerm);
    const b = self.pointOf(w.bDev, w.bTerm);
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2;
    const dy = Math.abs(b.y - a.y);
    const dx = Math.abs(b.x - a.x);
    // Smarter bezier: curve more when points are far apart vertically,
    // use S-curve for horizontal wires
    let d;
    if (dy < dx * 0.3) {
      // Mostly horizontal — gentle arc
      const cy = (a.y + b.y) / 2 - dx * 0.15;
      d = 'M ' + a.x + ' ' + a.y + ' Q ' + mx + ' ' + cy + ', ' + b.x + ' ' + b.y;
    } else {
      // Standard S-curve
      d = 'M ' + a.x + ' ' + a.y + ' C ' + mx + ' ' + a.y + ', ' + mx + ' ' + b.y + ', ' + b.x + ' ' + b.y;
    }
    const wc = i % WIRE_COLORS;
    s += '<path class="wireseg" data-wc="' + wc + '" d="' + d + '"/>';
    s += '<path class="wirehit" data-wid="' + w.id + '" d="' + d + '" fill="none" stroke="transparent" stroke-width="14" style="pointer-events:stroke;cursor:pointer"/>';
  });
  this.wireLayer.innerHTML = s;
};

root.EEE = root.EEE || {};
root.EEE.Wiring = Wiring;

})(typeof window !== 'undefined' ? window : globalThis);
