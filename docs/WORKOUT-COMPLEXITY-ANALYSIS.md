# Workout System: Complexity Analysis & Architecture Review

**Date:** 2026-03-29
**Scope:** Backend domain/services + Frontend hooks/components for workout logging and mesocycle progression

---

## 1. How the Data Moves

### The JSONB Blob

Everything lives in `mesocycle.structure` — a single JSONB column:

```
structure.weeks[N].sessions[N].exercises[N].sets[N]
```

Each set holds: `weight`, `reps`, `target_reps`, `suggested_weight`, `rir`, `logged`, `skipped`, `set_type`, `set_num`.

There is no separate WorkoutLog table. Logging a workout means mutating sets within this blob and calling `flag_modified()` to tell SQLAlchemy the JSONB changed.

### Lifecycle of a Single Set

```
                        CREATE MESO
                            │
                            ▼
    ┌─ Week 1: suggested_weight = ExercisePerformance.working_weight
    │          target_reps     = ExercisePerformance.working_reps
    │          weight          = null
    │          logged          = false
    │
    └─ Week 2+: suggested_weight = null (filled later by progression)
                target_reps     = null (filled later by progression)

                     OPEN WORKOUT (frontend)
                            │
                            ▼
    weight display = logged ? set.weight : (set.suggested_weight ?? 0)
    The user sees suggested_weight as the pre-filled value.

                     USER LOGS THE SET
                            │
                            ▼
    Local state: weight=user_input, reps=user_input, completed=true
    Auto-save fires → backend sets logged=true, weight, reps on the blob

                     USER FINISHES SESSION (complete=true)
                            │
                            ▼
    1. handle_weight_bump() — if weight != suggested, recalc target_reps via e1RM
    2. compute_progression() — carry weight + target_reps to next week's matching session
    3. update_exercise_performances() — upsert cross-meso memory table
```

### Auto-Save vs. Finish: The Two-Phase Commit

| Event | `complete` | Progression? | Performance tracking? |
|-------|-----------|--------------|----------------------|
| Set completed / skip toggled | `false` | No | No |
| "Finish Workout" / "Next" button | `true` | Yes | Yes |

Auto-save sends ALL completed sets each time (full state replacement for that session). The backend overwrites — sets NOT in the payload get `logged = false`.

---

## 2. Specific Findings: Current Pain Points

### Finding 1: The `weight` Field is Overloaded

**File:** `useWorkoutState.ts:61`
```ts
weight: s.logged ? (s.weight ?? 0) : (s.suggested_weight ?? s.weight ?? 0)
```

The same `weight` field on a set means three different things depending on context:
- **Before logging:** null (no user input yet)
- **After suggestion computed:** `suggested_weight` is the "real" value, `weight` stays null
- **After logging:** `weight` is the actual logged value

The frontend initialization line collapses these three states into one displayed value. This priority chain (`logged weight > suggested > raw > 0`) is repeated in `useSetModification.ts:53` and `useSetModification.ts:116` — three copies of the same resolution logic.

**Risk:** Any new code path that renders a set weight must re-derive this. If one place gets the priority wrong, the user sees stale/wrong data.

### Finding 2: Auto-Save is Full-State Replacement

**File:** `workout_service.py:166-179`

```python
for exercise in session.get("exercises", []):
    for set_data in exercise.get("sets", []):
        key = (exercise["exercise_id"], set_data["set_num"])
        if key in logged_map:
            set_data["weight"] = log.weight
            set_data["reps"] = log.reps
            set_data["logged"] = True
        else:
            set_data["logged"] = False  # ← everything not sent gets un-logged
```

Every auto-save overwrites the entire session's logged state. If the frontend fails to include a completed set in the payload (race condition, stale closure, or a bug), that set is silently un-logged. There's no diffing, no "only touch what changed."

**Risk:** Silent data loss. The user completes set 3, but a concurrent auto-save from set 2's completion fires with stale state — set 3 gets un-logged.

**Mitigation currently in place:** `pendingSavesRef` counter and sequential auto-saves. But the fundamental design means any single bad payload wipes state.

### Finding 3: Weight Edits After Completion Aren't Auto-Saved

**File:** `useWorkoutAutoSave.ts:151-162`

Auto-save triggers on:
- Completed set count changes
- Skipped exercises change
- Skipped sets change

It does NOT trigger on weight/reps edits to already-completed sets. If a user finishes set 1, then corrects the weight from 100 to 105, that edit lives only in frontend state until the next trigger (completing another set, or hitting "Finish").

If the user closes the app between editing and the next trigger, the correction is lost.

