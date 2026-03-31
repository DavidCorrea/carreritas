# CSS architecture

This document defines how styles are written and organized for Carreritas. **Component class names follow BEM**; new work should follow these rules. Migrate any remaining legacy names incrementally (by feature), not in one giant rename.

---

## BEM (Block — Element — Modifier)

We use a **namespaced BEM**-style pattern so classes stay grep-friendly and collision-free.

| Piece | Pattern | Example |
|--------|---------|---------|
| **Block** | Standalone component | `car-settings`, `menu-card`, `hud` |
| **Element** | `block__element` (double underscore) | `car-settings__bar`, `car-settings__preview` |
| **Modifier** | `block--modifier` or `block__element--modifier` | `car-settings__bar--lower`, `seg-control--sm` |

**Rules**

- One block per component; don’t reuse the same block name for unrelated UI.
- Elements belong to a block; avoid `grandchild__name` chains deeper than one level—split another block if needed.
- Modifiers describe **state or variant**, not position (avoid `car-settings__bar--top`; use layout/grid instead).
- **IDs** — avoid for layout and JS; use **BEM classes** (and `name` on form fields where helpful). Reserve rare `id` only if a spec or third-party tool requires it.

**Legacy names** (e.g. `settings-bar`, `seg-option`) remain until migrated; when touching a file, rename related selectors to match this doc and update `index.html` / any `classList` or `className` in JS.

---

## Design tokens (CSS variables)

Global tokens live on **`:root`** in `src/styles.css`. Use them for:

- Colors that mean the same thing everywhere (background, accent, muted text).
- Spacing, radii, font stacks, transition timing, **viewport height caps** (`--height-1` … `--height-8`), **fixed control heights** (`--h-1` … `--h-9`), and **menu shell width** (`--width-menu-shell` default / portrait, `--width-menu-shell-wide` for desktop and **landscape** `max-width: 1024px`).

**Color groups in `:root`**

- **Brand:** `--color-accent` (+ `--color-accent-soft`, `--color-accent-05` … `--color-accent-85`, highlights), `--color-danger` (+ mixes), `--color-warn` (+ `--color-warn-soft`, text, hover).
- **Neutrals on dark:** `--color-fill-*`, `--color-border-*`, `--color-text-*` / `--color-text-dim*` (white mixed at different strengths via `color-mix`).
- **Scrims / shadows:** `--color-overlay`, `--color-surface`, `--color-scrim`, `--color-shadow`, `--color-black-*`.

Rules and components should use these variables (or `color-mix` from them)—**not** raw `#hex` / `rgba` except inside `:root` where the token is defined.

**Usage**

```css
.example {
  padding: var(--space-4);
  color: var(--color-text-muted);
  border-radius: var(--radius-md);
}
```

**Derived colors** — Prefer `color-mix()` (or tokens) over hardcoding new RGBA for variations:

```css
border-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
```

---

## Spacing scale

Spacing uses a **4px grid** expressed in **rem** (root = `16px` unless changed).

| Token | Rem | Typical use |
|-------|-----|-------------|
| `--space-1` | 0.25rem | Tight gaps, icon padding |
| `--space-2` | 0.5rem | Inline gaps, compact padding |
| `--space-3` | 0.75rem | Default small gap |
| `--space-4` | 1rem | Standard padding / gap |
| `--space-5` | 1.25rem | Section padding |
| `--space-6` | 1.5rem | Larger sections |
| `--space-8` | 2rem | Major separation |
| `--space-10` | 2.5rem | Hero / overlay padding |

**Margins and padding** should prefer `var(--space-*)` over magic numbers. For one-off tweaks, **`calc()`** with tokens is OK: `calc(var(--space-4) + var(--space-1))`.

---

## Height scale (`--height-1` … `--height-8`)

Numbered **height tokens** on `:root` (same idea as `--space-1` … `--space-12`): each is a full `min(...)` viewport cap. Order is roughly **smallest rem ceiling → largest**; **6–8** are menu-shell variants (same 38rem cap, different `100dvh` offsets where needed).

