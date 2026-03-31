# Three.js performance review and optimization plan

## Original review (summary)

- **Strengths**: Dirty rendering (`sceneDirty` in [`src/game.js`](../src/game.js)), static track matrices (`matrixAutoUpdate = false` in [`src/track.js`](../src/track.js)), shared car geometries, instanced start line, capped DPR at 2.
- **Hot spots**: High `Constants.track.samples` (1200) drives ShapeGeometry + EdgesGeometry cost; `frustumCulled = false` on whole track; many `MeshLambertMaterial` instances per car; night additive transparent layers; MSAA; full Three CDN bundle.

---

## Goal

Keep **current gameplay and visuals** (track/collision agreement, car patterns, day/night, cameras, ghost, UI flow) while **lowering CPU/GPU** and **stabilizing FPS**.

Domain constraint ([`carreritas-track-boundaries` skill](../skills/carreritas-track-boundaries/SKILL.md)): road mesh, wall edges, and corridor collision are all derived from the same spine/offset pipeline—changes must preserve that contract or be validated on tight bends.

---

## Tier A — High impact, usually low risk

### 1. Tune `Constants.track.samples` with visual + collision QA

- **Effect**: Cuts triangulation work, `EdgesGeometry` size, and **per-frame collision work** (`trackCorridorCollision` scans all spine segments—O(n) with n = samples).
- **How**: Lower gradually (e.g. 1200 → 800 → 600); stress-test **tight bends** and **wall silhouette** (`wallEdgeThresholdDeg`). If seams appear, adjust threshold before reverting sample count.
- **Feature preservation**: Same architecture; only resolution of the polyline changes.

### 2. Adaptive or stricter pixel ratio

- **Current**: `Math.min(devicePixelRatio, 2)` in [`src/game.js`](../src/game.js).
- **Options**: Cap at `1.5` on mobile / `matchMedia('(pointer: coarse)')`; or **dynamic**: if smoothed frame time exceeds budget for N frames, reduce `setPixelRatio` until stable (restore when fast again).
- **Effect**: Large GPU fill savings on retina devices; minimal visual change at 1.5 vs 2.

### 3. Re-enable frustum culling selectively

- **Current**: Entire `trackGroup` sets `frustumCulled = false` ([`src/track.js`](../src/track.js)).
- **Approach**: Try `frustumCulled = true` on **road mesh, walls, instanced start line**; keep ground or huge planes as needed for edge cases. Test **ortho top-down**, **chase**, **first-person**, **isometric**—culling wrong objects causes pop-in.
- **Effect**: Fewer draw submissions when parts of the track leave the view frustum.

### 4. `renderer.compile(scene, camera)` after heavy scene changes

- **When**: After `rebuildTrack`, `switchRenderer`, or first paint of a mode.
- **Effect**: Moves shader compile **jitters** off the first interactive frames; steady-state FPS unchanged but **perceived** stability improves.

---

## Tier B — Medium impact, moderate effort

### 5. Share materials on car patterns (fewer programs / state changes)

- **Current**: Patterns often allocate **one `MeshLambertMaterial` per sub-mesh** (e.g. [`src/car-patterns/dots-pattern.js`](../src/car-patterns/dots-pattern.js)).
- **Approach**: Reuse one material with **vertex colors** for parts that differ, or share materials where color/opacity match; ghost could use **one** `MeshBasicMaterial` for all lambert-replaced parts ([`src/ghost.js`](../src/ghost.js)).
- **Effect**: Fewer GPU state switches; same look if colors unchanged.

### 6. Lambert vs Basic for “flat lit” content

- **Day mode** is mostly ambient; ground + track could use **`MeshBasicMaterial`** if you accept **no lighting response** (flat color). This is a **visual** tradeoff—only if day mode still looks acceptable.
- **Safer**: Keep Lambert on car; try Basic only on static environment first.

### 7. Optional MSAA off on constrained devices

