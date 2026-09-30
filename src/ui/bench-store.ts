/**
 * Bench library — named saves in localStorage.
 *
 * The kebab menu already had Save / Load, but both were FILE dialogs: Save
 * downloaded a JSON blob, Load opened a file picker. That works for moving a
 * bench between machines, and it is kept. What it cannot do is the thing you
 * actually want mid-session — park a half-finished wiring job under a name,
 * clear the bench, and get it back in two clicks.
 *
 * This module adds that: a small named-slot store on top of localStorage,
 * with the same BenchFile shape the file dialogs already use, so the two
 * paths cannot drift.
 */

/** One device as stored. `id` is preserved because wires reference it. */
export interface StoredDevice {
  id: string;
  kind: string;
  x: number;
  y: number;
  rot?: number;
  /**
   * Panel state: switch positions, dial settings, rotor speed.
   *
   * Optional because benches saved before this existed have no state, and a
   * bench with no state must still load - it just comes up at the device
   * defaults, exactly as it used to.
   */
  state?: Record<string, unknown>;
}

/** One wire as stored. Terminal names are the sprite's printed jacks. */
export interface StoredWire {
  aDev: string;
  aTerm: string;
  bDev: string;
  bTerm: string;
}

/** The on-disk / in-storage shape of a whole bench. */
export interface BenchFile {
  devices: StoredDevice[];
  wires: StoredWire[];
}

/** A named entry in the library. */
export interface BenchSlot {
  name: string;
  /** Epoch ms, for sorting newest-first. */
  savedAt: number;
  bench: BenchFile;
}

const KEY = 'eee2152.benches.v1';

/**
 * Read the whole library.
 *
 * A corrupt or foreign value under our key must not brick the app, so any
 * parse failure falls back to an empty library rather than throwing.
 */
export function listSlots(): BenchSlot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as BenchSlot[])
      .filter((s) => s && typeof s.name === 'string' && s.bench && Array.isArray(s.bench.devices))
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  } catch {
    return [];
  }
}

function writeSlots(slots: BenchSlot[]): void {
  localStorage.setItem(KEY, JSON.stringify(slots));
}

/**
 * Save a bench under a name.
 *
 * Saving over an existing name REPLACES it — that is what \"save\" means to
 * everyone who has ever used a computer, and asking to confirm every overwrite
 * would make re-saving a bench you are iterating on miserable.
 */
export function saveSlot(name: string, bench: BenchFile): BenchSlot {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('name required');
  const slots = listSlots().filter((s) => s.name !== trimmed);
  const slot: BenchSlot = { name: trimmed, savedAt: Date.now(), bench };
  slots.unshift(slot);
  writeSlots(slots);
  return slot;
}

export function getSlot(name: string): BenchSlot | undefined {
  return listSlots().find((s) => s.name === name);
}

export function deleteSlot(name: string): void {
  writeSlots(listSlots().filter((s) => s.name !== name));
}

/** Rename in place, keeping the bench and refreshing the timestamp. */
export function renameSlot(oldName: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return false;
  const slots = listSlots();
  const hit = slots.find((s) => s.name === oldName);
  if (!hit) return false;
  // A rename onto an existing name would silently destroy that entry.
  if (slots.some((s) => s.name === trimmed)) return false;
  hit.name = trimmed;
  hit.savedAt = Date.now();
  writeSlots(slots);
  return true;
}

/** Human-readable age, for the list. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'd ago';
  return new Date(ms).toLocaleDateString();
}