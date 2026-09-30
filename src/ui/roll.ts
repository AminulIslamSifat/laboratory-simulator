/**
 * Who is saving.
 *
 * ─── Why a roll number ───
 *
 * Experiments are now shared: they live in a database that any browser on any
 * machine can reach. Without an owner, two students in the same lab would
 * overwrite each other's `Exp 3` and neither would understand why. The roll
 * is the key that scopes a save, so it has to be captured before the first
 * write and remembered after.
 *
 * ─── Why not `window.prompt` ───
 *
 * The old save flow used `window.prompt` for the bench name. It works, and it
 * looks like a browser error dialog, cannot be styled, and on some platforms
 * is blocked entirely. A roll number is asked on first save and then never
 * again, so it is worth one small styled modal rather than the native box.
 *
 * The value lives in localStorage. That is per-browser, which is the right
 * scope: the lab PC remembers the last student who saved, and a shared
 * machine can switch rolls with the `change` link in the hub.
 */

const KEY = 'eee2152.roll.v1';

/**
 * Normalise a roll the same way the server does.
 *
 * Uppercased, letters and digits only. Both ends must agree exactly or a
 * bench saved as `2403000 ` would be invisible to a lookup for `2403000`.
 */
export function normRoll(roll: string): string {
  return String(roll || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 24);
}

/** The remembered roll, or '' when this browser has never saved. */
export function getRoll(): string {
  try {
    return normRoll(localStorage.getItem(KEY) || '');
  } catch {
    // Private mode can throw on localStorage access. An empty roll is
    // recoverable: the modal asks, and the save still works.
    return '';
  }
}

export function setRoll(roll: string): void {
  try {
    localStorage.setItem(KEY, normRoll(roll));
  } catch {
    // Not being able to remember the roll is not a reason to refuse it.
  }
}

/**
 * Escape a string for safe interpolation into innerHTML.
 *
 * Duplicated from app.ts rather than exported, because importing it would
 * make this module depend on the app shell for one four-line function. The
 * roll is sanitised to [A-Z0-9] before it ever gets here, but the modal also
 * echoes a typed value back, so it is escaped on principle.
 */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/**
 * Ask for a roll number, or return the remembered one.
 *
 * Resolves to a normalised roll, or null when the user cancelled — a cancel
 * must abort the save, not save under an empty owner.
 */
export function askRoll(reason?: string): Promise<string | null> {
  const existing = getRoll();
  if (existing && !reason) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'roll-overlay';
    overlay.innerHTML =
      '<div class="roll-card" role="dialog" aria-modal="true" aria-label="Roll number">' +
        '<div class="roll-crest"><i data-lucide="id-card" class="lucide-icon"></i></div>' +
        '<h3 class="roll-title">' + (reason ? 'Change roll number' : 'Your roll number') + '</h3>' +
        '<p class="roll-sub">Experiments are saved under your roll, so only you can overwrite them.</p>' +
        '<input class="roll-input" type="text" inputmode="numeric" autocomplete="off" ' +
          'spellcheck="false" placeholder="e.g. 2403000" value="' + esc(existing) + '" />' +
        '<p class="roll-err" hidden>Enter a roll number.</p>' +
        '<div class="roll-actions">' +
          '<button class="roll-btn ghost" data-r="cancel">Cancel</button>' +
          '<button class="roll-btn primary" data-r="ok">Save experiment</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    const input = overlay.querySelector('.roll-input') as HTMLInputElement;
    const err = overlay.querySelector('.roll-err') as HTMLElement;

    // Icons are rendered by a global installed in main.ts. Guarded because a
    // unit test can reach this module without booting the app.
    const refresh = (window as unknown as { refreshIcons?: () => void }).refreshIcons;
    if (typeof refresh === 'function') refresh();

    // Focus after the element is in the document, or the caret lands nowhere.
    input.focus();
    input.select();

    const finish = (value: string | null): void => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(value);
    };

    const submit = (): void => {
      const r = normRoll(input.value);
      if (!r) {
        err.hidden = false;
        input.focus();
        return;
      }
      setRoll(r);
      finish(r);
    };

    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    }

    overlay.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest('[data-r]') as HTMLElement | null;
      if (btn) {
        if (btn.dataset.r === 'ok') submit();
        else finish(null);
        return;
      }
      // Click on the backdrop (not the card) cancels, like every other modal.
      if (t === overlay) finish(null);
    });

    input.addEventListener('input', () => { err.hidden = true; });
    document.addEventListener('keydown', onKey, true);
  });
}

/**
 * Resolve the roll for a save, asking only when nothing is remembered.
 *
 * Kept separate from `askRoll` so the save path reads as one call and the
 * "already known" case never touches the DOM.
 */
export async function rollForSave(): Promise<string | null> {
  const known = getRoll();
  if (known) return known;
  return askRoll();
}
