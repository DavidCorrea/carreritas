# Domain

## Track Code

An 18-character string that deterministically generates a closed track shape. Each character's ASCII value maps to a radial distance at one of 18 evenly-spaced angles, which are smoothed and connected with a Catmull-Rom spline. The starting point of the track is shifted by an offset derived from the sum of all character codes in the string — different codes produce different start/finish positions. The same code always produces the same track and the same start position.

## Track Descriptor

A compact string that fully identifies a race configuration: track shape, direction, mode, and lap count. Format: `<18-char code> <F|R><D|N><laps>`. Example: `Ax!9kR#m2$pLqZ&w@f FD3` means forward, day, 3 laps. The space separator is safe because track codes use ASCII 33–126 (no spaces). Used consistently in results screens, the copy button, and best runs cards. Pasting a full descriptor into any track code input parses and applies all parts; pasting a bare 18-char code still works (missing parts keep current settings).

## Lap

One full circuit around the track. The track is divided into 4 sectors; a lap counts when the player crosses all 4 sectors in order and returns to the finish sector.

## Direction (FWD / REV)

Which way the track is driven. FWD runs sectors 0→1→2→3→0; REV runs 0→3→2→1→0. The start position and facing angle flip accordingly. Direction is part of the best-time storage key — FWD and REV times are tracked separately.

## Mode (DAY / NIGHT)

Visual mode that affects difficulty. Night mode sets ambient light to zero and adds distance fog — the track is invisible except where the car's headlight beams reach. Mode is part of the best-time storage key — DAY and NIGHT times are tracked separately.

## Ghost

A replay of the best recorded run on a given track, shown as a semi-transparent blue car. Ghost data (position + angle sampled at fixed intervals) is stored in localStorage. The storage key includes track code, lap count, direction, and mode — so each combination has its own ghost.

## Best Time

The fastest total race time for a specific track code + lap count + direction + mode combination. Stored alongside the ghost replay in localStorage.

## Series

A sequence of 2–5 races (stages) played back-to-back. Each stage has its own track code, direction, and mode. Laps per stage are shared. After each stage, a results screen shows the stage time; after the final stage, a summary shows all stage times and the series total.

## Stage

One race within a series. Configured independently for track code, direction, and mode.

## Challenge Modes

Four time-limited challenge modes where every player gets the same configuration. All use the same PRNG seeding mechanism (mulberry32).

- **Daily Race** — a single race generated from the current UTC date string. The seed is the bare date (`"2026-03-18"`) for backward compatibility with the original daily track. Produces track code, direction, mode, and laps.
- **Daily Series** — a multi-stage series generated from `"ds-" + dateStr`. Produces stage count (2–5), per-stage track code/direction/mode, and laps per stage.
- **Weekly Race** — a single race generated from `"wr-" + mondayStr`, where `mondayStr` is the UTC Monday of the current week. Same configuration for all players from Monday 00:00 UTC through Sunday 23:59 UTC.
- **Weekly Series** — a multi-stage series generated from `"ws-" + mondayStr`. Same weekly window as the weekly race.

Challenge mode is tracked as game state (`challengeMode`). Setting it labels the results screen, includes the challenge name in share text, and directs the leaderboard to the correct data source. Manually changing any config clears the challenge mode.

## Challenge Key

An identifier for a challenge instance, used to store and query series total times. Format: `"<prefix>:<date>"`. Examples: `"ds:2026-03-18"` (daily series), `"ws:2026-03-16"` (weekly series, keyed by Monday). Race challenges don't use challenge keys — they use the existing best_times table since they're normal single-track races.

## Daily Track

A race configuration (track code, direction, mode, laps) deterministically generated from the current UTC date. The date string is hashed into a seed for a PRNG (mulberry32), so every player gets the exact same race on the same day — no backend needed. Now part of the Challenge Modes system as "Daily Race".

## Car Settings

Player-configurable car appearance, persisted in localStorage. Includes:

- **Pattern** — how primary and secondary colors are applied to the car body. Options: solid, ring, half, stripe, gradient, radial, spiral, dots, bullseye.
- **Primary / Secondary Color** — two colors used by the selected pattern.
- **Headlights Color** — affects the visible beam and glow meshes only, not the scene's ambient point light (which stays warm white).
- **Headlight Shape** — a ratio between beam length and width. Low values produce long narrow beams; high values produce short wide beams.
- **Underglow Color** — the color of the neon-style light under the car, visible as both a mesh and a point light casting onto the ground.
- **Underglow Opacity** — controls underglow visibility from 0% (off) to 100% (full). Affects both the glow mesh and the point light intensity.

Settings are previewed live on the current map. The settings UI includes a day/night toggle, camera mode selector, and an idle/running toggle. In running mode the car auto-drives along the track centerline so the player can see their car in motion. A cinematic "Showcase" camera mode activates by default when the settings panel opens, cycling through slow orbits and sweeps around the car with smooth transitions between shots.

## Share

After finishing a race or series, a Share button copies a formatted text to the clipboard. The text includes a randomized opener/closer (drawn from separate pools for regular runs vs. new records — record messages are more confident), the race times, and a link that loads the same track configuration. Single-race links use `?t=<descriptor>`. Series links use `?s=<descriptor>,<descriptor>,...` with one descriptor per stage. On page load, these URL parameters are parsed and applied, then cleaned from the address bar.

## Best Runs (Records)

A panel that lists all personal best times stored in localStorage. Each entry shows the track preview (SVG), full track descriptor, time, and date. Players can retry any record directly, which loads the track configuration and starts a countdown.

## User Account

Optional username + password authentication. Stored in Postgres (Neon). Passwords are bcrypt-hashed. Authentication uses JWT tokens stored in localStorage. Logging in uploads car settings to the server. Logging in on a new device downloads remote car settings. The game works fully without an account — all features remain available via localStorage.

## Leaderboard

A ranking of the top 10 best times across all users. Accessible from the results screen (shows the current race/challenge leaderboard directly) and from the menu (shows a selection view to pick a challenge or current track). Race challenge leaderboards query the `best_times` table by track descriptor. Series challenge leaderboards query the `challenge_times` table by challenge key. Public — no auth required to view.
