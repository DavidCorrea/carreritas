# Carreritas

A top-down racing game inspired by Haxball's visual style, built with Three.js.

## Play

[carreritas.vercel.app](https://carreritas.vercel.app)

Or serve locally:

```bash
npx serve .
```

## Controls

| Key | Action |
|---|---|
| W / Up Arrow | Accelerate |
| S / Down Arrow | Brake / Reverse |
| A / Left Arrow | Steer Left |
| D / Right Arrow | Steer Right |
| Enter | Start race |
| Space | Restart race |
| C | Cycle camera mode |
| Escape | Back to menu (from results) |

## Features

- **Track codes** — 18-character strings that deterministically generate a closed track shape. Random or hand-crafted.
- **Ghost replay** — your best run is saved per track and shown as a translucent blue car on the next attempt.
- **Direction** — race each track forward (FWD) or reversed (REV). Best times are tracked separately.
- **Night mode** — the track is invisible except where your headlights reach. Fog hides everything beyond range. Best times are tracked separately from day.
- **Series mode** — chain 2–5 stages with independent track codes, directions, and modes.
- **Camera modes** — top-down, rotated, chase, and isometric views.
- **Configurable laps** — 1 to 20 laps per race.
