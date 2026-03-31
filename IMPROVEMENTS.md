# Improvements

## Three.js deprecation warning

The game loads `three.min.js` from CDN at version 0.150.0. Three.js warns that `build/three.js` and `build/three.min.js` are deprecated as of r150 and will be removed in r160. The migration path is ES Modules.

**Where:** `index.html` (Three.js `<script>` before `main.js`)
**Why it matters:** The CDN URL will stop working when Three.js removes the legacy build files.

## No test infrastructure

There are no tests. The game logic (track generation from string, lap counting, sector tracking, ghost replay interpolation, series state machine) is all testable but untested.

**Where:** project-wide
**Why it matters:** Any change to physics, lap tracking, or series flow could silently break behavior.

## User account extensions

Accounts and JWT auth were removed; leaderboards use anonymous display names and car settings stay in `localStorage`. If social features return (country filters, friends, cross-device profile), they would need a fresh design and server routes.

**Where:** future work (schema may still reference legacy `users` / `car_settings` from older deploys)
**Why it matters:** Prerequisite for social features (country rankings, friend invites, personalized friend ghosts).

## Challenge finalization and archiving

Daily and weekly challenge modes exist (client-side seeded PRNG, leaderboards, series challenge time storage). The remaining work is an automated lifecycle: a scheduled job that runs when each challenge window closes to finalize results — rank all submissions, assign medals (see "Medal system"), update user medal counts and rankings, then archive the challenge. Currently challenges just roll over when the date changes with no finalization step.

**Where:** new feature (needs backend scheduled job, challenge archive table)
**Why it matters:** Without finalization, challenge results are ephemeral — there's no historical record of who won or how players performed over time.

## Medal system

Award gold, silver, and bronze medals based on race times. Absolute thresholds are unfair on harder tracks (random codes produce wildly different layouts). Percentile-based needs a minimum player count to be meaningful. Recommended approach: percentile-based with a minimum participant threshold (e.g. top 10% gold, top 30% silver, top 60% bronze, but only if at least N players competed). Medals should only be awarded from official daily/weekly challenges — not from custom shared series, to prevent ranking inflation from easy self-made courses.

**Where:** new feature (needs challenge finalization job)
**Why it matters:** Adds progression and replayability — players have concrete goals beyond beating their own ghost.

## Custom shared series — leaderboards and invites

Series configs can be shared via URL (`?s=` parameter with comma-separated descriptors). The remaining work is the social layer: direct invites to friends from a friend list, and a shared leaderboard that compares times across players for the same series.

**Where:** new feature (needs friend system)
**Why it matters:** The sharing link is in place — players can already challenge friends by sending a URL. Adding a leaderboard and invite system would close the loop by letting them compare results.

## Global rankings

A leaderboard ranked by medals earned in daily and weekly challenges — not by raw time or total races. This keeps rankings meaningful (only official challenges count) and rewards consistency over one-off performances. Scoring could weight gold/silver/bronze (e.g. 3/2/1 points) and optionally decay over time to keep the board active.

**Where:** new feature (needs medal system and challenge finalization)
**Why it matters:** Creates a competitive layer that ties the other features together — challenges, medals, and accounts all feed into one visible ranking. Country filter on user accounts enables both national and worldwide views.

## Anti-cheat for challenges

With competitive rankings and unlimited retries, there's incentive to cheat. The current architecture runs everything client-side with no validation. Three measures, in priority order:

1. **Server-side replay verification** (highest impact). The client already records position + angle every 50ms. Change the recording to capture raw inputs (accel/steer per frame) instead. On submission, the server re-simulates from those inputs using the authoritative physics constants. If the replayed finish time doesn't match the claimed time within a small tolerance, reject it. This blocks both fake time submissions and modified-client cheats (altered speed/acceleration/friction) in one move.

2. **Signed challenge configs**. The server generates challenge parameters (track code, laps, direction, mode) and signs them. The client submits the signature back with results, proving they raced the correct track — prevents players from submitting a time from an easier track as if it were the challenge.

3. **Rate limiting**. Cap submissions per user per challenge window (e.g. 100 attempts). Unlimited retries is fine for humans, but thousands of automated attempts is a signal. Also validate that frame timing in the replay has natural variance — perfectly uniform deltas suggest automation.

