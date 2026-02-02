# Protocol — PRD

**Version:** 0.1  
**Author:** Peter Kupusarević  
**Last Updated:** 2025-02-02

---

## Overview

**Protocol** is a personal fitness application combining gym tracking, nutrition logging, and glucose management. Built as a Progressive Web App (PWA) for cross-platform use without App Store dependencies.

The name reflects a systematic, data-driven approach to health management.

### Goals

1. Replace $40/month in subscription apps (gym tracker + diet app) with a self-hosted solution
2. Tailor functionality to personal workflow — eliminate bloat, optimize for speed
3. Own the data — full export capability, no lock-in
4. Learn mobile/PWA development and modern deployment practices

### Non-Goals

- Multi-user support or social features
- App Store distribution
- Apple Watch / HealthKit integration (PWA limitation)
- Complex meal planning or recipe management

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React + Vite + TypeScript | Best Claude Code support, fast builds |
| Styling | Tailwind CSS | Utility-first, responsive by default |
| Charts | Recharts | Simple, React-native |
| Backend | FastAPI (Python) | Familiar, async, good for AI orchestration |
| AI | Claude API via Anthropic SDK | Vision for food photos, potential agentic workflows |
| Database | PostgreSQL (Supabase) | Relational with JSON flexibility, managed |
| Image Storage | Supabase Storage | S3-compatible, same platform as DB |
| Hosting | Railway | Single service for everything, always-on, GitHub CI/CD |

### Why Railway Only (Not Vercel + Railway)

A common pattern is Vercel for frontend + Railway for backend. This is overkill for a single-user app:

- **You don't need global edge CDN** — you're one user in Belgrade
- **One service = simpler deploys** — push to GitHub, everything rebuilds
- **FastAPI can serve static files** — the built React app is just files

Railway runs a single Docker container with FastAPI serving both the API and the frontend. One repo, one deploy, one bill.

**Alternative:** A Hetzner VPS (~€4/month) with Docker Compose would also work and gives more control, but Railway has nicer DX for getting started.

### Supabase Free Tier (Sufficient for This App)

| Resource | Free Limit | Your Usage |
|----------|------------|------------|
| Database | 500 MB | ~500KB/year of workout + food logs |
| File Storage | 1 GB | ~3,000 food photos at 300KB each |
| Bandwidth | 5 GB/month | Minimal for single user |
| MAUs | 50,000 | You are 1 user |

**Note:** Free projects pause after 7 days of inactivity. Daily gym logging prevents this. If you take a long break, manually unpause via Supabase dashboard.

### Estimated Monthly Costs

| Service | Cost |
|---------|------|
| Railway | ~$5 |
| Supabase | $0 (free tier) |
| Claude API | ~$1-5 (food photo estimates) |
| **Total** | **~$6-10/month** |

