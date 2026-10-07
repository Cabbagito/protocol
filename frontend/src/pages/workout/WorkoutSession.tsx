import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/Toast'
import {
  exerciseHistoryQuery, mesocycleQuery, useAddExercise, useExerciseHistory,
  useRemoveExerciseFromSession, useReorderExercises, useReplaceExercise, useSkipSession,
  useUpdateExerciseNote, useWeightLogs,
} from '../../api/hooks'
import { ApiError, NetworkError } from '../../api/client'
import MuscleSpotlight from '../../components/MuscleSpotlight'
import ProgressRail from '../../components/ProgressRail'
import ExercisePeekCard from '../../components/ExercisePeekCard'
import { getUserId } from '../../lib/auth'
import { todayIso } from '../../lib/dates'
import { formatHistorySummary } from '../../lib/exerciseHistory'
import { findNextOpenSession, getCurrentPosition } from '../../lib/mesoUtils'
import { useKeyboardVisible } from '../../lib/useKeyboardVisible'
import {
  applySnapshotToSession, findPreviousPerformance, targetForSet, toMesoExercises, withSession,
  type SetTarget,
} from '../../lib/workoutSession'
import { SyncUnavailableError, workoutSync } from '../../lib/workoutSync'
import { useWorkoutSession } from '../../hooks/useWorkoutSession'
import type { Mesocycle } from '../../types'
import { ExerciseHistoryPopup } from './ExerciseHistoryPopup'
import { ExercisePicker } from './ExercisePicker'
import { LoggingState } from './LoggingState'
import { NoteModal } from './NoteModal'
import { ReorderSheet } from './ReorderSheet'
import { SkippedExerciseState } from './SkippedExerciseState'
import { SyncPill } from './SyncPill'
import { WorkoutFinishBar } from './WorkoutFinishBar'
import { BackIcon, MesocycleIcon, ReorderIcon, SkipIcon } from './icons'

interface WorkoutSessionProps {
  mesocycle: Mesocycle
  weekIndex: number
  sessionIndex: number
}

const MONO = 'JetBrains Mono, ui-monospace, monospace'

const headerButton: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: 'var(--text-2)',
  display: 'grid', placeItems: 'center',
}

/**
 * One workout session. Mounted with a key per session (see pages/Workout),
 * so switching sessions always starts from fresh state.
 */
