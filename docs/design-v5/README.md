# Handoff — Protocol Redesign

## Overview

This is a visual redesign of the Protocol fitness PWA. The redesign keeps the existing data model, routing, and feature set 1:1 — it touches **only** the visual layer.

Three things get redone:

1. **Dashboard** (`pages/Dashboard.tsx`) — stripped down to one job: get the user into their next workout. Animated "aurora" background, big gradient day-title, real workout-day strip.
2. **Active workout** (`pages/Workout.tsx`) — re-imagined as a "cinematic" single-focus screen: the current exercise is huge and tinted in its muscle-group color, every other exercise is visible as a peek card below the hero.
3. **Theme system** (`lib/themes.ts` + `index.css`) — 4 new themes added (`midnight`, `forest`, `crimson`, `mono`), plus a new "background motion" system (`aurora` / `pulse` / `still` / `none`).

`Diet` and `Settings` pages get a lighter polish to align with the new aesthetic.

**Added in this iteration** — `Mesocycles`, `MesocycleDetail`, `Splits`, `SplitEditor`, `Exercises`, and `Progress` are now also part of the redesign. See sections 5–10 below for specs. `Splash`, `Login`, `WorkoutDetail`, `WorkoutHub` remain unchanged.

## About the design files

The files in this bundle are **HTML/JSX design references** — a high-fidelity prototype built outside the codebase to nail the visual language. They are not production code to copy directly.

Your task is to **recreate these designs inside the existing Protocol codebase** (`/protocol/frontend`, React 18 + Vite + TypeScript + Tailwind), respecting its established patterns:

- Tailwind classes for static styling where reasonable, inline `style={{}}` or CSS-in-CSS where the design needs dynamic theming or animations.
- Existing CSS variable system in `frontend/src/index.css` and `frontend/src/lib/themes.ts` — extend, don't replace.
- Existing API hooks in `frontend/src/api/hooks.ts` — wire the new UI to the real data.
- Existing types in `frontend/src/types/index.ts`.

The prototype lives at `Protocol Redesign v5.html` and uses Babel-in-browser + inline JSX. **Don't ship the prototype's structure.** Recreate the look in proper TSX components.

## Fidelity

**High-fidelity.** Exact hex values, type sizes, spacing, animations, and per-state colors are all specified — recreate pixel-perfectly using the codebase's existing libraries.

---

## Screens

### 1 · Dashboard — `pages/Dashboard.tsx`

**Purpose.** The user opens the app, sees today's workout title front and center, and taps Continue. 99% of dashboard interactions are this. Everything else is secondary.

**What was removed from the current dashboard:** the hero meso card with the embedded MesoGrid, the two stat cards (This Week / Meso Progress), the five-tile Quick Access grid, and the breathing/glow/shimmer styling. Replaced by a single hero composition with much more whitespace.

**Layout (top → bottom, in a single-column 22px-padded screen):**

| Element | Notes |
|---|---|
| Top bar | `<PLogoBadge size={38} glow />` on the left, a circular Settings button (38×38, blurred glass) on the right. Settings opens the Settings page (where mesocycles, splits, exercises, etc. now live). |
| Date + week strip | Centered mono-uppercase date ("FRIDAY · MAY 8"), 14px below it a row of 7 cells (M T W T F S S). Each cell 28×28, radius 8. Past trained days show the muscle-group accent in pale (`rgba(accent, 0.18)` bg, `accent-l` text); today shows the full brand gradient; future days are dashed empty. Letters are inside the cells — no separate labels above. |
| Hero (vertically centered, flex-grow:1) | Three muscle bullets (pulsing dots + uppercase mono label), then the day title in 130px gradient text (e.g. **Push**, **Pull**, **Legs**), then a Fraunces-italic subtitle "day five". |
| Meso hairline | Two lines of 10px-mono ("MASS · PHASE 2" left, "WK 1 / 4 · 20%" right) + a 2px-tall progress bar with the brand gradient. |
| CTA | Full-width 58px button: gradient bg + animated shimmer + arrow right. Copy: "Continue workout". |
| Bottom nav | Floating pill capsule (see Components). |

**Background:** the Aurora system (see Motion below). Blobs + aurora-pan stripes + soft grain + vignette.

**Exact typography:**

- Day title: **130px**, `font-weight: 700`, `letter-spacing: -0.06em`, `line-height: 0.9`, `var(--p-grad)` text-clipped, with `filter: drop-shadow(0 0 40px rgba(var(--p-accent-rgb), 0.35))`.
- Subtitle "day five": **17px**, Fraunces, italic, `var(--p-text-2)`.
- Date: **11px**, JetBrains Mono, `letter-spacing: 0.22em`, uppercase, `var(--p-text-2)`.
- Week-strip letters: **11px** mono, weight 600.
- Mono hairline labels: **10px**, weight 500, `letter-spacing: 0.18em`.

### 2 · Active workout — `pages/Workout.tsx`

The single biggest design change. Three meaningful states share the same shell.

**Shared chrome (top of every workout screen):**

- Header bar: 36×36 back button (left, glass), centered title group ("WEEK 1 · DAY 5" mono eyebrow + Fraunces-italic "Push" title), 36×36 menu/dots button (right, glass).
- **Progress rail:** the most distinctive piece. A row of segments, one per exercise, each subdivided by its sets. Width is `flex: e.sets.length` so longer exercises take more rail. Each set tick colors in its **muscle-group** color when logged, faint white otherwise. The current exercise's segment is 4px tall, the rest are 3px. Glow on logged ticks. Below it: "02 / 13 SETS" left, "EXERCISE 01 / 04" right, both 9px mono with `letter-spacing: 0.18em`. The right label is colored in the current exercise's muscle color.
- **Background:** muscle-color aurora — same wave system as the dashboard, but the blob colors come from CSS vars `--mc` and `--mc-l` which the screen sets based on the current exercise's muscle group. Chest = orange blobs, shoulders = purple, etc. The screen *recolors entirely* as the user moves between exercises.

**State A — Logging** (mid-set, the most common state):