| Token | Typical use |
|--------|-------------|
| `--height-1` | Stage list scroll — short-landscape menu |
| `--height-2` | Stage list scroll — landscape menu |
| `--height-3` | Stage list scroll — default |
| `--height-4` | Menu shell — phone portrait (`≤600px`); tighter than `--height-6` |
| `--height-5` | Car settings panel — short landscape |
| `--height-6` | Menu shell — default |
| `--height-7` | Menu shell — phone/tablet landscape (`100dvh - 9rem`) |
| `--height-8` | Menu shell — very short landscape (`100dvh - 7.5rem`) |

Full-viewport strips (e.g. `.car-settings` `min-height`) may still use **`100dvh` / `100svh`** directly where two fallbacks are required for mobile browsers.

---

## Menu shell width

| Token | Rem | Typical use |
|--------|-----|-------------|
| `--width-menu-shell` | 32rem | Default menu card (portrait / narrow) |
| `--width-menu-shell-wide` | 52rem | Desktop (`min-width: 1025px`) and **landscape** `max-width: 1024px` — more horizontal room for tabs and grids |

Width is always combined with **`min(..., calc(100vw - var(--space-10)))`** on `.menu-overlay__shell.menu-overlay__card` so the card never touches the viewport edges.

**Landscape `max-width: 1024px`:** the shell uses **CSS Grid** with **`grid-template-rows: minmax(0, 1fr)`** so the single row fills the shell’s fixed height, and **`column-gap`** between columns (no vertical rule on the sidebar). The **left** column is **`.menu-overlay__shell-sidebar`**: primary tabs (**LEADERBOARD / CASUAL**, stacked vertically), then the active secondary row — **SINGLE / SERIES** on **CASUAL** (stacked like the primary tabs), or the **four challenge modes** on **LEADERBOARD** (single-column grid, one label per row). **`.menu-overlay__divider--tabs`** and the first **`<hr>`** in each tab panel are hidden in this mode so spacing uses **flex `gap`** and grid gap instead of hairline separators. The **right** column is **`.menu-overlay__event-tab`** or **`.menu-overlay__challenges-tab`**. On **LEADERBOARD**, **`.menu-overlay__challenge-preview-wrap`** uses a **two-column** grid (**one** **`minmax(0, 1fr)`** row) and grows to fill the tab (**`flex: 1`**, **`min-height: 0`**). **`.challenge-preview-tracks`** is the **left** column (SVG plus dir/mode line for a single race, or **series** carousel slides each with **#** and dir/mode in **`.challenge-preview-stage-meta`**). **`.challenge-preview-menu-col`** is the **right** column: laps (**`.challenge-preview-summary`**), reset countdown, and **TOP 10**, built in **`renderChallengePreview`** and **flex**-centered (**`justify-content: center`**, **`align-items: center`**). **`.menu-overlay__challenge-preview`** uses **`display: contents`** so **tracks** and **menu-col** participate in the wrap grid. **CASUAL / SERIES** in this landscape shell: **`.menu-overlay__series-config`** is a **two-column grid** — column **1** stacks **stages** stepper, **laps per stage** stepper, and **RNG ALL** (from **`.menu-overlay__series-row`** as a column flex); column **2** is **`.stage-list-scroll`** with the same **prev / index / next** carousel chrome and **one** **`.stage-block--active`** at a time as **`(max-width: 600px)` portrait** (rules duplicated under **`.menu-overlay__shell.menu-overlay__card`**).

Portrait and desktop (`min-width: 1025px`) keep a **single-column** shell with the same sidebar block **full width** and the primary tabs **horizontal**.

---

## Fixed control heights (`--h-1` … `--h-9`)

**Exact rem** sizes for interactive controls (steppers, icon buttons, swatches, touch targets). Use these for **`height` / `width` / `min-height`** when the value should not depend on viewport caps—unlike **`--height-1` … `--height-8`**, which are `min(dvh, rem, …)` overlay budgets.

| Token | Rem | Typical use |
|--------|-----|-------------|
| `--h-1` | 1.5rem | Small dots, tight icons |
| `--h-2` | 1.75rem | Compact squares (e.g. color swatch in tight layouts) |
| `--h-3` | 2rem | Main menu (`.menu-overlay`): segment toggles, steppers, buttons, track + stage code inputs; compact controls elsewhere |
| `--h-4` | 2.25rem | Pattern buttons in narrow car-settings |
| `--h-5` | 2.375rem | Fixed control height on the scale (use when a control needs this exact size) |
| `--h-6` | 2.5rem | Carousel nav, pattern swatches, leaderboard list min-height |
| `--h-7` | 2.625rem | Touch actions — short landscape |
| `--h-8` | 2.75rem | Default touch actions, color swatch, seg min-height, sem lights |
| `--h-9` | 3rem | Large touch targets (e.g. mobile landscape HUD buttons) |

Prefer **`--h-*`** over duplicating the same **`rem`** in multiple components; use **`--space-*`** for padding and gaps, **`--h-*`** for control dimensions when they align with this scale.

---

## Relative units

| Use | For |
|-----|-----|
| **`rem`** | Typography, spacing, radii tied to user font size |
| **`%`** | Widths inside a defined container, grid/flex distribution |
| **`vh` / `dvh` / `svh`** | Full-viewport overlays (prefer **`dvh`** / **`svh`** where supported) |
| **`clamp()`** | Fluid type or padding that must adapt (e.g. preview controls) |
| **`min()` / `max()`** | Caps and safe areas combined with `env(safe-area-inset-*)` |

Avoid **px** except for **hairlines** (1px borders) or values that must not scale.

---

## Layout grid

- **Page / overlay shells**: Prefer **CSS Grid** for 2D layout (`grid-template-columns`, `gap: var(--space-*)`).
- **Toolbars / strips**: **Flexbox** for one-dimensional rows or columns; use `gap`, not margin hacks.
- **Alignment**: `align-items`, `justify-items`, `place-content` — avoid vertical `margin` on flex children for “centering” when gap/alignment can do it.

There is **no** 12-column Bootstrap-style framework; keep grids **local** to each block. If a repeated grid pattern appears **three times**, consider a small utility class (e.g. `.l-cluster` with `display: flex; gap: var(--space-3)`) in the same file, documented here.

**Container queries** — Use when a component must respond to its **own** width, not the viewport (`@container` + `container-type: inline-size`). Prefer for future complex cards.

---

## Modern CSS features (preferred)

Use when supported by our targets (evergreen browsers + mobile WebKit):

| Feature | Use case |
|---------|----------|
| **`color-mix()`** | Hover borders, translucent accents from `--color-accent` |
| **`clamp()`** | Fluid font-size, padding, min/max widths |
| **`min()`, `max()`** | Constraints with viewport units |
| **`aspect-ratio`** | Thumbnails, fixed-ratio boxes |
| **`@layer`** | (Optional future) Order: tokens → base → components → utilities |
| **`:where()`** | Reset specificity for utility groups |
| **`prefers-reduced-motion`** | Already used for game blur; extend for transitions |

Avoid **@import** for many small files unless the build pipeline concatenates; a single `styles.css` entry keeps Vite simple.

---

## Files

| File | Role |
|------|------|
| `src/styles.css` | Single stylesheet; `:root` tokens at top; rest ordered roughly: base → layout → components → overlays |

---

## Checklist when adding or refactoring CSS

1. Prefer **tokens** over raw hex/rgba for brand and neutrals.
2. Prefer **`rem`** + spacing scale for padding/margin/gap.
3. New classes: **BEM** names tied to one block.
4. One **media query** block per breakpoint concern; merge duplicates when touching a file.
5. Update this doc if you introduce a **new global pattern** (e.g. a second accent color).
