/**
 * Application shell - boot screen, menu, lab mount, drawer, save/load.
 *
 * The declarative chrome around the bench: menus, overlays, file dialogs,
 * and the one place the Lab is constructed. The bench itself is imperative
 * and lives in `lab.ts`; nothing here touches the simulation directly.
 */

import { refreshIcons } from './icons.js';
import { Lab } from './lab.js';
import { PRESETS } from './presets.js';
import { REFERENCE_DOCS } from './reference.js';
import { ago, type BenchFile } from './bench-store.js';
import {
  apiAvailable, resetAvailability,
  saveBenchToServer, listServerBenches, loadBenchFromServer, deleteServerBench,
  type ServerBench
} from './bench-server.js';

/** Shorthand for getElementById, non-null because every id below is in the HTML. */
function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error('missing element: #' + id);
  return e;
}

const boot = el('boot');
const bootFill = el('boot-fill');
const bootStatus = el('boot-status');
const menu = el('menu');
const labEl = el('lab');
const kebab = el('kebab');
const drawer = el('drawer');
const drawerTtl = el('drawer-title');
const drawerBody = el('drawer-body');
const toast = el('toast');


/* ────────────────────────────────────────────────────────────────
   Boot sequence
   ──────────────────────────────────────────────────────────────── */

interface BootStep {
  pct: number;
  text: string;
  run?: () => void;
}

let lab: Lab | null = null;

const BOOT_STEPS: BootStep[] = [
  { pct: 8, text: 'Loading solver core\u2026' },
  { pct: 20, text: 'Seeding the noise stream\u2026' },
  { pct: 34, text: 'Warming the MNA matrix\u2026' },
  { pct: 50, text: 'Mounting the bench\u2026', run: () => mountLab() },
  { pct: 68, text: 'Wiring the palette\u2026' },
  { pct: 84, text: 'Loading experiment presets\u2026' },
  { pct: 96, text: 'Registering nameplates\u2026' },
  { pct: 100, text: 'Ready.' }
];

function mountLab(): void {
  lab = new Lab({
    surface: el('bench-surface'),
    world: el('bench-world'),
    wireLayer: el('wire-layer'),
    smokeLayer: el('smoke-layer'),
    palList: el('pal-list'),
    palPresets: el('pal-presets'),
    meterList: el('meter-list'),
    statusEl: el('lab-status'),
    titleEl: el('lab-title'),
    toast: toast
  });
  lab.loadPresetList(PRESETS);
  lab.bindMeterPanel();
}

function ensureLab(): Lab {
  if (!lab) mountLab();
  return lab as Lab;
}

function runBoot(): void {
  let i = 0;
  const tick = (): void => {
    if (i >= BOOT_STEPS.length) {
      setTimeout(() => {
        boot.classList.add('hidden');
        menu.classList.remove('hidden');
        refreshIcons();
      }, 220);
      return;
    }
    const step = BOOT_STEPS[i];
    bootFill.style.width = step.pct + '%';
    bootStatus.textContent = step.text;
    if (step.run) {
      try { step.run(); } catch (e) { console.error('boot step failed', step.text, e); }
    }
    i++;
    setTimeout(tick, 130);
  };
  tick();
}

/* ────────────────────────────────────────────────────────────────
   View switching
   ──────────────────────────────────────────────────────────────── */

function showLab(): void {
  menu.classList.add('hidden');
  labEl.classList.remove('hidden');
  const L = ensureLab();
  L._applyView();
  refreshIcons();
}

function showMenu(): void {
  const L = ensureLab();
  L.stop();
  labEl.classList.add('hidden');
  menu.classList.remove('hidden');
  refreshIcons();
}

/* ────────────────────────────────────────────────────────────────
   Kebab menu
   ──────────────────────────────────────────────────────────────── */

function openKebab(): void { kebab.classList.remove('hidden'); }
function closeKebab(): void { kebab.classList.add('hidden'); }