### Finding 4: Progression Runs at Finish Time, Not Per-Set

**File:** `workout_service.py:182-185`

```python
if complete:
    handle_weight_bump(structure, week_index, session_index)
    compute_progression(structure, week_index, session_index)
```

Weight bump detection and target_reps adjustment happen only when the user explicitly finishes. The user gets no feedback during the workout about how their weight change affects next week's targets. And if the session is abandoned (auto-saved but never finished), progression never computes — next week's session has empty suggestions.

### Finding 5: Session Matching is Fragile

**File:** `progression.py:162-166`, `progression.py:209-213`

Progression finds "the same session next week" by matching `session_name` AND `day_order`:

```python
if (future_session["session_name"] != session_name
    or future_session["day_order"] != day_order):
    continue
```

This works today because sessions are created from splits and never renamed. But there's no constraint preventing this from breaking — if session names were ever editable, or if exercise management changes `day_order`, progression silently writes to the wrong session or to nothing.

### Finding 6: Weight Initialization is Duplicated 3x

The logic for "what weight should this set show?" appears in three places:

1. **`useWorkoutState.ts:61`** — initial render
2. **`useSetModification.ts:53`** — after adding a set
3. **`useSetModification.ts:116`** — after removing a set

Each is a slightly different expression:
```ts
// useWorkoutState
weight: s.logged ? (s.weight ?? 0) : (s.suggested_weight ?? s.weight ?? 0)

// useSetModification (add)
weight: s.logged ? (s.weight ?? 0) : (local?.weight ?? s.suggested_weight ?? s.weight ?? 0)

// useSetModification (remove) — same as add
weight: s.logged ? (s.weight ?? 0) : (local?.weight ?? s.suggested_weight ?? s.weight ?? 0)
```

The set modification versions add `local?.weight` to preserve user edits during add/remove. This is correct but fragile — the priority chain must stay in sync across all three locations.

### Finding 7: ExercisePerformance Uses Inconsistent Aggregation

**File:** `workout_service.py:20-61`

```python
working_weight = max((s.get("weight") or 0) for s in logged_sets)    # max weight
working_reps = logged_sets[0].get("reps") or logged_sets[0].get("target_reps")  # FIRST set's reps
num_sets = len(logged_sets)
```

`working_weight` is the max across all sets, but `working_reps` comes from the first set. If the user does a heavy single on set 1 and volume sets on set 2-3, the "performance memory" stores the heavy weight with the heavy single's reps — which may not represent the user's typical working parameters.

This data seeds the next mesocycle (week 1 suggestions), so errors compound across mesos.

### Finding 8: Propagation Rules are Inconsistent

Different operations have different propagation behavior:

| Operation | Propagation | Guard |
|-----------|-------------|-------|
| Add set | Always propagates to future weeks | Only if future has no logged sets |
| Remove set | Always propagates to future weeks | Only if future has no logged sets |
| Add exercise | User chooses (`apply_to_future`) | Only if exercise not already present |
| Remove exercise | User chooses (`apply_to_future`) | Only if no logged sets in future |
| Replace exercise | User chooses (`apply_to_future`) | Always replaces (clears unlogged) |
| Reorder exercise | User chooses (`apply_to_future`) | By ID lookup |
| Weight bump | Always propagates | Only unlogged sets |
| Progression | Always propagates to next week only | Only unlogged sets |

Set operations always propagate. Exercise operations ask the user. Weight bumps propagate silently across all future weeks. There's no single mental model for "what happens to future weeks when I change something."

---

## 3. Architecture Assessment

### Backend: Clean and Well-Layered

```
domain/progression.py   ← Pure functions, no DB, no async (310 lines)
domain/constants.py     ← RIR schemes, weight increments (17 lines)
        │
        ▼
services/workout_service.py  ← DB + domain orchestration (778 lines)
services/mesocycle_service.py ← Meso CRUD + structure building (212 lines)
        │
        ▼
routers/workouts.py     ← HTTP thin controllers (195 lines)
```

**Verdict:** This layering is good. The domain layer being pure makes it testable. The service layer is the orchestrator.

**Concern:** `workout_service.py` at 778 lines is doing too many things — template fetching, set logging, exercise CRUD (add/remove/replace/reorder), history queries, note management. These are distinct responsibilities that happen to operate on the same JSONB blob.

### Frontend: Good Hook Composition, Growing Pains in Components

