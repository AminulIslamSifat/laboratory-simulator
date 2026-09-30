/**
 * Bench saves on disk, via the File System Access API.
 *
 * A browser cannot write to an arbitrary path — that is a security boundary,
 * not a design choice. What it CAN do is let the user pick a folder once, then
 * read and write real files in it for the rest of the session. That is the
 * closest thing to "save my experiment to a file" a web app can offer, and it
 * is what this module does.
 *
 * The folder handle is remembered in IndexedDB, because a FileSystemDirectory
 * Handle is a structured-cloneable object that localStorage cannot hold. On
 * the next visit the handle is read back and re-permissioned with a single
 * click, so the user does not re-pick the folder every time.
 *
 * Files are plain JSON — the same BenchFile shape the Import/Export buttons
 * already use — so a save is something the user can open, edit, diff, or
 * commit. Nothing here is a private format.
 */

import type { BenchFile, BenchSlot } from './bench-store.js';

/** Minimal shape of the File System Access API we rely on. */
interface FsWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
}
export interface FsDirHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<FsFileHandle | FsDirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  removeEntry(name: string): Promise<void>;
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
}

const DB_NAME = 'eee2152-fs';
const STORE = 'handles';
const HANDLE_KEY = 'benchDir';

/** True when the browser supports picking and keeping a directory. */
export function diskSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
}

/* ── IndexedDB: remember the chosen folder ─────────────────────── */

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

async function idbDel(key: string): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/* ── folder handle lifecycle ───────────────────────────────────── */

let cachedDir: FsDirHandle | null = null;

/** The folder currently in use, or null if none has been picked yet. */
export function currentDirName(): string | null {
  return cachedDir ? cachedDir.name : null;
}

/**
 * Ask for read/write permission on a directory handle.
 *
 * A handle restored from IndexedDB comes back WITHOUT permission — the browser
 * requires a user gesture to re-grant it. queryPermission is a silent check;
 * requestPermission must be called from a click.
 */
async function ensurePermission(dir: FsDirHandle): Promise<boolean> {
  if (!dir.queryPermission) return true;
  const opts = { mode: 'readwrite' as const };
  if ((await dir.queryPermission(opts)) === 'granted') return true;
  if (!dir.requestPermission) return false;
  return (await dir.requestPermission(opts)) === 'granted';
}

/** Prompt the user to choose a folder, and remember it. */
export async function chooseDir(): Promise<string | null> {
  const picker = (window as unknown as {
    showDirectoryPicker?: (o?: { mode?: string; id?: string }) => Promise<FsDirHandle>;
  }).showDirectoryPicker;
  if (!picker) throw new Error('File System Access API not supported in this browser');
  const dir = await picker({ mode: 'readwrite', id: 'eee-benches' });
  if (!(await ensurePermission(dir))) throw new Error('permission denied');
  cachedDir = dir;
  await idbPut(HANDLE_KEY, dir);
  return dir.name;
}

/**
 * Get the folder to work in, restoring a remembered one if possible.
 *
 * Returns null when the user has never picked a folder, or when the browser
 * forgot the handle. The caller decides whether to prompt.
 */
export async function getDir(interactive = false): Promise<FsDirHandle | null> {
  if (cachedDir) return cachedDir;
  const saved = await idbGet<FsDirHandle>(HANDLE_KEY);
  if (!saved) return null;
  if (interactive) {
    if (!(await ensurePermission(saved))) return null;
  } else {
    // Non-interactive: only usable if permission is already granted.
    if (saved.queryPermission && (await saved.queryPermission({ mode: 'readwrite' })) !== 'granted') return null;
  }
  cachedDir = saved;
  return saved;
}

/** Forget the chosen folder. */
export async function forgetDir(): Promise<void> {
  cachedDir = null;
  await idbDel(HANDLE_KEY);
}

/* ── file naming ───────────────────────────────────────────────── */

/**
 * Turn a bench name into a safe file name.
 *
 * Everything outside [A-Za-z0-9._-] becomes an underscore, runs collapse, and
 * the result is capped. A name like "Exp 04 / DC shunt" must not escape the
 * chosen folder or produce a path separator.
 */
export function toFileName(name: string): string {
  const base = name
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80);
  return (base || 'bench') + '.json';
}

/* ── read / write ──────────────────────────────────────────────── */

/** Write a bench to `<dir>/<name>.json`, overwriting silently. */
export async function writeBench(dir: FsDirHandle, name: string, bench: BenchFile): Promise<string> {
  const fileName = toFileName(name);
  const fh = await dir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(bench, null, 2));
  await w.close();
  return fileName;
}

/** Read and parse one bench file from the folder. */
export async function readBench(dir: FsDirHandle, fileName: string): Promise<BenchFile> {
  const fh = await dir.getFileHandle(fileName);
  const file = await fh.getFile();
  return JSON.parse(await file.text()) as BenchFile;
}

export async function deleteBench(dir: FsDirHandle, fileName: string): Promise<void> {
  await dir.removeEntry(fileName);
}

/**
 * List every *.json bench in the folder, newest first.
 *
 * The file's own lastModified is used for the timestamp, so a bench is dated
 * by when it was written rather than when it was read.
 */
export async function listBenches(dir: FsDirHandle): Promise<BenchSlot[]> {
  const out: BenchSlot[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file') continue;
    if (!entry.name.toLowerCase().endsWith('.json')) continue;
    try {
      const fh = entry as FsFileHandle;
      const file = await fh.getFile();
      const parsed = JSON.parse(await file.text()) as BenchFile;
      if (!parsed || !Array.isArray(parsed.devices)) continue;
      out.push({
        name: entry.name.replace(/\.json$/i, ''),
        savedAt: file.lastModified,
        bench: parsed,
        fileName: entry.name
      } as BenchSlot & { fileName: string });
    } catch {
      // A file we cannot parse is not a bench. Skip it rather than failing
      // the whole listing — the folder may hold other things.
      continue;
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}