/* ────────────────────────────────────────────────────────────────
   Drawer (reference material + about)
   ──────────────────────────────────────────────────────────────── */

function openDrawer(title: string, html: string): void {
  drawerTtl.textContent = title;
  drawerBody.innerHTML = html;
  drawer.classList.remove('hidden');
  refreshIcons();
}

function closeDrawer(): void {
  drawer.classList.add('hidden');
  drawerBody.innerHTML = '';
}

function renderRefList(): void {
  let html = '<div class="ref-list">';
  REFERENCE_DOCS.forEach((doc) => {
    html += '<button class="ref-item" data-ref="' + doc.id + '">' +
      '<span class="ref-num">' + doc.num + '</span>' +
      '<span class="ref-txt"><strong>' + doc.title + '</strong>' +
      '<small>' + doc.sub + '</small></span></button>';
  });
  html += '</div>';
  openDrawer('Reference Material', html);

  drawerBody.querySelectorAll('[data-ref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.ref as string;
      const doc = REFERENCE_DOCS.find((d) => d.id === id);
      if (!doc) return;
      drawerTtl.textContent = doc.title;
      drawerBody.innerHTML =
        '<button class="ref-back" id="ref-back"><i data-lucide="arrow-left" class="lucide-icon xs"></i> All experiments</button>' +
        '<div class="ref-doc">' + doc.body() + '</div>';
      const back = document.getElementById('ref-back');
      if (back) back.addEventListener('click', renderRefList);
      refreshIcons();
    });
  });
}

function showAbout(): void {
  openDrawer('About',
    '<div class="ref-doc">' +
    '<h1>EEE-2152 \u00b7 Electrical Machines Laboratory</h1>' +
    '<p class="ref-meta">An interactive bench simulator with a live MNA solver.</p>' +
    '<h2>How it works</h2>' +
    '<p>Place equipment, wire the printed jacks, then press Run. The solver stamps a '
    + 'modified-nodal matrix from your wiring every frame and reads live meters off it.</p>' +
    '<h2>Honest limits</h2>' +
    '<p>The 3-phase rails are stamped as a balanced <strong>snapshot</strong>, not a rotating '
    + 'waveform: the step is ~16.7 ms against a 20 ms mains period, so a real phase clock '
    + 'would alias. Power factor, phase angle and slip-dependent rotor frequency are '
    + '<strong>not</strong> simulated. For nameplate and no-load studies that is irrelevant; '
    + 'for a load test it matters.</p>' +
    '<p>Contact resistance is modelled as an occasional bad joint. Thermal damage is '
    + 'permanent once it accumulates.</p>' +
    '<h2>Credits</h2>' +
    '<p>Aminul Islam Sifat \u00b7 Roll 2403123 \u00b7 Section C<br/>' +
    'Submitted to: Tasnim Sarker Joyeeta, Asst. Prof., Dept. of EEE.</p>' +
    '</div>');
}

/* ────────────────────────────────────────────────────────────────
   Save / load bench
   ──────────────────────────────────────────────────────────────── */

/**
 * Snapshot the live bench into the serialisable shape.
 *
 * Device ids are kept verbatim: the wires reference them, so a fresh id on
 * load would leave every connection pointing at a device that no longer
 * exists and the bench would sit silently dead.
 */
function captureBench(): BenchFile {
  const L = ensureLab();
  const devices = L.devices.map((d) => ({ id: d.id, kind: d.kind, x: d.x, y: d.y, rot: d.rot || 0 }));
  // Drop dangling wires before they reach disk.
  //
  // A wire can outlive its device: the undo stack snapshots the wires around
  // a deletion and re-adds them on Ctrl+Z, and if the device id was recycled
  // or the device never came back, the wire survives pointing at an id that
  // is not in `devices`. On reload that becomes a floating node the solver
  // complains about, and the wire renders to a terminal that does not exist.
  // The saved file is the one place worth enforcing this: the live wiring
  // layer stays tolerant so a half-finished edit is never silently mangled.
  const ids = new Set(devices.map((d) => d.id));
  const wires = L.wiring.wires
    .filter((w) => ids.has(w.aDev) && ids.has(w.bDev))
    .map((w) => ({ aDev: w.aDev, aTerm: w.aTerm, bDev: w.bDev, bTerm: w.bTerm }));
  return { devices, wires };
}