Bot detection (statistical flagging of inputs that are unnaturally smooth or suspiciously optimal) is an optimization to add once abuse is actually observed, not before.

**Where:** new feature (needs backend replay simulation, challenge signing, rate limiting)
**Why it matters:** Without it, rankings and medals lose credibility the moment anyone finds they can POST a fake time. Replay verification alone makes cheating go from "paste a number in dev tools" to "write a physics simulator that produces valid replays", which eliminates the vast majority of casual cheaters.

## Ghost sync and friend ghosts

Ghosts are currently localStorage-only. Each user keeps one ghost per map config (their personal best). When racing a track a friend has also raced, show their ghost alongside your own best. The server only needs to persist ghosts for competitive or social contexts — challenge tracks and shared series. Personal random-track ghosts stay in localStorage (no server cost). See "Ghost replay compression" for reducing per-replay size before syncing.

**Where:** new feature (needs friend system and backend ghost storage)
**Why it matters:** Racing against a friend's ghost is more motivating than racing alone. Bridges single-player and social without requiring real-time multiplayer.

## Challenge history and profile page

A user's past challenge results, medal collection, and stats — total races, medal breakdown, best finishes, favorite tracks. Gives the account substance beyond a username and makes progression visible.

**Where:** new feature (needs challenge finalization and medal system)
**Why it matters:** Players want to see their history and share their achievements. A profile is the natural home for all the data these features generate.

## Spectate replays

View the top-ranked replay for any completed challenge. Learn racing lines from better players. Low effort to build since ghost recording already exists — just serve the winning replay and render it in the existing ghost system.

**Where:** new feature (needs ghost sync and challenge archive)
**Why it matters:** Watching fast players is both entertaining and educational. Turns every challenge into content beyond just a leaderboard number.

## Series templates

Preset series configs (e.g. "Sprint: 5 tracks, 1 lap, all RNG" or "Endurance: 3 tracks, 10 laps") so users don't have to configure from scratch every time. Could be built-in presets or user-created templates saved to their profile.

**Where:** new feature (client-side for built-in presets; user-saved templates need accounts)
**Why it matters:** Reduces friction when creating shared series. Common formats shouldn't require manual setup each time.

## Notifications

Notify users when: a friend invites them to a series, a challenge they participated in finalizes and medals are assigned, or someone beats their time on a shared series. Could start as in-app notifications and optionally extend to email or push.

**Where:** new feature (needs friend system and backend event system)
**Why it matters:** Without notifications, users have to manually check for updates. Notifications close the loop on every social interaction.

## Data storage strategy

The server only stores competitive data: race challenge best times (in `best_times`) and series challenge totals (in `challenge_times`). Personal random-track bests stay in localStorage. Future storage concerns:

- **Ghost replays** are not yet synced server-side. When adding ghost sync, store only the top 3 per challenge for spectating (~225KB per challenge) and the user's own best ghost for cross-device access.
- **Shared series results** should expire after 30–90 days to prevent unbounded growth.
- **Friend ghosts**: one replay per friend per shared track, served on demand, not pre-synced.

**Where:** future schema changes
**Why it matters:** Splitting by competitive/social vs. personal keeps costs predictable.

## Ghost replay compression — reduce sample rate

Ghost replays already use delta encoding, quantization (positions ×10, angles ×100), and flat packed arrays — dropping timestamps and JSON overhead. The remaining optimization is reducing the sample rate from 10/sec (`RECORD_INTERVAL = 0.1`) to 5/sec (200ms). This would halve frame count with negligible visual impact on interpolation.

**Where:** `Constants.track.recordInterval` in `src/constants.js` (currently `0.1` → 10 samples/sec)
**Why it matters:** Halves per-replay size in localStorage and future server storage. Worth doing before ghost sync.

## `Game` orchestrator size (`game.js`)

`Game` remains the composition root (scene, loop, `StateMachine`, API/session). Challenge seeding, track descriptors, and share/results assembly have moved to `src/utils/challenge-seed.js`, `src/utils/track-descriptor.js`, and `src/ui/results-presenter.js`; race timing/recording lives in `src/race.js`; device input is split in `src/input-controllers/`.

**Still worth tightening (when touching related code):**

