# Structure

## Files

- `index.html` — entry point. Contains all markup, styling, and UI layout (HUD, menu overlay, countdown, results screen, car settings panel, auth panel, leaderboard panel). Loads Three.js from CDN and `game.js`. The car settings panel uses CSS grid for alignment.
- `game.js` — all game logic in a single IIFE. No module system or build step.
- `schema.sql` — Postgres schema for users, car_settings, and best_times tables. Run manually against Neon to set up the database.
- `package.json` — server-side dependencies only (Neon driver, bcryptjs, jsonwebtoken). No client-side build.
- `.env.example` — template for required environment variables (DATABASE_URL, JWT_SECRET).

## api/ Directory

Vercel Serverless Functions. Each `.js` file becomes an endpoint at `/api/<name>`. Files prefixed with `_` are shared helpers, not exposed as endpoints.

- `_db.js` — lazy-initialized Neon Postgres connection
- `_auth.js` — JWT token creation/verification, JSON response helper
- `register.js` — POST: create user account (username + bcrypt-hashed password)
- `login.js` — POST: validate credentials, return JWT
- `settings.js` — GET/PUT: read/write car settings for the authenticated user
- `times.js` — GET/POST: read all best times or save a new best time for the authenticated user
- `leaderboard.js` — GET: top 20 times for a given track descriptor (public, no auth required)
- `challenge.js` — GET: top 20 series challenge times by challenge key (public). POST: save series challenge total time (authenticated)

## game.js Sections

The file is organized into labeled sections:

- **Persistence** — localStorage read/write for ghost replays and best times
- **Auth & remote sync** — JWT-based auth state, API request helper, remote sync for settings and best times, auth panel UI logic, leaderboard fetching and display
- **String → track points** — converts an 18-char code into polar control points with a code-derived start offset
- **Track SVG generation** — 2D Catmull-Rom interpolation to produce an SVG preview for the records panel
- **Track generation** — builds the 3D track mesh (surface, walls, start line)
- **Car settings** — loads/saves car customization from localStorage (pattern, colors, headlight shape, underglow opacity), applies settings to car mesh and light meshes
- **Car mesh creation** — creates the player and ghost car visuals, supports 9 patterns with vertex coloring for gradients
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
- **Camera** — smooth follow on the player position. Includes a showcase mode (cinematic orbits with shot transitions) and an auto-drive preview (car follows the track centerline) used in the car settings panel
- **Lighting** — headlight beams, underglow mesh/light, glow effects. Beam shape derived from headlight shape setting
- **Night mode** — 2D canvas overlay with headlight beam masking
- **Main loop** — `requestAnimationFrame` loop dispatching to the current game state
- **Sharing** — share text builder with randomized opener/closer pools, URL generation for single races (`?t=`) and series (`?s=`)
- **Init** — scene setup, renderer, ground plane, initial track build, URL parameter parsing, resize handler

## Conventions

- All code uses `var` declarations (ES5-style) inside a single IIFE
- No build tools, bundler, or transpiler
- Three.js loaded globally via CDN script tag
- UI elements referenced once at the top via `document.getElementById`
- API functions use CommonJS (`require`/`module.exports`) — Vercel's default for serverless
- Persistence is dual-write: localStorage (instant, offline) + API (remote, cross-device). localStorage acts as a fast cache; the API is the source of truth when logged in