- Centered glowing muscle dot + uppercase muscle label.
- Exercise name, **36px** weight 700, with `filter: drop-shadow(0 0 28px <muscle-color>)`.
- Mini-meta: Fraunces italic "target 3 × 10".
- **The numerals card** — a glass-blurred panel tinted in the muscle color. Inside:
  - Top row: "SET 3 OF 3" left (mono 10px), "LAST · 22.5×10" right (mono 10px, muscle-color).
  - Two huge mono numerals (**56px**, weight 700) side-by-side with a vertical divider gradient between them. Each numeral has labels above ("WEIGHT" / "REPS") in muscle-color eyebrow and short −/+ buttons below to nudge by `1.25` (weight) or `1` (reps). Unit label below ("KG" / "OF 10").
  - **Log button**, full-width 56px, muscle gradient bg, `font-weight: 700`, `letter-spacing: 0.2em`, copy is just **`LOG`** in uppercase. Has a shimmer sweep + breathing border (`p-btn-breathe-<muscle>` keyframe, see Motion).
- Set chips row below the card — one chip per set: SET 1, SET 2, SET 3, etc. Logged chips tint muscle-color, current chip is outlined in muscle-color, future chips are faint. A `+` chip at the end for adding sets manually.
- "Up next" section below: peek cards for every remaining exercise in the workout. See Components.

**State B — Exercise complete** (last set just logged on this exercise):

- Same shell, but the title shows "COMPLETE · 3 × 10 @ 22.5" mono in muscle-light color instead of the target.
- The numerals card is replaced by an **"Up next" card**, tinted in the **next** exercise's muscle color (not the current one). It shows: muscle-color accent strip on the left, "UP NEXT" eyebrow, the next exercise name 20px weight 600, target line mono, and a "START" button in the next muscle's gradient.
- Below: the full workout list — done lifts with checks (dimmed), the next lift outlined in its muscle color, queued lifts plain.

**State C — Session complete** (all exercises logged):

- Header chrome stays.
- Hero is centered text: "SESSION COMPLETE" mono in accent-light, then **110px gradient `Done.`** title (period included), then Fraunces "push · day five", then "13 SETS · 4 EXERCISES · 54 MIN" mono.
- Two stacked buttons at the bottom: **`FINISH`** (full-width gradient, 58px, weight 700, `letter-spacing: 0.2em`) and a "Review sets" ghost button below it (50px, transparent, border).
- **Don't** include a checkmark circle or any celebration ring — the giant gradient title is the celebration.

**Navigation behavior:** tapping any peek card in the list jumps to that exercise (changes `curIdx`). Tapping the top arrows goes prev/next exercise. No swipes — the user explicitly disabled gestures because PWA support is unreliable.

### 3 · Diet — `pages/Diet.tsx`

Lighter touch. Existing diet logging structure stays.

- Top: glass card with a **180×180 calorie ring** (SVG, gradient stroke + glow), centered mono numeral inside ("1340" / "/ 2400 KCAL"). Below the ring: 3-column macro split (PROTEIN / CARBS / FAT), each with a value, target, and a 2px colored progress bar in its own color (protein → chest orange, carbs → accent, fat → quads yellow).
- "MEALS" eyebrow + a list of meal cards. Logged meals: name, kcal mono on the right, "Oats · Whey · Banana" mono subtitle. Empty meal slots: dashed border, name in muted color, "+ Log" on the right.

### 4 · Settings — `pages/Settings.tsx`

- Gradient-filled square avatar (80×80, radius 26) with the user's initial in Fraunces italic 34px, centered.
- "Marcus" Fraunces-italic title below.
- "184 DAYS · 142 WORKOUTS" mono stat line.
- Four sectioned card-lists below: **Profile** (Name / Units / Default rest), **Library** (Mesocycles / Splits / Exercises — these tap into the existing pages), **Appearance** (Theme / Density / Motion), **Account** (Export data / Log out).
- Each section is one rounded glass card with hairline dividers between items.

### 5 · Mesocycles list — `pages/Mesocycles.tsx`

Reference: `protocol-more-pages-v5.jsx` → `MesocyclesV5Page`.

**Purpose.** See active training blocks at a glance; jump into the active one; review archived ones.

**Layout (top → bottom):**

- **Chrome.** Back / centered title ("Mesocycles" Fraunces italic + "2 ACTIVE · 4 ARCHIVED" mono eyebrow) / dots menu — same chrome as Settings/Diet.
- **Hero card** for the current active meso:
  - 20px-radius glass panel, tinted with `linear-gradient(180deg, rgba(var(--p-accent-rgb), 0.14), rgba(15,29,46,0.6))` plus a `radial-gradient` halo at the top.
  - Left column: "ACTIVE · WEEK 2" mono eyebrow in `var(--p-accent-l)`, then meso name 30px Fraunces italic, then "UPPER / LOWER · 4×WEEK" mono.
  - Right column: a big gradient-text percentage (`p-grad-text`, 32px mono weight 700) with "%" smaller and faded, then "4 WEEKS" mono caption.
  - **Mini-strip** under the row: 16 tick marks (one per session), each `flex: 1`. Logged = `--p-accent-l` solid with glow; current = 6px tall accent-mixed bar; future = `rgba(255,255,255,0.05)`. The current tick is **6px** while the rest are 4px — quick "you-are-here" affordance.
- **Second-active card** (compact). 14px-radius glass, muscle-color vertical accent (e.g. `--m-quads` for a Run block), mono "ACTIVE · PAUSED" label, name 15px weight 600, "5×WEEK · 6 WEEKS · 30%" mono caption, chevron.
- **Archived section.** "Archived · 4" eyebrow + list of compact rows. Each: gray dot, dim 13px name, mono date range "Mar 4 — Apr 1", "100%" mono on the right.
- **CTA.** Full-width gradient button "+ New mesocycle".

**Data wiring.** Use `useMesocycles()` and `useActiveMesocycle()` from `api/hooks.ts`. The hero is the result of `useActiveMesocycle()`; second-active comes from `mesocycles.filter(m => m.is_active && m.id !== activeMeso.id)`; archived is the `!is_active` list.

### 6 · Mesocycle detail — `pages/MesocycleDetail.tsx`