```
Workout.tsx (420 lines)  ← Page orchestrator
    ├─ useWorkoutState       (216 lines)  ← State machine
    ├─ useWorkoutAutoSave    (165 lines)  ← Backend sync
    ├─ useSetModification    (141 lines)  ← Add/remove sets
    ├─ useWorkoutCompletion  (109 lines)  ← Finish flow
    └─ useAnimPhase           (14 lines)  ← Animation state
        │
        ▼
    ExerciseCard (221 lines)  ← Per-exercise container
        │
        ▼
    SetRow (302 lines)  ← Per-set editor (approaching God component)
```

**Verdict:** The 5-hook pattern is well-designed — each hook has a single responsibility, none exceeds 216 lines. This is clean.

**Concern:** SetRow.tsx (302 lines) handles weight input, reps input, myorep_match reference resolution, set type changes, animation triggers, skip toggling, and multiple button states. It's the most complex component and the one most likely to accumulate bugs.

---

## 4. Proposed Simplifications

### 4A. Extract a `resolveSetWeight()` Utility

Replace the 3x duplicated weight initialization with one function:

```ts
// lib/setUtils.ts
function resolveSetWeight(
  set: TemplateSet,
  localOverride?: number | null
): number {
  if (set.logged) return set.weight ?? 0
  return localOverride ?? set.suggested_weight ?? set.weight ?? 0
}
```

Used in `useWorkoutState`, `useSetModification` (add), `useSetModification` (remove). Single source of truth for "what weight should this set show."

**Impact:** Eliminates Finding 6 entirely. Small change, high value.

### 4B. Make Auto-Save Additive, Not Replacement

Instead of the backend un-logging everything not in the payload, change to:

```python
# Only update sets that are explicitly in the payload
for exercise in session.get("exercises", []):
    for set_data in exercise.get("sets", []):
        key = (exercise["exercise_id"], set_data["set_num"])
        if key in logged_map:
            set_data["weight"] = log.weight
            set_data["reps"] = log.reps
            set_data["logged"] = True
        # else: leave unchanged (don't un-log)
```

Un-completing a set would require an explicit `uncomplete` action in the payload rather than omission.

**Impact:** Eliminates Finding 2 (silent data loss risk). Requires frontend change to explicitly send uncomplete actions. Medium effort.

### 4C. Split workout_service.py into Focused Modules

Current (778 lines, 11 functions):
```
workout_service.py
  ├─ get_next_template()
  ├─ get_specific_template()
  ├─ log_sets()
  ├─ update_exercise_performances()
  ├─ replace_exercise()
  ├─ add_exercise()
  ├─ remove_exercise()
  ├─ reorder_exercise()
  ├─ modify_sets()
  ├─ get_exercise_progress()
  ├─ update_exercise_note()
  ├─ get_workout_history()
  └─ get_workout_detail()
```

Proposed split:
```
services/
  workout_logging.py     ← log_sets, get_next_template, get_specific_template
  workout_history.py     ← get_workout_history, get_workout_detail, get_exercise_progress
  exercise_management.py ← add, remove, replace, reorder, modify_sets, update_note
  exercise_performance.py ← update_exercise_performances (cross-meso memory)
```

**Impact:** Each module stays under 250 lines. Easier to reason about, easier to test individually. No behavioral change.

### 4D. Auto-Save on Debounced Timer (Not Just Completion Count)

Add a debounced timer that fires 2-3 seconds after any state change, in addition to the completion-triggered saves. This catches weight/reps edits to already-completed sets (Finding 3).

```ts
// In addition to existing completion-triggered saves:
useEffect(() => {
  if (!initialized || isFutureSession) return
  const timer = setTimeout(() => {
    const hasCompletedSets = sets.some(s => s.completed)
    if (hasCompletedSets) triggerAutoSave(sets, skippedExercises, skippedSets)
  }, 3000)
  return () => clearTimeout(timer)
}, [sets]) // triggers on ANY set change, debounced
```

**Impact:** Eliminates Finding 3 (lost weight corrections). Small frontend change.

### 4E. Normalize Propagation into a Single Pattern

Define one propagation policy and use it everywhere:

```python
def propagate_to_future(
    structure, week_index, session_index,
    mutator_fn,  # (session, exercise) -> None
    exercise_id: str | None = None,
    guard_logged: bool = True,  # skip sessions with logged data
):
    """Apply a mutation to matching sessions in all future weeks."""
    session = structure["weeks"][week_index]["sessions"][session_index]
    session_name = session["session_name"]
    day_order = session["day_order"]

    for wi in range(week_index + 1, len(structure["weeks"])):
        for future_session in structure["weeks"][wi]["sessions"]:
            if future_session["session_name"] != session_name:
                continue
            if future_session["day_order"] != day_order:
                continue
            if exercise_id:
                target = next((e for e in future_session["exercises"]
                              if e["exercise_id"] == exercise_id), None)
                if not target:
                    continue
                if guard_logged and any(s.get("logged") for s in target.get("sets", [])):
                    continue
                mutator_fn(future_session, target)
            else:
                mutator_fn(future_session, None)
```

