// EEE-2152 Lab · App bootstrap
// Boot → menu → lab. Kebab menu wires reference docs and preset loading.
(function () {
'use strict';
const EEE = window.EEE;

/* ───────── DOM ───────── */
const $ = function (id) { return document.getElementById(id); };
const boot       = $('boot');
const bootFill   = $('boot-fill');
const bootStatus = $('boot-status');
const menu       = $('menu');
const labEl      = $('lab');

const kebab      = $('kebab');
const drawer     = $('drawer');
const drawerTtl  = $('drawer-title');
const drawerBody = $('drawer-body');
const toast      = $('toast');

/* ───────── boot sequence ───────── */
const BOOT_STEPS = [
  [10,  'Loading solver core…'],
  [28,  'Registering equipment library…'],
  [48,  'Compiling M1-2/EV · M-4/EV · GMS models…'],
  [66,  'Wiring bench surface…'],
  [82,  'Calibrating AZ-VIPS meters…'],
  [94,  'Charging capacitors…'],
  [100, 'Ready.']
];
let bootIdx = 0;
(function runBoot() {
  if (bootIdx >= BOOT_STEPS.length) {
    setTimeout(function () {
      boot.classList.add('fade');
      menu.classList.remove('hidden');
      setTimeout(function () { boot.classList.add('hidden'); }, 520);
    }, 260);
    return;
  }
  const step = BOOT_STEPS[bootIdx++];
  bootFill.style.width = step[0] + '%';
  bootStatus.textContent = step[1];
  setTimeout(runBoot, 180 + Math.random() * 180);
})();

/* ───────── lab instance (lazy) ───────── */
let lab = null;
function ensureLab() {
  if (lab) return lab;
  lab = new EEE.Lab({
    surface:    $('bench-surface'),
    world:      $('bench-world'),
    wireLayer:  $('wire-layer'),
    smokeLayer: $('smoke-layer'),
    palList:    $('pal-list'),
    palPresets: $('pal-presets'),
    meterList:  $('meter-list'),
    statusEl:   $('lab-status'),
    titleEl:    $('lab-title'),
    toast:      toast
  });
  lab.loadPresetList(EEE.PRESETS);

  // Sidebar tab switching
  const palTabs = document.querySelectorAll('.pal-tab');
  const palPanels = document.querySelectorAll('.pal-panel');
  palTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      palTabs.forEach(function (t) { t.classList.remove('active'); });
      palPanels.forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // wire meter delete buttons (event delegation)
  $('meter-list').addEventListener('click', function (e) { lab._onMeterClick(e); });
  // top bar buttons — run/stop toggle
  $('lab-run').addEventListener('click', function () {
    if (lab.running) {
      lab.stop();
      this.classList.remove('on');
      this.innerHTML = '<i data-lucide="play" class="lucide-icon xs"></i> Run';
    } else {
      lab.start();
      this.classList.add('on');
      this.innerHTML = '<i data-lucide="square" class="lucide-icon xs"></i> Stop';
    }
    if (window.lucide) lucide.createIcons();
  });
  $('lab-clear').addEventListener('click', function () {
    lab.clear();
    const runBtn = $('lab-run');
    runBtn.classList.remove('on');
    runBtn.innerHTML = '<i data-lucide="play" class="lucide-icon xs"></i> Run';
    if (window.lucide) lucide.createIcons();
  });
  $('lab-back').addEventListener('click', function () { showMenu(); });
  return lab;
}

/* ───────── screen transitions ───────── */
function showLab() {
  menu.classList.add('fade');
  setTimeout(function () {
    menu.classList.add('hidden');
    menu.classList.remove('fade');
    labEl.classList.remove('hidden');
    ensureLab();
  }, 320);
}
function showMenu() {
  if (lab) {
    lab.stop();
    const runBtn = $('lab-run');
    runBtn.classList.remove('on');
    runBtn.innerHTML = '<i data-lucide="play" class="lucide-icon xs"></i> Run';
    if (window.lucide) lucide.createIcons();
  }
  labEl.classList.add('fade');
  setTimeout(function () {
    labEl.classList.add('hidden');
    labEl.classList.remove('fade');
    menu.classList.remove('hidden');
  }, 300);
}

/* ───────── menu actions ───────── */
$('go-lab').addEventListener('click', function () {
  const L = ensureLab();
  L.loadPreset('sandbox');
  showLab();
});
$('go-presets').addEventListener('click', function () {
  const L = ensureLab();
  showLab();
  setTimeout(function () { L.loadPreset('exp04_dcgen'); }, 350);
});
$('go-reference').addEventListener('click', function () {
  openReference();
});

/* ───────── kebab menu ───────── */
function openKebab() { kebab.classList.remove('hidden'); }
function closeKebab() { kebab.classList.add('hidden'); }
$('menu-kebab').addEventListener('click', openKebab);
$('lab-kebab').addEventListener('click', openKebab);
kebab.addEventListener('click', function (e) {
  if (e.target === kebab) { closeKebab(); return; }
  const b = e.target.closest('button');
  if (!b) return;
  closeKebab();
  const k = b.dataset.k;
  if (k === 'reference') openReference();
  else if (k === 'presets')  { ensureLab(); showLab(); setTimeout(function () { lab.loadPreset('exp04_dcgen'); }, 350); }
  else if (k === 'about')    showAbout();
  else if (k === 'save')     saveBench();
  else if (k === 'load')     loadBench();
});

/* ───────── reference drawer ───────── */
function openReference() {
  renderRefList();
  drawer.classList.remove('hidden');
}
function closeDrawer() { drawer.classList.add('hidden'); drawerBody.innerHTML = ''; }
$('drawer-close').addEventListener('click', closeDrawer);

function renderRefList() {
  drawerTtl.textContent = 'Reference Material';
  let html = '<p style="font-size:12px;color:var(--muted);line-height:1.65;margin:0 0 18px">Static write-ups from the lab sessions. For the live simulation, use the presets on the left of the Laboratory.</p>';
  html += '<div class="ref-list">';
  EEE.REFERENCE_DOCS.forEach(function (d) {
    html += '<button class="ref-item" data-ref="' + d.id + '">' +
      '<span class="ref-num">' + d.num + '</span>' +
      '<span class="ref-txt"><strong>' + d.title + '</strong><small>' + d.sub + '</small></span>' +
      '</button>';
  });
  html += '</div>';
  drawerBody.innerHTML = html;
}

drawerBody.addEventListener('click', function (e) {
  const item = e.target.closest('[data-ref]');
  if (item) {
    const doc = EEE.REFERENCE_DOCS.find(function (d) { return d.id === item.dataset.ref; });
    if (!doc) return;
    drawerTtl.textContent = 'Exp ' + doc.num + ' · ' + doc.title;
    drawerBody.innerHTML = '<div class="ref-doc"><button class="back-link" id="ref-back"><i data-lucide="arrow-left" class="lucide-icon xs"></i> Back to list</button>' + doc.body() + '</div>';
    if (window.lucide) lucide.createIcons();
    $('ref-back').addEventListener('click', renderRefList);
    drawerBody.scrollTop = 0;
  }
});

/* ───────── about / toast ───────── */
function showAbout() {
  drawerTtl.textContent = 'About';
  drawerBody.innerHTML = '<div class="ref-doc">' +
    '<h1>EEE-2152 · Electrical Machines Laboratory</h1>' +
    '<p class="ref-meta">Interactive bench simulator with live MNA solver.</p>' +
    '<h2>Built for</h2>' +
    '<p>RUET · Dept. of Computer Science &amp; Engineering<br/>Course EEE-2152 — Electrical Drives &amp; Instrumentation Sessional.</p>' +
    '<h2>Bench</h2>' +
    '<p>Every machine is byte-identical to the real lab equipment — same nameplate, same terminal labels, same excitation modes. Readouts come from an MNA circuit solver running at 60 fps: <strong>noise, contact resistance, thermal damage</strong> are all simulated.</p>' +
    '<h2>How to use</h2>' +
    '<ul>' +
    '<li>Click equipment in the left palette to place it on the bench.</li>' +
    '<li>Click a terminal (red dot), then another terminal, to make a wire.</li>' +
    '<li>Click a wire to remove it, or right-click for options.</li>' +
    '<li>Press <strong>Run</strong> to energise the supplies and watch the meters.</li>' +
    '<li>Overcurrent → smoke. Let it run and you burn the machine. Reset with <strong>Clear</strong>.</li>' +
    '</ul>' +
    '<h2>Controls</h2>' +
    '<ul>' +
    '<li><strong>Left-click device</strong> — select it (highlighted outline)</li>' +
    '<li><strong>Right-click device</strong> — context menu (duplicate, info, delete)</li>' +
    '<li><strong>Right-click wire</strong> — delete wire option</li>' +
    '<li><strong>Right-click empty space</strong> — fit view, reset zoom, clear all, undo</li>' +
    '<li><strong>Delete / Backspace</strong> — remove selected device</li>' +
    '<li><strong>Ctrl+D</strong> — duplicate selected device</li>' +
    '<li><strong>Ctrl+Z</strong> — undo last deletion</li>' +
    '<li><strong>Escape</strong> — deselect / close menus</li>' +
    '<li><strong>Hover device</strong> — tooltip with name, model &amp; temperature</li>' +
    '<li><strong>Save Bench</strong> — downloads your setup as JSON</li>' +
    '<li><strong>Load Bench</strong> — restores from a saved JSON file</li>' +
    '</ul>' +
    '<h2>Credits</h2>' +
    '<p>Aminul Islam Sifat · Roll 2403123 · Section C<br/>Submitted to: Tasnim Sarker Joyeeta, Asst. Prof., Dept. of EEE.</p>' +
    '</div>';
  drawer.classList.remove('hidden');
}

function toastMsg(msg, cls) {
  toast.textContent = msg;
  toast.className = 'toast ' + (cls || '');
  clearTimeout(toastMsg._t);
  toastMsg._t = setTimeout(function () { toast.className = 'toast hidden'; }, 2200);
}

/* ───────── save / load bench ───────── */
function saveBench() {
  const L = ensureLab();
  if (!L.devices.length) { toastMsg('Nothing to save', 'warn'); return; }
  const data = {
    devices: L.devices.map(function (d) {
      return { id: d.id, kind: d.kind, x: d.x, y: d.y, rot: d.rot || 0 };
    }),
    wires: L.wiring.wires.map(function (w) {
      return { aDev: w.aDev, aTerm: w.aTerm, bDev: w.bDev, bTerm: w.bTerm };
    })
  };
  const json = JSON.stringify(data, null, 2);
  // Download as file
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eee-bench-' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toastMsg('Bench saved ✓', 'ok');
}

function loadBench() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', function () {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        const L = ensureLab();
        L.clear();
        // Restore devices with original IDs
        const idMap = {};
        data.devices.forEach(function (d) {
          const entry = L.place(d.kind, d.x, d.y);
          if (entry) {
            idMap[d.id] = entry.id;
            // Swap to original ID for wire reconnection
            L.netlist.removeDevice(entry.id);
            entry.id = d.id;
            entry.model.id = d.id;
            entry.model._labId = d.id;
            const el = L.world.querySelector('.device[data-id="' + entry.id + '"]');
            if (el) el.dataset.id = d.id;
            // Restore the saved rotation before any wire is drawn, so the
            // first render already has the terminals in the right place.
            entry.rot = d.rot || 0;
            if (el) L._applyRotation(el, entry);
            L.netlist.addDevice(entry.model);
          }
        });
        // Restore wires using original device IDs
        if (data.wires) {
          data.wires.forEach(function (w) {
            L.wiring.add(w.aDev, w.aTerm, w.bDev, w.bTerm);
          });
        }
        L._renderMeters();
        L._sync();
        toastMsg('Bench loaded ✓', 'ok');
      } catch (err) {
        toastMsg('Invalid bench file', 'err');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

/* ───────── escape closes overlays ───────── */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (!kebab.classList.contains('hidden')) closeKebab();
    else if (!drawer.classList.contains('hidden')) closeDrawer();
  }
});

})();