export function WorkoutSession({ mesocycle, weekIndex, sessionIndex }: WorkoutSessionProps) {
  const toast = useToast()
  const keyboardOpen = useKeyboardVisible()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const mesocycleId = mesocycle.id

  const week = mesocycle.structure.weeks[weekIndex]!
  const serverSession = week.sessions[sessionIndex]!
  const exerciseNotes = mesocycle.structure.exercise_notes ?? {}

  // Only later *weeks* are locked as previews; any session in the current
  // week can be logged out of order.
  const currentPos = getCurrentPosition(mesocycle.structure)
  const isFutureSession = !!currentPos && weekIndex > currentPos.weekIndex
  const isSkippedSession = !!serverSession.skipped
  const canLog = !isFutureSession && !isSkippedSession

  const session = useWorkoutSession({
    mesocycleId, weekIndex, sessionIndex, session: serverSession, readOnly: !canLog,
  })
  const { exercises } = session

  const updateExerciseNote = useUpdateExerciseNote()
  const replaceExercise = useReplaceExercise()
  const addExercise = useAddExercise()
  const reorderExercises = useReorderExercises()
  const removeExercise = useRemoveExerciseFromSession()
  const skipSession = useSkipSession()
  const { data: weightLogs } = useWeightLogs()

  // Cache every exercise's history now, while there's signal (locker room),
  // so "last time" targets still work deep inside the gym.
  useEffect(() => {
    for (const ex of serverSession.exercises) {
      void queryClient.prefetchQuery(exerciseHistoryQuery(ex.exercise_id))
    }
  }, [queryClient, serverSession.exercises])

  // UI state
  const [noteModal, setNoteModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null)
  const [replaceModal, setReplaceModal] = useState<{ exerciseId: string; exerciseIndex: number; muscleGroup: string; equipmentType: string } | null>(null)
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Current-exercise cursor; defaults to the first unfinished exercise.
  const [curIdxOverride, setCurIdxOverride] = useState<number | null>(null)
  // Per-exercise active set (chip taps, auto-advance after LOG).
  const [activeSetOverride, setActiveSetOverride] = useState<Record<string, number>>({})

  // ─── derived ───
  const exerciseDone = (i: number) => {
    const ex = exercises[i]!
    return ex.skipped || ex.sets.every(s => s.logged || s.skipped)
  }
  const firstUnfinished = exercises.findIndex((_, i) => !exerciseDone(i))
  const fallbackIdx = firstUnfinished === -1 ? Math.max(0, exercises.length - 1) : firstUnfinished
  const curIdx = Math.min(curIdxOverride ?? fallbackIdx, Math.max(0, exercises.length - 1))
  const currentEx = exercises[curIdx]

  let activeSetIdx = 0
  if (currentEx) {
    const override = activeSetOverride[currentEx.exercise_id]
    if (override != null && override < currentEx.sets.length) {
      activeSetIdx = override
    } else {
      const firstOpen = currentEx.sets.findIndex(s => !s.logged && !s.skipped)
      activeSetIdx = firstOpen === -1 ? currentEx.sets.length - 1 : firstOpen
    }
  }

  const allLogged = exercises.length > 0 && exercises.every((_, i) => exerciseDone(i))
  const showFinishBar = canLog && allLogged && !keyboardOpen

  // "Last time" for the current exercise: earlier in this mesocycle, else
  // the most recent older mesocycle.
  const { data: history } = useExerciseHistory(currentEx?.exercise_id)
  const previous = useMemo(
    () => currentEx
      ? findPreviousPerformance(mesocycle.structure, mesocycleId, weekIndex, sessionIndex, currentEx.exercise_id, history)
      : null,
    [currentEx, mesocycle.structure, mesocycleId, weekIndex, sessionIndex, history],
  )
  const isBodyweight = currentEx?.equipment_type === 'bodyweight'
  const latestBodyweight = useMemo(() => {
    if (!weightLogs?.length) return null
    return [...weightLogs].sort((a, b) => b.logged_on.localeCompare(a.logged_on))[0]!.weight_kg
  }, [weightLogs])
  const targets: SetTarget[] = (currentEx?.sets ?? []).map((_, i) => {
    const t = targetForSet(previous, i + 1)
    return isBodyweight && t.weight == null ? { ...t, weight: latestBodyweight } : t
  })

  // The structure with this session's local state applied (for "what's next").
  const localStructure = useMemo(
    () => withSession(
      mesocycle.structure, weekIndex, sessionIndex,
      applySnapshotToSession(serverSession, exercises, todayIso()),
    ),
    [mesocycle.structure, weekIndex, sessionIndex, serverSession, exercises],
  )
  const nextOpen = useMemo(
    () => findNextOpenSession(localStructure, { weekIndex, sessionIndex }),
    [localStructure, weekIndex, sessionIndex],
  )
  const isLastSession = nextOpen === null

  // ─── server-side changes ───
  // Changing the exercise list happens on the server, so this session's
  // local changes must be synced first; afterwards local state is rebuilt
  // from the fresh server copy.
  const runServerChange = useCallback(async (op: () => Promise<unknown>, failMessage: string) => {
    const userId = getUserId()
    if (!userId) return false
    setBusy(true)
    try {
      await workoutSync.ensureSynced(userId, mesocycleId, weekIndex, sessionIndex)
      await op()
      const fresh = await queryClient.fetchQuery({ ...mesocycleQuery(mesocycleId), staleTime: 0 })
      const freshSession = fresh.structure.weeks[weekIndex]?.sessions[sessionIndex]
      if (freshSession) session.resetFrom(freshSession)
      return true
    } catch (e) {
      toast.showError(
        e instanceof SyncUnavailableError ? e.message
          : e instanceof NetworkError ? 'No connection — try again when you have signal'
          : e instanceof ApiError ? e.message
          : failMessage,
      )
      return false
    } finally {
      setBusy(false)
    }
  }, [mesocycleId, weekIndex, sessionIndex, queryClient, session, toast])

  const position = { mesocycle_id: mesocycleId, week_index: weekIndex, session_index: sessionIndex }

  const handleReplace = async (newExerciseId: string, applyToFuture: boolean) => {
    if (!replaceModal) return
    const ok = await runServerChange(() => replaceExercise.mutateAsync({
      ...position,
      exercise_index: replaceModal.exerciseIndex,
      old_exercise_id: replaceModal.exerciseId,
      new_exercise_id: newExerciseId,
      apply_to_future: applyToFuture,
    }), 'Failed to replace exercise')
    if (ok) setReplaceModal(null)
  }

  const handleAddExercise = async (exerciseId: string) => {
    const ok = await runServerChange(
      () => addExercise.mutateAsync({ ...position, exercise_id: exerciseId, apply_to_future: true }),
      'Failed to add exercise',
    )
    if (ok) setAddExerciseOpen(false)
  }

  const handleRemoveExercise = async (exerciseId: string) => {
    const ok = await runServerChange(
      () => removeExercise.mutateAsync({ ...position, exercise_id: exerciseId, apply_to_future: true }),
      'Failed to remove exercise',
    )
    if (ok) setCurIdxOverride(null)
  }

  const handleReorder = async (exerciseIds: string[], currentExerciseId: string | null) => {
    const ok = await runServerChange(
      () => reorderExercises.mutateAsync({ ...position, exercise_ids: exerciseIds, apply_to_future: true }),
      'Failed to reorder exercises',
    )
    if (!ok) return
    setReorderOpen(false)
    if (currentExerciseId) {
      const idx = exerciseIds.indexOf(currentExerciseId)
      if (idx !== -1) setCurIdxOverride(idx)
    }
  }

  // Skip / restore the whole session. Logged sets are kept, so undo brings
  // the workout back exactly as it was.
  const handleSetSessionSkipped = async (skipped: boolean) => {
    if (skipped && !confirm('Skip this workout? You can undo this later.')) return
    await runServerChange(
      () => skipSession.mutateAsync({ ...position, skipped }),
      skipped ? 'Failed to skip workout' : 'Failed to restore workout',
    )
  }

  const handleSaveNote = async (exerciseId: string, note: string | null) => {
    const trimmed = note?.trim() || null
    await runServerChange(
      () => updateExerciseNote.mutateAsync({ mesocycle_id: mesocycleId, exercise_id: exerciseId, note: trimmed }),
      'Failed to save note',
    )
  }

  // ─── finish ───
  const finishingRef = useRef(false)
  const handleFinish = () => {
    if (finishingRef.current) return
    finishingRef.current = true
    // Everything is already saved on the phone; just push it now.
    workoutSync.schedule(0)
    if (!navigator.onLine) toast.showSuccess("Saved on this phone — it'll sync when you have signal")
    navigate(nextOpen
      ? `/workout/${mesocycleId}?week=${nextOpen.weekIndex}&session=${nextOpen.sessionIndex}`
      : `/mesocycles/${mesocycleId}`)
  }

  // ─── set actions with cursor moves ───
  const advanceAfter = (exIdx: number, setIdx: number) => {
    const ex = exercises[exIdx]!
    setCurIdxOverride(exIdx)
    const next = ex.sets.findIndex((s, i) => i > setIdx && !s.logged && !s.skipped)
    if (next !== -1) setActiveSetOverride(prev => ({ ...prev, [ex.exercise_id]: next }))
  }

  const mesoExercises = useMemo(() => toMesoExercises(exercises), [exercises])

  return (
    <div style={{ position: 'relative', overflowX: 'clip' }}>
      <MuscleSpotlight group={currentEx?.muscle_group ?? 'chest'} />

      <div style={{ position: 'relative', zIndex: 1, padding: `12px 20px ${showFinishBar ? 120 : 0}px` }}>
        {/* ── Header: back / title / mesocycle ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" style={headerButton}>
            <BackIcon />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text-m)', letterSpacing: '0.22em', fontFamily: MONO, fontWeight: 500 }}>
              WEEK {week.week_number} · DAY {sessionIndex + 1}
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
                fontStyle: 'italic', fontSize: 18, color: 'var(--text-1)', marginTop: 1,
              }}
            >
              {serverSession.session_name}
            </div>
            {canLog && <SyncPill />}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/mesocycles/${mesocycleId}`)}
            aria-label="View mesocycle"
            style={headerButton}
          >
            <MesocycleIcon />
          </button>
        </div>

        {/* ── Future-session banner (preview only) ── */}
        {isFutureSession && !isSkippedSession && (
          <div
            style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 12,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: '#f59e0b', fontWeight: 500,
            }}
          >
            Preview — complete previous workouts first.
          </div>
        )}

        {/* ── Skipped-session banner ── */}
        {isSkippedSession && (
          <div
            style={{
              marginTop: 14, padding: '14px 14px 12px', borderRadius: 14,
              background: 'rgba(148,163,184,0.07)', border: '1px dashed rgba(148,163,184,0.3)',
            }}
          >
            <div
              style={{
                fontSize: 10, color: 'var(--text-m)', letterSpacing: '0.22em',
                fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase',
              }}
            >
              Workout skipped
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.4 }}>
              This session is marked as skipped and won't count toward the mesocycle.
              {exercises.some(ex => ex.sets.some(s => s.logged)) && ' Sets you already logged are kept.'}
            </div>
            <button
              type="button"
              onClick={() => handleSetSessionSkipped(false)}
              disabled={busy}
              style={{
                marginTop: 12, width: '100%', height: 44, borderRadius: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-1)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              Undo skip
            </button>
          </div>
        )}

        {/* ── Progress rail ── */}
        {canLog && exercises.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <ProgressRail exercises={mesoExercises} currentIndex={curIdx} />
          </div>
        )}

        {/* ── Skipped exercise: dimmed shell with undo ── */}
        {canLog && currentEx && currentEx.skipped && (
          <SkippedExerciseState
            exercise={currentEx}
            onUnskip={() => session.toggleSkipExercise(currentEx.exercise_id)}
            onAdvanceExercise={() => setCurIdxOverride(curIdx + 1)}
            hasNextExercise={curIdx < exercises.length - 1}
          />
        )}

        {/* ── Logging ── */}
        {canLog && currentEx && !currentEx.skipped && currentEx.sets[activeSetIdx] && (
          <LoggingState
            exercise={currentEx}
            activeIdx={activeSetIdx}
            targets={targets}
            lastSummary={previous ? formatHistorySummary(previous.sets) : null}
            isBodyweight={isBodyweight}
            note={exerciseNotes[currentEx.exercise_id] ?? null}
            onEditNote={() => setNoteModal({ exerciseId: currentEx.exercise_id, exerciseName: currentEx.exercise_name })}
            onWeight={(idx, v) => session.setWeight(currentEx.exercise_id, idx, v)}
            onReps={(idx, v) => session.setReps(currentEx.exercise_id, idx, v)}
            onLog={(idx, w, r) => {
              session.logSet(currentEx.exercise_id, idx, w, r)
              advanceAfter(curIdx, idx)
            }}
            onAddSet={() => {
              // Jump to the new set only when it's the next thing to do.
              const allDone = currentEx.sets.every(s => s.logged || s.skipped)
              session.addSet(currentEx.exercise_id)
              setActiveSetOverride(prev => {
                const next = { ...prev }
                if (allDone) next[currentEx.exercise_id] = currentEx.sets.length
                else delete next[currentEx.exercise_id]
                return next
              })
            }}
            onChipTap={(idx) => setActiveSetOverride(prev => ({ ...prev, [currentEx.exercise_id]: idx }))}
            onSetType={(idx, type) => session.setSetType(currentEx.exercise_id, idx, type)}
            onSkipSet={(idx) => {
              const wasSkipped = currentEx.sets[idx]?.skipped
              session.toggleSkipSet(currentEx.exercise_id, idx)
              if (!wasSkipped) advanceAfter(curIdx, idx)
            }}
            onRemoveSet={(idx) => {
              session.removeSet(currentEx.exercise_id, idx)
              setActiveSetOverride(prev => {
                const next = { ...prev }
                delete next[currentEx.exercise_id]
                return next
              })
            }}
            onSwapExercise={() => setReplaceModal({
              exerciseId: currentEx.exercise_id,
              exerciseIndex: curIdx,
              muscleGroup: currentEx.muscle_group,
              equipmentType: currentEx.equipment_type,
            })}
            onSkipExercise={() => {
              session.toggleSkipExercise(currentEx.exercise_id)
              setCurIdxOverride(null)
            }}
            onRemoveExercise={() => handleRemoveExercise(currentEx.exercise_id)}
            onOpenHistory={() => setHistoryOpen(true)}
            onAdvanceExercise={() => setCurIdxOverride(curIdx + 1)}
            hasNextExercise={curIdx < exercises.length - 1}
            busy={busy}
          />
        )}

        {/* ── Workout list ── */}
        {canLog && exercises.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                  textTransform: 'uppercase', color: 'var(--text-m)', fontFamily: MONO,
                }}
              >
                Workout
              </div>
              {exercises.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReorderOpen(true)}
                  disabled={busy}
                  style={{
                    height: 36, padding: '0 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--text-2)', fontSize: 12, fontWeight: 500,
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  }}
                >
                  <ReorderIcon />
                  Reorder
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mesoExercises.map((ex, i) => (
                <ExercisePeekCard
                  key={ex.exercise_id}
                  exercise={ex}
                  index={i}
                  status={ex.skipped ? 'skipped' : exerciseDone(i) ? 'done' : i === curIdx ? 'current' : 'queued'}
                  onClick={() => setCurIdxOverride(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Add exercise ── */}
        {canLog && (
          <button
            type="button"
            onClick={() => setAddExerciseOpen(true)}
            disabled={busy}
            style={{
              marginTop: 16, width: '100%', padding: '14px 0',
              fontSize: 13, fontWeight: 500, color: 'var(--text-m)', borderRadius: 14,
              border: '1.5px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
            }}
          >
            + Add Exercise
          </button>
        )}

        {/* ── Skip the whole workout ── */}
        {canLog && !keyboardOpen && (
          <button
            type="button"
            onClick={() => handleSetSessionSkipped(true)}
            disabled={busy}
            style={{
              marginTop: 10, width: '100%', padding: '12px 0',
              fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', color: 'var(--text-m)',
              borderRadius: 14, border: 'none', background: 'transparent', cursor: 'pointer',
              opacity: busy ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <SkipIcon />
            Skip this workout
          </button>
        )}

        {/* ── Go-to-current CTA for preview / skipped screens ── */}
        {!keyboardOpen && (isFutureSession || isSkippedSession) && currentPos && (
          <button
            type="button"
            onClick={() => navigate(`/workout/${mesocycleId}?week=${currentPos.weekIndex}&session=${currentPos.sessionIndex}`)}
            style={{
              marginTop: 20, width: '100%', height: 52, borderRadius: 14,
              background: 'rgba(var(--accent-rgb),0.15)', border: '1.5px solid rgba(var(--accent-rgb),0.3)',
              color: 'var(--accent-l)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            Go to current workout
          </button>
        )}
      </div>

      {noteModal && (
        <NoteModal
          exerciseName={noteModal.exerciseName}
          initialNote={exerciseNotes[noteModal.exerciseId] ?? ''}
          onSave={(note) => {
            void handleSaveNote(noteModal.exerciseId, note || null)
            setNoteModal(null)
          }}
          onClose={() => setNoteModal(null)}
        />
      )}

      {replaceModal && (
        <ExercisePicker
          mode="replace"
          initialMuscleGroup={replaceModal.muscleGroup}
          initialEquipmentType={replaceModal.equipmentType}
          currentExerciseId={replaceModal.exerciseId}
          excludeExerciseIds={exercises.map(ex => ex.exercise_id)}
          onSelect={handleReplace}
          onClose={() => setReplaceModal(null)}
        />
      )}

      {addExerciseOpen && (
        <ExercisePicker
          mode="add"
          excludeExerciseIds={exercises.map(ex => ex.exercise_id)}
          onSelect={(exerciseId) => handleAddExercise(exerciseId)}
          onClose={() => setAddExerciseOpen(false)}
        />
      )}

      {reorderOpen && (
        <ReorderSheet
          subtitle={`${serverSession.session_name} · Week ${week.week_number}`}
          exercises={mesoExercises}
          saving={busy}
          onSave={(ids) => handleReorder(ids, currentEx?.exercise_id ?? null)}
          onClose={() => setReorderOpen(false)}
        />
      )}

      {historyOpen && currentEx && (
        <ExerciseHistoryPopup
          exerciseName={currentEx.exercise_name}
          muscleGroup={currentEx.muscle_group}
          equipmentType={currentEx.equipment_type}
          history={history ?? []}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {showFinishBar && (
        <WorkoutFinishBar
          exercises={exercises}
          isLastSession={isLastSession}
          busy={busy}
          onFinish={handleFinish}
          onReviewSets={() => navigate(`/workouts/${mesocycleId}/${weekIndex}/${sessionIndex}`)}
        />
      )}
    </div>
  )
}
