/**
 * Pure helpers for the local-first workout session.
 *
 * A session is edited on the phone and saved to localStorage on every change
 * (a "draft"); `workoutSync` pushes drafts to the server as full snapshots
 * (`PUT /api/workouts/session`). Snapshots are idempotent, so retries are
 * always safe. The server applies them with the same rules as
 * `applySnapshotToSession` below (backend: `apply_session_snapshot`).
 */
import type { ExerciseSessionHistory } from './exerciseHistory'
import type { MesoExercise, MesoSession, MesoSet, MesoStructure, Mesocycle, SetType } from '../types'

export interface SessionSet {
  /** Logged value, or one typed in but not logged yet. null = untouched. */
  weight: number | null
  reps: number | null
  set_type: SetType | null
  logged: boolean
  skipped: boolean
}

export interface SessionExercise {
  exercise_id: string
  exercise_name: string
  muscle_group: string
  equipment_type: string
  skipped: boolean
  sets: SessionSet[]
}

export interface SessionDraft {
  v: 1
  userId: string
  mesocycleId: string
  weekIndex: number
  sessionIndex: number
  exercises: SessionExercise[]
  /** Local date of the first set logged in this draft. */
  loggedOn: string | null
  /** Bumped on every local change; the draft is unsynced while rev > syncedRev. */
  rev: number
  syncedRev: number
  updatedAt: number
  /** Set when the server rejected the snapshot (not retried until it changes). */
  error: string | null
  /**
   * Every unsynced change came from correcting a past session: set-count
   * changes then stay in this session instead of resizing later ones.
   */
  editOnly?: boolean
}

export function isDraftDirty(d: SessionDraft): boolean {
  return d.rev > d.syncedRev
}

export function sessionFromServer(session: MesoSession): SessionExercise[] {
  return session.exercises.map(ex => ({
    exercise_id: ex.exercise_id,
    exercise_name: ex.exercise_name,
    muscle_group: ex.muscle_group,
    equipment_type: ex.equipment_type,
    skipped: !!ex.skipped,
    sets: ex.sets.map(s => ({
      weight: s.weight,
      reps: s.reps,
      set_type: s.set_type ?? null,
      logged: s.logged,
      skipped: !s.logged && !!s.skipped,
    })),
  }))
}

export function anyLogged(exercises: SessionExercise[]): boolean {
  return exercises.some(e => e.sets.some(s => s.logged))
}

export function blankSet(): SessionSet {
  return { weight: null, reps: null, set_type: null, logged: false, skipped: false }
}

/** Request body for PUT /api/workouts/session. */
export function snapshotPayload(d: SessionDraft, today: string) {
  return {
    mesocycle_id: d.mesocycleId,
    week_index: d.weekIndex,
    session_index: d.sessionIndex,
    logged_on: d.loggedOn ?? today,
    apply_to_future: !d.editOnly,
    exercises: d.exercises.map(e => ({
      exercise_id: e.exercise_id,
      skipped: e.skipped,
      sets: e.sets.map(s => ({
        weight: s.weight,
        reps: s.reps,
        set_type: s.set_type,
        logged: s.logged,
        skipped: s.skipped && !s.logged,
      })),
    })),
  }
}

/**
 * Apply a local snapshot onto a server session — the same rules the server
 * uses, minus carrying set-count changes onto future weeks. Used to show
 * unsynced local changes everywhere (overlay) without waiting for the server.
 */
export function applySnapshotToSession(
  session: MesoSession,
  exercises: SessionExercise[],
  loggedOn: string,
): MesoSession {
  const byId = new Map(exercises.map(e => [e.exercise_id, e]))
  const hadLogged = session.exercises.some(e => e.sets.some(s => s.logged))
  const nextExercises: MesoExercise[] = session.exercises.map(ex => {
    const local = byId.get(ex.exercise_id)
    if (!local) return ex
    return {
      ...ex,
      skipped: local.skipped,
      sets: local.sets.map((s, i): MesoSet => ({
        set_num: i + 1,
        weight: s.weight,
        reps: s.reps,
        logged: s.logged,
        skipped: s.skipped && !s.logged,
        set_type: s.set_type,
      })),
    }
  })
  const hasLogged = nextExercises.some(e => e.sets.some(s => s.logged))
  const date = !hasLogged ? null : !hadLogged || !session.date ? loggedOn : session.date
  return { ...session, exercises: nextExercises, date }
}

