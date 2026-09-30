/**
 * Client for the bench save/load API served by the Vite dev server.
 *
 * The server owns the storage. This module only talks to it over HTTP, so the
 * app works the same whether the backend is MongoDB or a folder of JSON — the
 * client never knows which, and the hub reports it only so the user can tell
 * where their work went.
 *
 * ─── Rolls ───
 * Every call carries a roll number. That is the ownership key: a save is
 * `(roll, name)`, and two students may both have a bench called `Exp 3`.
 * The roll is stored in localStorage by the caller (`roll.ts`) so the user is
 * asked once per browser, not once per save.
 */

import type { BenchFile } from './bench-store.js';

/** One device position in a listing, for drawing a thumbnail. */
export interface BenchLayoutItem {
  k: string;
  x: number;
  y: number;
  r: number;
}

/** One entry in the hub. Mirrors the server's `BenchMeta`. */
export interface ServerBench {
  roll: string;
  name: string;
  savedAt: number;
  createdAt: number;
  devices: number;
  wires: number;
  layout: BenchLayoutItem[];
}

/** Result of a save, for the toast. */
export interface SaveResult {
  roll: string;
  name: string;
  savedAt: number;
  where: string;
  backend: 'mongo' | 'fs';
}

/** Result of a listing, including where the data actually lives. */
export interface ListResult {
  where: string;
  backend: 'mongo' | 'fs';
  benches: ServerBench[];
}

interface ApiError { ok: false; error: string }

/** True when the bench API answered at least once. Cached after first check. */
let apiLive: boolean | null = null;

/**
 * Probe the API.
 *
 * A plain static server has no /api/bench routes, so the app must be able to
 * fall back to a download rather than showing a broken Save button. The probe
 * is one cheap request, cached, because the answer cannot change without a
 * page reload.
 */
export async function apiAvailable(): Promise<boolean> {
  if (apiLive !== null) return apiLive;
  try {
    const res = await fetch('/api/bench/list', { method: 'GET' });
    apiLive = res.ok;
  } catch {
    apiLive = false;
  }
  return apiLive;
}

/** Force a re-probe. Used after a failure, in case the server restarted. */
export function resetAvailability(): void {
  apiLive = null;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = (await res.json()) as T | ApiError;
  if (!res.ok || (json as ApiError).ok === false) {
    throw new Error((json as ApiError).error || ('HTTP ' + res.status));
  }
  return json as T;
}

/** Write a bench under a roll number. */
export async function saveBenchToServer(roll: string, name: string, bench: BenchFile): Promise<SaveResult> {
  const out = await post<SaveResult & { ok: true }>('/api/bench/save', { roll, name, bench });
  return {
    roll: out.roll, name: out.name, savedAt: out.savedAt,
    where: out.where, backend: out.backend
  };
}

/** List saved benches. With a roll, only that student's. */
export async function listServerBenches(roll?: string): Promise<ListResult> {
  const url = roll ? '/api/bench/list?roll=' + encodeURIComponent(roll) : '/api/bench/list';
  const res = await fetch(url);
  if (!res.ok) throw new Error('list failed: HTTP ' + res.status);
  const json = (await res.json()) as ListResult & { ok: true };
  return { where: json.where, backend: json.backend, benches: json.benches };
}

/** Read one bench back. */
export async function loadBenchFromServer(roll: string, name: string): Promise<BenchFile> {
  const url = '/api/bench/load?roll=' + encodeURIComponent(roll) + '&name=' + encodeURIComponent(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error('load failed: HTTP ' + res.status);
  const json = (await res.json()) as { ok: true; bench: BenchFile };
  return json.bench;
}

/** Delete one bench. */
export async function deleteServerBench(roll: string, name: string): Promise<void> {
  await post('/api/bench/delete', { roll, name });
}

// NOTE: there is deliberately no `listRolls()` wrapper here. The hub needs
// distinct owners, and it already has the full listing, so deriving them
// client-side costs nothing and saves a request. The server keeps
// GET /api/bench/rolls for anything else that wants the list without pulling
// every bench row — but nothing in the app calls it, so a wrapper would be
// dead code that the bundler tree-shakes away while still looking live.
