# How workouts work

The rules behind logging, skipping, "where we left off", targets and sync.
Code: `backend/app/domain/mesocycle_structure.py` (server) and
`frontend/src/lib/mesoUtils.ts` + `frontend/src/lib/workoutSession.ts` (client)
implement the same rules.

## The data

A mesocycle stores everything in one JSON document:

```
weeks[] → sessions[] → exercises[] → sets[]
```

- **Set:** `weight`, `reps`, `logged`, `skipped`, and optionally `set_type`
  (`myorep`, `myorep_match`; plain sets have none).
- **Exercise:** can be `skipped`.
- **Session:** can be `skipped`, and has a `date`.

When a mesocycle is created from a split, every session gets the split day's
exercises with 3 blank sets.

## When things count as done

| Thing | Done when |
|---|---|
| Set | logged **or** skipped |
| Exercise | skipped, **or** every set is done |
| Session | not skipped, and every exercise is done |
| Mesocycle | no open sessions left |

- **Skipped sessions** are neither done nor open: they're passed over and
  don't count toward "N / M workouts".
- **Skipping an exercise** keeps the sets you already logged for it. Those
  sets show up in history and progress, because the work was done.
- **Where we left off** is the first open session in order (week 1 day 1,
  week 1 day 2, …). Any session in the current week can be done out of
  order. Later weeks open as a read-only preview.

## Set counts

- Adding or removing a set changes that session.
- The same exercise in matching later sessions (same day of the split) gets
  the same number of sets, as long as you haven't started it yet.
- Adding an exercise also adds it to later matching sessions you haven't
  started.
- Swapping an exercise keeps your already-logged sets on the original
  exercise. The new exercise is inserted after it for the remaining sets.

## Previous weights: "last time" targets

There is no automatic progression and nothing is copied between weeks.

1. **Targets from last time.** When you open a set, the app looks up the
   last time you logged that exercise:
   - first, earlier in this mesocycle (most recent date);
   - otherwise, the most recent older mesocycle.

   That session's set with the same number is shown as a **grey target** for
   weight and reps. Sets beyond last time's count use its final set.
2. **LOG accepts what's shown.** Tap it to log the grey values, or type over
   them first.
3. **Weight carries forward within a session.** Typing a weight also fills
   it into the later open sets of that exercise.
4. **Bodyweight exercises** (pull-ups, dips, …) can be logged at 0 kg. If
   there's no last time, the target is your latest weigh-in. Log
   bodyweight + added weight for weighted variations.

"LAST · 3×10 @ 60kg" above the numbers summarizes that previous session.
Tap it for the full history.

## Dates

A session's date is the day its **first set was logged**:

- Opening a session never changes anything.
- Editing an old session later keeps its date.
- If you un-log everything, the date is cleared.

## Saving and sync (offline)

Everything you do in a workout is saved **on the phone first**, then sent
to the server in the background:

1. Every tap (log, skip, add set, typed value) is written to the phone's
   storage right away. Closing the app, losing signal or reloading never
   loses it.
2. A background queue sends the whole session to the server
   (`PUT /api/workouts/session`). Sending the same thing twice is harmless,
   so it simply retries with backoff until the server confirms. It also
   retries when the phone comes back online or the app is reopened.
3. Once confirmed, the local copy is dropped and the server copy is the truth.

The app also keeps its last-loaded data on the phone, so it opens offline.
Open the workout once with signal (e.g. in the locker room) and everything
needed for the session, including last-time targets, is available deeper in
the gym.

The header under the workout name shows:

- **Synced:** everything is on the server.
- **Syncing…:** sending now.
- **Offline · saved on phone:** no signal. Keep going; it syncs later.
- **Not synced · retry:** the server rejected a change, which is rare. Tap
  to retry.

Changes to the **exercise list** need a connection: swap, add, remove,
reorder, skipping the whole workout, and notes. The app syncs the session
first, then applies the change.

**FINISH** never waits for the network. It moves you to the next open
session, or to the mesocycle page when the mesocycle is done.
