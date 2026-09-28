/**
 * Device identifier allocation.
 *
 * One counter for the whole application. The old build declared `uid()` twice
 * — once in `devices.js` and once in `lab.js` — each with its own private
 * counter, so `m_1_ab3f` was a legal id for two different objects. Ids key the
 * netlist, the DOM dataset, the wire endpoints and the readout cache; two
 * devices sharing one is not a cosmetic problem.
 */

let counter = 0;

/** Monotonic, human-readable, collision-free within a session. */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Reset the counter. Used by tests so ids are predictable. */
export function resetUidCounter(): void {
  counter = 0;
}