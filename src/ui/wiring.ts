/**
 * Wiring layer - terminal-to-terminal connections drawn as bezier wires.
 *
 * Click a terminal, then click another: a wire appears. Click a wire to
 * delete it. Mechanical ports (a coupling's MA/MB) wire like any other
 * terminal but carry torque, not current.
 *
 * Geometry comes from `pointOf()`, which reads a terminal's recorded centre
 * out of the DOM and rotates it to match the device's current rotation. That
 * last part matters: a rotated device is drawn with a CSS transform, so the
 * DOM does NOT report where its jacks actually are. Without the rotation the
 * wires stay where the jacks used to be and every connection visibly detaches
 * the moment you turn a device.
 */

/** One drawn connection between two terminals. */
export interface Wire {
  id: string;
  aDev: string;
  aTerm: string;
  bDev: string;
  bTerm: string;
}

/**
 * A device as the wiring layer sees it.
 *
 * Deliberately narrower than the Lab's own entry type. Wiring needs the
 * geometry, the model's `type`, and the mechanical-link fields - nothing else.
 */
export interface WireDevice {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  model: {
    type?: string;
    omega?: number;
    mechA?: string;
    mechB?: string;
    _mechA?: string | null;
    _mechB?: string | null;
  };
}

/** The Lab, as far as wiring needs to reach back into it. */
export interface WireOwner {
  devices: WireDevice[];
}

export interface WiringOptions {
  /** Clipped viewport. Terminal clicks are delegated here. */
  surface: HTMLElement;
  /** Transformed world containing the devices. Defaults to `surface`. */
  world?: HTMLElement;
  /** The SVG (or group) the wires are drawn into. Lives inside `world`. */
  wireLayer: HTMLElement | SVGElement;
  /** For device lookup in `_syncMech`. */
  owner?: WireOwner | null;
  onChange?: () => void;
}

/** World-space point. */
export interface Point {
  x: number;
  y: number;
}

export class Wiring {
  surface: HTMLElement;
  world: HTMLElement;
  wireLayer: HTMLElement | SVGElement;
  owner: WireOwner | null;
  wires: Wire[] = [];
  pending: { devId: string; term: string } | null = null;
  onChange: () => void;

  /**
   * Set for one tick after a pan drag, so the click that follows a pan does
   * not also cancel a pending terminal pick.
   */
  _suppressClick = false;

  private _seq = 0;

  constructor(opts: WiringOptions) {
    this.surface = opts.surface;
    this.world = opts.world || opts.surface;
    this.wireLayer = opts.wireLayer;
    this.owner = opts.owner || null;
    this.onChange = opts.onChange || (() => {});
    this._bind();
  }