/** Replace one session in a structure, copying only the path to it. */
export function withSession(
  structure: MesoStructure,
  weekIndex: number,
  sessionIndex: number,
  session: MesoSession,
): MesoStructure {
  return {
    ...structure,
    weeks: structure.weeks.map((w, wi) =>
      wi !== weekIndex
        ? w
        : { ...w, sessions: w.sessions.map((s, si) => (si === sessionIndex ? session : s)) },
    ),
  }
}

/** Show unsynced local drafts on top of server data. */
export function overlayDrafts(meso: Mesocycle, drafts: SessionDraft[], today: string): Mesocycle {
  let structure = meso.structure
  for (const d of drafts) {
    if (d.mesocycleId !== meso.id || !isDraftDirty(d)) continue
    const session = structure.weeks[d.weekIndex]?.sessions[d.sessionIndex]
    if (!session) continue
    structure = withSession(
      structure, d.weekIndex, d.sessionIndex,
      applySnapshotToSession(session, d.exercises, d.loggedOn ?? today),
    )
  }
  return structure === meso.structure ? meso : { ...meso, structure }
}

// ─── "Last time" targets ────────────────────────────────────────────────

export interface PreviousPerformance {
  sets: MesoSet[]
  date: string | null
  /** e.g. "Week 3 · Pull" or "Block 1 · Week 4 · Pull" */
  label: string
}

/**
 * The most recent earlier session where this exercise was logged: first
 * within the current mesocycle (from the local structure, so it works
 * offline and includes unsynced sessions), then across older mesocycles
 * (server history).
 */
export function findPreviousPerformance(
  structure: MesoStructure,
  mesocycleId: string,
  weekIndex: number,
  sessionIndex: number,
  exerciseId: string,
  history: ExerciseSessionHistory[] | undefined,
): PreviousPerformance | null {
  let best: { sets: MesoSet[]; date: string | null; pos: number; label: string } | null = null
  for (let wi = 0; wi < structure.weeks.length; wi++) {
    const week = structure.weeks[wi]!
    for (let si = 0; si < week.sessions.length; si++) {
      if (wi === weekIndex && si === sessionIndex) continue
      const session = week.sessions[si]!
      const ex = session.exercises.find(e => e.exercise_id === exerciseId)
      const sets = ex?.sets.filter(s => s.logged && !s.skipped) ?? []
      if (sets.length === 0) continue
      const cand = {
        sets,
        date: session.date,
        pos: wi * 1000 + si,
        label: `Week ${week.week_number} · ${session.session_name}`,
      }
      if (!best || compareRecency(cand, best) > 0) best = cand
    }
  }
  if (best) return { sets: best.sets, date: best.date, label: best.label }

  const older = history?.find(h => h.meso_id !== mesocycleId && h.sets.length > 0)
  if (!older) return null
  return {
    sets: older.sets,
    date: older.date,
    label: `${older.meso_name} · Week ${older.week_number} · ${older.session_name}`,
  }
}

function compareRecency(
  a: { date: string | null; pos: number },
  b: { date: string | null; pos: number },
): number {
  if (a.date && b.date && a.date !== b.date) return a.date > b.date ? 1 : -1
  if (a.date && !b.date) return 1
  if (!a.date && b.date) return -1
  return a.pos - b.pos
}

export interface SetTarget {
  weight: number | null
  reps: number | null
}

/**
 * What to aim for on set N: the same set last time. Extra sets beyond last
 * time's count aim for its final set.
 */
export function targetForSet(prev: PreviousPerformance | null, setNum: number): SetTarget {
  if (!prev || prev.sets.length === 0) return { weight: null, reps: null }
  const sorted = [...prev.sets].sort((a, b) => a.set_num - b.set_num)
  const match =
    sorted.find(s => s.set_num === setNum) ??
    [...sorted].reverse().find(s => s.set_num < setNum) ??
    sorted[0]!
  return { weight: match.weight, reps: match.reps }
}

/** Local exercises in the server's shape (for shared list/progress components). */
export function toMesoExercises(exercises: SessionExercise[]): MesoExercise[] {
  return exercises.map(e => ({
    exercise_id: e.exercise_id,
    exercise_name: e.exercise_name,
    muscle_group: e.muscle_group,
    equipment_type: e.equipment_type,
    skipped: e.skipped,
    sets: e.sets.map((s, i) => ({
      set_num: i + 1,
      weight: s.weight,
      reps: s.reps,
      logged: s.logged,
      skipped: s.skipped && !s.logged,
      set_type: s.set_type,
    })),
  }))
}