Reference: `protocol-more-pages-v5.jsx` → `MesocycleDetailPage`.

**Purpose.** Drill into one meso. See the full week × session grid, jump into the next session, scan volume distribution.

**Layout (top → bottom):**

- **Chrome.** "Mass — Phase 2" Fraunces italic title + "MESOCYCLE · ACTIVE" mono eyebrow.
- **Hero block (centered).**
  - "PROGRESS" mono eyebrow (10px, `letter-spacing: 0.28em`, `var(--p-text-m)`).
  - Big `p-grad-text` percentage: number is **78px** weight 700, the `%` is **30px** weight 500 at 70% opacity, both baseline-aligned with 6px gap. `filter: drop-shadow(0 0 28px rgba(var(--p-accent-rgb), 0.35))`.
  - Caption: "6 / 16 SESSIONS · WEEK 2 OF 4" — **11px mono**, `letter-spacing: 0.2em`, `var(--p-accent-l)`.
  - Sub-caption: "UPPER / LOWER · 4× WEEK" — 9px mono, `var(--p-text-m)`.
  - **Don't** add a ring/arc — the typography is the visualization.
- **Week × session grid.** Glass panel, 18px radius. CSS grid `60px repeat(4, 1fr)`, gap 6.
  - Header row: blank + W1 W2 W3 W4 mono labels (9px, `var(--p-text-m)`). The W4 column says "W4 · D" in `var(--m-quads-l)` (yellow) to mark deload.
  - 4 session rows: Upper A / Lower A / Upper B / Lower B (10px mono, `var(--p-text-2)`) followed by 4 cells per row.
  - Cell states:
    - `done` — `rgba(var(--p-accent-rgb), 0.18)` bg + 1px `rgba(var(--p-accent-rgb), 0.30)` border + small checkmark in `var(--p-accent-l)`.
    - `current` — full `--p-grad` bg + white 5px-circle dot in the middle + `0 0 14px rgba(var(--p-accent-rgb), 0.55)` glow. No border.
    - `queued` — `rgba(255,255,255,0.03)` bg + 1px `rgba(255,255,255,0.06)` border.
    - `deload-queued` — `rgba(234,179,8,0.10)` bg + 1px `rgba(234,179,8,0.25)` border (yellow tint for the deload week).
  - All cells 26px tall, 7px radius.
- **Up-next CTA card.** 16px radius, accent-tinted gradient bg + radial halo. Inside: 4px vertical gradient bar (gradient) / "NEXT SESSION" eyebrow + "Upper B · Week 2" + "4 LIFTS · ~52 MIN" / a small `p-btn-grad` "START →" button (42px tall, mono 12px tracked).
- **Volume by muscle (this week).** Eyebrow "Volume · this week" left, "SETS / PEAK" mono right. Glass panel containing rows, one per trained muscle: muscle dot + uppercase muscle label (9px mono in muscle-light) / progress bar (6px tall, gradient muscle → muscle-light, glow) / "32 / 38" mono on the right.
- **Action row.** Two 50/50 ghost buttons: "Edit" / "Archive".

**Data wiring.** Use `useMesocycle(id)` and `useWorkoutHistory(id)`. Compute the grid from `mesocycle.structure.weeks` and `getCurrentPosition()` (already exists in `lib/mesoUtils.ts`). Volume by muscle comes from `getVolumeByMuscleGroup()` in `lib/mesoAnalysis.ts`.

### 7 · Splits list — `pages/Splits.tsx`

Reference: `protocol-more-pages-v5.jsx` → `SplitsPage`.

**Purpose.** Browse split templates (the recurring weekly structure of training days). Show each split's days and which muscle groups it touches. One split is "LIVE" (assigned to the active meso).

**Layout:**

- **Chrome.** "Splits" / "4 TEMPLATES".
- **Card list.** One 18px-radius glass card per split. Cards stack with 12px gap.
  - **Live split** gets a `linear-gradient(180deg, color-mix(in oklab, var(<split-color>) 14%, rgba(15,29,46,0.5)), rgba(15,29,46,0.6))` bg + a radial halo from the top-left in the split color, plus a `color-mix(35%)` border. Inactive cards are plain `rgba(15,29,46,0.45)` with the standard soft border.
  - Card header row: 4px vertical accent (`linear-gradient(180deg, var(<color>), var(<color>-l))`, 12px glow) / split name 17px weight 600 / live badge: tiny mono "· LIVE" pill in the split color (only on the active split) / "4 DAYS · 18 GROUPS" mono caption / chevron right.
  - Card body: one row per day. Each row: "D1" mono index (9px) / day name (12px weight 500) / **muscle chips** (one per muscle the day trains) — `padding: 2px 7px`, radius 100, fontsize 9, with a leading 4px muscle-color dot, `color-mix(12%)` bg, `color-mix(25%)` border, muscle-light text. Wraps onto multiple lines if needed.
- **CTA.** Dashed-border "+ New split" button at the bottom.

**Split colors.** Each split stores a color hex in the DB (`splits.color`). The prototype maps the hex to one of the muscle vars for visual harmony, but production code should just use the stored hex directly. Recommended palette (from `SplitEditor.tsx`): `#14b8a6`, `#6366f1`, `#f97316`, `#ec4899`, `#22c55e`, `#eab308`, `#06b6d4`, `#f43f5e`.

**Data wiring.** `useSplits()` for the list. Each split has `days[] → { name, exercises[] → { muscle_group } }`. Reduce per-day to a unique set of muscle groups for the chip rendering.

### 8 · Split editor — `pages/SplitEditor.tsx`

Reference: `protocol-more-pages-v5.jsx` → `SplitEditorPage`.

**Purpose.** Create or edit one split. Name + color + ordered list of days, each containing an ordered list of exercises.

**Layout (top → bottom):**

