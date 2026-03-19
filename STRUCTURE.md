# Structure

## Root Files

- `index.html` — entry point. Contains all markup, styling, and UI layout (HUD, menu overlay, countdown, results screen, car settings panel, auth panel, leaderboard panel). Loads Three.js from CDN and `main.js` as the module entry point. The car settings panel uses CSS grid for alignment.
- `main.js` — module entry point. Imports and instantiates `Game` from `src/game.js`. Vite uses this as the build entry.
- `schema.sql` — Postgres schema for users, car_settings, best_times, and challenge_times tables. Run manually against Neon to set up the database.
- `package.json` — server-side dependencies (Neon driver, bcryptjs, jsonwebtoken) and Vite as a dev dependency. Build scripts: `dev`, `build`, `preview`.
- `vite.config.js` — Vite configuration. Outputs to `dist/`.
- `vercel.json` — Vercel build config: runs `npm run build`, serves from `dist/`.
- `.env.example` — template for required environment variables (DATABASE_URL, JWT_SECRET).
- `public/` — static assets copied as-is to `dist/` during build (e.g., `og-image.png`).

## src/ Directory

All client-side game code lives here as ES modules.

- `game.js` — `Game` class orchestrator. Owns the game loop, scene setup, state transitions (menu, countdown, racing, results, settings), and coordinates all UI modules. Contains no direct DOM manipulation beyond one-time mobile init.
- `constants.js` — game constants (`C` object): physics, car defaults, track parameters, camera config, storage keys, share text, country list.
- `storage.js` — localStorage helpers (ghost replay encoding/decoding, best time persistence) and `GuestSession` (localStorage-only session).
- `utils.js` — shared utilities: color conversion (`hexToInt`, `hexToRgb`, `intToHex`), Three.js cleanup (`disposeMesh`, `disposeGroup`), and time formatting (`formatTime`).
- `track.js` — track generation from code strings: polar control points, Catmull-Rom interpolation, 3D mesh building (surface, walls, start line), SVG preview, and start position calculation.
- `car-mesh.js` — car visual creation: shared geometries, 9 pattern types with vertex coloring for gradients.
- `player.js` — `Player` class: position, velocity, angle, physics updates, wall collision, track projection, and lap tracking.
- `ghost.js` — `Ghost` class: replay interpolation and rendering of a ghost car from recorded data.
- `camera.js` — `Camera` class: orthographic/perspective modes, smooth follow, showcase cinematic mode with shot transitions.
- `night.js` — `NightRenderer` class: headlight beams, glow effects, underglow mesh/light for night mode.
- `input.js` — keyboard and touch input abstraction: raw state tracking, touch element lookup, and normalized `{ accel, steer }` output. Looks up its own touch DOM elements internally.
- `auth.js` — authentication state, JWT token management, API request helper, `UserSession` factory, leaderboard fetching.
- `hud.js` — `createHUD()` factory: racing HUD (lap counter, timer, speed, best time, stage display), countdown semaphore lights, and camera label. All DOM elements are internal.
- `results.js` — `createResults()` factory: results screen with title, track text, lap rows, copy/share/leaderboard buttons, and prompt text. All DOM elements are internal.
- `menu.js` — `createMenu()` factory: main overlay, track code input, tab switching, challenge preview, laps/direction/mode/race-type controls, stage list builder, and touch controls visibility. Largest UI module.
- `panels.js` — four factory functions: `createRecords()` (personal best times), `createLeaderboard()` (online rankings), `createAuthPanel()` (login/register form), `createAccountBar()` (username display and login/logout buttons). All DOM elements are internal.
- `settings-panel.js` — `createSettingsPanel()` factory: car color/pattern/headlight/underglow settings, pattern preview canvases, camera and preview drive toggles. All DOM elements are internal.

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

## Conventions

- Client code uses ES modules with `import`/`export` throughout `src/`
- Stateful game objects are lightweight classes (`Player`, `Ghost`, `Camera`, `NightRenderer`) with explicit dependency injection via constructors/methods
- UI modules are factory functions (`createHUD()`, `createResults()`, `createMenu()`, etc.) that encapsulate their DOM elements and expose intent-revealing methods. `game.js` never touches raw DOM elements for UI.
- Pure logic and UI helpers are plain module functions (no unnecessary classes)
- Shared Three.js geometries/materials are marked with `_shared = true` to prevent accidental disposal
- Vite builds and bundles the client code with content-hashed filenames for cache-busting
- Three.js loaded globally via CDN script tag (pre-module, available as `THREE` global)
- API functions use CommonJS (`require`/`module.exports`) — Vercel's default for serverless
- Best times are always saved to localStorage. The API is only used for race challenge times (daily race, weekly race) and series challenge totals — personal random-track bests stay client-side only. Car settings sync bidirectionally via the API when logged in
