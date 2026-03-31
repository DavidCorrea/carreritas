# Carreritas

A top-down racing game inspired by Haxball's visual style, built with Three.js (CDN) and Vite.

## Play

[carreritas.vercel.app](https://carreritas.vercel.app)

## Local development

```bash
npm install
npm run dev
```

Opens the Vite dev server (hot reload for client code).

Build and preview production bundle:

```bash
npm run build
npm run preview
```

Lint:

```bash
npm run lint
```

Full stack against Vercel routes locally: `npm run dev:full` (requires Vercel CLI and env). For a static smoke test of the built app: `npx serve dist` after `npm run build`.

## Controls

| Key | Action |
|-----|--------|
| W / Up Arrow | Accelerate |
| S / Down Arrow | Brake / Reverse |
| A / Left Arrow | Steer Left |
| D / Right Arrow | Steer Right |
| Enter | Start race |
| Space | Restart race |
| C | Cycle camera mode |
| Escape | Back to menu (from results) |

Touch controls are available on supported mobile layouts.

## Features

- **Track codes** — 36-character strings that deterministically generate a closed track. Random or hand-crafted; start/finish placement varies per code.
- **Track descriptor** — compact string for full race config (code, direction, day/night, laps); used in URLs, copy/share, and records.
- **Ghost replay** — your best run per config is saved locally and shown as a translucent car on the next attempt.
- **Best runs** — list personal bests with SVG previews; retry any run from the panel.
- **Challenges** — daily and weekly **race** and **series** modes: same seed for every player (UTC). Leaderboard-backed via anonymous submit.
- **Direction** — forward (FWD) or reversed (REV); times tracked separately.
- **Day / night** — night limits visibility to headlight range; times tracked separately.
- **Series** — chain 2–5 stages with per-stage track, direction, and mode; shared lap count.
- **Camera modes** — top-down, rotated, chase, isometric.
- **Laps** — configurable lap count per race or series.
- **Leaderboards** — top times for the current track descriptor or challenge (from results or menu). Car settings and ghosts stay in localStorage.

See `DOMAIN.md` for terminology and `STRUCTURE.md` for how the repo is laid out.
