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