  private _bind(): void {
    this.surface.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const term = target.closest('.term') as HTMLElement | null;
      if (term) {
        const dev = term.closest('.device') as HTMLElement;
        if (dev) this._onTerminal(dev.dataset.id as string, term.dataset.term as string);
        return;
      }
      // Clicking empty bench cancels a pending pick - but not the click that
      // closes a pan drag.
      if (!target.closest('.device') && !this._suppressClick) this._clearPending();
    });

    (this.wireLayer as HTMLElement).addEventListener('click', (e: MouseEvent) => {
      const hit = (e.target as HTMLElement).closest('.wirehit') as HTMLElement | null;
      if (hit) this.remove(hit.dataset.wid as string);
    });
  }

  private _onTerminal(devId: string, term: string): void {
    if (!this.pending) {
      this.pending = { devId, term };
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
  }

  private _markPending(devId: string, term: string, on: boolean): void {
    const el = this.surface.querySelector(
      '.device[data-id="' + devId + '"] .term[data-term="' + term + '"]'
    );
    if (el) el.classList.toggle('pick', on);
  }

  _clearPending(): void {
    if (!this.pending) return;
    this._markPending(this.pending.devId, this.pending.term, false);
    this.pending = null;
  }

  /**
   * Refresh a coupling's mechanical links after a wire change.
   *
   * A coupling's MA/MB link two DEVICES, not two nets. The coupling remembers
   * which machine hangs off each port so the simulator's mechanical pass can
   * find the pair without re-walking the wire list every frame.
   *
   * Only a wire landing on a machine's SHAFT port counts. Wiring MA to A1 or
   * F2 is an electrical terminal, not a shaft, so it must NOT couple rotors.
   */
  private _syncMech(devId: string): void {
    const devs = (this.owner && this.owner.devices) || [];
    const wires = this.wires;

    const find = (id: string): WireDevice | undefined => devs.find((d) => d.id === id);

    const linkFor = (couplingId: string, portName: string): string | null => {
      for (const w of wires) {
        let other: string | null = null;
        let otherTerm: string | null = null;
        if (w.aDev === couplingId && w.aTerm === portName) {
          other = w.bDev; otherTerm = w.bTerm;
        } else if (w.bDev === couplingId && w.bTerm === portName) {
          other = w.aDev; otherTerm = w.aTerm;
        }
        if (!other) continue;
        if (otherTerm !== 'SHAFT') continue;
        const m = find(other);
        if (m && m.model && typeof m.model.omega === 'number') return other;
      }
      return null;
    };

    const dev = find(devId);
    if (!dev || !dev.model || dev.model.type !== 'coupling') return;
    dev.model._mechA = linkFor(devId, dev.model.mechA || 'MA');
    dev.model._mechB = linkFor(devId, dev.model.mechB || 'MB');
  }

  add(aDev: string, aTerm: string, bDev: string, bTerm: string): Wire | null {
    const dup = this.wires.some((w) =>
      (w.aDev === aDev && w.aTerm === aTerm && w.bDev === bDev && w.bTerm === bTerm) ||
      (w.aDev === bDev && w.aTerm === bTerm && w.bDev === aDev && w.bTerm === aTerm)
    );
    if (dup) return null;

    const w: Wire = { id: 'w' + (++this._seq), aDev, aTerm, bDev, bTerm };
    this.wires.push(w);
    this._syncMech(aDev);
    this._syncMech(bDev);
    this.render();
    this.onChange();
    return w;
  }

  remove(id: string): void {
    const w = this.wires.find((x) => x.id === id);
    if (!w) return;
    this.wires = this.wires.filter((x) => x.id !== id);
    this._syncMech(w.aDev);
    this._syncMech(w.bDev);
    this.render();
    this.onChange();
  }

  removeDevice(devId: string): void {
    const before = this.wires.length;

    // Every coupling attached to this device must forget the link.
    const touched: string[] = [];
    for (const w of this.wires) {
      if (w.aDev === devId && touched.indexOf(w.bDev) < 0) touched.push(w.bDev);
      if (w.bDev === devId && touched.indexOf(w.aDev) < 0) touched.push(w.aDev);
    }
    this.wires = this.wires.filter((w) => w.aDev !== devId && w.bDev !== devId);
    touched.forEach((id) => this._syncMech(id));

    if (this.wires.length !== before) {
      this.render();
      this.onChange();
    }
  }

  clear(): void {
    const devs = (this.owner && this.owner.devices) || [];
    devs.forEach((d) => {
      if (d.model && d.model.type === 'coupling') {
        d.model._mechA = null;
        d.model._mechB = null;
      }
    });
    this.wires = [];
    this._clearPending();
    this.render();
    this.onChange();
  }

  /**
   * World-space position of a terminal.
   *
   * Uses the device's own style.left/top plus the terminal's recorded centre,
   * rather than getBoundingClientRect - that breaks under CSS transforms when
   * devices are dragged or rotated.
   */
  pointOf(devId: string, term: string): Point | null {
    const dev = this.world.querySelector(
      '.device[data-id="' + devId + '"]'
    ) as HTMLElement | null;
    if (!dev) return null;

    const t = dev.querySelector('.term[data-term="' + term + '"]') as HTMLElement | null;
    if (!t) return null;

    const devX = parseFloat(dev.style.left) || 0;
    const devY = parseFloat(dev.style.top) || 0;

    // Trust the recorded centre over offsetLeft + width/2 so non-square bank
    // posts stay exact.
    let termX = parseFloat(t.dataset.cx as string);
    let termY = parseFloat(t.dataset.cy as string);
    if (!isFinite(termX)) termX = t.offsetLeft + t.offsetWidth / 2;
    if (!isFinite(termY)) termY = t.offsetTop + t.offsetHeight / 2;

    // A rotated device is drawn with a CSS transform, so the DOM does not tell
    // us where its terminals are. Rotate the recorded coordinate by the same
    // angle about the device centre and the wire lands on the jack again.
    //
    // The rotation is about the centre, matching `transform-origin: 50% 50%`,
    // so the centre is a fixed point and the maths is a plain 2D rotation of
    // the offset from it. Positive degrees rotate clockwise, which is what CSS
    // does, because the y axis points down.
    const rot = parseFloat(dev.dataset.rot as string) || 0;
    if (rot) {
      const w = parseFloat(dev.style.width) || 0;
      const h = parseFloat(dev.style.height) || 0;
      const dx = termX - w / 2;
      const dy = termY - h / 2;
      const rad = (rot * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      termX = w / 2 + (dx * c - dy * s);
      termY = h / 2 + (dx * s + dy * c);
    }

    return { x: devX + termX, y: devY + termY };
  }

  /**
   * Rebuild the wire SVG.
   *
   * ─── Why this is not just `innerHTML = s` any more ───
   *
   * The drag handler on a device called this on EVERY mousemove. Mousemove
   * fires far faster than the display refreshes (100-1000 Hz on a decent
   * mouse), and each call did two expensive things:
   *
   *   1. `pointOf()` for every endpoint - each one a `querySelector` plus
   *      several `parseFloat` on `style.left/top/width/height`.
   *   2. `innerHTML = s`, which makes the browser parse the whole SVG string,
   *      destroy every previous path node, and build a fresh tree.
   *
   * Building an SVG subtree hundreds of times per second, while the garbage
   * collector swept the old ones, is what pinned a core at ~200% for what is
   * visually just one box sliding across the bench.
   *
   * Two changes fix it without touching the geometry:
   *
   *   - When the NUMBER of wires is unchanged, reuse the existing two `<path>`
   *     nodes per wire and only set the `d` attribute. Setting an attribute is
   *     a single style/layout input; replacing innerHTML re-parses and
   *     re-creates the whole tree.
   *   - Only fall back to a full rebuild when the count changes (a wire was
   *     added or removed), which is the rare case.
   *
   * The wire order is stable (`this.wires` is only ever push/filter), so the
   * i-th pair of nodes always belongs to the i-th wire.
   */
  render(): void {
    const WIRE_COLORS = 6;
    const layer = this.wireLayer as HTMLElement;

    // Build the geometry first; both paths share it.
    type Seg = { d: string; wc: number; wid: string };
    const segs: Seg[] = [];
    this.wires.forEach((w, i) => {
      const a = this.pointOf(w.aDev, w.aTerm);
      const b = this.pointOf(w.bDev, w.bTerm);
      if (!a || !b) return;

      const mx = (a.x + b.x) / 2;
      const dy = Math.abs(b.y - a.y);
      const dx = Math.abs(b.x - a.x);

      // Curve more when the ends are far apart vertically; a gentle arc when
      // the wire is mostly horizontal, so parallel runs stay readable.
      let d: string;
      if (dy < dx * 0.3) {
        const cy = (a.y + b.y) / 2 - dx * 0.15;
        d = 'M ' + a.x + ' ' + a.y + ' Q ' + mx + ' ' + cy + ', ' + b.x + ' ' + b.y;
      } else {
        d = 'M ' + a.x + ' ' + a.y + ' C ' + mx + ' ' + a.y + ', ' + mx + ' ' + b.y + ', ' + b.x + ' ' + b.y;
      }

      segs.push({ d, wc: i % WIRE_COLORS, wid: w.id });
    });

    // Fast path: reuse the existing nodes when the wire SET is unchanged.
    //
    // Keyed on wire id, not on positional count. A positional match would
    // drift the moment one wire is skipped for a frame (its device mid-drag
    // with a missing endpoint): `segs` would drop it, the next frame's
    // `segs` would put a DIFFERENT wire at that index, and the reused node
    // would show the wrong wire's geometry. Matching by `data-wid` makes the
    // node follow its own wire no matter how the visible set changes.
    const existing = layer.children;
    if (existing.length === segs.length * 2) {
      let aligned = true;
      for (let i = 0; i < segs.length; i++) {
        const hit = existing[i * 2 + 1] as SVGPathElement;
        if (hit.getAttribute('data-wid') !== segs[i].wid) { aligned = false; break; }
      }
      if (aligned) {
        for (let i = 0; i < segs.length; i++) {
          const seg = existing[i * 2] as SVGPathElement;
          const hit = existing[i * 2 + 1] as SVGPathElement;
          seg.setAttribute('d', segs[i].d);
          hit.setAttribute('d', segs[i].d);
        }
        return;
      }
    }

    // Slow path: the wire set changed. Rebuild once.
    let s = '';
    for (const seg of segs) {
      s += '<path class="wireseg" data-wc="' + seg.wc + '" d="' + seg.d + '"/>';
      s += '<path class="wirehit" data-wid="' + seg.wid + '" d="' + seg.d +
        '" fill="none" stroke="transparent" stroke-width="14" ' +
        'style="pointer-events:stroke;cursor:pointer"/>';
    }
    layer.innerHTML = s;
  }
}
