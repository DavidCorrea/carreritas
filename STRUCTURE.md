# Structure

## Files

- `index.html` — entry point. Contains all markup, styling, and UI layout (HUD, menu overlay, countdown, results screen, car settings panel, auth panel, leaderboard panel). Loads Three.js from CDN and `game.js`. The car settings panel uses CSS grid for alignment.
- `game.js` — all game logic in a single IIFE. No module system or build step.
- `schema.sql` — Postgres schema for users, car_settings, best_times, and challenge_times tables. Run manually against Neon to set up the database.
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
- **Sessions** — GuestSession (localStorage-only) and UserSession (dual-write to localStorage + API) abstractions for settings, best times, and records
- **Auth** — JWT token management, login/register/logout UI, auth panel, account bar, API request helper, local data upload on login, leaderboard fetching and display
- **String → track points** — converts an 18-char code into polar control points with a code-derived start offset
- **Track SVG generation** — 2D Catmull-Rom interpolation to produce an SVG preview for the records panel
- **Track generation** — builds the 3D track mesh (surface, walls, start line)
- **Car mesh creation** — creates the player and ghost car visuals, supports 9 patterns with vertex coloring for gradients
- **Rebuild track** — tears down and reconstructs everything for a new track code
- **Player** — player state initialization
- **Ghost** — ghost interpolation and rendering
- **Recording** — samples player position at fixed intervals for ghost replay
- **Physics** — acceleration, braking, steering, grip, friction
- **Wall collision** — point-segment distance checks against inner/outer track edges
- **Track projection & laps** — finds the player's closest point on the track centerline, tracks sector crossings to count laps
- **Series** — builds the series stage list UI, handles stage advancement
- **Input** — keyboard event handlers, menu button handlers, challenge mode tab/preview logic
- **HUD** — updates lap counter, timer, speed, best time, stage indicator
- **Game state** — countdown, race start, results screen, restart flow, best runs panel, share text builder
- **Settings** — car settings UI (pattern previews, color pickers, sliders), settings panel show/hide, live preview with showcase camera and auto-drive
- **Camera** — smooth follow on the player position. Includes a showcase mode (cinematic orbits with shot transitions) and an auto-drive preview (car follows the track centerline) used in the settings panel
- **Night mode (3D)** — 2D canvas overlay with headlight beam masking, headlight beams, underglow mesh/light, glow effects
- **Main loop** — `requestAnimationFrame` loop dispatching to the current game state
- **Init** — scene setup, renderer, ground plane, initial track build, URL parameter parsing, resize handler

## Conventions

- All code uses `var` declarations (ES5-style) inside a single IIFE
- No build tools, bundler, or transpiler
- Three.js loaded globally via CDN script tag
- UI elements referenced once at the top via `document.getElementById`
- API functions use CommonJS (`require`/`module.exports`) — Vercel's default for serverless
- Best times are always saved to localStorage. The API is only used for race challenge times (daily race, weekly race) and series challenge totals — personal random-track bests stay client-side only. Car settings sync bidirectionally via the API when logged in
