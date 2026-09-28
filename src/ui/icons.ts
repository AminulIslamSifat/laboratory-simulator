/**
 * Icon rendering.
 *
 * Lucide is BUNDLED, not fetched. The previous build loaded it from
 * `unpkg.com/lucide@latest` in a script tag, which meant:
 *
 *   · the lab did not work offline at all - the single hardest requirement
 *     for a tool students run on a lab machine with no network
 *   · `@latest` is unpinned, so the icon set could change under the app
 *     without a single line of this repo changing
 *
 * Only the icons actually referenced are imported. The full lucide set is
 * ~1,600 icons; this app draws 28 of them, and importing the whole thing
 * would add roughly half a megabyte to the bundle for nothing.
 *
 * `createIcons()` scans the document for `[data-lucide="name"]` and replaces
 * each element with the matching `<svg>`. Because every list here is built by
 * assigning `innerHTML`, the placeholder elements come back on each rebuild
 * and have to be converted again - so call `refreshIcons()` after any
 * innerHTML write that contains icon markup.
 *
 * Adding an icon means adding it to BOTH the import and the ICONS map below.
 * Miss one and the element stays an empty `<i>` - visible as a blank gap, not
 * a crash, which is why the map is spelled out rather than derived.
 */

import {
  createIcons,
  Activity,
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Cog,
  Copy,
  Flame,
  FlaskConical,
  FolderOpen,
  Gauge,
  Info,
  Layers,
  Link,
  Maximize2,
  MoreVertical,
  MousePointer2,
  Pause,
  Play,
  PlugZap,
  RotateCcw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Waves,
  X,
  Zap
} from 'lucide';

/**
 * PascalCase keys, matching how lucide names its exports.
 *
 * The `data-lucide` attribute is kebab-case ('rotate-ccw'); lucide converts
 * the two internally, so this map keys on the export name and the lookups
 * still resolve.
 */
const ICONS = {
  Activity,
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Cog,
  Copy,
  Flame,
  FlaskConical,
  FolderOpen,
  Gauge,
  Info,
  Layers,
  Link,
  Maximize2,
  MoreVertical,
  MousePointer2,
  Pause,
  Play,
  PlugZap,
  RotateCcw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Waves,
  X,
  Zap
};

let installed = false;

/**
 * Convert every `[data-lucide]` placeholder in the document to an SVG.
 *
 * Safe to call before the DOM exists and safe to call repeatedly: with no
 * placeholder present it is a no-op, which is why the old `window.lucide &&`
 * guards are no longer needed at call sites.
 */
export function refreshIcons(): void {
  if (typeof document === 'undefined') return;
  createIcons({ icons: ICONS });
}

/**
 * Mark lucide as installed and expose it for the inline `onclick` handlers in
 * index.html.
 *
 * The static markup ships with 20-odd `<i data-lucide>` placeholders, and the
 * module graph cannot reach them until it has loaded - by which point the
 * boot screen is already on screen. Exposing `refreshIcons` on `window` lets
 * the tiny inline script in index.html fill them in immediately.
 */
export function installIcons(): void {
  if (installed) return;
  installed = true;
  (window as unknown as { refreshIcons?: () => void }).refreshIcons = refreshIcons;
}
