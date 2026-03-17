# Structure

## Files

- `index.html` — entry point. Contains all markup, styling, and UI layout (HUD, menu overlay, countdown, results screen). Loads Three.js from CDN and `game.js`.
- `game.js` — all game logic in a single IIFE. No module system or build step.

## game.js Sections

The file is organized into labeled sections:

- **Persistence** — localStorage read/write for ghost replays and best times
- **String → track points** — converts an 18-char code into polar control points with a code-derived start offset
- **Track SVG generation** — 2D Catmull-Rom interpolation to produce an SVG preview for the records panel
- **Track generation** — builds the 3D track mesh (surface, walls, start line, center line)
- **Car mesh creation** — creates the player and ghost car visuals
- **Rebuild track** — tears down and reconstructs everything for a new track code
- **Player / Ghost** — player state initialization, ghost interpolation and rendering
- **Recording** — samples player position at fixed intervals for ghost replay
- **Physics** — acceleration, braking, steering, grip, friction
- **Wall collision** — point-segment distance checks against inner/outer track edges
- **Track projection & laps** — finds the player's closest point on the track centerline, tracks sector crossings to count laps
- **Series** — builds the series stage list UI, handles stage advancement
- **Input** — keyboard event handlers, menu button handlers
- **HUD** — updates lap counter, timer, speed, best time, stage indicator
- **Game state** — countdown, race start, results screen, restart flow, best runs panel
- **Camera** — smooth follow on the player position
- **Night mode** — 2D canvas overlay with headlight beam masking
- **Main loop** — `requestAnimationFrame` loop dispatching to the current game state
- **Init** — scene setup, renderer, ground plane, initial track build, resize handler

## Conventions

- All code uses `var` declarations (ES5-style) inside a single IIFE
- No build tools, bundler, or transpiler
- Three.js loaded globally via CDN script tag
- UI elements referenced once at the top via `document.getElementById`