Every operation (add/remove/replace/reorder/modify_sets/weight_bump) uses this helper. The matching logic and guard conditions live in one place.

**Impact:** Eliminates Finding 8 (inconsistent propagation). Reduces code in workout_service.py by ~100 lines. Medium effort.

---

## 5. What Would a Deeper Refactor Look Like?

If we wanted to invest more substantially (not necessarily recommended for an MVP), here's what a cleaner architecture could look like:

### 5A. Separate `actual_weight` from `suggested_weight`

Currently a set has `weight` (overloaded) and `suggested_weight`. Cleaner:

```json
{
  "set_num": 1,
  "suggested_weight": 185.0,
  "suggested_reps": 10,
  "actual_weight": null,
  "actual_reps": null,
  "logged": false
}
```

`suggested_*` is set by progression and never overwritten by user input. `actual_*` is only set when logged. No ambiguity about which value to display — always show `actual` if logged, else `suggested`. The `weight` field disappears entirely.

**Trade-off:** Requires a data migration of existing mesocycle structures. Every existing set needs `weight` → `actual_weight`, and `target_reps` → `suggested_reps` (or keep `target_reps` if we want to distinguish "target" from "suggested").

### 5B. Event-Sourced Set Logging

Instead of mutating the JSONB blob directly, record set completions as events:

```python
class SetLog(Base):
    mesocycle_id = FK
    week_index = int
    session_index = int
    exercise_id = FK
    set_num = int
    weight = float
    reps = int
    rir = int | None
    logged_at = datetime
```

The JSONB blob becomes the "plan" (immutable after creation + progression). The SetLog table is the "execution." To render a workout, you overlay SetLog entries onto the plan.

**Trade-off:** More complex queries (join plan + logs), but gains an audit trail, eliminates the un-logging problem entirely, and makes the JSONB blob smaller and simpler (no `weight`, `reps`, `logged` fields — those live in SetLog).

This is a larger refactor and may be overkill for a 1-user MVP. But it cleanly separates "what should I do" from "what did I do."

---

## 6. Recommended Priority

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| 1 | Extract `resolveSetWeight()` utility | Small | Removes 3x duplication, prevents bugs |
| 2 | Split `workout_service.py` into modules | Small | Better readability, no behavioral change |
| 3 | Add debounced auto-save for edits | Small | Prevents lost weight corrections |
| 4 | Make auto-save additive (not replacement) | Medium | Eliminates silent data loss risk |
| 5 | Extract `propagate_to_future()` helper | Medium | Single propagation pattern, less code |
| 6 | Separate `actual_weight` / `suggested_weight` | Large | Cleanest data model, requires migration |
| 7 | Event-sourced SetLog table | Large | Full audit trail, cleanest separation |

Items 1-3 can be done in a single session with no breaking changes. Items 4-5 are medium-effort improvements. Items 6-7 are larger investments that would simplify the system fundamentally but require data migration.

---

## 7. Work Completed (2026-03-29)

All items from priorities 1, 2, 3, and 5 were implemented, plus an additional bug fix (Finding 7) and a test suite. Six commits on `refactor/workout-system`:

### 7A. Domain Test Suite (56 tests)

**Files created:**
- `backend/tests/conftest.py`
- `backend/tests/domain/test_progression.py` — 41 tests covering `compute_progression`, `handle_weight_bump`, `build_mesocycle_structure`, `get_current_position`, `derive_fields`, `calculate_rir_scheme`
- `backend/tests/domain/test_constants.py` — 7 tests for RIR_SCHEMES and WEIGHT_INCREMENTS
- `backend/tests/domain/test_propagation.py` — 8 tests for the new propagation helpers

All tests are pure dict-in/dict-out. No database, no async, no mocking. Run with `uv run pytest`.

### 7B. Extract Propagation Helpers (Finding 5 / Proposal 4E)

**New file:** `backend/app/domain/propagation.py`

Two helpers — `iter_future_sessions()` and `find_exercise_in_session()` — replaced the duplicated session-matching loop (`for wi in range(...): for session in ...: if name == ... and day_order == ...`) across 8 call sites:

- `workout_service/exercise_ops.py`: replace, add, remove, reorder, modify_sets (add + remove)
- `domain/progression.py`: handle_weight_bump, compute_progression