Compared to current $40/month in subscriptions.

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Railway                    │
│  ┌───────────────────────────────────┐  │
│  │     Single Docker Container       │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │        FastAPI              │  │  │
│  │  │  - /api/* routes            │  │  │
│  │  │  - Auth (JWT)               │  │  │
│  │  │  - Claude API integration   │  │  │
│  │  │  - Serves React static      │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │
     ┌────────────┴────────────┐
     ▼                         ▼
┌──────────────┐      ┌──────────────────┐
│  PostgreSQL  │      │ Supabase Storage │
│  (Supabase)  │      │ (Food Photos)    │
└──────────────┘      └──────────────────┘
```

**Monorepo structure:**
```
protocol/
├── frontend/          # React + Vite
│   ├── src/
│   └── package.json
├── backend/           # FastAPI
│   ├── app/
│   └── requirements.txt
├── Dockerfile         # Builds both, serves from FastAPI
└── README.md
```

---

## Data Model

### Gym Domain

**Hierarchy:** Exercise → Session → Split → Mesocycle

```
Exercise
├── id: uuid
├── name: string                    "Incline Dumbbell Press"
├── muscle_groups: string[]         ["chest", "shoulders", "triceps"]
└── equipment_type: string          "dumbbell" | "barbell" | "machine" | "cable" | "bodyweight"
    (Future: valid_increments for smart progression)

Split
├── id: uuid
└── name: string                    "PPL 6-Day"

Session
├── id: uuid
├── split_id: uuid → Split
├── name: string                    "Push A"
├── day_order: int                  1, 2, 3...
├── is_rest_day: boolean
└── exercises: jsonb                [{exercise_id, sets, rep_min, rep_max}]

Mesocycle
├── id: uuid
├── split_id: uuid → Split
├── name: string                    "February Hypertrophy"
├── total_weeks: int                4
├── rir_scheme: int[]               [3, 2, 1, 0] (week 4 = deload, auto-calculated)
├── current_week: int               2
├── started_at: timestamp
└── is_active: boolean

WorkoutLog
├── id: uuid
├── mesocycle_id: uuid → Mesocycle
├── session_id: uuid → Session
├── week_number: int
├── date: date
├── notes: string (nullable)
└── sets: jsonb                     [{exercise_id, set_num, weight, reps, rir, completed}]
```

### Diet Domain

```
FoodItem
├── id: uuid
├── name: string                    "Greek Yogurt 2%"
├── barcode: string (nullable)      "5901234123457"
├── protein_per_100g: decimal
├── carbs_per_100g: decimal
├── fat_per_100g: decimal
├── kcal_per_100g: decimal
└── source: string                  "manual" | "barcode" | "ai_estimate"

FoodLog
├── id: uuid
├── date: date
├── meal_type: string (nullable)    "breakfast" | "lunch" | "dinner" | "snack"
├── food_item_id: uuid (nullable) → FoodItem
├── quantity_g: decimal
├── manual_macros: jsonb (nullable) {protein, carbs, fat, kcal} (if no food_item)
├── photo_url: string (nullable)
├── ai_response: jsonb (nullable)   (raw AI output for review)
└── notes: string (nullable)

DailyTargets (single row, user settings)
├── protein_g: int                  180
├── carbs_g: int                    250
├── fat_g: int                      70
└── kcal: int                       2400
```

### Glucose Domain

```
GlucoseSettings (single row, user settings)
├── carb_ratio: decimal             10 (1 unit per 10g carbs)
├── correction_factor: decimal      50 (1 unit per 50 mg/dL above target)
├── workout_modifier: decimal       0.7 (30% less insulin post-workout)
└── target_bg: int                  100

GlucoseLog
├── id: uuid
├── datetime: timestamp
├── carbs_eaten: decimal
├── suggested_units: decimal        (calculated at log time)
├── actual_units: decimal           (what was taken)
├── outcome: string                 "good" | "hypo" | "hyper"
├── had_recent_workout: boolean     (auto-flagged: workout in last 48h)
└── notes: string (nullable)
```

---

## Feature Specification

### Phase 1: Gym MVP

**Goal:** Replace gym tracking app. Log workouts, track progression, manage mesocycles.

#### 1.1 Exercise Library

- View all exercises in searchable list
- Add custom exercises (name, muscle groups, equipment type)
- Edit / delete exercises
- Pre-seeded with common exercises (bench, squat, deadlift, rows, etc.)

#### 1.2 Split Builder

- Create named splits ("PPL", "Upper/Lower", etc.)
- Add sessions to split with day order
- Mark rest days
- For each session: add exercises from library, specify target sets and rep range
- Reorder exercises via drag-and-drop (or simple up/down buttons for MVP)

#### 1.3 Mesocycle Management

- Create mesocycle: select split, name it, set total weeks
- RiR scheme auto-calculated:
  - 4 weeks → [3, 2, 1, 0] (week 4 = deload)
  - 5 weeks → [3, 2, 1, 0, deload]
  - Deload = half weight, half reps, half sets
- View current week, progress through mesocycle
- Only one active mesocycle at a time
- Complete mesocycle → archive, start new one

#### 1.4 Workout Logging

- Dashboard shows: "Today's workout: Push A (Week 2, RiR 2)"
- Load session template with target sets/reps
- For each set: enter weight, reps, mark complete
- Auto-fill weight from last session (same exercise, same week position)
- Rest timer (optional, dismissible)
- Save workout log on completion

#### 1.5 Progression Algorithm

Simple rule for MVP:
- If all sets hit **15 reps** at target RiR → suggest weight increase next session
- Default increment: +2.5kg (barbells), +2kg (dumbbells), +5kg (machines)
- Display suggestion, user confirms or adjusts

Future enhancement: equipment-aware increments (no 23kg dumbbells)

#### 1.6 Progress Views

- Per-exercise: weight over time chart, PR history
- Per-session: volume (sets × reps × weight) trend
- Mesocycle summary: completion %, volume progression

---

### Phase 2: Diet Tracking

**Goal:** Replace diet tracking app. Log food, estimate macros, hit daily targets.

#### 2.1 Food Logging Flow

Primary input modes:
1. **Manual entry:** Name + macros directly (fastest for known foods)
2. **Search saved foods:** Pick from personal FoodItem database, enter quantity
3. **Barcode scan:** Camera opens → detect barcode → lookup in personal DB
   - Hit: show food, enter quantity
   - Miss: prompt to add new FoodItem with macros
4. **AI photo:** Take photo → Claude Vision estimates food + portions → confirm/edit → save

Camera behavior (smart detection):
- Camera opens in single view
- If barcode detected → barcode flow
- If user takes photo → AI estimation flow
- Optional text input for hints ("this is about 200g of rice")

#### 2.2 Personal Food Database

- CRUD for FoodItems
- Store macros per 100g (standard unit)
- Optional barcode association
- Source tracking (manual, barcode, ai_estimate)
- Frequently used foods surfaced at top

#### 2.3 Barcode Scanning

- Client-side barcode detection (html5-qrcode or quagga2)
- Lookup against personal FoodItem table by barcode
- If not found: option to add new item
- Optional: fallback to Open Food Facts API for initial data

#### 2.4 AI Food Estimation

- Capture photo via camera
- Send to Claude Vision API with prompt:
  - Identify foods in image
  - Estimate portions (grams)
  - Calculate macros per item and total
- Return structured response for user confirmation
- Store photo + final macros in FoodLog
- Store AI response for later review/learning

#### 2.5 Daily View

- Today's food log grouped by meal (or flat list)
- Running totals: protein / carbs / fat / kcal
- Progress bars against DailyTargets
- Quick actions: add food, copy yesterday's meal

#### 2.6 Macro Adherence

- Weekly view: days hitting targets (80%+ = green)
- Simple stats: average protein/day, adherence %

---

### Phase 3: Glucose Management

**Goal:** Track insulin dosing, see patterns, get reference suggestions.

**Important:** This is a personal tracking tool, not medical advice. Suggestions are reference points based on user-configured ratios.

#### 3.1 Settings Configuration

- Set carb ratio (grams per unit)
- Set correction factor (mg/dL per unit)
- Set workout modifier (multiplier for post-workout)
- Set target BG

#### 3.2 Bolus Reference

When logging a meal:
- Input carbs (from FoodLog or manual)
- App calculates: `suggested_units = carbs / carb_ratio`
- If workout in last 48h: `suggested_units *= workout_modifier`
- Display suggestion prominently
- User logs actual units taken

#### 3.3 Outcome Logging

After meal (user-initiated):
- Log outcome: good / hypo / hyper
- Optional: notes

#### 3.4 Pattern View

- History of logs with outcomes
- Filter by: workout days vs rest days
- Surface patterns: "Rice meals tend to run hyper"
- Help inform ratio adjustments over time

#### 3.5 Future: CGM Integration

Sibionics GS3 has no official API. Community workaround via xDrip exists but is complex.
For now: manual BG entry if desired.
Future option: If user sets up xDrip/Nightscout, could pull from that.

---

### Cross-Domain Features

#### Combined Dashboard

- Today at a glance:
  - Workout scheduled? Completed?
  - Macros so far vs targets
  - Last glucose log outcome

#### Workout ↔ Nutrition Link

- Auto-flag `had_recent_workout` on GlucoseLog (check WorkoutLog for 48h window)
- Training day vs rest day nutrition comparison view

#### Protein/kg Tracking

- Optional: log bodyweight periodically
- Calculate protein per kg of bodyweight
- Show if hitting targets (e.g., 2g/kg goal)

#### Data Export

- Export all data as JSON
- Export specific tables as CSV
- No lock-in

---

## Authentication

Single-user app, simple approach:

- Single password configured via environment variable
- Login generates long-lived JWT (1 year)
- JWT stored in localStorage
- All API routes require valid JWT
- Rate limiting on login endpoint

No OAuth, no email, no password reset. It's your app.

---

## Security

- HTTPS required (Railway provides this)
- CORS restricted to your domain
- Claude API key stored server-side only, never exposed to client
- All AI requests proxied through backend
- Input validation on all endpoints

---

## PWA Requirements

- Service worker for "Add to Home Screen" capability
- App manifest with icons
- Responsive design (mobile-first, works on desktop)
- Offline: show "no connection" state (no offline-first complexity for MVP)

---

## Development Phases

### Phase 1: Gym MVP

**Goal:** Replace gym tracking app. Log workouts, track progression, manage mesocycles.

**Deliverables:**
- Project setup (monorepo, Railway deploy, Supabase connection)
- Exercise CRUD with pre-seeded common exercises
- Split builder UI
- Mesocycle creation with auto-calculated RiR scheme
- Workout logging flow
- Progression algorithm (suggest weight increase at 15 reps)
- Basic progress charts
- PWA setup (installable on phone)

**Done when:** Using app for daily workouts

### Phase 2: Diet Tracking

**Goal:** Replace diet tracking app. Log food, estimate macros, hit daily targets.

**Deliverables:**
- FoodItem CRUD (personal food database)
- Manual food logging
- Daily view with macro totals vs targets
- Barcode scanning (html5-qrcode)
- AI photo estimation (Claude Vision)
- Photo storage (Supabase Storage)

**Done when:** Logging all meals via app

### Phase 3: Glucose Management

**Goal:** Track insulin dosing, see patterns, get reference suggestions.

**Deliverables:**
- Settings configuration (carb ratio, workout modifier)
- Bolus reference calculation on meal log
- Outcome logging (good/hypo/hyper)
- Pattern view (filter by workout days vs rest days)
- Cross-domain dashboard

**Done when:** Full replacement of subscription apps

---

## Getting Started — Next Steps

### 1. Set Up Accounts

- [ ] **Supabase:** Create account at supabase.com, create new project "protocol"
- [ ] **Railway:** Create account at railway.app, connect GitHub
- [ ] **Anthropic:** Get API key from console.anthropic.com (for Claude Vision)

### 2. Create the Repository

```bash
mkdir protocol && cd protocol
git init
```

### 3. Scaffold with Claude Code

Use Claude Code to generate the initial project structure:

```
Create a monorepo for "Protocol" with:
- Frontend: React + Vite + TypeScript + Tailwind in /frontend
- Backend: FastAPI with SQLAlchemy in /backend
- Dockerfile that builds frontend and serves via FastAPI
- Basic health check endpoint
- PWA manifest and service worker setup
```

### 4. Set Up Database

In Supabase dashboard:
- Go to SQL Editor
- Run the schema migrations (generate from data model in this PRD)
- Get connection string from Settings → Database

### 5. Deploy to Railway

- Connect GitHub repo to Railway
- Add environment variables (Supabase URL, Claude API key, app password)
- Deploy

### 6. Start Building

Begin with Exercise CRUD — smallest vertical slice that proves the full stack works:
- Backend: `/api/exercises` endpoints
- Frontend: Exercise list + add/edit form
- Verify it works on your phone via Railway URL

### 7. Iterate

Use the app. See what's annoying. Fix it. Repeat.

---

## Success Metrics

1. **Cost:** Total hosting + API < $15/month (vs $40 current)
2. **Usage:** App used daily for 30+ days
3. **Speed:** Log a workout in < 2 minutes
4. **Speed:** Log a meal in < 30 seconds (saved food) or < 1 minute (photo)

---

## Open Questions

1. **Progression complexity:** Start simple (15 rep threshold), add equipment-aware increments later?
2. **Food database seeding:** Start empty, or pre-seed common foods?
3. **Deload calculation:** Half everything, or more nuanced?
4. **Photo storage retention:** Keep forever, or auto-delete after N days?

---

## Appendix: Barcode Scanning Libraries

| Library | Size | Notes |
|---------|------|-------|
| html5-qrcode | ~50kb | Good default choice, handles permissions well |
| quagga2 | ~85kb | More configurable, better for edge cases |
| zxing-js | ~200kb | Most comprehensive, overkill for this use |

Recommendation: Start with `html5-qrcode`

---

## Appendix: AI Food Estimation Prompt (Draft)

```
Analyze this food image and estimate the nutritional content.

For each distinct food item visible:
1. Identify the food
2. Estimate the portion size in grams
3. Provide macros (protein, carbs, fat, kcal)

Return as JSON:
{
  "items": [
    {
      "name": "grilled chicken breast",
      "portion_g": 150,
      "protein": 45,
      "carbs": 0,
      "fat": 5,
      "kcal": 225
    }
  ],
  "total": {
    "protein": 45,
    "carbs": 0,
    "fat": 5,
    "kcal": 225
  },
  "confidence": "medium",
  "notes": "Portion estimate based on plate size reference"
}

If user provides additional context, factor it in.
Be conservative with portion estimates when uncertain.
```