- **Chrome.** "Upper / Lower" Fraunces italic + "EDIT SPLIT · UNSAVED" mono eyebrow.
- **Name row.** 14px-radius glass card: 36×36 color swatch (gradient bg matching the chosen color, 10px radius, glow) / "SPLIT NAME" mono micro-eyebrow + split name 15px weight 600 / pencil-edit icon.
- **Color picker row.** 8 swatches, 30×30, 10px radius, gradient `var(<color>), var(<color>-l)`. Selected swatch gets a 2px `var(--p-text-1)` border + outer offset outline + glow. Tapping sets the color.
- **Days section.**
  - Header: "Days · 4" eyebrow left, "DRAG TO REORDER" mono caption right.
  - Each day is a 14px-radius accordion card. Collapsed:
    - Drag handle (6-dots icon) / "D1" mono index / day name 14px weight 600 (italic gray "Untitled" if empty) / "5 lifts" mono count / chevron.
    - Border becomes `rgba(var(--p-accent-rgb), 0.30)` when expanded.
  - Expanded body: list of exercise rows. Each: drag handle / 2px muscle-color gradient bar / exercise name 13px weight 500 + muscle group 9px mono in muscle-light / trash icon on hover. Empty days show a dashed "NO LIFTS YET" placeholder. Below the rows, a dashed "+ Add lift" CTA in accent-light text.
  - At the bottom: dashed "+ Add day" CTA (gray, full-width).
- **Sticky save bar.** Positioned 96px from the bottom (clears the bottom nav), 18px radius, glass, padded 8. Two buttons: "Discard" (ghost, 1fr) and "SAVE SPLIT" (`p-btn-grad`, 2fr, mono tracked 13px).

**Interactions:**
- Drag handles wire to a sortable library (the codebase already uses `@dnd-kit/sortable` in `pages/split-editor/DayCard.tsx`).
- Tapping a collapsed day toggles expanded state. Only one open at a time.
- "Add lift" opens an exercise picker bottom sheet (existing component pattern — see `components/BottomSheet.tsx` and the search in `pages/Exercises.tsx`).
- "Save" calls `useCreateSplit` / `useUpdateSplit`.

### 9 · Exercises library — `pages/Exercises.tsx`

Reference: `protocol-more-pages-v5.jsx` → `ExercisesV5Page`.

**Purpose.** Browse all lifts, filter by muscle group and equipment, jump into one to see progress / history / edit.

**Key design decision (this iteration):** muscle-group and equipment filters are **always visible in a single glass panel**, not behind a button. The earlier prototype used a single horizontally-scrolling chip row — replaced because the existing codebase already organizes muscle groups by Push / Pull / Legs / Core rows (`MUSCLE_GROUP_ROWS` in `components/exerciseConstants.ts`) and the user wants both axes filterable at once.

**Layout (top → bottom):**

- **Chrome.** "Exercises" / "78 LIFTS · 12 GROUPS".
- **Search bar.** 14px-radius glass: search icon / "Search lifts…" placeholder / "⌘K" hotkey hint pill.
- **Filter panel.** 14px-radius glass, 10/12 padding, vertical 6px gap between rows.
  - **Muscle rows.** Four rows: `PUSH`, `PULL`, `LEGS`, `CORE`. Each row: 30px-wide mono label (9px, `letter-spacing: 0.2em`, `var(--p-text-m)`) + flex chip group. Each chip 4×9 padding, radius 100, 10px mono uppercase, with a 4×4 muscle-color dot prefix. Selected chip: `color-mix(in oklab, var(<muscle>) 18%, transparent)` bg, `color-mix(40%)` border, muscle-light text. Unselected: transparent bg, soft border, `var(--p-text-2)` text. **Multi-select.**
  - **Divider.** 1px `var(--p-border-soft)` with 8px top padding above the next row.
  - **Equipment row.** Label "GEAR". Five chips: `barbell`, `dumbbell`, `machine`, `cable`, `bodyweight`. Each chip 4×9 padding, radius 100, leading 11px icon SVG + 10px mono label. Selected: `rgba(var(--p-accent-rgb), 0.16)` bg, `0.40` border, `var(--p-accent-l)` text.
- **Grouped sections.** One per muscle group, ordered. Each section:
  - Header: 8px muscle dot with glow / muscle name 10px mono uppercase in muscle-light / "4 LIFTS" mono count on the right.
  - List of exercise rows. Each row: 2px vertical muscle-color gradient bar / exercise name 14px weight 500 + "72.5kg · 4 wks ago" mono caption / set count "148" mono in muscle-light + "SETS" mono micro-label, right-aligned.

**Filter semantics.** Show an exercise if (no muscle selected OR exercise.muscle_group ∈ selected) AND (no gear selected OR exercise.equipment_type ∈ selected) AND (search query matches name).

**Data wiring.** `useExercises()` for the list. Group on the fly by `muscle_group`. Use the existing `getMuscleColor()` helper for the per-group accents.

### 10 · Progress — `pages/Progress.tsx`

Reference: `protocol-more-pages-v5.jsx` → `ProgressPage`.

**Purpose.** One exercise at a time. Show its strength trajectory, key stats, and weekly training volume. Quick switch to other lifts via a list at the bottom.

**Layout (top → bottom):**

- **Chrome.** "Progress" / "LAST 8 WEEKS".
- **Selected-exercise hero card.** 20px radius, tinted in the **muscle group's color** (`color-mix(in oklab, var(<muscle>) 12%, rgba(15,29,46,0.6))`) with a radial halo at the top.
  - Top row: muscle dot + muscle label mono (left); "EST 1RM" mono micro-eyebrow + value "96kg" mono 24px weight 700 (right).
  - Exercise name 22px weight 600, `-0.015em` letter-spacing.
  - **Sparkline.** Full-width 82px tall SVG. Filled gradient under the line (muscle color at 35% top → 0% bottom). Line stroke `var(<muscle>-l)` 2px with `drop-shadow(0 0 6px var(<muscle>))`. Final point gets a 3.5px circle with white stroke + 8px glow.
  - Bottom row: "MAR 4" mono left, "NOW" mono right.
