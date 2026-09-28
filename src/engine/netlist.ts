/**
 * Netlist — devices plus wires, reduced to equipotential nets.
 *
 * Union-find over `deviceId:terminal` keys. Two things make a terminal pair
 * share a net: a wire between them, or a `bond` the device itself declares.
 *
 * The bond path is not optional. An input bank whose four posts are all one
 * node must say so, or each post becomes its own net and a wire landed on
 * the "wrong" post silently never closes the loop. That failure mode cost
 * real debugging time — the presets wired posts that did not exist and ten
 * wires across five benches never reached the solver.
 */

import type { Device, Net } from './types.js';

export interface Wire {
  id: string;
  /** `deviceId:terminal` */
  a: string;
  /** `deviceId:terminal` */
  b: string;
}

export class Netlist {
  readonly devices = new Map<string, Device>();
  readonly wires = new Map<string, Wire>();

  private _nets: Net[] | null = null;
  private _netOf: Map<string, number> | null = null;

  addDevice(d: Device): Device {
    this.devices.set(d.id, d);
    this._nets = null;
    return d;
  }

  removeDevice(id: string): void {
    this.devices.delete(id);
    this._nets = null;
  }

  addWire(w: Wire): Wire {
    this.wires.set(w.id, w);
    this._nets = null;
    return w;
  }

  removeWire(id: string): void {
    this.wires.delete(id);
    this._nets = null;
  }

  /** Drop every wire — used when the bench is cleared or reloaded. */
  clearWires(): void {
    this.wires.clear();
    this._nets = null;
  }

  invalidate(): void {
    this._nets = null;
  }

  computeNets(): Net[] {
    if (this._nets) return this._nets;

    const parent = new Map<string, string>();

    const find = (x: string): string => {
      let root = x;
      if (!parent.has(root)) parent.set(root, root);
      while (parent.get(root) !== root) root = parent.get(root) as string;
      // Path compression, so repeated lookups stay near O(1).
      let cur = x;
      while (parent.get(cur) !== root) {
        const next = parent.get(cur) as string;
        parent.set(cur, root);
        cur = next;
      }
      return root;
    };

    const union = (a: string, b: string): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    // Every declared terminal starts as its own singleton.
    for (const d of this.devices.values()) {
      const terms = d.terminals ?? {};
      for (const key of Object.keys(terms)) find(`${d.id}:${key}`);
    }

    // Structural bonds: terminals the device says are the same node.
    for (const d of this.devices.values()) {
      if (!d.bonds) continue;
      for (const [a, b] of d.bonds) union(`${d.id}:${a}`, `${d.id}:${b}`);
    }

    // Real wires.
    for (const w of this.wires.values()) {
      if (parent.has(w.a) && parent.has(w.b)) union(w.a, w.b);
    }

    const groups = new Map<string, string[]>();
    for (const key of parent.keys()) {
      const root = find(key);
      let bucket = groups.get(root);
      if (!bucket) {
        bucket = [];
        groups.set(root, bucket);
      }
      bucket.push(key);
    }

    const nets: Net[] = [];
    const netOf = new Map<string, number>();
    let id = 0;
    for (const terminals of groups.values()) {
      nets.push({ id, terminals });
      for (const t of terminals) netOf.set(t, id);
      id++;
    }

    this._nets = nets;
    this._netOf = netOf;
    return nets;
  }

  netOf(deviceId: string, terminal: string): number | undefined {
    this.computeNets();
    return this._netOf?.get(`${deviceId}:${terminal}`);
  }
}
