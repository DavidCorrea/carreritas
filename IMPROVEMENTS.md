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

Currently all persistence is localStorage — ghost replays and best times are device-bound and anonymous. Adding user accounts (username/password with proper hashing) would enable cross-device persistence and leaderboards. Accounts should include a country field so rankings can be filtered by country or viewed worldwide. Users should be able to add other users as friends via search or username. Users should also be able to pick their car color, stored in their profile. Needs a backend and database, which the project doesn't have yet.

**Where:** project-wide (new backend required)
**Why it matters:** Prerequisite for any social or competitive feature (challenges, leaderboards, medals, country rankings, friend invites). Car color adds personalization.

## Daily and weekly challenges

Fully automated challenge lifecycle. A scheduled job generates the challenge config (track code, laps, direction, mode) using seeded RNG — daily at midnight UTC, weekly on Monday midnight UTC. While active, players can retry as many times as they want — only their best time counts. When the window closes, the job finalizes results: ranks all submissions, assigns gold/silver/bronze based on medal thresholds, updates user medal counts and rankings, then archives the challenge. No manual curation needed — the system runs itself.

**Where:** new feature (needs backend for challenge generation, scheduling, result storage, and finalization job)
**Why it matters:** Gives players a reason to come back regularly. Fully automated means zero operational overhead once deployed.

## Medal system

Award gold, silver, and bronze medals based on race times. Absolute thresholds are unfair on harder tracks (random codes produce wildly different layouts). Percentile-based needs a minimum player count to be meaningful. Recommended approach: percentile-based with a minimum participant threshold (e.g. top 10% gold, top 30% silver, top 60% bronze, but only if at least N players competed). Medals should only be awarded from official daily/weekly challenges — not from custom shared series, to prevent ranking inflation from easy self-made courses.

**Where:** new feature (needs user accounts and a time-recording backend)
**Why it matters:** Adds progression and replayability — players have concrete goals beyond beating their own ghost.

## Custom shared series

Let users create a series (track codes, directions, modes, laps) and share it two ways: a public link anyone can open, or a direct invite to friends from their friend list. Friends race the same series and times are compared on a shared leaderboard for that series. The series config could be encoded in the URL (no backend needed for the config itself) but recording and comparing results across players requires user accounts and a backend.

**Where:** new feature (series config encoding could be client-side; leaderboard and invites need backend + user accounts + friend system)
**Why it matters:** Turns the game into a social experience — players can challenge friends on courses they designed, either casually via link or directly via invite.

## Global rankings

A leaderboard ranked by medals earned in daily and weekly challenges — not by raw time or total races. This keeps rankings meaningful (only official challenges count) and rewards consistency over one-off performances. Scoring could weight gold/silver/bronze (e.g. 3/2/1 points) and optionally decay over time to keep the board active.

**Where:** new feature (needs daily/weekly challenges, medal system, and user accounts)
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

Ghosts are currently localStorage-only. Once accounts exist, decide: keep ghosts local-only, sync only the best ghost per track, or let users opt in to sharing. If shared, when racing a track a friend has also raced, show their ghost alongside your own best. Makes the social layer feel alive even in single-player. Syncing full ghost data (position + angle every 50ms) is a lot of data — consider only syncing for challenge tracks or capping replay length.

**Where:** new feature (needs user accounts and backend storage)
**Why it matters:** Racing against a friend's ghost is more motivating than racing alone. Bridges single-player and social without requiring real-time multiplayer.

## Challenge history and profile page

A user's past challenge results, medal collection, and stats — total races, medal breakdown, best finishes, favorite tracks. Gives the account substance beyond a username and makes progression visible.

**Where:** new feature (needs user accounts, challenge archive, and medal records)
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

**Where:** new feature (needs user accounts, friend system, and backend event system)
**Why it matters:** Without notifications, users have to manually check for updates. Notifications close the loop on every social interaction.