- `antialias: false` when `navigator.hardwareConcurrency <= 4` or saved user flag / dynamic FPS rule.
- **Effect**: Noticeable fill savings; edges slightly harsher.

### 8. Night mode: reduce overdraw without removing features

- Fewer **segments** in `createBeamMesh` / `createGlowMesh` ([`src/renderers/night-renderer.js`](../src/renderers/night-renderer.js)) if art allows.
- **Advanced**: Combine additive passes into **one** `BufferGeometry` or a tiny **custom shader** that draws beam+glow in one pass—same look, fewer draw calls and less additive blending overlap.

### 9. Underglow vertex color loop

- [`applyUnderglowAppearance`](../src/renderers/underglow-mesh.js) updates many vertices when color/opacity changes—fine. Avoid calling it every frame unless inputs change (already mostly event-driven).

---

## Tier C — CPU latency (stable “feel,” not FPS)

### 10. Build track on a Worker (optional)

- **Problem**: `Track` constructor CPU spike can hitch the main thread.
- **Approach**: Compute points/offset rings in a Worker; transfer typed arrays back; main thread builds Three objects—or simpler: `requestIdleCallback` / deferred frame for non-racing transitions only.
- **Effect**: Smoother tab interactions; does not reduce GPU work.

### 11. `sceneRenderer.update` gating (minor)

- Today it runs every frame while [`src/game.js`](../src/game.js) may skip `render` when `!sceneDirty`. Lights still move when the car moves—so in **racing**, you still need updates every frame. Possible micro-win only in **idle** states (e.g. finished + no replay) by skipping night/day `update` when nothing moves—small.

---

## Stable FPS pattern (recommended mini-design)

1. **Measure**: rolling average of `dt` from your existing `gameLoop` ([`src/game.js`](../src/game.js)).
2. **Tier down** when average frame time > budget (e.g. > 18ms for 60fps): lower `pixelRatio` one step, optionally disable antialias, or reduce effects flag.
3. **Tier up** when stable fast for several seconds (avoid oscillation with hysteresis).
4. **Keep** dirty rendering and menu preview throttling as-is—they already help idle cost.

---

## What to avoid without explicit product approval

- **Splitting collision samples vs render samples** into two different curves—risks desync from the “same rings” rule unless proven equivalent.
- **Removing** `EdgesGeometry` walls without an alternative that still matches the road mesh.

---

## Priority order (suggested)

1. Adaptive / lower DPR + optional MSAA toggle for weak devices  
2. Empirical reduction of `track.samples` + collision/visual QA  
3. `renderer.compile` after rebuilds  
4. Frustum culling experiments per camera  
5. Material sharing + optional night mesh merge  
6. Worker / idle deferral for track build  

---

## FAQ: Bigger map + fewer `track.samples` — what changes?

**Short answer:** Uniformly **increasing “map size”** (scaling world units) does **not** automatically let you drop `samples` without the same risks. **`samples` is count of subdivisions along the spline in parameter space** (`u ∈ [0,1)`), not “detail per meter.”

- The spline is built from **TrackCode control points** (`toPoints()` → `CatmullRomCurve3`). **`samples`** adds points **along that same curve** for spine, offset rings, and collision. Fewer samples ⇒ coarser polyline in **`u`**, which can bite on **tight bends** and offset/wall accuracy—regardless of whether the whole track is “big” or “small” in meters.

- **Scaling all coordinates** (bigger world): geometrically similar curves get **larger radii in meters**, but **angular change between successive samples in `u`** is unchanged for the same `n`. So you do **not** get a free pass to halve `samples` just by scaling the map.

- **What does help fewer samples:** **Gentler curvature in authoring**—fewer sharp direction changes per lap, or **larger effective bend radii** from how codes map to points. That can come from **content/encoding** (simpler or smoother tracks), not from “size” alone. **Wider lane** (`Constants.track.width`) can make the **corridor** more forgiving for the same polyline, but it does not fix **offset singularity** where inner parallel curves self-cross on paper-tight bends.