- **Stats trio.** Three equal-width 13px-radius glass cards: `BEST SET / 72.5×8 / +5kg`, `TREND / +21% / 8 WK`, `CONSISTENCY / 94% / 18/19`. Each card stacks micro-eyebrow → 16px mono value → muscle-color caption.
- **Period toggle.** Glass segmented control, 4 values: `4 WEEKS`, `8 WEEKS`, `12 WEEKS`, `ALL`. Selected segment is `rgba(var(--p-accent-rgb), 0.18)` bg + `0.35` border + accent-light text. Tapping a segment updates the sparkline + stats.
- **Weekly volume** (separate from the per-exercise hero — shows total session volume across **all** lifts).
  - Header: "Weekly volume" eyebrow left, "+38% · 8WK" accent-light mono right.
  - Glass panel: 8-column CSS grid of bars, 96px tall, gap 6. Each bar is gradient `accent → 30%-mixed`, the latest week gets the full `--p-accent-l → --p-accent` gradient + 10px glow.
  - W1–W8 mono labels below the bars.
- **Other lifts.** "Other lifts" eyebrow + list of compact rows. Each row: `1fr 110px 56px` grid — muscle dot + group + lift name (left); 110×28 mini sparkline (middle); delta "+25%" mono in muscle-light (right).

**Data wiring.**
- `useExercises()` for the list.
- `useExerciseProgress(selectedExerciseId)` for the selected hero's sparkline series.
- `useWorkoutHistory(mesocycle.id)` rolled up by `w.week_number` for the weekly-volume chart.
- Other-lifts list: top 4 exercises by session frequency in the current meso, each with their own `useExerciseProgress` series (mini sparkline only — no fills).

---

## Components

### `<PLogo>` and `<PLogoBadge>` — `protocol-primitives.jsx`

Three-layer cascade Protocol "P", gradient-filled. `PLogoBadge` wraps it in a card-colored 12px-radius square. Already exists in the codebase as `frontend/src/components/ProtocolMark.tsx` — keep that, no need to port the prototype's version.

### `<BottomNavV3>` — `protocol-nav-splash.jsx`

Floating capsule, 18px from each edge, 64px tall, radius 22, glass blurred. Three items: Home / Workout / Diet. Active item gets the brand gradient bg, white text, and a shimmer-free 16px-radius pill inside the capsule. Inactive items are icons only in `--p-text-m`.

Implementation note: the existing `BottomNav` in `frontend/src/components/Layout.tsx` is a full-width 56px frosted bar. Replace it with this floating capsule, or make it a config option.

### Muscle pill / accent

Two flavors, used everywhere:

- **Solid pill** — `padding: 3px 9px`, `border-radius: 6`, `font-size: 10px`, `letter-spacing: 0.12em`, uppercase. `background: color-mix(in oklab, <muscle> 12%, transparent)`, `border: 1px solid color-mix(in oklab, <muscle> 22%, transparent)`, `color: <muscle-light>`.
- **Glowing dot + label** — for hero contexts. 9-11px circle with `box-shadow: 0 0 14px <muscle>, 0 0 4px <muscle>` + uppercase mono label. The dot pulses (see Motion).

### Peek card (workout list rows)

Used in workout state B and below the hero in state A. Glass-blurred, 14px radius, 12-14px padding. Left edge has a 3px tall vertical accent in the muscle gradient. Inside:

- Row 1 (small): mono index "01" + muscle pill + optional "· NEXT" / "· DONE" / "· ACTIVE" mono tag.
- Row 2: exercise name, 14px weight 600.
- Right: row of set dots (7×7 circles, muscle-colored when logged, faint white otherwise). Final: arrow-right or check (if done), in `--p-text-m` or muscle-light.

Done cards: `opacity: 0.55`, no gradient tint.

### Numerals card / Log button

See State A above. Note the **breathing** keyframes per muscle group: `p-btn-breathe-chest`, `p-btn-breathe-shoulders`, etc. They animate `border-color` and `box-shadow` on a 3.2s ease-in-out cycle. Defined in `protocol-tokens.css`.

---

## Design tokens

### Type

```
--p-sans:    'Inter',          system-ui, sans-serif
--p-display: 'Fraunces',       'Instrument Serif', serif   (italics-by-default in display roles)
--p-mono:    'JetBrains Mono', ui-monospace,    monospace
```

Add Fraunces to the existing Google Fonts import in `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&display=swap" rel="stylesheet" />
```

JetBrains Mono is already loaded. Inter is already loaded.

**Type roles:**

| Role | Font | Size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|---|
| Day hero | Display | 130 | 700 | -0.06em | Gradient text-clip + drop-shadow glow |
| Done. title | Display | 110 | 700 | -0.05em | Same treatment as day hero |
| Exercise name (hero) | Sans | 36 | 700 | -0.025em | Drop-shadow in muscle color |
| Numerals (set) | Mono | 56 | 700 | -0.03em | `text-shadow: 0 0 30px <muscle 50%>` |
| Page title (Fraunces italic) | Display | 18-30 | 400 | -0.02em | Italic by default in display roles |
| Body | Sans | 14 | 500 | normal | Use sparingly — most UI is mono or display |
| Eyebrow / mono labels | Mono | 9-11 | 500-600 | 0.15–0.22em | Uppercase |
| Set chips | Mono | 13 | 600 | normal | Logged: muscle-light |

### Color — base tokens (per theme)

Every theme defines the same set of CSS variables. The current `frontend/src/lib/themes.ts` already uses this exact pattern — just **add four new themes and a couple of new variables**:

```ts
// Add to ThemeColors interface
'--p-grad': string          // full linear-gradient(135deg, …) for hero text & gradient buttons
'--wave-c1': string         // background blob 1 color
'--wave-c2': string         // background blob 2 color
'--wave-c3': string         // background blob 3 color
'--wave-c4': string         // background blob 4 color
```

Then for **each existing theme**, add the gradient + wave colors. Suggested values:

```ts
// dark   (default)
'--p-grad':  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #8b5cf6 100%)',
'--wave-c1': '#0ea5e9',  '--wave-c2': '#8b5cf6',
'--wave-c3': '#22d3ee',  '--wave-c4': '#ec4899',

// black  (AMOLED) — same accents as dark
// (use the same grad + wave colors as dark)

// white  (light mode) — same brand gradient, but the wave layer is toned down via CSS
// (use the same grad + wave colors as dark; the bg-mixing CSS below desaturates them)

// cyan   (bright cyan)
'--p-grad':  'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #06b6d4 100%)',
'--wave-c1': '#7dd3fc',  '--wave-c2': '#06b6d4',
'--wave-c3': '#22d3ee',  '--wave-c4': '#0ea5e9',

// violet
'--p-grad':  'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #ec4899 100%)',
'--wave-c1': '#a78bfa',  '--wave-c2': '#ec4899',
'--wave-c3': '#c4b5fd',  '--wave-c4': '#8b5cf6',

// gradient — full vibrant
'--p-grad':  'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 50%, #ec4899 100%)',
'--wave-c1': '#0ea5e9',  '--wave-c2': '#7c3aed',
'--wave-c3': '#ec4899',  '--wave-c4': '#38bdf8',
```

**Four new themes to add:**

```ts
// ── Midnight (sunset accent on navy) ─────────────────────
midnight: {
  '--deep': '#070d15',  '--base': '#0d1b2a',  '--card': '#0f1d2e',
  '--panel': '#132438', '--input': '#162a3e', '--border': '#1e3a52',
  '--text-1': '#e2e8f0','--text-2': '#cbd5e1','--text-m': '#64748b',
  '--accent-l': '#fdba74', '--accent': '#f97316', '--accent-d': '#ea580c',
  '--accent-rgb': '249,115,22',
  '--p-grad':  'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a855f7 100%)',
  '--wave-c1': '#f97316', '--wave-c2': '#a855f7',
  '--wave-c3': '#ec4899', '--wave-c4': '#22d3ee',
  // other props (nav-bg, shadow, vignette, check-color, btn-text, logo-bg)
  // — follow the same pattern as `dark`
},

// ── Forest (emerald + teal) ──────────────────────────────
forest: {
  '--deep': '#04140e',  '--base': '#0a1f17',  '--card': '#0d251c',
  '--panel': '#102e22', '--input': '#0f2a1f', '--border': '#1a3d2e',
  '--text-1': '#e6f4ec','--text-2': '#c5dcd0','--text-m': '#5d8472',
  '--accent-l': '#6ee7b7', '--accent': '#10b981', '--accent-d': '#059669',
  '--accent-rgb': '16,185,129',
  '--p-grad':  'linear-gradient(135deg, #10b981 0%, #06b6d4 55%, #6366f1 100%)',
  '--wave-c1': '#10b981', '--wave-c2': '#06b6d4',
  '--wave-c3': '#84cc16', '--wave-c4': '#6366f1',
},

// ── Crimson (warm red / orange / yellow) ─────────────────
crimson: {
  '--deep': '#15050a',  '--base': '#1f0a12',  '--card': '#260e17',
  '--panel': '#2e131e', '--input': '#2b101a', '--border': '#3d1d2d',
  '--text-1': '#f5e6ec','--text-2': '#dcc5d0','--text-m': '#8c5d70',
  '--accent-l': '#fda4af', '--accent': '#f43f5e', '--accent-d': '#e11d48',
  '--accent-rgb': '244,63,94',
  '--p-grad':  'linear-gradient(135deg, #f43f5e 0%, #f97316 50%, #eab308 100%)',
  '--wave-c1': '#f43f5e', '--wave-c2': '#f97316',
  '--wave-c3': '#eab308', '--wave-c4': '#ec4899',
},

// ── Mono (monochrome AMOLED) ─────────────────────────────
mono: {
  '--deep': '#000', '--base': '#050505', '--card': '#0c0c0c',
  '--panel': '#111', '--input': '#1a1a1a', '--border': '#252525',
  '--text-1': '#fafafa','--text-2': '#d4d4d4','--text-m': '#737373',
  '--accent-l': '#fafafa', '--accent': '#a3a3a3', '--accent-d': '#737373',
  '--accent-rgb': '212,212,212',
  '--p-grad':  'linear-gradient(135deg, #fafafa 0%, #a3a3a3 50%, #525252 100%)',
  '--wave-c1': '#d4d4d4', '--wave-c2': '#737373',
  '--wave-c3': '#a3a3a3', '--wave-c4': '#525252',
},
```

Update `THEME_IDS`:

```ts
export const THEME_IDS = [
  'dark', 'black', 'white', 'cyan', 'violet', 'gradient',
  'midnight', 'forest', 'crimson', 'mono',
] as const
```

Update the `ThemePicker.tsx` component to render the 10 themes (the existing one is built to be data-driven from `themes.ts` so it should automatically pick up the new entries, but verify).

### Color — muscle groups

Keep the existing `lib/muscleColors.ts` palette **exactly as is**. The redesign just uses those colors more aggressively (whole-card tints, breathing borders, blob backgrounds).

For convenience the prototype exposes the muscle colors as CSS variables (`--m-chest`, `--m-chest-l`, etc.) — feel free to add this to `index.css` so you can use them inline in TSX without importing the JS object:

```css
:root {
  --m-chest:#f97316;     --m-chest-l:#fb923c;
  --m-back:#14b8a6;      --m-back-l:#2dd4bf;
  --m-quads:#eab308;     --m-quads-l:#facc15;
  --m-hamstrings:#22c55e;--m-hamstrings-l:#4ade80;
  --m-glutes:#f43f5e;    --m-glutes-l:#fb7185;
  --m-calves:#06b6d4;    --m-calves-l:#22d3ee;
  --m-biceps:#6366f1;    --m-biceps-l:#818cf8;
  --m-triceps:#ec4899;   --m-triceps-l:#f472b6;
  --m-shoulders:#a855f7; --m-shoulders-l:#c084fc;
  --m-traps:#8b5cf6;     --m-traps-l:#a78bfa;
  --m-core:#f59e0b;      --m-core-l:#fbbf24;
  --m-forearms:#64748b;  --m-forearms-l:#94a3b8;
}
```

### Spacing & radii

- Screen padding (mobile): **22px** horizontal.
- Card radius: **14px** standard, **18-22px** for hero panels.
- Card padding: **14px** for list rows, **18-22px** for hero cards.
- Gaps in lists: **8px** standard.
- Mono label / eyebrow letter-spacing: **0.15em – 0.22em**.

### Motion system

The most novel piece of the redesign. Three components, all in `protocol-tokens.css` (port to `index.css`):

