# Structure

## Root Files

- `index.html` — shell markup: HUD, auth overlay, main menu overlay, panels (records, settings, results, leaderboard), touch controls. Links `/src/styles.css` for styling. Loads Three.js from CDN and `main.js` as the module entry point.
- `main.js` — entry: calls `applyStaticDocumentCopy()` from `src/strings.js`, then instantiates `Game` from `src/game.js`.
- `schema.sql` — Postgres schema for users, car_settings, and anonymous `best_times` (per-track rows, optional `series_run_id`; no `challenge_times`). Run manually against Neon (or a local Postgres with `USE_LOCAL_DB`) to set up the database. SQL migrations live under `migrations/`.
- `package.json` — dependencies: Neon serverless driver, `pg` (local dev DB), bcryptjs, jsonwebtoken. Dev: Vite, ESLint. Scripts: `dev`, `dev:full` (Vercel dev), `build`, `preview`, `lint`, `lint:fix`.
- `vite.config.js` — Vite configuration: `outDir: dist`, `assetsInlineLimit: 0`, `target: es2025`.
- `eslint.config.mjs` — flat ESLint config for `main.js` and `src/**/*.js` (browser globals + `THREE`).
- `vercel.json` — Vercel build: runs `npm run build`, serves from `dist/`.
- `.env.example` — template for required environment variables (e.g. `DATABASE_URL`, `JWT_SECRET`; optional `USE_LOCAL_DB` for local Postgres).
- `public/` — static assets copied as-is to `dist/` during build (e.g. `og-image.png`).

## src/ Directory

Client-side game code as ES modules.

### Core orchestration

- `game.js` — `Game` class: scene bootstrap, `requestAnimationFrame` loop, `StateMachine` (`game-states/`), session/auth/API wiring, menu and track lifecycle, delegates race timing/recording to `Race`. On mobile, applies `strings.mobile` copy to a few `index.html` nodes and wires tap-to-start; UI panels otherwise own their DOM.
- `constants.js` — default export `Constants` (physics, car defaults + pattern list, track params including `recordInterval`, camera modes + showcase, storage keys, share base URL, menu preview FPS, countries). Composes camera modes from `camera-modes/` and patterns from `car-patterns/`.
- `intrinsic-constants.js` — `CAR_RADIUS`, `CAMERA_HEIGHT` (import-free to avoid cycles with `constants.js`).
- `strings.js` — `strings` object for UI copy; `applyStaticDocumentCopy()` syncs selected strings into `index.html` on load.
- `race.js` — `Race`: countdown, race timer, ghost recording buffer, series stage index and per-stage results, “last run was record” flag.

### Track & car

- `track-code.js` — `TrackCode`: normalized 18-char code → 3D control points and SVG preview.
- `track.js` — `Track` class: 3D track mesh (surface, walls, start line) and `getStartPosition()`.
- `car-geometries.js` — shared Three.js geometries for the car mesh.
- `car-mesh.js` — `CarMesh`: builds the car from geometries + pattern coloring.
- `car-patterns/` — `CarPattern` subclasses (solid, ring, half, stripe, gradient, radial, spiral, dots, bullseye); barrel `car-patterns/index.js`.
- `player.js` — `Player`: position, velocity, angle, physics, wall collision, track projection, lap tracking.
- `ghost.js` — `Ghost`: replay interpolation and rendering.

### Camera & rendering

- `camera-modes/` — `CameraMode` implementations: top-down, rotated, chase, first-person, isometric; barrel `camera-modes/index.js`.
- `camera.js` — `Camera`: mode switching, follow, showcase cinematic shots.
- `renderers/` — base `Renderer` plus `DayRenderer` / `NightRenderer` (lighting, fog, night headlights/underglow).

### Input & modes

- `input-controllers/` — `KeyboardInputController`, `MobileInputController`; `Input` in `input.js` picks one via `canHandle`.
- `directions/` — `Direction` / `FwdDirection` (+ rev): sector order and start pose.
- `modes/` — `Mode` / `DayMode` / `NightMode`: visual mode for storage keys and rendering.
- `challenge-modes/` — `ChallengeMode` enum-style values for daily/weekly race and series.