- **“Complex maps”** in the sense of **longer codes / more control points** can mean **more** inflections and **more** places the polyline must be accurate—sometimes **more** demanding, not less, unless the extra points smooth the path.

- **Tradeoffs if you truly change scale:** camera (`viewSize`, fog), **lap times and speeds** (unless physics scales with you), and how **tight** the same string “feels.” Plan a **physics/camera pass** if world scale changes.

---

## Maximum performance while keeping tracks “competitive enough”

**What “competitive” means here:** Same **track code + mode + direction + laps** should give a **fair, comparable** run: corridor push-out ([`player.trackCorridorCollision`](../src/player.js)), lap sectors, and **replay/ghost** samples depend on the **same** spine + half-widths as the road. If that geometry changes meaningfully, **times and lines** can shift—bad for leaderboards and player trust.

### Do first (big win, **no** change to race physics or track math)

- **Adaptive DPR + optional MSAA off** on weak hardware or when FPS drops—purely **visual**; same inputs, same physics timestep.
- **`renderer.compile`** after scene ready—same frames, less hitch.
- **Batch/share materials** on car and ghost—**visual** only if done correctly.
- **Night cosmetic LOD**: fewer beam/glow segments or merged additive pass—**must not** change fog/lighting that affects readability if you consider that a competitive cue; usually cosmetic only.
- **Frustum culling** on static track pieces—**visual only** if tested (no missing road).

These maximize GPU/CPU without touching **who can cut the line** or **how tight the corridor feels**.

### Do with a **validation gate** (large win, **can** affect fairness if done blindly)

- **Lower `track.samples`**: Cuts **collision work** (full spine scan per frame in [`trackCorridorCollision`](../src/player.js)) **and** mesh build. To stay competitive:
  - Pick the minimum `n` where **worst-case tracks** (tightest bends, stress codes) still pass **visual + collision** QA (no clipping through corridor, walls still match road).
  - Optionally maintain a **small test suite** of track codes (or procedural stress tests) re-run when `n` changes.
- **Optional: accelerate collision without changing the polyline** — e.g. **search a window** around `lastTrackIdx` instead of scanning all spine segments **only if** you can prove the car never “jumps” to a non-adjacent segment in one frame (max speed × `dt` vs segment length). **Wrong windowing** would change who gets pushed. Full scan is safe; windowing is a **research** item with tests.

### Keep frozen (until you explicitly accept leaderboard resets or versioned rules)

- **Splitting** render spline vs collision spline (different `n` or different curves)—same risks as in “What to avoid.”
- **Changing** `track.width`, `corridorShell`, or curvature safety **without** treating it as a **ruleset** change for competition.

### Suggested order for “as much performance as possible” + competitive integrity

1. **GPU tiering** (DPR, MSAA, dynamic FPS)—zero gameplay change.  
2. **Rendering** (culling, materials, night overdraw, `compile`)—zero gameplay change.  
3. **Find minimum `track.samples`** with automated + manual stress tracks—single source of truth preserved.  
4. **Collision broadphase / window** (only with tests proving identical outcomes in edge cases).  
5. **Worker** for track build—does not change physics; only **latency** to first frame.

---

## Files referenced

- [`src/game.js`](../src/game.js) — renderer, DPR, ground, dirty render, loop  
- [`src/track.js`](../src/track.js) — samples, meshes, edges, culling flags  
- [`src/player.js`](../src/player.js) — corridor collision, `getTrackT`  
- [`src/constants.js`](../src/constants.js) — `track.samples`  
- [`src/renderers/night-renderer.js`](../src/renderers/night-renderer.js) — lights, beams, fog  
- [`src/renderers/underglow-mesh.js`](../src/renderers/underglow-mesh.js) — underglow  
- [`src/ghost.js`](../src/ghost.js) — ghost materials  
- [`index.html`](../index.html) — Three CDN load  
