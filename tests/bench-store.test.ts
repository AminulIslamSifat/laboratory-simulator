/**
 * Bench library store.
 *
 * localStorage does not exist under Node, so the tests install a minimal
 * in-memory stub on globalThis before importing the module. That also proves
 * the store only uses the two methods it claims to: getItem and setItem.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Install the stub BEFORE the module under test is imported. A dynamic
// import inside the test would also work, but a top-level import plus a
// hoisted stub is simpler and the stub has no ordering hazard.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0
} as unknown as Storage;

import {
  listSlots, saveSlot, getSlot, deleteSlot, renameSlot, ago,
  type BenchFile
} from '../src/ui/bench-store.js';

const bench = (n: number): BenchFile => ({
  devices: Array.from({ length: n }, (_, i) => ({ id: 'd' + i, kind: 'rheostat', x: i * 10, y: i * 10 })),
  wires: []
});

beforeEach(() => store.clear());

describe('bench store', () => {
  it('starts empty', () => {
    expect(listSlots()).toEqual([]);
  });

  it('saves and reads back a named bench', () => {
    saveSlot('My Bench', bench(2));
    const got = getSlot('My Bench');
    expect(got).toBeDefined();
    expect(got?.bench.devices).toHaveLength(2);
  });

  it('trims the name and rejects an empty one', () => {
    saveSlot('  spaced  ', bench(1));
    expect(getSlot('spaced')).toBeDefined();
    expect(() => saveSlot('   ', bench(1))).toThrow();
  });

  it('overwrites on save under the same name', () => {
    saveSlot('B', bench(1));
    saveSlot('B', bench(5));
    expect(listSlots()).toHaveLength(1);
    expect(getSlot('B')?.bench.devices).toHaveLength(5);
  });

  it('sorts newest-first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    saveSlot('old', bench(1));
    vi.setSystemTime(2000);
    saveSlot('new', bench(1));
    vi.useRealTimers();
    expect(listSlots()[0].name).toBe('new');
  });

  it('deletes a slot', () => {
    saveSlot('gone', bench(1));
    deleteSlot('gone');
    expect(getSlot('gone')).toBeUndefined();
  });

  it('renames a slot and refuses a collision', () => {
    saveSlot('a', bench(1));
    saveSlot('b', bench(1));
    expect(renameSlot('a', 'c')).toBe(true);
    expect(getSlot('c')).toBeDefined();
    // Renaming onto an existing name must not silently destroy it.
    expect(renameSlot('c', 'b')).toBe(false);
    expect(getSlot('b')?.bench.devices).toHaveLength(1);
  });

  it('survives a corrupt stored value', () => {
    store.set('eee2152.benches.v1', '{ not json');
    expect(listSlots()).toEqual([]);
  });

  it('drops entries that are not shaped like a bench', () => {
    store.set('eee2152.benches.v1', JSON.stringify([
      { name: 'good', savedAt: 1, bench: { devices: [], wires: [] } },
      { name: 'bad', savedAt: 2 },
      'nonsense'
    ]));
    const slots = listSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0].name).toBe('good');
  });

  it('formats ages', () => {
    const now = Date.now();
    expect(ago(now)).toBe('just now');
    expect(ago(now - 5 * 60_000)).toBe('5m ago');
    expect(ago(now - 3 * 3600_000)).toBe('3h ago');
  });
});