/**
 * Entry point.
 *
 * Vite bundles from here. The only thing this file does is pull in the app
 * shell's side effects - everything else is imported by `app.ts`.
 *
 * The old build had eight hand-ordered <script> tags in index.html, each with
 * a `?v=18` cache-buster that had to be bumped by hand in nine places. Load
 * order was load-bearing: sprites before lab, lab before app, and forgetting
 * one produced a stale-file bug that took an hour to find. A module graph
 * cannot get that wrong.
 */

import './ui/app.js';