/**
 * Rebuild a bench from a snapshot, replacing whatever is on the surface.
 *
 * Shared by the file loader and the named-slot library so the two cannot
 * drift — a fix to the id-restoration dance below has to land once.
 */
function restoreBench(data: BenchFile): void {
  const L = ensureLab();
  L.clear();

  data.devices.forEach((d) => {
    const entry = L.place(d.kind, d.x, d.y);
    if (!entry) return;

    // Grab the DOM node BEFORE touching ids.
    //
    // `place()` minted a fresh id and rendered the node with it. The node's
    // dataset must be re-pointed to the SAVED id, and the only moment we can
    // find it is while it still carries the fresh id. The old code queried
    // AFTER assigning `entry.id = d.id`, so the selector looked for a node
    // that did not exist yet and `node` was always null: dataset.id kept the
    // fresh id while the netlist/devices used the saved one. Every wire then
    // failed to draw (pointOf() found no node for the saved id) and every
    // terminal click resolved to an id not in `devices` - the loaded bench
    // looked stale and dead. Capture first, swap second.
    const freshId = entry.id;
    const node = L.world.querySelector('.device[data-id="' + freshId + '"]') as HTMLElement | null;

    L.netlist.removeDevice(freshId);
    entry.id = d.id;
    entry.model.id = d.id;
    L.netlist.addDevice(entry.model);

    if (node) node.dataset.id = d.id;

    // Rotation is restored BEFORE any wire is drawn, so the first render
    // already has the terminals where the wires expect them.
    entry.rot = d.rot || 0;
    if (node) L.applyRotationPublic(node, entry);
  });

  (data.wires || []).forEach((w) => {
    L.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
  });

  L._renderMeters();
  L._sync();
}

/**
 * Download a bench under a given name.
 *
 * This is the ONE save mechanism every browser supports, including Firefox
 * and Zen, which do not implement the File System Access API at all. It is
 * used directly as the save path on those browsers, and as the fallback
 * wherever a folder write fails.
 */
