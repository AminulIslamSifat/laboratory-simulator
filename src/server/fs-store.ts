/**
 * Filesystem bench store — the pre-Mongo behaviour, kept as a fallback.
 *
 * ─── Why keep it ───
 *
 * Two reasons, and neither is nostalgia.
 *
 * First, `npm run dev` on a machine with no Atlas credentials has to keep
 * working. Before this file the app wrote to `<project>/benches/` and that is
 * still the right answer when there is no database to write to.
 *
 * Second, a deployed instance whose URI is missing or whose cluster is
 * unreachable must degrade, not break. A student pressing Save should get
 * their bench on disk and a toast that says where, not a 500.
 *
 * ─── Layout ───
 *
 *   benches/<ROLL>/<name>.json
 *
 * The roll is a directory. That is what scopes a name to its owner on disk:
 * two students can both have `Exp 3.json` because they are in different
 * folders. `normRoll` already strips everything that is not a letter or
 * digit, so the directory name cannot contain a separator or a `..`.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  isBenchShape, layoutOf, normName, normRoll,
  type BenchMeta, type BenchShape, type BenchStore, type SaveInfo
} from './bench-store.js';

/** Cap a listing the same way the Mongo store does. */
const LIST_LIMIT = 500;

export class FsBenchStore implements BenchStore {
  readonly kind = 'fs' as const;
  readonly where: string;

  constructor(private readonly root: string) {
    this.where = path.join(root, 'benches');
  }

  /**
   * `<root>/benches/<ROLL>`.
   *
   * With no roll this is the benches root itself, NOT a subfolder. Benches
   * saved before roll numbers existed are sitting at `benches/<name>.json`,
   * and pointing the legacy owner at a fresh `_legacy/` directory would make
   * every one of them invisible after the upgrade.
   */
  private dirFor(roll: string): string {
    const r = normRoll(roll);
    return r ? path.join(this.where, r) : this.where;
  }

  /**
   * Resolve a bench file inside a roll directory, refusing anything that
   * escapes it.
   *
   * `normName` already makes a hostile name impossible, but this is the last
   * gate before a write and `path.relative` catches what a string prefix test
   * would not (a sibling directory named `benches-evil`).
   */
  private fileFor(roll: string, name: string): string {
    const dir = this.dirFor(roll);
    const full = path.resolve(dir, normName(name) + '.json');
    const rel = path.relative(dir, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('bad bench name');
    }
    return full;
  }

  async save(roll: string, name: string, bench: BenchShape): Promise<SaveInfo> {
    const r = normRoll(roll);
    if (!r) throw new Error('roll required');
    const full = this.fileFor(r, name);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, JSON.stringify(bench, null, 2), 'utf8');
    const stat = await fs.stat(full);
    return { roll: r, name: normName(name), savedAt: stat.mtimeMs };
  }

  /**
   * List every bench, or one roll's.
   *
   * Reads each file to get its device/wire counts and layout. That is the
   * whole reason Mongo is the preferred backend: this is O(files) disk reads
   * where the database does it with an index. For a dev machine with a dozen
   * benches it is nothing, which is exactly the scale this fallback serves.
   */
  async list(roll?: string): Promise<BenchMeta[]> {
    const rolls = roll ? [normRoll(roll)] : await this.rolls();
    const out: BenchMeta[] = [];

    for (const r of rolls) {
      const dir = path.join(this.where, r);
      let names: string[];
      try {
        names = await fs.readdir(dir);
      } catch {
        continue; // no such roll folder is a normal miss
      }

      for (const n of names) {
        if (!n.toLowerCase().endsWith('.json')) continue;
        const full = path.join(dir, n);
        try {
          const [stat, text] = await Promise.all([fs.stat(full), fs.readFile(full, 'utf8')]);
          const bench = JSON.parse(text) as unknown;
          if (!isBenchShape(bench)) continue;
          out.push({
            roll: r,
            name: n.replace(/\.json$/i, ''),
            savedAt: stat.mtimeMs,
            createdAt: stat.birthtimeMs || stat.mtimeMs,
            devices: bench.devices.length,
            wires: bench.wires.length,
            layout: layoutOf(bench)
          });
        } catch {
          // An unreadable or corrupt file is not a bench. Skip it rather than
          // failing the whole listing.
          continue;
        }
      }
    }

    out.sort((a, b) => b.savedAt - a.savedAt);
    return out.slice(0, LIST_LIMIT);
  }

  async load(roll: string, name: string): Promise<BenchShape | null> {
    try {
      const text = await fs.readFile(this.fileFor(roll, name), 'utf8');
      const bench = JSON.parse(text) as unknown;
      return isBenchShape(bench) ? bench : null;
    } catch {
      return null;
    }
  }

  async remove(roll: string, name: string): Promise<void> {
    await fs.rm(this.fileFor(roll, name), { force: true });
  }

  async rolls(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.where, { withFileTypes: true });
      const out: string[] = [];
      for (const e of entries) {
        if (e.isDirectory()) out.push(e.name);
      }
      // A bench saved before rolls existed still has to be visible, or the
      // upgrade silently hides every existing save. "" is the legacy owner.
      if (entries.some((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))) {
        out.push('');
      }
      return out.sort();
    } catch {
      return [];
    }
  }
}
