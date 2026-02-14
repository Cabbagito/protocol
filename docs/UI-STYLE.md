# Protocol Design System

## Base Colors — Navy Palette

| Token       | Hex       | Usage                       |
|-------------|-----------|-----------------------------|
| `navy-deep` | `#070d15` | HTML background, vignette   |
| `navy-base` | `#0d1b2a` | Body background             |
| `navy-card` | `#0f1d2e` | Card backgrounds            |
| `navy-panel`| `#132438` | Frosted panels, inner cards |
| `navy-input`| `#162a3e` | Input backgrounds           |
| `navy-border`| `#1e3a52`| Borders, dividers           |

## Text Hierarchy

| Level     | Hex       | Tailwind           |
|-----------|-----------|--------------------|
| Primary   | `#e2e8f0` | `text-slate-200`   |
| Secondary | `#cbd5e1` | `text-slate-300`   |
| Muted     | `#475569` | `text-slate-600`   |

## Accent — Sky Blue

| Variant  | Hex       | Usage                          |
|----------|-----------|--------------------------------|
| Light    | `#38bdf8` | Active text, badges, RiR value |
| Base     | `#0ea5e9` | Buttons, logo fill             |
| Dark     | `#0284c7` | Logged-set check buttons       |

Uses the existing `protocol-*` Tailwind palette (`protocol-400` = `#38bdf8`, `protocol-500` = `#0ea5e9`, `protocol-600` = `#0284c7`).

## Muscle Group Colors

Each muscle group maps to a distinct hue. Used for exercise card borders and pill badges.

| Group      | Primary   | Light (badge text) | Hue Family |
|------------|-----------|-------------------|------------|
| Back       | `#14b8a6` | `#2dd4bf`         | Teal       |
| Biceps     | `#6366f1` | `#818cf8`         | Indigo     |
| Shoulders  | `#a855f7` | `#c084fc`         | Purple     |
| Chest      | `#f97316` | `#fb923c`         | Orange     |
| Triceps    | `#ec4899` | `#f472b6`         | Pink       |
| Quads      | `#eab308` | `#facc15`         | Yellow     |
| Hamstrings | `#22c55e` | `#4ade80`         | Green      |
| Glutes     | `#f43f5e` | `#fb7185`         | Rose       |
| Calves     | `#06b6d4` | `#22d3ee`         | Cyan       |
| Core       | `#f59e0b` | `#fbbf24`         | Amber      |
| Traps      | `#8b5cf6` | `#a78bfa`         | Violet     |
| Forearms   | `#64748b` | `#94a3b8`         | Slate      |

### Color Derivation

For each muscle group, derive:
- **Card border**: `rgba({primary}, 0.35)`
- **Badge background**: `rgba({primary}, 0.1)`
- **Badge border**: `rgba({primary}, 0.15)`
- **Badge text**: `{light}`

## Set State Indicators

| State    | Condition                 | Input BG              | Input Border           | Text Color | Button            |
|----------|---------------------------|-----------------------|------------------------|------------|-------------------|
| Pending  | Not yet logged            | `#162a3e`             | `#1e3a52`              | `#cbd5e1`  | Empty bordered    |
| Logged   | Met target (min <= reps <= max) | `#0c2d4e`      | `#164e7a`              | `#38bdf8`  | Blue check (`#0284c7`) |
| Exceeded | Reps > target_rep_max     | `rgba(168,85,247,0.08)` | `rgba(168,85,247,0.2)` | `#c084fc`  | Purple up-arrow (`#7c3aed`) |
| Under    | Reps < target_rep_min     | `rgba(239,68,68,0.06)` | `rgba(239,68,68,0.15)` | `#f87171`  | Red down-arrow (`#dc2626`) |

## Progress Bar

- Track: `#162a3e` (navy-input)
- Fill: `#4ade80` (green-400)
- Height: 3px
- Glow: `box-shadow: 0 0 8px rgba(74,222,128,0.5), 0 0 2px rgba(74,222,128,0.8)`
- Rounded right end (`rounded-r-full`)

## Components

### Exercise Card
- Background: `#0f1d2e` (navy-card)
- Border: `1.5px solid {muscle-group-color @ 0.35}`
- Border radius: `10px`
- Shadow: `0 4px 12px rgba(0,0,0,0.5)`
- Padding: `12px` horizontal, `12px` top, `10px` bottom

### Frosted Panel (Sets Wrapper)
- Background: `#132438` (navy-panel)
- Border: `1px solid rgba(255,255,255,0.04)`
- Border radius: `8px`
- Padding: `4px`

### Pill Badge (Muscle Group)
- Font: `11px`, `font-semibold`, `uppercase`, `tracking-wider`
- Padding: `2px 8px`
- Border radius: rounded (default)
- Colors derived from muscle group (see above)

### Set Input
- Height: `h-10` (40px)
- Border radius: `rounded-xl` (12px)
- Text: centered, `text-sm`, `font-medium`
- Focus: `ring-1 ring-sky-500`

### Check Button
- Size: `w-9 h-9`
- Border radius: `rounded-lg`
- Active animation: `transform: scale(0.85)` on `:active`

### Vignette Overlay
- `position: fixed; inset: 0`
- `background: radial-gradient(ellipse at center, transparent 60%, #070d15 100%)`
- `pointer-events: none; z-index: 100`

### Bottom Nav (Frosted Glass)
- Background: `rgba(13,27,42,0.95)`
- Backdrop filter: `blur(12px)`
- Top border: `1px solid rgba(255,255,255,0.06)`
- Active: `protocol-400` (`#38bdf8`)
- Inactive: `slate-600` (`#475569`)

## Typography

- **Font family**: Inter (Google Fonts), fallback `system-ui, sans-serif`
- **Weights**: 400 (body), 500 (medium), 600 (semibold), 700 (bold)
- **Sizes**:
  - Page title: `text-[15px] font-semibold`
  - Subtitle: `text-[11px]`
  - Exercise name: `text-base font-semibold`
  - Column headers: `text-[11px] font-medium uppercase tracking-wider`
  - Badge: `text-[11px] font-semibold uppercase tracking-wider`
  - Set inputs: `text-sm font-medium`
