# Protocol — Roadmap

**Last Updated:** 2026-10-06

## Recently shipped

- **Local-first workout logging** — every set is saved on the phone first and
  synced in the background with retries; the app opens offline
  (see `docs/WORKOUT-LOGIC.md`).
- **"Last time" targets** — untouched sets show the previous session's weight
  and reps in grey; LOG accepts them. Replaces finish-time weight carry-forward.
- **Bodyweight exercises** can be logged (0 kg / latest weigh-in).
- **Custom exercises** — create, edit, delete (in-use ones are protected).
- **Split templates** are read-only with "Duplicate to customize".
- Bodyweight tracking, barcode scanner (Open Food Facts), per-user macro targets.
- Backend hardening: DB-backed test suite, CI gate before deploy, food/exercise
  ownership, login throttling, safer deletes (deleting a split keeps its
  mesocycles).

## Next, in rough priority order

### 1. Food logging good enough to switch to
The diet side is functional but doesn't yet beat a dedicated app. In order:
- **Fast re-logging:** recent and favourite foods at the top of search,
  "copy yesterday" / repeat a meal, edit a logged entry (today: delete only).
- **Meals** (breakfast/lunch/…) and quick-add of kcal/macros without a food.
- **AI meal logging** (text first, photo second) via Claude
  (`ANTHROPIC_API_KEY` config stub exists): describe a meal → editable rows
  with estimated macros → confirm.
- Visual pass on Diet + AddFoodSheet.

### 2. Progress / analysis redesign
The Progress page works but is thin. Training: weekly sets per muscle group,
e1RM trend per lift, PR detection, volume per session/week. Diet: calorie and
protein trends, adherence to targets, bodyweight trend line (moving average),
protein per kg.

### 3. Workout history views
"Review sets" (WorkoutDetail) and the exercise history popup still use the old
visual language and a plain table; redesign them in the v5 style (per-set
comparison with last time, PR markers, notes).

### 4. Split creation flow
Faster and more fun: start from a template, add exercises by muscle group with
a few taps, reorder days/exercises by drag, preview weekly volume per muscle.

### 5. Ready for other people
- First-run onboarding: pick a template → create a mesocycle → first workout.
- Change password / name in Settings; data export.
- PNG app icons (iOS ignores the SVG icon for the home screen).

### 6. Small things
- Rest timer between sets (often assumed, never built).
- Cheap UI "life" now that animated backgrounds are gone: set-logged
  confirmation, count-up numbers, ring fill transitions, staggered list
  entrance on first mount, shared press feedback.

## Not planned right now

- Glucose domain.
- Per-user identity / passkey auth — the single-password-per-user model is a
  deliberate simplicity choice for a friends-and-family app.
- Offline support for changing a workout's exercise list (add/swap/remove),
  which still needs a connection; set logging is fully offline.