function downloadBench(name: string, bench: BenchFile): void {
  const safe = (name.trim() || 'bench').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
  const blob = new Blob([JSON.stringify(bench, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on a later tick: tearing the blob URL down synchronously can
  // cancel the download before Firefox has started it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download the current bench, timestamped. */
function exportBench(): void {
  const L = ensureLab();
  if (!L.devices.length) { toastMsg('Nothing to save', 'warn'); return; }
  downloadBench('eee-bench-' + Date.now(), captureBench());
  toastMsg('Exported \u2713', 'ok');
}

/** Pick a JSON file and load it as the current bench. */
function importBench(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as BenchFile;
        restoreBench(data);
        closeDrawer();
        toastMsg('Bench imported \u2713', 'ok');
      } catch (err) {
        console.error(err);
        toastMsg('Invalid bench file', 'err');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

/* ────────────────────────────────────────────────────────────────
   Bench library — real files in a folder you pick
   ──────────────────────────────────────────────────────────────── */

/** Escape a string for safe interpolation into innerHTML. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/** A listed bench plus the file it came from. */
type DiskSlot = ServerBench;

/** The last bench name used, so re-saving is one Enter key. */
let lastName = '';

/**
 * Save the live bench to `<project>/benches/` on the machine running the
 * dev server.
 *
 * The browser cannot write to disk, but the Vite server it is talking to can
 * and does — that is the whole point of this path. No download prompt, no
 * permission dialog. When the app is served by something WITHOUT the bench
 * API (a plain static host), this falls back to a download so the button
 * still does something useful.
 */
async function saveNamed(): Promise<void> {
  const L = ensureLab();
  if (!L.devices.length) { toastMsg('Nothing to save', 'warn'); return; }

  const suggested = lastName || 'Exp ' + new Date().toISOString().slice(0, 10);
  const name = window.prompt('Save experiment as:', suggested);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) { toastMsg('Name required', 'warn'); return; }

  const bench = captureBench();

  if (await apiAvailable()) {
    try {
      const out = await saveBenchToServer(trimmed, bench);
      lastName = trimmed;
      toastMsg('Saved ' + out.file + ' \u2713', 'ok');
      void openBenchLibrary();
      return;
    } catch (err) {
      console.error(err);
      // The server may have restarted; re-probe before falling back so the
      // next save does not wrongly take the download path.
      resetAvailability();
    }
  }

  downloadBench(trimmed, bench);
  lastName = trimmed;
  toastMsg('Saved \u201c' + trimmed + '.json\u201d to Downloads', 'ok');
}

/** Load a bench from the server onto the bench. */
async function loadNamed(file: string): Promise<void> {
  try {
    // The library lists FILE NAMES (`Meow-1.json`), but the bench API takes a
    // NAME and appends `.json` itself (`toFileName`). Passing the file name
    // straight through asked the server for `Meow-1.json.json`, which does
    // not exist - so every load from the drawer failed with ENOENT even
    // though the file was sitting right there. Strip the extension here; the
    // server re-adds exactly one.
    const bench = await loadBenchFromServer(file.replace(/\.json$/i, ''));
    restoreBench(bench);
    lastName = file.replace(/\.json$/i, '');
    closeDrawer();
    toastMsg('Loaded \u201c' + file + '\u201d \u2713', 'ok');
  } catch (err) {
    console.error(err);
    toastMsg('Could not load', 'err');
  }
}

/** Render the bench library (server folder contents) into the drawer. */
async function openBenchLibrary(): Promise<void> {
  drawerTtl.textContent = 'Load Experiment';
  drawer.classList.remove('hidden');

  let html = '<div class="bl-actions">';
  html += '<button class="bl-btn primary" data-bl="save"><i data-lucide="save" class="lucide-icon xs"></i> Save experiment</button>';
  html += '<button class="bl-btn" data-bl="import"><i data-lucide="upload" class="lucide-icon xs"></i> Load from file</button>';
  html += '</div>';

  if (!(await apiAvailable())) {
    html += '<p class="bl-empty">The bench server is not reachable, so saving falls back to a download.<br>' +
            'Run <code>npm run dev</code> to save straight into the project folder.</p>';
    drawerBody.innerHTML = html;
    refreshIcons();
    return;
  }

  let dir = '';
  let slots: DiskSlot[] = [];
  try {
    const res = await listServerBenches();
    dir = res.dir;
    slots = res.benches;
  } catch (err) {
    console.error(err);
    html += '<p class="bl-empty">Could not read the bench folder.</p>';
    drawerBody.innerHTML = html;
    refreshIcons();
    return;
  }

  html += '<div class="bl-where">Saving to <strong>' + esc(dir) + '</strong></div>';

  if (!slots.length) {
    html += '<p class="bl-empty">No saved experiments yet.<br>Wire something up and hit <strong>Save experiment</strong>.</p>';
  } else {
    html += '<div class="bl-list">';
    for (const s of slots) {
      html += '<div class="bl-item" data-file="' + esc(s.file) + '">';
      html += '<div class="bl-main">';
      html += '<div class="bl-name">' + esc(s.name) + '</div>';
      html += '<div class="bl-meta">' + s.devices + ' device' + (s.devices === 1 ? '' : 's') + ' \u00b7 ' +
              s.wires + ' wire' + (s.wires === 1 ? '' : 's') + ' \u00b7 ' + ago(s.savedAt) + '</div>';
      html += '</div>';
      html += '<div class="bl-tools">';
      html += '<button class="bl-ico" data-act="load" title="Load"><i data-lucide="folder-open" class="lucide-icon xs"></i></button>';
      html += '<button class="bl-ico danger" data-act="delete" title="Delete"><i data-lucide="trash-2" class="lucide-icon xs"></i></button>';
      html += '</div></div>';
    }
    html += '</div>';
  }

  drawerBody.innerHTML = html;
  refreshIcons();
}

/** Delegate clicks inside the library drawer. */
drawerBody.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  const action = target.closest('[data-bl]') as HTMLElement | null;
  if (action) {
    const k = action.dataset.bl;
    if (k === 'save') void saveNamed();
    else if (k === 'import') importBench();
    return;
  }

  const item = target.closest('.bl-item') as HTMLElement | null;
  if (!item) return;
  const file = item.dataset.file as string;

  const tool = target.closest('[data-act]') as HTMLElement | null;
  if (tool) {
    const act = tool.dataset.act;
    if (act === 'load') void loadNamed(file);
    else if (act === 'delete') {
      if (window.confirm('Delete ' + file + '?')) {
        void (async () => {
          try {
            await deleteServerBench(file);
            void openBenchLibrary();
            toastMsg('Deleted', 'ok');
          } catch (err) {
            console.error(err);
            toastMsg('Could not delete', 'err');
          }
        })();
      }
    }
    return;
  }

  void loadNamed(file);
});

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function toastMsg(msg: string, cls?: string): void {
  toast.textContent = msg;
  toast.className = 'toast ' + (cls || '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 2200);
}

/* ────────────────────────────────────────────────────────────────
   Wiring the chrome
   ──────────────────────────────────────────────────────────────── */

el('go-lab').addEventListener('click', () => { showLab(); });
el('go-presets').addEventListener('click', () => {
  showLab();
  const L = ensureLab();
  // Switch the palette to its Presets tab and open the experiment drawer so
  // the user lands on the list they just asked for.
  document.querySelectorAll('.pal-tab').forEach((t) => {
    t.classList.toggle('active', (t as HTMLElement).dataset.tab === 'presets');
  });
  el('panel-equipment').classList.remove('active');
  el('panel-presets').classList.add('active');
  L._renderMeters();
});
el('go-reference').addEventListener('click', renderRefList);

el('lab-back').addEventListener('click', showMenu);
el('lab-run').addEventListener('click', () => {
  const L = ensureLab();
  if (L.running) L.stop(); else L.start();
  const btn = el('lab-run');
  btn.innerHTML = L.running
    ? '<i data-lucide="pause" class="lucide-icon xs"></i> Stop'
    : '<i data-lucide="play" class="lucide-icon xs"></i> Run';
  refreshIcons();
});
el('lab-clear').addEventListener('click', () => { ensureLab().clearWithUndo(); });
el('lab-kebab').addEventListener('click', openKebab);
el('menu-kebab').addEventListener('click', openKebab);
el('drawer-close').addEventListener('click', closeDrawer);

el('kebab').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-k]') as HTMLElement | null;
  if (!btn) return;
  closeKebab();
  const k = btn.dataset.k;
  if (k === 'reference') renderRefList();
  else if (k === 'presets') { showLab(); }
  else if (k === 'save') { showLab(); saveNamed(); }
  else if (k === 'load') { showLab(); openBenchLibrary(); }
  else if (k === 'about') showAbout();
});

// Palette tabs.
document.querySelectorAll('.pal-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = (tab as HTMLElement).dataset.tab as string;
    document.querySelectorAll('.pal-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    el('panel-equipment').classList.toggle('active', name === 'equipment');
    el('panel-presets').classList.toggle('active', name === 'presets');
  });
});

// Escape closes overlays (the Lab handles its own Escape for selection).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!kebab.classList.contains('hidden')) closeKebab();
  else if (!drawer.classList.contains('hidden')) closeDrawer();
});

// Mouse-wheel zoom on the bench must not scroll the page behind it.
el('bench-surface').addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

runBoot();
