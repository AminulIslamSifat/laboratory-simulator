/**
 * MongoDB-backed bench store.
 *
 * ─── Why a database at all ───
 *
 * The filesystem store works, but it ties every saved experiment to ONE
 * machine. `render.yaml` had to buy a persistent disk so saves survived a
 * redeploy, and a student on a lab PC still could not see what they saved at
 * home. Mongo fixes both: the bench lives in Atlas, so it is reachable from
 * any browser on any host, and the free plan's ephemeral container stops
 * mattering.
 *
 * ─── Collection shape ───
 *
 *   {
 *     roll:      '2403000',            // owner, normalised (see normRoll)
 *     name:      'Exp 3',              // bench label
 *     bench:     { devices, wires },   // the whole serialised bench
 *     devices:   5, wires: 7,          // counts, so the hub need not read bench
 *     layout:    [{k,x,y,r}],          // positions, for the hub thumbnail
 *     createdAt: Date,
 *     savedAt:   Date,
 *     schema:    1
 *   }
 *
 * `devices`/`wires`/`layout` are denormalised copies of data already inside
 * `bench`. That is deliberate: the hub lists every experiment, and projecting
 * `bench` out of that query turns a listing of 200 benches from megabytes of
 * device state into a few kB of positions. The copies are written on every
 * save, so they cannot drift.
 *
 * The unique key is `{ roll, name }`, not `name`. Two students both naming a
 * bench "Exp 3" must not overwrite each other, and one student re-saving
 * their own "Exp 3" must.
 */

import { MongoClient, type Collection, type Db } from 'mongodb';
import {
  layoutOf, normRoll,
  type BenchMeta, type BenchShape, type BenchStore, type SaveInfo
} from './bench-store.js';

/** One document in the `benches` collection. */
interface BenchDoc {
  roll: string;
  name: string;
  bench: BenchShape;
  devices: number;
  wires: number;
  layout: BenchMeta['layout'];
  createdAt: Date;
  savedAt: Date;
  schema: number;
}

/** Hard ceiling on a listing, so one enormous account cannot stall the hub. */
const LIST_LIMIT = 500;

/**
 * How long to wait for the cluster before giving up and using the filesystem.
 *
 * Atlas occasionally has a slow first handshake — a cold cluster, a DNS
 * hiccup — and a save that hangs for 30 seconds is worse than one that falls
 * back to disk and works. 6 s is long enough to cover a normal cold start and
 * short enough that the fallback is not a visible stall.
 */
const CONNECT_TIMEOUT_MS = 6000;

/** The slice of a Mongo error we actually read. */
function isDuplicateKey(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
}

export class MongoBenchStore implements BenchStore {
  readonly kind = 'mongo' as const;
  readonly where: string;

  private readonly col: Collection<BenchDoc>;
  private indexReady: Promise<void> | null = null;

  private constructor(
    private readonly client: MongoClient,
    db: Db,
    dbName: string
  ) {
    this.col = db.collection<BenchDoc>('benches');
    // The host is safe to show; the URI (which carries the password) is not.
    this.where = 'MongoDB · ' + dbName + '.benches';
  }

  /**
   * Connect and verify, or throw so the caller can fall back to disk.
   *
   * A `ping` is part of the check on purpose. `connect()` alone can resolve
   * against a client that has not actually reached a server, and the failure
   * would then surface on the first save — long after the fallback decision
   * was made.
   */
  static async connect(uri: string, dbName: string): Promise<MongoBenchStore> {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
      // The app writes tiny documents; a big pool is wasted sockets.
      maxPoolSize: 5
    });

    try {
      await client.connect();
      await client.db(dbName).command({ ping: 1 });
    } catch (err) {
      await client.close().catch(() => {});
      throw err;
    }

    return new MongoBenchStore(client, client.db(dbName), dbName);
  }

  /**
   * Create the unique index once, lazily.
   *
   * Not in the constructor: building an index is a round trip, and a read-only
   * session (loading a bench someone else saved) should not pay for it. The
   * promise is cached so ten concurrent saves still build it once.
   */
  private ensureIndex(): Promise<void> {
    if (!this.indexReady) {
      this.indexReady = this.col
        .createIndex({ roll: 1, name: 1 }, { unique: true, name: 'roll_name' })
        .then(() => undefined)
        .catch((err) => {
          // Do not poison the cache on a transient failure — the next save
          // should try again rather than run unindexed forever.
          this.indexReady = null;
          throw err;
        });
    }
    return this.indexReady;
  }

  async save(roll: string, name: string, bench: BenchShape): Promise<SaveInfo> {
    const r = normRoll(roll);
    if (!r) throw new Error('roll required');

    try {
      await this.ensureIndex();
    } catch (err) {
      // A pre-existing duplicate would make the index fail, but that must not
      // block saving — the upsert below is correct either way.
      console.warn('[bench] index build failed, continuing:', (err as Error).message);
    }

    const now = new Date();
    const layout = layoutOf(bench);
    const counts = { devices: bench.devices.length, wires: bench.wires.length, layout };

    try {
      await this.col.updateOne(
        { roll: r, name },
        {
          $set: { bench, ...counts, savedAt: now, schema: 1 },
          $setOnInsert: { roll: r, name, createdAt: now }
        },
        { upsert: true }
      );
    } catch (err) {
      // Two saves of the same new name racing the upsert can still collide on
      // the unique index. The loser simply retries once; by then the winner's
      // document exists and this becomes an ordinary update.
      if (!isDuplicateKey(err)) throw err;
      await this.col.updateOne(
        { roll: r, name },
        { $set: { bench, ...counts, savedAt: now, schema: 1 } }
      );
    }

    return { roll: r, name, savedAt: now.getTime() };
  }

  async list(roll?: string): Promise<BenchMeta[]> {
    const filter = roll ? { roll: normRoll(roll) } : {};
    const docs = await this.col
      .find(filter)
      // `bench` is the one field the hub never needs. Excluding it here is what
      // keeps a listing small; everything else is counts and positions.
      .project<Omit<BenchDoc, 'bench'>>({ bench: 0 })
      .sort({ savedAt: -1 })
      .limit(LIST_LIMIT)
      .toArray();

    return docs.map((d) => ({
      roll: d.roll,
      name: d.name,
      savedAt: d.savedAt instanceof Date ? d.savedAt.getTime() : Number(d.savedAt),
      createdAt: d.createdAt instanceof Date ? d.createdAt.getTime() : Number(d.createdAt),
      devices: d.devices || 0,
      wires: d.wires || 0,
      layout: Array.isArray(d.layout) ? d.layout : []
    }));
  }

  async load(roll: string, name: string): Promise<BenchShape | null> {
    const doc = await this.col.findOne({ roll: normRoll(roll), name });
    return doc ? doc.bench : null;
  }

  async remove(roll: string, name: string): Promise<void> {
    await this.col.deleteOne({ roll: normRoll(roll), name });
  }

  async rolls(): Promise<string[]> {
    const out = await this.col.distinct('roll');
    return (out as string[]).filter((r) => typeof r === 'string' && r).sort();
  }

  /** Close the pool. Used by the smoke test so the process can exit. */
  async close(): Promise<void> {
    await this.client.close().catch(() => {});
  }
}
