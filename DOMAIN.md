# Domain

## Track Code

An 18-character string that deterministically generates a closed track shape. Each character's ASCII value maps to a radial distance at one of 18 evenly-spaced angles, which are smoothed and connected with a Catmull-Rom spline. The same code always produces the same track.

## Lap

One full circuit around the track. The track is divided into 4 sectors; a lap counts when the player crosses all 4 sectors in order and returns to the finish sector.

## Direction (FWD / REV)

Which way the track is driven. FWD runs sectors 0→1→2→3→0; REV runs 0→3→2→1→0. The start position and facing angle flip accordingly. Direction is part of the best-time storage key — FWD and REV times are tracked separately.

## Mode (DAY / NIGHT)

Visual mode. Night mode renders a dark overlay with headlight beams that follow the car's facing angle. Does not affect physics or ghost records.

## Ghost

A replay of the best recorded run on a given track, shown as a semi-transparent blue car. Ghost data (position + angle sampled at fixed intervals) is stored in localStorage. The storage key includes track code, lap count, and direction — so each combination has its own ghost.

## Best Time

The fastest total race time for a specific track code + lap count + direction combination. Stored alongside the ghost replay in localStorage.

## Series

A sequence of 2–5 races (stages) played back-to-back. Each stage has its own track code, direction, and mode. Laps per stage are shared. After each stage, a results screen shows the stage time; after the final stage, a summary shows all stage times and the series total.

## Stage

One race within a series. Configured independently for track code, direction, and mode.
