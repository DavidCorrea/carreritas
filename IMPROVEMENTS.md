# Improvements

## README is outdated

The README references "5 AI opponents" which don't exist in the current codebase. It also doesn't mention the track code system, direction/mode toggles, ghost replays, or series mode.

**Where:** `README.md`
**Why it matters:** Misleads anyone reading the README about what the game actually does.

## Three.js deprecation warning

The game loads `three.min.js` from CDN at version 0.150.0. Three.js warns that `build/three.js` and `build/three.min.js` are deprecated as of r150 and will be removed in r160. The migration path is ES Modules.

**Where:** `index.html` line 255 (script tag)
**Why it matters:** The CDN URL will stop working when Three.js removes the legacy build files.

## No test infrastructure

There are no tests. The game logic (track generation from string, lap counting, sector tracking, ghost replay interpolation, series state machine) is all testable but untested.

**Where:** project-wide
**Why it matters:** Any change to physics, lap tracking, or series flow could silently break behavior.

## User accounts

Currently all persistence is localStorage — ghost replays and best times are device-bound and anonymous. Adding user accounts (username/password with proper hashing) would enable cross-device persistence and leaderboards. Accounts should include a country field so rankings can be filtered by country or viewed worldwide. Needs a backend and database, which the project doesn't have yet.

**Where:** project-wide (new backend required)
**Why it matters:** Prerequisite for any social or competitive feature (challenges, leaderboards, medals, country rankings).

## Daily and weekly challenges

Curated or procedurally-generated challenge tracks that rotate on a schedule — a daily track (resets every 24h) and a weekly track (resets every 7 days). All players race the same track code, laps, direction, and mode. Requires user accounts to record and compare times.

**Where:** new feature (needs backend for challenge generation, scheduling, and result storage)
**Why it matters:** Gives players a reason to come back regularly and compete on equal footing.

## Medal system

Award gold, silver, and bronze medals based on race times. Thresholds could be absolute (fixed time targets per track) or relative (percentile-based against other players' times). Medals would be tied to user accounts and visible on a profile or leaderboard.

**Where:** new feature (needs user accounts and a time-recording backend)
**Why it matters:** Adds progression and replayability — players have concrete goals beyond beating their own ghost.

## Custom shared series

Let users create a series (track codes, directions, modes, laps) and generate a shareable link. Friends open the link, race the same series, and times are compared on a shared leaderboard for that series. The series config could be encoded in the URL (no backend needed for the config itself) but recording and comparing results across players requires user accounts and a backend.

**Where:** new feature (series config encoding could be client-side; leaderboard needs backend + user accounts)
**Why it matters:** Turns the game into a social experience — players can challenge friends on courses they designed.

## Global rankings

A leaderboard ranked by medals earned in daily and weekly challenges — not by raw time or total races. This keeps rankings meaningful (only official challenges count) and rewards consistency over one-off performances. Scoring could weight gold/silver/bronze (e.g. 3/2/1 points) and optionally decay over time to keep the board active.

**Where:** new feature (needs daily/weekly challenges, medal system, and user accounts)
**Why it matters:** Creates a competitive layer that ties the other features together — challenges, medals, and accounts all feed into one visible ranking. Country filter on user accounts enables both national and worldwide views.
