# Structure

## Root Files

- `index.html` — shell markup: HUD, main menu overlay, panels (records, settings, results, leaderboard), touch controls. Links `/src/styles.css` for styling. Loads Three.js from CDN and `main.js` as the module entry point.
- `main.js` — entry: calls `applyStaticDocumentCopy()` from `src/strings.js`, then instantiates `Game` from `src/game.js`.
- `schema.sql` — Postgres schema for anonymous `best_times` (per-track rows, optional `series_run_id`). Run manually against Neon (or a local Postgres with `USE_LOCAL_DB`) to set up the database. SQL migrations live under `migrations/`.
- `package.json` — dependencies: Neon serverless driver, `pg` (local dev DB). Dev: Vite, ESLint. Scripts: `dev`, `dev:full` (Vercel dev), `build`, `preview`, `lint`, `lint:fix`.
- `vite.config.js` — Vite configuration: `outDir: dist`, `assetsInlineLimit: 0`, `target: es2025`.
- `eslint.config.mjs` — flat ESLint config for `main.js` and `src/**/*.js` (browser globals + `THREE`).
- `vercel.json` — Vercel build: runs `npm run build`, serves from `dist/`.
- `.env.example` — template for required environment variables (e.g. `DATABASE_URL`; optional `USE_LOCAL_DB` for local Postgres).
- `public/` — static assets copied as-is to `dist/` during build (e.g. `og-image.png`).

## src/ Directory

Client-side game code as ES modules.

### Core orchestration

- `game.js` — `Game` class: scene bootstrap, `requestAnimationFrame` loop, `StateMachine` (`game-states/`), session + API wiring, menu and track lifecycle, delegates race timing/recording to `Race`. On mobile, applies `strings.mobile` copy to a few `index.html` nodes and wires tap-to-start; UI panels otherwise own their DOM. In Vite dev, `init()` ends with `attachDevScreenApi` (see **Dev tooling**).
- `constants.js` — default export `Constants` (physics, car defaults + pattern list, track params including `recordInterval`, camera modes + showcase, storage keys, share base URL, menu preview FPS). Composes camera modes from `camera-modes/` and patterns from `car-patterns/`.
- `intrinsic-constants.js` — `CAR_RADIUS`, `CAMERA_HEIGHT` (import-free to avoid cycles with `constants.js`).
- `strings.js` — `strings` object for UI copy; `applyStaticDocumentCopy()` syncs selected strings into `index.html` on load.
- `race.js` — `Race`: countdown, race timer, ghost recording buffer, series stage index and per-stage results, “last run was record” flag.

### Track & car

- `track-code.js` — `TrackCode`: normalized 36-char code → 3D control points and SVG preview.
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

- `storage.js` — `Storage`: sole module touching `localStorage` (car settings, ghost encode/decode, best times).
- `session.js` — `Session`, `GuestSession`: load/save settings and bests via `Storage` only (no API ghost/best sync for challenges).
- `api.js` — `ApiClient`: HTTP helpers for leaderboard fetch and anonymous challenge submit.

### Utils

- `utils/index.js` — re-exports.
- `utils/core.js` — color helpers, Three.js dispose helpers, `formatTime`, `pickRandom`, `countryFlag`, `isMobile`, etc.
- `utils/track-descriptor.js` — `formatDescriptor`, `parseDescriptor`, `randomTrackCode`.
- `utils/challenge-seed.js` — deterministic challenge configs (`mulberry32`, UTC date helpers), `challengeKey`, `challengeLabel`, daily/weekly configs, stats messages.

### Dev tooling (Vite dev only)

- `dev-screen-preview.js` — jump to any major overlay with fake data so you do not need to run a race to inspect UI. Gated on `import.meta.env.DEV`; production builds do not register the global below.

**URL:** `?devScreen=<id>` — processed once at startup; the query param is removed with `history.replaceState` so the address bar stays clean.

**Console:** `window.__carreritasDev` — `{ screens: string[], go(id: string), dock: HTMLElement }`. Call `__carreritasDev.go('results')` (same ids as the query param). Unknown ids log a warning and the allowed list.

**Dev panel:** In dev, the same bottom-right `#dev-tools` panel (Backquote toggles) includes PERF stats plus a **Screens** section with the same shortcuts (collapse with the header toggle). Styled in `styles.css` (`.dev-tools`, `.dev-tools__screens`).

**Screen ids:** `menu`, `menu-event`, `results`, `results-stage`, `results-series`, `leaderboard`, `leaderboard-challenge`, `records`, `settings`, `qualify`, `hud`, `hud-series`.

### UI (`ui/`)

Class-based overlays; constructors bind to DOM in `index.html`; `game.js` does not manipulate those DOM trees directly. Barrel `ui/index.js` exports: `Menu`, `Hud`, `ResultsScreen`, `ResultsPresenter`, `RecordsPanel`, `LeaderboardPanel`, `SettingsPanel`.

- `menu.js` — main overlay: event vs challenges tabs, track code, laps, direction, mode, single vs series, stage list, challenge previews.
- `hud.js` — racing HUD, countdown lights, camera label.
- `results-screen.js` — post-race / post-series UI.
- `results-presenter.js` — fills results view and builds share text/URLs.

### Styles

- `styles.css` — imported from `index.html` as `/src/styles.css` (Vite resolves it). Global design tokens live in `:root` at the top of the file. **Conventions** (BEM, spacing scale, grid/layout, CSS variables): `docs/CSS.md`.

## api/ Directory

Vercel Serverless Functions. Each `.js` file becomes `/api/<name>`. Files prefixed with `_` are shared helpers, not routes.

- `_db.js` — lazy DB: Neon serverless when `DATABASE_URL` is set (default); if `USE_LOCAL_DB` is set, uses `pg` `Pool` against `DATABASE_URL`.
- `_respond.js` — small JSON response helper for handlers.
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
- Personal bests and ghosts stay in `localStorage` for everyone; **official challenge** runs (LEADERBOARD tab) can POST to `/api/submit` with a display name. CASUAL / custom tracks never hit the leaderboard API.
