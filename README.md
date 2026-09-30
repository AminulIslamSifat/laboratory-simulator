# EEE-2152 · Electrical Machines Laboratory

An interactive bench simulator for the Electrical Machines Laboratory course (EEE-2152), Department of CSE, RUET.

Place real lab equipment on a bench, wire the terminals up, energise the supply, and read live measurements from a Modified Nodal Analysis (MNA) solver — all in the browser.

## What it does

- **Real bench, real wiring.** Every device exposes the terminals its panel actually paints. Click a jack, click another, a wire appears. Wire a terminal that does not exist and the preset loader refuses it loudly instead of building a dead bench.
- **Live MNA solver.** A dense linear solve per frame, with honest singularity reporting. A floating node says so; it does not quietly return a plausible-looking voltage.
- **Rotating machines.** DC machines, 3φ and 1φ induction motors, a synchronous generator — coupled through shaft couplings, with a mechanical pass that locks their rotors together.
- **Thermal model.** Every element has a heat capacity and a thermal resistance. Overload it and it heats, smokes, accumulates damage, and eventually dies.
- **Presets.** Pre-wired benches for the course experiments (Exp 01–06, plus extras), matching the procedures in `References/`.
- **Save / load.** Named benches saved to disk, with no browser permission dialog and no download prompt when served by the dev or preview server.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Then open the lab, or load one of the experiment presets from the left palette.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `:5173` (localhost only) |
| `npm run build` | Type-check, run the shaft check, and build the single-file `dist/index.html` |
| `npm run preview` | Serve the built `dist/` — **with** the bench API mounted |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite |
| `npm run check` | Geometry check: every shaft flange sits on its terminal |

## How save / load works

> [!IMPORTANT]
> A browser cannot write to disk. That is the browser's security boundary, not a design choice. Something with filesystem access has to be running for a save to reach a file.

The bench API (`bench-api.ts`) is a **Vite plugin** that mounts `/api/bench/*` routes on the **dev** and **preview** servers:

| Route | Purpose |
| --- | --- |
| `POST /api/bench/save` | Write `<project>/benches/<name>.json` |
| `GET /api/bench/list` | List saved benches |
| `GET /api/bench/load?name=` | Read one back |
| `POST /api/bench/delete` | Remove one |

Because it hooks **both** `configureServer` and `configurePreviewServer`, running `npm run preview` gives you a real server with working saves — no browser API, no download fallback.

On a **plain static host** (no Node process) there are no `/api/bench` routes, so the app probes once and falls back to a download for save, and the File System Access folder picker where the browser supports it.

Names are sanitised and the resolved path is checked to stay inside `benches/`, so a name like `../../.ssh/id` cannot escape the folder.

## Deploying to Render

`render.yaml` describes a **web** service (not a static site), because the bench API needs a running Node process to write files.

1. Push the repo.
2. Render → **New** → **Blueprint** → pick the repo.
3. Render reads `render.yaml` and deploys.

The service runs `npm ci && npm run build`, then `npm run preview`, bound to `0.0.0.0` and `$PORT` (wired in `vite.config.ts`).

> [!WARNING]
> `benches/` lives on the container filesystem. On the free plan it resets on every deploy or restart. `render.yaml` declares a **persistent disk** mounted at `benches/` so saves survive — that disk is a paid feature.

## Project layout

```
src/
  engine/       solver, netlist, linalg, thermal, rng — no DOM
  devices/      one folder per device: sprite.ts, layout.ts, model.ts
  ui/           lab, wiring, presets, app shell, save/load
  main.ts       entry point
benches/        saved benches (JSON)
References/     nameplates, procedures, text diagrams
assets/         stylesheet
```

Each device owns its whole self: the SVG it paints, the terminal layout the lab reads, and the model the solver stamps. That is deliberate — the terminal list a model reads and the list a panel draws are the same file, so they cannot drift apart.

## Tests

```bash
npm test
```

Integration tests build real benches, wire them, run the solver, and assert on the readouts. The realism audit checks power balance across coupled machines.

## Built with

- **Vite** + **TypeScript**
- **Vitest** for tests
- **lucide** for icons (bundled, tree-shaken — no CDN, works offline)
- `vite-plugin-singlefile` — the build emits **one** self-contained `dist/index.html` that runs from any path, including `file://`

## Author

Shadow · Roll 2403000 · Sec C · Dept. of CSE, RUET