#### Wave background

Four colored blobs at fixed positions, each animating on a long ease-in-out cycle (18s, 22s, 26s, 30s). Plus two angled "aurora" stripe layers panning across with `background-position` (24s and 32s). Plus a film-grain layer (animated SVG turbulence at 1.2s steps).

```css
.wave-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.wave-bg .blob {
  position: absolute; border-radius: 50%;
  filter: blur(60px); mix-blend-mode: screen;
  opacity: 0.85; will-change: transform;
}
/* See protocol-tokens.css for full keyframes — copy verbatim */
```

The blobs read their colors from `--wave-c1` ... `--wave-c4` so they pick up the active theme automatically.

**Per-screen variant for the workout:** a class `.wave-bg.wave-muscle` overrides the blob colors to read from `--mc` / `--mc-l` instead, so the bg recolors when the user moves between exercises.

#### Breathing on the log button

Per muscle group, one `@keyframes p-btn-breathe-<g>` definition. Cycle: `border-color` from 30% muscle to 70% muscle, and add an outer glow shadow in muscle color. Duration **3.2s ease-in-out infinite**. Applied via inline `style={{ animation: \`p-btn-breathe-${ex.g} 3.2s ease-in-out infinite\` }}`.

#### Card breathe

A subtle `opacity` cycle for the inner glow of the numerals card. 4s ease-in-out.

#### Motion controls (Appearance setting)

Four values for `data-motion` on `<body>`:

| Value | Behavior |
|---|---|
| `aurora` (default) | All layers on: blobs + aurora stripes + grain. |
| `pulse` | Blobs only, pulsing in place (no panning). Grain on. |
| `still` | Frozen gradients, no movement, no grain. |
| `none` | Wave + grain + screen vignette hidden entirely. All page-level animations disabled. |

Implement as a setter on `<body>` from a setting page. Persist to `localStorage` ("protocol_motion"). Default `aurora`.

---

## Specific code-level changes

### Files to add (new)

- `frontend/src/components/AuroraBackground.tsx` — extracts the four-blob + aurora + grain layer setup into a single component. Drops into any page that wants the aurora bg.
- `frontend/src/components/MuscleWaveBackground.tsx` — variant that takes a `group` prop and sets `--mc` / `--mc-l` on the wrapper.
- `frontend/src/components/ProgressRail.tsx` — the divided-by-exercise progress bar from the workout screen.
- `frontend/src/components/MuscleAccent.tsx` — the glowing-dot-plus-label muscle component (two variants: solid pill, glowing dot).
- `frontend/src/components/ExercisePeekCard.tsx` — the workout-list row used in states A and B.
- `frontend/src/components/NumeralsCard.tsx` — weight/reps input with −/+ controls and the Log button.

### Files to modify

| File | Change |
|---|---|
| `frontend/src/lib/themes.ts` | Add `--p-grad` + `--wave-c1..4` to interface. Add 4 new themes (midnight, forest, crimson, mono). Update `THEME_IDS`. |
| `frontend/src/index.css` | Add the wave/aurora/grain/breathe keyframes from `protocol-tokens.css`. Add muscle-color CSS vars. |
| `frontend/index.html` | Add Fraunces font import. |
| `frontend/src/pages/Dashboard.tsx` | Rewrite per spec above. Use existing `useActiveMesocycle()` hook for data. |
| `frontend/src/pages/Workout.tsx` | Rewrite per spec above. Keep existing hook usage (`useWorkoutState`, `useWorkoutAutoSave`, `useWorkoutCompletion`, `useSetModification`). The single biggest task — split into the three states and route between them based on workout completion. |
| `frontend/src/pages/Diet.tsx` | Add calorie ring + macro bars. |
| `frontend/src/pages/Settings.tsx` | Restructure into sectioned cards. Add motion picker. |
| `frontend/src/pages/Mesocycles.tsx` | Rewrite per section 5. Hero active card + mini-strip + archived list. |
| `frontend/src/pages/MesocycleDetail.tsx` | Rewrite per section 6. Big progress %, week×session grid, volume-by-muscle. |
| `frontend/src/pages/Splits.tsx` | Rewrite per section 7. Color-tinted cards with day rows of muscle chips. |
| `frontend/src/pages/SplitEditor.tsx` | Rewrite per section 8. Color picker + accordion days + sticky save bar. |
| `frontend/src/pages/Exercises.tsx` | Rewrite per section 9. Always-visible Push/Pull/Legs/Core rows + GEAR row. |
| `frontend/src/pages/Progress.tsx` | Rewrite per section 10. Sparkline hero, stats trio, weekly volume bars. |
| `frontend/src/components/Layout.tsx` | Replace `BottomNav` with the floating capsule version. |
| `frontend/src/components/ThemePicker.tsx` | Verify it picks up the 4 new themes. May need swatch updates. |

### Files to leave alone

- `SplashScreen.tsx`, `ProtocolMark.tsx` — user likes them.
- `Login.tsx`.
- `WorkoutDetail.tsx`, `WorkoutHub.tsx` — not part of this redesign pass.
- Everything in `backend/` — design only.

### Things I removed that the user explicitly asked for

- **Progression up/down arrows on set rows** — gone. The user said the progression logic is broken; just log what you did.
- **Equipment labels (Cable / Dumbbell / Machine pills)** — gone. Readable from exercise name.
- **Rest timer** — gone. The user says this isn't a real feature in the app.
- **Per-set RIR badges** — gone (consolidated into the workout header eyebrow line).
- **Quick Access tile grid on the dashboard** — gone. Settings page covers it now.

---

## Interactions

### Dashboard
- Tapping Continue → `navigate(\`/workout/\${mesocycle.id}?week=…&session=…\`)`. Existing logic in `Dashboard.tsx`'s "current position" calc is reused.
- Tapping Settings (top-right) → `/settings`.
- Tapping the week-strip cells (future) → could open the corresponding workout. Not in scope for v1.
- Tapping the meso hairline → `/mesocycles/<active-id>`.