Guard conditions (has_logged, already-exists, etc.) remain at each call site since they differ per function.

### 7C. Split workout_service.py into Package (Finding 6 / Proposal 4C)

**Before:** `workout_service.py` — 743 lines, 14 functions across 4 unrelated responsibilities.

**After:**
```
backend/app/services/workout_service/
  __init__.py        — re-exports all public functions (existing imports unchanged)
  _helpers.py        — get_session_from_structure (shared validation)
  templates.py       — get_next_template, get_specific_template
  logging.py         — log_sets, update_exercise_performances
  exercise_ops.py    — replace, add, remove, reorder, modify_sets, update_note
  queries.py         — get_exercise_progress, get_workout_history, get_workout_detail
```

The router (`workouts.py`) continues to use `from app.services import workout_service` unchanged — the `__init__.py` re-exports everything.

### 7D. Fix ExercisePerformance Aggregation Bug (Finding 7)

**Before:**
```python
working_weight = max((s.get("weight") or 0) for s in logged_sets)
working_reps = logged_sets[0].get("reps") or logged_sets[0].get("target_reps")
```

Max weight from any set, reps from the first set. If set 1 logged 60kg x 10 and set 3 logged 80kg x 6, performance stored `weight=80, reps=10` — wrong pairing that compounded across mesocycles.

**After:**
```python
best_set = max(logged_sets, key=lambda s: s.get("weight") or 0)
working_weight = best_set.get("weight") or 0
working_reps = best_set.get("reps") or best_set.get("target_reps") or None
```

Weight and reps now come from the same set.

### 7E. Extract Set Resolution Utilities (Finding 1 / Proposal 4A)

**New file:** `frontend/src/lib/setDefaults.ts`

Exports `resolveSetWeight`, `resolveSetReps`, `resolveSetRir`, `resolveSetType`, and `buildWorkingSet`. Replaced 3 copies of the weight priority chain and the duplicated reps/rir/set_type logic between `useWorkoutState.ts` and `useSetModification.ts` (add + remove handlers).

### 7F. Debounced Auto-Save for Completed Set Edits (Finding 3 / Proposal 4D)

**File:** `frontend/src/hooks/useWorkoutAutoSave.ts`

Added a fingerprint of completed sets' data (weight, reps, rir, set_type). When the fingerprint changes without a completion count change, a 2-second debounced save fires. Immediate saves on new completions cancel any pending debounce to avoid redundant requests.

---

## 8. What Remains (Deferred)

### 8A. Make Auto-Save Additive, Not Replacement (Finding 2 / Proposal 4B) — Deferred

**Current risk:** `log_sets` sets `logged=False` for every set not in the payload (`logging.py`, the `else` branch in the set-application loop). A single bad payload silently un-logs previously completed sets.

**Current mitigation:** `pendingSavesRef` counter + sequential saves prevent most race conditions. The debounced save (7F) reduces the window further.

**What's needed to implement:**
1. **Integration test infrastructure** — Need async DB test fixtures (test database, session factory, seed data helpers) to test `log_sets` end-to-end. The current test suite only covers pure domain functions.
2. **Schema change** — Add `uncompleted_sets: list[SetRef] | None` to `LogSetsRequest` in `backend/app/schemas/workout.py`.
3. **Backend change** — In `logging.py`'s `log_sets`, remove the `else: set_data["logged"] = False` branch. Instead, only set `logged=False` for sets explicitly listed in `uncompleted_sets`.
4. **Frontend change** — When a user un-completes a set, include it in the `uncompleted_sets` payload instead of relying on omission. Touch `useWorkoutAutoSave.ts` and `useWorkoutCompletion.ts`.
5. **Test coverage** — Write tests verifying: additive save preserves existing logged state, explicit uncomplete works, skipped sets interaction, the "finish workout" (complete=true) path still triggers progression correctly.

### 8B. Separate `actual_weight` / `suggested_weight` (Proposal 5A) — Deferred

Requires a data migration of all existing mesocycle structures. Not needed while the `resolveSetWeight()` utility (7E) keeps the priority chain in one place.

### 8C. Event-Sourced SetLog Table (Proposal 5B) — Deferred

Largest investment. Would cleanly separate "plan" from "execution" but adds query complexity. Worth revisiting if the app grows beyond single-user MVP.

### 8D. Frontend Test Infrastructure — Not Started

No frontend test setup exists (no vitest, no testing-library). Would be needed before safely refactoring `SetRow.tsx` (302 lines) or the auto-save logic further.
