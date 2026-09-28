/**
 * Entry point.
 *
 * Vite bundles from here. This file installs the icon renderer and then pulls
 * in the app shell's side effects - everything else is imported by `app.ts`.
 *
 * The old build had eight hand-ordered <script> tags in index.html, each with
 * a `?v=18` cache-buster that had to be bumped by hand in nine places. Load
 * order was load-bearing: sprites before lab, lab before app, and forgetting
 * one produced a stale-file bug that took an hour to find. A module graph
 * cannot get that wrong.
 */

import { installIcons, refreshIcons } from './ui/icons.js';
import './ui/app.js';

// Install the icon renderer and paint the static boot-screen placeholders.
// This runs after `app.js` so the app's own refreshIcons() calls resolve,
// but the icon map is registered first because `installIcons()` only assigns
// `window.refreshIcons` - the first `createIcons()` call is what actually
// replaces the <i> placeholders that index.html ships with.
installIcons();
refreshIcons();