### State & run type

- `game-states/` — `StateMachine`, `MenuState`, `CountdownState`, `RacingState`, `FinishedState`, `InputContext`.
- `run-context/` — `RunContext` base plus `EventRunContext` and `ChallengeRunContext` (leaderboard routing, share lines, challenge keys).

### Data & HTTP

- `storage.js` — `Storage`: sole module touching `localStorage` (car settings, auth blob, ghost encode/decode, best times).
- `session.js` — `Session`, `GuestSession`, `UserSession`: load/save settings and bests via `Storage` only (no API ghost/best sync for challenges).
- `auth.js` — `Auth`: JWT in memory + persistence via `Storage`.
- `user.js` — `UserProfile`: username/country display via `Storage`.
- `api.js` — `ApiClient`: HTTP helpers for auth, settings, times, leaderboard, challenges.

### Utils

- `utils/index.js` — re-exports.
- `utils/core.js` — color helpers, Three.js dispose helpers, `formatTime`, `pickRandom`, `countryFlag`, `isMobile`, etc.
- `utils/track-descriptor.js` — `formatDescriptor`, `parseDescriptor`, `randomTrackCode`.
- `utils/challenge-seed.js` — deterministic challenge configs (`mulberry32`, UTC date helpers), `challengeKey`, `challengeLabel`, daily/weekly configs, stats messages.

### UI (`ui/`)

Class-based overlays; constructors bind to DOM in `index.html`; `game.js` does not manipulate those DOM trees directly. Barrel `ui/index.js` exports: `Menu`, `Hud`, `ResultsScreen`, `ResultsPresenter`, `RecordsPanel`, `LeaderboardPanel`, `AuthPanel`, `SettingsPanel`.

- `menu.js` — main overlay: event vs challenges tabs, track code, laps, direction, mode, single vs series, stage list, challenge previews.
- `hud.js` — racing HUD, countdown lights, camera label.
- `results-screen.js` — post-race / post-series UI.
- `results-presenter.js` — fills results view and builds share text/URLs.

### Styles

- `styles.css` — imported from `index.html` as `/src/styles.css` (Vite resolves it).

## api/ Directory

Vercel Serverless Functions. Each `.js` file becomes `/api/<name>`. Files prefixed with `_` are shared helpers, not routes.

- `_db.js` — lazy DB: Neon serverless when `DATABASE_URL` is set (default); if `USE_LOCAL_DB` is set, uses `pg` `Pool` against `DATABASE_URL`.
- `_auth.js` — JWT create/verify, JSON response helper.
- `register.js` — POST: create user (username, bcrypt password, country).
- `login.js` — POST: credentials → JWT.
- `settings.js` — GET/PUT: car settings for authenticated user.
- `times.js` — legacy stub: GET empty; POST returns 410 (use `/api/submit` for challenge times).
- `leaderboard.js` — GET: top **10** for a track descriptor (`display_name`, `username` alias); champion `ghost_data` / `car_settings` on #1 only.
- `challenge.js` — GET: series aggregate leaderboard from `best_times` by challenge key; no POST (submissions via `/api/submit`).
- `submit.js` — POST: anonymous single-track or series batch (`display_name`, top-10 trim, shared `series_run_id` for series stages).
- `_challenge-seed.js`, `_leaderboardDb.js` — shared helpers for challenge parsing and DB trim.

## Conventions

- Client code uses ES modules (`import`/`export`) under `src/`.
- Stateful objects are small classes with constructor injection where it keeps boundaries clear (`Player`, `Ghost`, `Camera`, `Race`, UI classes).
- Shared Three.js geometries/materials use `_shared = true` where applicable to avoid accidental disposal.
- Vite bundles the app with content-hashed filenames; Three.js remains a global from a CDN script tag before `main.js`.
- API handlers use CommonJS (`require`/`module.exports`) for Vercel serverless.
- Personal bests and ghosts stay in `localStorage` for everyone; **official challenge** runs (LEADERBOARD tab) can POST to `/api/submit` with a display name. CASUAL / custom tracks never hit the leaderboard API. Car settings still sync via `/api/settings` when logged in.
