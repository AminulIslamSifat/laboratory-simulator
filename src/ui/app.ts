/**
 * Application shell - boot screen, menu, lab mount, drawer, save/load.
 *
 * The declarative chrome around the bench: menus, overlays, file dialogs,
 * and the one place the Lab is constructed. The bench itself is imperative
 * and lives in `lab.ts`; nothing here touches the simulation directly.
 */

import { Lab } from './lab.js';
import { PRESETS } from './presets.js';
import { REFERENCE_DOCS } from './reference.js';

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

/** Lucide, if the CDN script loaded. Every call site tolerates it being absent. */
function refreshIcons(): void {
  const lucide = (window as unknown as { lucide?: { createIcons: () => void } }).lucide;
  if (lucide) lucide.createIcons();
}

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

interface BenchFile {
  devices: Array<{ id: string; kind: string; x: number; y: number; rot?: number }>;
  wires: Array<{ aDev: string; aTerm: string; bDev: string; bTerm: string }>;
}

function saveBench(): void {
  const L = ensureLab();
  if (!L.devices.length) { toastMsg('Nothing to save', 'warn'); return; }

  const data: BenchFile = {
    devices: L.devices.map((d) => ({ id: d.id, kind: d.kind, x: d.x, y: d.y, rot: d.rot || 0 })),
    wires: L.wiring.wires.map((w) => ({ aDev: w.aDev, aTerm: w.aTerm, bDev: w.bDev, bTerm: w.bTerm }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eee-bench-' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toastMsg('Bench saved \u2713', 'ok');
}

function loadBench(): void {
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
        const L = ensureLab();
        L.clear();

        // Restore devices with their ORIGINAL ids, because the saved wires
        // reference those ids. A fresh id would leave every wire pointing at
        // a device that no longer exists and the whole bench silently dead.
        data.devices.forEach((d) => {
          const entry = L.place(d.kind, d.x, d.y);
          if (!entry) return;

          L.netlist.removeDevice(entry.id);
          entry.id = d.id;
          entry.model.id = d.id;
          L.netlist.addDevice(entry.model);

          const node = L.world.querySelector('.device[data-id="' + entry.id + '"]') as HTMLElement | null;
          if (node) node.dataset.id = d.id;

          // Restore rotation BEFORE any wire is drawn, so the first render
          // already has the terminals in the right place.
          entry.rot = d.rot || 0;
          if (node) L.applyRotationPublic(node, entry);
        });

        (data.wires || []).forEach((w) => {
          L.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
        });

        L._renderMeters();
        L._sync();
        toastMsg('Bench loaded \u2713', 'ok');
      } catch (err) {
        console.error(err);
        toastMsg('Invalid bench file', 'err');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

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
  else if (k === 'save') saveBench();
  else if (k === 'load') loadBench();
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
