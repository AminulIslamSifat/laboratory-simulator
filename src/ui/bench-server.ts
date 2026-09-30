/**
 * Client for the bench save/load API served by the Vite dev server.
 *
 * The server owns the disk. This module only talks to it over HTTP, so the
 * app works the same whether it is served by `vite dev`, `vite preview`, or
 * anything else that mounts the bench-api plugin.
 *
 * A bench is written to `<project>/benches/<name>.json` by the server, with
 * no download prompt and no browser permission dialog.
 */

import type { BenchFile } from './bench-store.js';

/** One entry in the server's bench listing. */
export interface ServerBench {
  name: string;
  file: string;
  savedAt: number;
  devices: number;
  wires: number;
}

/** Result of a save, for the toast. */
export interface SaveResult {
  file: string;
  dir: string;
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

/** Write a bench to the server's folder. */
export async function saveBenchToServer(name: string, bench: BenchFile): Promise<SaveResult> {
  const out = await post<{ ok: true; file: string; dir: string }>('/api/bench/save', { name, bench });
  return { file: out.file, dir: out.dir };
}

/** List every saved bench. */
export async function listServerBenches(): Promise<{ dir: string; benches: ServerBench[] }> {
  const res = await fetch('/api/bench/list');
  if (!res.ok) throw new Error('list failed: HTTP ' + res.status);
  const json = (await res.json()) as { ok: true; dir: string; benches: ServerBench[] };
  return { dir: json.dir, benches: json.benches };
}

/** Read one bench back. */
export async function loadBenchFromServer(file: string): Promise<BenchFile> {
  const res = await fetch('/api/bench/load?name=' + encodeURIComponent(file));
  if (!res.ok) throw new Error('load failed: HTTP ' + res.status);
  const json = (await res.json()) as { ok: true; bench: BenchFile };
  return json.bench;
}

/** Delete one bench. */
export async function deleteServerBench(file: string): Promise<void> {
  await post('/api/bench/delete', { name: file });
}