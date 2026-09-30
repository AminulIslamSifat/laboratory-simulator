/**
 * Storage contract shared by the Mongo and filesystem backends.
 *
 * ─── Why an interface at all ───
 *
 * The bench API used to write straight to disk with `fs` calls inline in the
 * Vite plugin. Adding MongoDB could have meant a second copy of every route
 * with `if (mongo)` scattered through it. Instead both backends implement
 * this one interface and the plugin picks a backend once, at startup. Every
 * route is then written exactly once.
 *
 * The filesystem backend is not dead code: it is what keeps `npm run dev`
 * working on a machine with no credentials, and it is the safety net if the
 * Atlas URI is missing or the cluster is unreachable on Render.
 */

/** The serialised bench, as `captureBench()` produces it. */
export interface BenchShape {
  devices: unknown[];
  wires: unknown[];
}

/**
 * A device position, for drawing a hub thumbnail.
 *
 * Deliberately tiny: the listing returns one of these per device instead of
 * the whole bench, so a hub of 200 experiments costs a few kB rather than a
 * few MB. The client already knows every device's pixel size (it has the
 * same EQUIPMENT registry that drew the bench), so positions are all it needs
 * to reconstruct a faithful miniature.
 */
export interface BenchLayoutItem {
  /** Device kind, e.g. `dc_machine`. */
  k: string;
  x: number;
  y: number;
  /** Rotation in degrees. */
  r: number;
}

/** One row in the hub listing. Everything except the bench body itself. */
export interface BenchMeta {
  roll: string;
  name: string;
  /** Epoch ms of the last write. */
  savedAt: number;
  /** Epoch ms of the first write under this roll+name. */
  createdAt: number;
  devices: number;
  wires: number;
  layout: BenchLayoutItem[];
}

/** What a save reports back. */
export interface SaveInfo {
  roll: string;
  name: string;
  savedAt: number;
}

export interface BenchStore {
  /** Human-readable location, shown in the hub header. Never contains secrets. */
  readonly where: string;
  /** Which backend won, so the hub can say so honestly. */
  readonly kind: 'mongo' | 'fs';

  save(roll: string, name: string, bench: BenchShape): Promise<SaveInfo>;
  /** List all benches, or only one roll's when `roll` is given. */
  list(roll?: string): Promise<BenchMeta[]>;
  /** Read one bench back, or null when it does not exist. */
  load(roll: string, name: string): Promise<BenchShape | null>;
  remove(roll: string, name: string): Promise<void>;
  /** Distinct rolls that own at least one bench. */
  rolls(): Promise<string[]>;
}

/**
 * Normalise a roll number.
 *
 * Rolls are typed by hand on a lab PC, so `2403123 `, `2403123` and
 * `2403123\n` must all be the same owner. Uppercased and stripped of
 * everything that is not a letter or digit, which also makes the value safe
 * to use as a directory name in the filesystem backend without a second
 * sanitiser.
 */
export function normRoll(roll: string): string {
  return String(roll || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 24);
}

/**
 * Sanitise a bench name for use as a key or a file name.
 *
 * Same rule as the old `toFileName`: everything outside `[A-Za-z0-9._-]`
 * collapses to an underscore. A name is a label, not a path — this makes a
 * hostile name impossible rather than merely caught downstream.
 */
export function normName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80);
}

/** Pull the layout out of a raw bench body. Capped so a pathological save
 *  cannot bloat every listing response. */
export function layoutOf(bench: BenchShape): BenchLayoutItem[] {
  const out: BenchLayoutItem[] = [];
  for (const d of bench.devices) {
    const o = d as { kind?: unknown; x?: unknown; y?: unknown; rot?: unknown };
    if (typeof o?.x !== 'number' || typeof o?.y !== 'number') continue;
    out.push({
      k: String(o.kind || '?'),
      x: o.x,
      y: o.y,
      r: typeof o.rot === 'number' ? o.rot : 0
    });
    if (out.length >= 60) break;
  }
  return out;
}

/** Shape check shared by both backends, so neither can store a broken bench. */
export function isBenchShape(v: unknown): v is BenchShape {
  if (!v || typeof v !== 'object') return false;
  const b = v as { devices?: unknown; wires?: unknown };
  return Array.isArray(b.devices) && Array.isArray(b.wires);
}
