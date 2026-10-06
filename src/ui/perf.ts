/**
 * Viewport capability gate.
 *
 * The bench is one app asked to run on two very different machines. On a
 * desktop the compositor and the rasteriser are, for practical purposes, free:
 * a full-screen backdrop blur, an SVG filter over a rotating rotor, and a
 * forced reflow per frame all disappear into a GPU that was idle anyway. On a
 * phone each of those is drawn from a budget roughly a fifth the size, and
 * together they are the difference between a smooth bench and two frames a
 * second.
 *
 * Everything gated on this flag changes HOW MUCH is redrawn, never WHAT is
 * drawn. The physics, the wiring, the readouts and the solver are identical
 * either way — a bench solved on a phone produces the same numbers as the
 * same bench solved on a desktop.
 *
 * The query is deliberately the SAME 900px breakpoint `assets/style.css`
 * already uses for the phone layout, so "mobile view" here means exactly "the
 * presentation the stylesheet already considers a phone". A desktop window is
 * never touched by any of it.
 */

/** Must match the `@media (max-width: 900px)` breakpoint in style.css. */
const MOBILE_QUERY = '(max-width: 900px)';

let query: MediaQueryList | null = null;
let mobile = false;

/**
 * Resolve the flag once and keep it live.
 *
 * This is read at the top of per-frame functions, so it has to be a property
 * test and NOT a `matchMedia` call — that would allocate a MediaQueryList
 * sixty times a second, which is exactly the kind of cost this module exists
 * to remove.
 */
function ensure(): void {
  if (query || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  query = window.matchMedia(MOBILE_QUERY);
  mobile = query.matches;
  const on = (e: MediaQueryListEvent): void => { mobile = e.matches; };
  // `addEventListener` on a MediaQueryList is the modern form; Safari below 14
  // only has the deprecated `addListener`. Both are wired so a rotation or a
  // window drag switches the flag without a reload.
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', on);
  } else if (
    typeof (query as unknown as { addListener?: (f: (e: MediaQueryListEvent) => void) => void }).addListener === 'function'
  ) {
    (query as unknown as { addListener: (f: (e: MediaQueryListEvent) => void) => void }).addListener(on);
  }
}

/** True when the viewport is in the phone layout. */
export function isMobileView(): boolean {
  ensure();
  return mobile;
}
