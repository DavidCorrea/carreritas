# Domain

## Track Code

An 18-character string that deterministically generates a closed track shape. Each character's ASCII value maps to a radial distance at one of 18 evenly-spaced angles, which are smoothed and connected with a Catmull-Rom spline. The starting point of the track is shifted by an offset derived from the sum of all character codes in the string — different codes produce different start/finish positions. The same code always produces the same track and the same start position.

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

## Daily Track

A race configuration (track code, direction, mode, laps) deterministically generated from the current UTC date. The date string is hashed into a seed for a PRNG (mulberry32), so every player gets the exact same race on the same day — no backend needed.

## Car Settings

Player-configurable car appearance, persisted in localStorage. Includes:

- **Pattern** — how primary and secondary colors are applied to the car body. Options: solid, ring, half, stripe, gradient, radial, spiral, dots, bullseye.
- **Primary / Secondary Color** — two colors used by the selected pattern.
- **Headlights Color** — affects the visible beam and glow meshes only, not the scene's ambient point light (which stays warm white).
- **Headlight Shape** — a ratio between beam length and width. Low values produce long narrow beams; high values produce short wide beams.
- **Underglow Color** — the color of the neon-style light under the car, visible as both a mesh and a point light casting onto the ground.
- **Underglow Opacity** — controls underglow visibility from 0% (off) to 100% (full). Affects both the glow mesh and the point light intensity.

Settings are previewed live on the current map. The settings UI includes a day/night toggle and camera mode selector for previewing.

## Best Runs (Records)

A panel that lists all personal best times stored in localStorage. Each entry shows the track preview (SVG), track code, time, lap count, direction, mode, and date. Players can retry any record directly, which loads the track configuration and starts a countdown.