### Workout — Logging state
- `−` / `+` on weight: `±1.25` (kg). On reps: `±1`. Could also long-press for `±2.5` / `±5` later.
- Tapping a set chip → focus that set (reload its values into the numerals if previously logged, or just navigate set cursor).
- Tapping `LOG` → call existing `useSetModification` to log the set. Then:
  - If more sets remaining on this exercise → reload State A with the next set queued.
  - If exercise complete and more exercises remaining → transition to **State B**.
  - If everything complete → transition to **State C**.
- Tapping any peek card in "Up next" → jump to that exercise (changes the active exercise without losing logged work).

### Workout — Exercise complete state
- Tapping `START` on the Up-next card → advance and go to State A on the next exercise.
- Tapping any card in the full list → jump to it.

### Workout — Session complete state
- `FINISH` → save (already saved via auto-save hooks) + navigate to `/workouts/<meso>/<wi>/<si>` (the existing WorkoutDetail / review page).
- `Review sets` → expand a sheet or scroll-to-show all logged sets inline. For v1, this can route to WorkoutDetail too.

### Theme + motion
- Settings → Appearance → Theme: swatch grid, persist to `localStorage`.
- Settings → Appearance → Motion: 4-way radio (aurora / pulse / still / none), persist to `localStorage`.

---

## State management

- **Theme** — already managed in `frontend/src/lib/theme.ts` / index.html blocking script. Just wire the new themes through.
- **Motion** — new. Store as `protocol_motion` in `localStorage`, apply to `document.body.dataset.motion` on app boot via a blocking script in `index.html` (same pattern as theme).
- **Workout state** — keep existing hooks. The "which state are we in" question is derived state:
  ```ts
  const allLogged = exercises.every(ex => ex.sets.every(s => s.logged))
  const currentExLogged = currentEx.sets.every(s => s.logged)
  const state = allLogged ? 'workout-done'
              : currentExLogged ? 'exercise-done'
              : 'logging'
  ```
- **Set cursor** (which set within the current exercise is "active") — derived: `findIndex(s => !s.logged)`.

---

## Assets

- **Fonts**: Inter (already loaded), Fraunces (add), JetBrains Mono (already loaded).
- **No images or icons added** — all icons are inline SVGs in the prototype's `protocol-primitives.jsx`. The existing `frontend/src/components/Icons.tsx` already has most of what's needed; add any missing ones (Drag handle, Flame are in the prototype but probably unused in the shipped screens).
- **No new third-party libraries needed.** Everything is pure CSS animations + React state.

---

## Performance notes

The aurora bg is GPU-friendly (only `transform` and `opacity` animated, `will-change: transform` on the blobs) but the user mentioned their MacBook was struggling with the dev environment. Things to watch:

- The `mix-blend-mode: screen` on all four blobs + two aurora layers stacks expensively on low-power devices. The `motion="still"` and `motion="none"` settings exist for that — make sure they're easy to reach.
- The grain SVG is base64'd inline. Animating its `transform` at 1.2s steps is cheap, but if mobile Safari struggles you can disable it for `motion: "pulse"` and below.
- On iPhone PWA, `backdrop-filter: blur(20px)` is fine but `blur(60px)` (the blob filter) can chug if combined with `mix-blend-mode`. If you see jank, drop the blob blur to 40px.
- **Reduce on iOS low-power-mode**: respect `@media (prefers-reduced-motion: reduce)` and force `motion: still`.

---

## Files in this handoff

| File | What |
|---|---|
| `README.md` | This document. |
| `Protocol Redesign v5.html` | The runnable prototype. Open it in a browser to see everything. The on-screen Tweaks panel lets you swap themes and motion modes live. |
| `protocol-tokens.css` | The full CSS — themes, wave/grain/aurora keyframes, breathing animations. **Read this carefully** — most of the visual logic lives here. |
| `protocol-primitives.jsx` | `PLogo`, `PLogoBadge`, status-bar mock, inline `Icon` SVGs. |
| `protocol-nav-splash.jsx` | `BottomNavV3` (the floating capsule). |
| `protocol-dashboard-v5.jsx` | Dashboard prototype. |
| `protocol-workout-v5.jsx` | Workout prototype — all three states. **The reference for State A / B / C.** |
| `protocol-other-pages.jsx` | Diet + Settings prototypes. |
| `protocol-more-pages-v5.jsx` | **NEW.** Mesocycles list, Mesocycle detail, Splits list, Split editor, Exercises library, Progress — sections 5–10. |
| `design-canvas.jsx` | Pan/zoom canvas frame. Not relevant to the app — just how the prototype is presented. Ignore. |
| `tweaks-panel.jsx` | The Tweaks panel component. Not relevant to the app. Ignore. |

---

## Recommended implementation order

1. **Tokens + themes first.** Wire up `themes.ts` with the new entries, the `--p-grad` + wave variables, and the CSS keyframes in `index.css`. Verify the existing app still renders correctly under the existing themes (regression check).
2. **AuroraBackground component.** Build it once, drop it on the dashboard. Confirm it renders + the theme swatches change the colors as expected.
3. **Dashboard rewrite.** Easiest of the three screens. Once it looks like the prototype, you've proved the design system works.
4. **Floating bottom nav.** Replace existing nav in Layout.
5. **Workout — State A first.** Get the muscle-color bg, progress rail, peek cards, and numerals card working with real data through `useWorkoutState`.
6. **Workout — State B and C.** Add the state transitions.
7. **Diet and Settings polish.**
8. **Motion picker in Settings + persistence.**
9. **Planning pages** — Mesocycles list → Mesocycle detail → Splits list → Split editor. Reuse the AuroraBackground component and the peek/glass card patterns. The mesocycle detail's week×session grid is the trickiest piece — it's just a CSS grid with conditional cell states, but make sure the deload-week styling reads.
10. **Library & Progress** — Exercises list (filter panel is the key novelty), then Progress (sparkline + bars). The Progress page's sparkline doesn't need recharts — raw SVG is fine and avoids the dependency for a 1-component use case (recharts is already a dep, but the prototype's SVG sparkline is simpler and matches the visual better than recharts' default line chart).

Estimate: ~3-4 days for a focused dev (was ~1-2 for just the original three screens).

Good luck.