- **Menu + track sync:** repeated `clearChallengeMode()`, menu-visible `rebuildTrack`, and lap/stage clamping in menu callbacks — a small helper could reduce duplication.
- **Leaderboard fetch + render:** the async fetch → `LeaderboardPanel.render` pattern could be wrapped once (e.g. panel encapsulates fetch + render).

**Where:** `src/game.js`, `src/ui/leaderboard-panel.js`, menu wiring
**Why it matters:** Less noise in the orchestrator makes state transitions and track lifecycle easier to follow.

## Manual QA — anonymous leaderboard (`/api/submit`, GET leaderboard/challenge)

Run against a DB with migrations applied (`migrations/001_leaderboard_anonymous.sql`, `002_series_run_sequence.sql`).

- **Default tab:** App opens on LEADERBOARD (challenges); CASUAL tab is available for offline play.
- **CASUAL:** Finish a run — no name prompt, no network POST to submit; local bests/ghosts only.
- **Daily race (single track):** Finish faster than 10th or on empty board — name prompt → submit → row in `best_times` with `display_name`; slower than top 10 — “Better luck next time”, no POST.
- **GET** `/api/leaderboard?track_code=…&laps=…&reversed=…&night_mode=…` — returns up to 10 entries, `total_count`.
- **Weekly/daily series:** Complete all stages — qualification + name → POST with `challenge_key` + `stages` array; GET `/api/challenge?challenge_key=ws:…` shows aggregated totals.
- **Champion row:** #1 single-track submission stores `ghost_data` + `car_settings` when provided; trim removes extras beyond top 10.
**Automated:** `npm test` runs `api/self-test.js` (challenge seed helpers only, no DB).

## Legacy `challenge_times` migration

Historical rows were not backfilled into per-stage `best_times`; old table is dropped by migration. Restore only if you have a DB dump and a one-off script.

**Where:** `migrations/001_leaderboard_anonymous.sql`
**Why it matters:** Operators should not expect old series totals to appear automatically after deploy.

## CSS: legacy class names and raw values

`docs/CSS.md` defines BEM, spacing tokens, and variable usage. `index.html` and UI modules now use BEM-style hooks (classes / `querySelector`); some `styles.css` rules still duplicate sizing (e.g. pattern buttons) or use hardcoded colors outside `:root` where tokens are not yet applied.

**Where:** `src/styles.css`, `docs/CSS.md`
**Why it matters:** Finishing token coverage and removing leftover duplicates keeps theme tweaks one place to change.

## `scripts/css-bem-migrate.mjs` ESLint noise

The one-off migration script triggers `no-undef` for `console` under the repo ESLint config.

**Where:** `scripts/css-bem-migrate.mjs`
**Why it matters:** `npm run lint` fails unless the script is excluded or given a Node env — minor hygiene.

## Grey wall lines vs corridor collision

Road **inner/outer** contours now come from **Clipper** offset (`src/track-clipper.js`, round joins) when that yields a valid two-loop annulus; kerb `LineLoop`s prefer **mesh boundary extraction** from `ShapeGeometry`, else lifted Clipper rings, else (strip + legacy offset only) **outer** kerb line to avoid self-crossing grey loops. Corridor collision uses **spine + `spineHalfWidths`**; when Clipper builds the road, half-widths are uniform nominal width (not curvature-pinched). If Clipper fails or triangulation falls back to strips, rare pathologies may still show odd visuals.

**Where:** `src/track.js` (`_addWallLineLoops`, `buildAnnulusShapeGeometry`), `src/track-clipper.js`, `src/player.js` (`trackCorridorCollision`)
**Why it matters:** Worst-case tracks may still look off at the kerb lines even though driving is valid.

## Track / ground missing while the car still renders

Likely cause addressed: `trackCorridorCollision` only runs in `RacingState` (not during countdown). Unbounded per-segment `push = clearance - depth` could sum to a huge displacement in one frame, moving the car far off the asphalt; the camera follows the car, so the world reads as empty grass/background while the HUD still runs.

**Mitigation:** worst-violation-only push per frame (no multi-segment / two-pass loops), capped `MAX_CORRIDOR_PUSH_PER_FRAME`, depth slack, and velocity response that only removes velocity into the wall (no extra global damping). (`src/player.js`)

**Where:** `src/player.js` (`trackCorridorCollision`), previously also `src/track.js` / renderer flags
**Why it matters:** Distinguishes “nothing rendered” from “camera no longer aimed at the track.”
