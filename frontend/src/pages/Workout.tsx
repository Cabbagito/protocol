import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
// Icons inlined in CompletedButton
import { useLogSets, useMesocycle, useExercises, useUpdateExerciseNote, useReplaceExercise, queryKeys } from '../api/hooks'
import { api } from '../api/client'
import PageLoader from '../components/PageLoader'
import AppHeader from '../components/AppHeader'
import RirBadge from '../components/RirBadge'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import MesoGrid from '../components/MesoGrid'
import BottomSheet from '../components/BottomSheet'
import { getCurrentPosition } from '../lib/mesoUtils'
import { getMuscleColor } from '../lib/muscleColors'
import type { WorkoutTemplate, MesoExercise, MesoSet, Mesocycle, SetType } from '../types'

interface WorkingSet extends MesoSet {
  exercise_id: string
  exercise_name: string
  completed: boolean
}

function getNextSession(weekIndex: number, sessionIndex: number, mesocycle: Mesocycle) {
  const weeks = mesocycle.structure.weeks
  const currentWeek = weeks[weekIndex]
  if (currentWeek && sessionIndex + 1 < currentWeek.sessions.length)
    return { weekIndex, sessionIndex: sessionIndex + 1 }
  if (weekIndex + 1 < weeks.length)
    return { weekIndex: weekIndex + 1, sessionIndex: 0 }
  return null
}

export default function Workout() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { mesocycleId } = useParams<{ mesocycleId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const sessionParam = searchParams.get('session')
  const { data: template, isLoading } = useQuery({
    queryKey: weekParam !== null && sessionParam !== null
      ? ['workouts', 'template', mesocycleId, Number(weekParam), Number(sessionParam)]
      : ['workouts', 'template', mesocycleId],
    queryFn: () => weekParam !== null && sessionParam !== null
      ? api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}/${weekParam}/${sessionParam}`)
      : api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}`),
    enabled: !!mesocycleId,
  })
  const { data: mesocycle } = useMesocycle(mesocycleId!)
  const logSets = useLogSets()
  const updateExerciseNote = useUpdateExerciseNote()
  const replaceExercise = useReplaceExercise()
  const [sets, setSets] = useState<WorkingSet[]>([])
  const [initialized, setInitialized] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const [skippedExercises, setSkippedExercises] = useState<Set<string>>(new Set())
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({})
  const [noteModal, setNoteModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null)
  const [replaceModal, setReplaceModal] = useState<{ exerciseId: string; exerciseIndex: number; muscleGroup: string } | null>(null)
  const pendingSavesRef = useRef(0)
  const prevCompletedRef = useRef(0)
  const prevSkippedRef = useRef<string>('')

  // Animation phase tracking
  const animPhaseRef = useRef<Map<string, 'saving' | 'success'>>(new Map())
  const [, setAnimTick] = useState(0)
  const bumpAnim = useCallback(() => setAnimTick(n => n + 1), [])
  const setAnimKey = useCallback((exerciseId: string, setNum: number) => `${exerciseId}:${setNum}`, [])
  const clearAnim = useCallback((exerciseId: string, setNum: number) => {
    animPhaseRef.current.delete(`${exerciseId}:${setNum}`)
    bumpAnim()
  }, [bumpAnim])

  const currentPos = useMemo(() => {
    if (!mesocycle) return null
    return getCurrentPosition(mesocycle.structure)
  }, [mesocycle])

  const isFutureSession = useMemo(() => {
    if (!template || !currentPos) return false
    return template.week_index > currentPos.weekIndex
  }, [template, currentPos])

  // Reset state when navigating to a different session
  useEffect(() => {
    setInitialized(false)
    setSets([])
    setSkippedExercises(new Set())
    setExerciseNotes({})
    setHeaderExpanded(false)
    prevCompletedRef.current = 0
    prevSkippedRef.current = ''
    animPhaseRef.current.clear()
  }, [weekParam, sessionParam])

  useEffect(() => {
    if (template && !initialized) {
      const initialSets: WorkingSet[] = []
      const initialSkipped = new Set<string>()
      for (const ex of template.exercises) {
        if (ex.skipped) initialSkipped.add(ex.exercise_id)
        for (const s of ex.sets) {
          initialSets.push({
            ...s,
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            weight: s.suggested_weight ?? s.weight ?? 0,
            reps: s.reps ?? 0,
            rir: template.target_rir >= 0 ? template.target_rir : null,
            completed: s.logged,
            set_type: s.set_type,
          })
        }
      }
      setSets(initialSets)
      setSkippedExercises(initialSkipped)
      setExerciseNotes(template.exercise_notes ?? {})
      prevCompletedRef.current = initialSets.filter(s => s.completed).length
      prevSkippedRef.current = [...initialSkipped].sort().join(',')
      setInitialized(true)
    }
  }, [template, initialized])

  const updateSet = useCallback((exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => {
    if (isFutureSession) return
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, [field]: value }
          : s
      )
    )
  }, [isFutureSession])

  const completeSet = useCallback((exerciseId: string, setNum: number) => {
    if (isFutureSession) return
    animPhaseRef.current.set(setAnimKey(exerciseId, setNum), 'saving')
    bumpAnim()
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, completed: true }
          : s
      )
    )
  }, [isFutureSession, setAnimKey, bumpAnim])

  const uncompleteSet = useCallback((exerciseId: string, setNum: number) => {
    if (isFutureSession) return
    animPhaseRef.current.delete(setAnimKey(exerciseId, setNum))
    bumpAnim()
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, completed: false }
          : s
      )
    )
  }, [isFutureSession, setAnimKey, bumpAnim])

  // Auto-save
  const triggerAutoSave = useCallback((currentSets: WorkingSet[], currentSkipped?: Set<string>) => {
    if (!mesocycleId || !template || isFutureSession) return
    const skipped = currentSkipped ?? skippedExercises
    const completed = currentSets.filter(s => s.completed && !skipped.has(s.exercise_id))

    // Build exercise updates for skipped state
    const exerciseUpdates = template.exercises.map(ex => ({
      exercise_id: ex.exercise_id,
      skipped: skipped.has(ex.exercise_id),
    }))

    // Snapshot keys currently in 'saving' phase
    const savingKeys = [...animPhaseRef.current.entries()]
      .filter(([, phase]) => phase === 'saving')
      .map(([key]) => key)

    pendingSavesRef.current++
    setIsSaving(true)

    logSets.mutateAsync({
      mesocycle_id: mesocycleId,
      week_index: template.week_index,
      session_index: template.session_index,
      sets: completed.map(s => ({
        exercise_id: s.exercise_id,
        set_num: s.set_num,
        weight: s.weight ?? 0,
        reps: s.reps ?? 0,
        rir: s.rir,
        set_type: s.set_type ?? null,
      })),
      notes: null,
      exercise_updates: exerciseUpdates,
    }).then(() => {
      // Update cached templates so navigating away and back shows correct logged state
      const loggedKeys = new Set(
        completed.map(s => `${s.exercise_id}:${s.set_num}`)
      )
      const skippedIds = new Set(
        exerciseUpdates.filter(eu => eu.skipped).map(eu => eu.exercise_id)
      )

      queryClient.setQueriesData<WorkoutTemplate>(
        { queryKey: ['workouts', 'template', mesocycleId] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            exercises: old.exercises.map(ex => ({
              ...ex,
              skipped: skippedIds.has(ex.exercise_id),
              sets: ex.sets.map(s => {
                const key = `${ex.exercise_id}:${s.set_num}`
                if (loggedKeys.has(key)) {
                  const logged = completed.find(
                    c => c.exercise_id === ex.exercise_id && c.set_num === s.set_num
                  )!
                  return { ...s, weight: logged.weight, reps: logged.reps, rir: logged.rir, logged: true, set_type: logged.set_type ?? s.set_type }
                }
                return { ...s, logged: false }
              }),
            })),
          }
        }
      )

      // Invalidate mesocycle caches (they compute derived fields server-side)
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.detail(mesocycleId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.history(mesocycleId) })
    }).catch(() => {
      toast.showError('Auto-save failed')
      // On error, remove saving keys so no success animation plays
      for (const key of savingKeys) animPhaseRef.current.delete(key)
      bumpAnim()
    }).finally(() => {
      pendingSavesRef.current--
      if (pendingSavesRef.current === 0) setIsSaving(false)

      // Transition remaining 'saving' → 'success'
      for (const key of savingKeys) {
        if (animPhaseRef.current.get(key) === 'saving') {
          animPhaseRef.current.set(key, 'success')
        }
      }
      bumpAnim()

      // Clean up 'success' entries after animation completes
      setTimeout(() => {
        for (const key of savingKeys) {
          if (animPhaseRef.current.get(key) === 'success') {
            animPhaseRef.current.delete(key)
          }
        }
        bumpAnim()
      }, 600)
    })
  }, [mesocycleId, template, logSets, toast, isFutureSession, skippedExercises, bumpAnim, queryClient])

  // Trigger auto-save when completed count or skipped set changes
  useEffect(() => {
    if (!initialized) return
    const count = sets.filter(s => s.completed).length
    const skippedKey = [...skippedExercises].sort().join(',')
    if (count !== prevCompletedRef.current || skippedKey !== prevSkippedRef.current) {
      triggerAutoSave(sets, skippedExercises)
    }
    prevCompletedRef.current = count
    prevSkippedRef.current = skippedKey
  }, [sets, initialized, triggerAutoSave, skippedExercises])

  const toggleSkip = useCallback((exerciseId: string) => {
    setSkippedExercises(prev => {
      const next = new Set(prev)
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      return next
    })
  }, [])

  const handleSaveNote = useCallback((exerciseId: string, note: string | null) => {
    if (!mesocycleId) return
    const trimmed = note?.trim() || null
    setExerciseNotes(prev => {
      if (trimmed) return { ...prev, [exerciseId]: trimmed }
      const next = { ...prev }
      delete next[exerciseId]
      return next
    })
    updateExerciseNote.mutate({ mesocycle_id: mesocycleId, exercise_id: exerciseId, note: trimmed })
  }, [mesocycleId, updateExerciseNote])

  const handleReplace = useCallback(async (newExerciseId: string, applyToFuture: boolean) => {
    if (!mesocycleId || !template || !replaceModal) return
    try {
      await replaceExercise.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_index: replaceModal.exerciseIndex,
        old_exercise_id: replaceModal.exerciseId,
        new_exercise_id: newExerciseId,
        apply_to_future: applyToFuture,
      })
      setReplaceModal(null)
      setInitialized(false)
      setSets([])
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    } catch {
      toast.showError('Failed to replace exercise')
    }
  }, [mesocycleId, template, replaceModal, replaceExercise, queryClient, toast])

  const isLastSession = useMemo(() => {
    if (!mesocycle || !template) return false
    return getNextSession(template.week_index, template.session_index, mesocycle) === null
  }, [mesocycle, template])

  const handleFinishOrNext = async () => {
    if (pendingSavesRef.current > 0) {
      setIsSaving(true)
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (pendingSavesRef.current === 0) { clearInterval(check); resolve() }
        }, 100)
      })
    }

    // Send final save with complete=true to trigger progression + performance tracking
    if (mesocycleId && template && !isFutureSession) {
      const completed = sets.filter(s => s.completed && !skippedExercises.has(s.exercise_id))
      const exerciseUpdates = template.exercises.map(ex => ({
        exercise_id: ex.exercise_id,
        skipped: skippedExercises.has(ex.exercise_id),
      }))
      try {
        await logSets.mutateAsync({
          mesocycle_id: mesocycleId,
          week_index: template.week_index,
          session_index: template.session_index,
          sets: completed.map(s => ({
            exercise_id: s.exercise_id,
            set_num: s.set_num,
            weight: s.weight ?? 0,
            reps: s.reps ?? 0,
            rir: s.rir,
            set_type: s.set_type ?? null,
          })),
          notes: null,
          exercise_updates: exerciseUpdates,
          complete: true,
        })
      } catch {
        toast.showError('Failed to finalize workout')
      }
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })

    if (isLastSession) {
      navigate(`/mesocycles/${mesocycleId}`)
    } else {
      const next = getNextSession(template!.week_index, template!.session_index, mesocycle!)
      navigate(`/workout/${mesocycleId}?week=${next!.weekIndex}&session=${next!.sessionIndex}`)
    }
  }

  const currentWorkoutInfo = useMemo(() => {
    if (!mesocycle || !currentPos) return null
    const session = mesocycle.structure.weeks[currentPos.weekIndex]?.sessions[currentPos.sessionIndex]
    const rir = mesocycle.rir_scheme[currentPos.weekIndex]
    return {
      name: session?.session_name ?? 'Workout',
      week: currentPos.weekIndex + 1,
      rir: rir === -1 ? 'Deload' : `RiR ${rir}`,
    }
  }, [mesocycle, currentPos])

  if (isLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  if (!template) {
    return <div className="text-[var(--text-m)] text-center py-8">Workout template not found</div>
  }

  // Compute completion excluding skipped exercises
  const activeSets = sets.filter(s => !skippedExercises.has(s.exercise_id))
  const completedSets = activeSets.filter(s => s.completed).length
  const totalSets = activeSets.length

  const exerciseGroups = template.exercises.map((ex, idx) => ({
    ...ex,
    exerciseIndex: idx,
    workingSets: sets.filter((s) => s.exercise_id === ex.exercise_id),
  }))

  const rirLabel = template.target_rir === -1 ? 'Deload' : `RiR ${template.target_rir}`

  return (
    <div className="pb-4">
      <AppHeader
        title={template.session_name}
        subtitle={isFutureSession ? `Week ${template.week_number} · ${rirLabel}` : `Week ${template.week_number}`}
        rightContent={
          isFutureSession ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.15)' }}
            >
              <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-2)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Preview</span>
            </div>
          ) : (
            <RirBadge rir={template.target_rir} />
          )
        }
        progressPercent={isFutureSession ? undefined : (totalSets > 0 ? (completedSets / totalSets) * 100 : 0)}
        drawerContent={mesocycle && (
          <MesoGrid
            mesocycle={mesocycle}
            compact
            viewingWeek={isFutureSession ? template.week_index : undefined}
            viewingSession={isFutureSession ? template.session_index : undefined}
          />
        )}
        drawerExpanded={headerExpanded}
        onHeaderAreaClick={() => setHeaderExpanded(prev => !prev)}
      />

      {/* Future session banner */}
      {isFutureSession && (
        <div
          className="mx-2.5 mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
            Complete previous workouts first
          </span>
        </div>
      )}

      {/* Exercise Cards */}
      <div className="px-2.5 pt-4 flex flex-col gap-3" style={isFutureSession ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
        {exerciseGroups.map((ex) => (
          <ExerciseCard
            key={ex.exercise_id}
            exercise={ex}
            exerciseIndex={ex.exerciseIndex}
            sets={ex.workingSets}
            allSets={sets}
            targetRir={template.target_rir}
            onUpdateSet={updateSet}
            onCompleteSet={completeSet}
            onUncompleteSet={uncompleteSet}
            locked={isFutureSession}
            skipped={skippedExercises.has(ex.exercise_id)}
            onToggleSkip={() => toggleSkip(ex.exercise_id)}
            note={exerciseNotes[ex.exercise_id]}
            onEditNote={() => setNoteModal({ exerciseId: ex.exercise_id, exerciseName: ex.exercise_name })}
            onReplace={() => setReplaceModal({ exerciseId: ex.exercise_id, exerciseIndex: ex.exerciseIndex, muscleGroup: ex.muscle_group })}
            animPhaseRef={animPhaseRef}
            onClearAnim={clearAnim}
          />
        ))}
      </div>

      {/* Context-aware sticky button */}
      {!isFutureSession && completedSets === totalSets && totalSets > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleFinishOrNext}
              disabled={isSaving}
              className="btn btn-primary w-full"
            >
              {isSaving ? 'Saving...' : isLastSession ? 'Finish Mesocycle' : 'Next Workout'}
            </button>
          </div>
        </div>
      )}

      {/* Go to current workout CTA */}
      {isFutureSession && currentWorkoutInfo && (
        <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-3">
          <div className="max-w-lg mx-auto flex flex-col gap-1.5">
            <button
              onClick={() => navigate(`/workout/${mesocycleId}`)}
              className="btn w-full font-medium"
              style={{
                background: 'rgba(var(--accent-rgb),0.15)',
                border: '1.5px solid rgba(var(--accent-rgb),0.3)',
                color: 'var(--accent-l)',
              }}
            >
              Go to Current Workout
            </button>
            <span className="text-[11px] text-center" style={{ color: 'var(--text-m)' }}>
              {currentWorkoutInfo.name} · Week {currentWorkoutInfo.week} · {currentWorkoutInfo.rir}
            </span>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <NoteModal
          exerciseName={noteModal.exerciseName}
          initialNote={exerciseNotes[noteModal.exerciseId] ?? ''}
          onSave={(note) => {
            handleSaveNote(noteModal.exerciseId, note || null)
            setNoteModal(null)
          }}
          onClose={() => setNoteModal(null)}
        />
      )}

      {/* Replace Exercise Picker */}
      {replaceModal && (
        <ExercisePicker
          muscleGroup={replaceModal.muscleGroup}
          currentExerciseId={replaceModal.exerciseId}
          onSelect={handleReplace}
          onClose={() => setReplaceModal(null)}
        />
      )}
    </div>
  )
}

// --- Note Modal ---

function NoteModal({ exerciseName, initialNote, onSave, onClose }: {
  exerciseName: string
  initialNote: string
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [note, setNote] = useState(initialNote)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative w-full rounded-t-2xl pb-safe slide-up"
        style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="px-5 pb-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-m)]">Note for {exerciseName}</span>
        </div>
        <div className="px-4 pb-3">
          <textarea
            ref={inputRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Use wide grip, lean back slightly"
            rows={3}
            className="input w-full resize-none"
            style={{ fontSize: 15 }}
          />
        </div>
        <div className="px-4 pb-4 flex gap-2">
          {initialNote && (
            <button
              onClick={() => onSave('')}
              className="btn flex-1"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              Remove
            </button>
          )}
          <button onClick={() => onSave(note)} className="btn btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Exercise Picker (Replace) ---

function ExercisePicker({ muscleGroup, currentExerciseId, onSelect, onClose }: {
  muscleGroup: string
  currentExerciseId: string
  onSelect: (exerciseId: string, applyToFuture: boolean) => void
  onClose: () => void
}) {
  const { data: exercises } = useExercises()
  const [search, setSearch] = useState('')
  const [applyToFuture, setApplyToFuture] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!exercises) return []
    return exercises
      .filter(ex => ex.muscle_group === muscleGroup && ex.id !== currentExerciseId)
      .filter(ex => !search || ex.name.toLowerCase().includes(search.toLowerCase()))
  }, [exercises, muscleGroup, currentExerciseId, search])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--base)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={onClose} className="text-[var(--text-2)] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-[var(--text-1)] flex-1">Replace Exercise</h2>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${muscleGroup} exercises...`}
          className="input"
          style={{ fontSize: 15 }}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4">
        {filtered.map(ex => (
          <button
            key={ex.id}
            onClick={() => setSelectedId(ex.id === selectedId ? null : ex.id)}
            className="w-full flex items-center gap-3 py-3 border-b"
            style={{
              borderColor: 'rgba(255,255,255,0.04)',
              background: ex.id === selectedId ? 'rgba(var(--accent-rgb),0.08)' : undefined,
            }}
          >
            <div
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
              style={{
                borderColor: ex.id === selectedId ? 'var(--accent)' : 'var(--border)',
                background: ex.id === selectedId ? 'var(--accent)' : undefined,
              }}
            >
              {ex.id === selectedId && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-[var(--text-1)]">{ex.name}</div>
              <div className="text-[11px] text-[var(--text-m)] capitalize">{ex.equipment_type}</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-[var(--text-m)] py-8 text-sm">No exercises found</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 pb-safe" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
          <button
            onClick={() => setApplyToFuture(!applyToFuture)}
            className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0"
            style={{
              borderColor: applyToFuture ? 'var(--accent)' : 'var(--border)',
              background: applyToFuture ? 'var(--accent)' : undefined,
            }}
          >
            {applyToFuture && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </button>
          <span className="text-sm text-[var(--text-2)]">Apply to rest of mesocycle</span>
        </label>
        <button
          onClick={() => selectedId && onSelect(selectedId, applyToFuture)}
          disabled={!selectedId}
          className="btn btn-primary w-full disabled:opacity-40"
        >
          Replace
        </button>
      </div>
    </div>
  )
}

// --- Exercise Card ---

interface ExerciseCardProps {
  exercise: MesoExercise
  exerciseIndex: number
  sets: WorkingSet[]
  allSets: WorkingSet[]
  targetRir: number
  onUpdateSet: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => void
  onCompleteSet: (exerciseId: string, setNum: number) => void
  onUncompleteSet: (exerciseId: string, setNum: number) => void
  locked?: boolean
  skipped: boolean
  onToggleSkip: () => void
  note?: string
  onEditNote: () => void
  onReplace: () => void
  animPhaseRef: React.MutableRefObject<Map<string, 'saving' | 'success'>>
  onClearAnim: (exerciseId: string, setNum: number) => void
}

function ExerciseCard({ exercise, sets, allSets, targetRir, onUpdateSet, onCompleteSet, onUncompleteSet, locked, skipped, onToggleSkip, note, onEditNote, onReplace, animPhaseRef, onClearAnim }: ExerciseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const color = getMuscleColor(exercise.muscle_group)

  if (skipped) {
    return (
      <div
        className="exercise-card flex items-center justify-between"
        style={{ borderColor: 'rgba(255,255,255,0.04)', opacity: 0.5 }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
          <span className="text-sm font-medium text-[var(--text-2)] truncate">{exercise.exercise_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-2)' }}
          >
            Skipped
          </span>
          {!locked && (
            <button
              onClick={() => setMenuOpen(true)}
              className="p-1.5 -mr-1 rounded-lg active:bg-white/5"
            >
              <EllipsisIcon />
            </button>
          )}
        </div>

        <BottomSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={exercise.exercise_name}
          actions={[
            {
              label: 'Unskip Exercise',
              icon: <UnskipIcon />,
              onClick: onToggleSkip,
            },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="exercise-card" style={{ borderColor: color.cardBorder }}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
        {!locked && (
          <button
            onClick={() => setMenuOpen(true)}
            className="p-1.5 -mr-1 -mt-0.5 rounded-lg active:bg-white/5"
          >
            <EllipsisIcon />
          </button>
        )}
      </div>

      {/* Exercise name + equipment */}
      <div className="mb-1">
        <h2 className="text-base font-semibold text-[var(--text-1)]">{exercise.exercise_name}</h2>
        {exercise.equipment_type && (
          <span className="text-xs text-[var(--text-m)] capitalize">{exercise.equipment_type}</span>
        )}
      </div>

      {/* Note */}
      {note && (
        <div className="mb-2 px-2 py-1.5 rounded-md" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
          <p className="text-[11px] text-amber-400/80 leading-relaxed">{note}</p>
        </div>
      )}

      {/* Sets panel */}
      <div className="panel-frosted">
        {/* Column headers */}
        <div className="flex items-center mb-2 px-2 pt-1">
          <div className="w-8 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            #
          </div>
          <div className="flex-1 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            Weight
          </div>
          <div className="flex-1 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            Reps
          </div>
          <div className="w-12 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            Log
          </div>
        </div>

        {/* Set rows */}
        {sets.map((set) => (
          <SetRow
            key={set.set_num}
            set={set}
            exercise={exercise}
            allSets={allSets}
            targetRir={targetRir}
            onUpdate={onUpdateSet}
            onComplete={onCompleteSet}
            onUncomplete={onUncompleteSet}
            locked={locked}
            animPhase={animPhaseRef.current.get(`${exercise.exercise_id}:${set.set_num}`)}
            onClearAnim={onClearAnim}
          />
        ))}
      </div>

      <BottomSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={exercise.exercise_name}
        actions={[
          {
            label: 'Replace Exercise',
            icon: <ReplaceIcon />,
            onClick: onReplace,
          },
          {
            label: 'Skip Exercise',
            icon: <SkipIcon />,
            onClick: onToggleSkip,
          },
          {
            label: note ? 'Edit Note' : 'Add Note',
            icon: <NoteIcon />,
            onClick: onEditNote,
          },
        ]}
      />
    </div>
  )
}

// --- Set Row ---

interface SetRowProps {
  set: WorkingSet
  exercise: MesoExercise
  allSets: WorkingSet[]
  targetRir: number
  onUpdate: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => void
  onComplete: (exerciseId: string, setNum: number) => void
  onUncomplete: (exerciseId: string, setNum: number) => void
  locked?: boolean
  animPhase?: 'saving' | 'success'
  onClearAnim: (exerciseId: string, setNum: number) => void
}

type SetState = 'pending' | 'logged' | 'exceeded' | 'under'

function getSetState(set: WorkingSet): SetState {
  if (!set.completed) return 'pending'
  if (set.set_type === 'myorep_match') return 'logged'
  if ((set.reps ?? 0) > set.target_reps) return 'exceeded'
  if ((set.reps ?? 0) < set.target_reps) return 'under'
  return 'logged'
}

const SET_STYLES: Record<SetState, { inputBg: string; inputBorder: string; textColor: string }> = {
  pending: {
    inputBg: 'var(--input)',
    inputBorder: 'var(--border)',
    textColor: 'var(--text-2)',
  },
  logged: {
    inputBg: 'rgba(var(--accent-rgb),0.08)',
    inputBorder: 'rgba(var(--accent-rgb),0.2)',
    textColor: 'var(--accent-l)',
  },
  exceeded: {
    inputBg: 'rgba(168,85,247,0.08)',
    inputBorder: 'rgba(168,85,247,0.2)',
    textColor: '#c084fc',
  },
  under: {
    inputBg: 'rgba(239,68,68,0.06)',
    inputBorder: 'rgba(239,68,68,0.15)',
    textColor: '#f87171',
  },
}

const SET_TYPE_LABELS: Record<string, { label: string; color: string; bg: string; border: string; rowBg: string }> = {
  myorep: { label: 'MR', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)', border: 'rgba(45,212,191,0.3)', rowBg: 'rgba(45,212,191,0.04)' },
  myorep_match: { label: 'MM', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', rowBg: 'rgba(251,191,36,0.05)' },
}

const STRAIGHT_PILL = { color: 'var(--text-2)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' }

const SetRow = memo(function SetRow({ set, exercise, allSets, onUpdate, onComplete, onUncomplete, locked, animPhase, onClearAnim }: SetRowProps) {
  const [typePopoverOpen, setTypePopoverOpen] = useState(false)
  const [jiggleTarget, setJiggleTarget] = useState<'weight' | 'reps' | null>(null)
  const jiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const state = getSetState(set)
  const styles = SET_STYLES[state]
  const setType = set.set_type ?? 'straight'
  const typeInfo = SET_TYPE_LABELS[setType]

  // Cleanup jiggle timer on unmount
  useEffect(() => {
    return () => { if (jiggleTimerRef.current) clearTimeout(jiggleTimerRef.current) }
  }, [])

  const triggerLockJiggle = useCallback((target: 'weight' | 'reps') => {
    setJiggleTarget(target)
    if (jiggleTimerRef.current) clearTimeout(jiggleTimerRef.current)
    jiggleTimerRef.current = setTimeout(() => setJiggleTarget(null), 700)
  }, [])

  // Resolve myorep_match reference set: find nearest non-MM set before this one
  const mmRef = useMemo(() => {
    if (setType !== 'myorep_match') return null
    const exerciseSets = allSets
      .filter(s => s.exercise_id === exercise.exercise_id)
      .sort((a, b) => a.set_num - b.set_num)
    for (let i = exerciseSets.findIndex(s => s.set_num === set.set_num) - 1; i >= 0; i--) {
      const ref = exerciseSets[i]!
      if ((ref.set_type ?? 'straight') !== 'myorep_match') return ref
    }
    return null
  }, [setType, allSets, set.set_num, exercise.exercise_id])

  const resolvedTargetReps = useMemo(() => {
    if (!mmRef) return set.target_reps
    return mmRef.completed ? (mmRef.reps ?? set.target_reps) : set.target_reps
  }, [mmRef, set.target_reps])

  const resolvedWeight = useMemo(() => {
    if (!mmRef) return null
    return mmRef.weight ?? 0
  }, [mmRef])

  const isMatchLocked = setType === 'myorep_match'
  const mmRefLogged = mmRef?.completed ?? false
  const mmWaiting = isMatchLocked && !mmRefLogged && !set.completed

  const handleSetTypeChange = (newType: SetType) => {
    onUpdate(exercise.exercise_id, set.set_num, 'set_type', newType)
    if (newType === 'myorep') {
      onUpdate(exercise.exercise_id, set.set_num, 'target_reps', 20)
    } else if (newType === 'myorep_match') {
      // Auto-copy weight from reference set
      const exerciseSets = allSets
        .filter(s => s.exercise_id === exercise.exercise_id)
        .sort((a, b) => a.set_num - b.set_num)
      for (let i = exerciseSets.findIndex(s => s.set_num === set.set_num) - 1; i >= 0; i--) {
        const ref = exerciseSets[i]!
        if ((ref.set_type ?? 'straight') !== 'myorep_match') {
          if (ref.weight) onUpdate(exercise.exercise_id, set.set_num, 'weight', ref.weight)
          break
        }
      }
    } else if (newType === 'straight') {
      onUpdate(exercise.exercise_id, set.set_num, 'target_reps', 10)
    }
    setTypePopoverOpen(false)
  }

  const isFirstSet = set.set_num === 1

  // Row tint
  const rowBg = typeInfo
    ? (isMatchLocked && mmWaiting ? 'rgba(251,191,36,0.03)' : typeInfo.rowBg)
    : undefined

  return (
    <div className="flex items-center gap-2 mb-1.5 rounded-lg px-2 py-1.5" style={{ background: rowBg }}>
      {/* Set number / type indicator */}
      <div className="w-8 flex justify-center relative">
        <button
          onClick={() => !locked && !set.completed && setTypePopoverOpen(!typePopoverOpen)}
          disabled={locked || set.completed}
          className="min-w-[28px] h-7 rounded-md flex items-center justify-center text-[11px] font-semibold disabled:cursor-default"
          style={typeInfo ? {
            background: typeInfo.bg,
            color: typeInfo.color,
            border: `1px solid ${typeInfo.border}`,
          } : {
            color: STRAIGHT_PILL.color,
            background: STRAIGHT_PILL.bg,
            border: `1px solid ${STRAIGHT_PILL.border}`,
          }}
        >
          {typeInfo ? typeInfo.label : set.set_num}
        </button>

        {/* Type selection popover */}
        {typePopoverOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setTypePopoverOpen(false)} />
            <div
              className="absolute left-0 top-8 z-50 rounded-lg py-1 min-w-[140px]"
              style={{
                background: 'var(--panel)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
            >
              <button
                onClick={() => handleSetTypeChange('straight')}
                className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2"
                style={{ color: setType === 'straight' ? 'var(--accent-l)' : 'var(--text-m)' }}
              >
                <span className="w-4 text-center font-semibold text-[11px]">#</span>
                Straight
              </button>
              <button
                onClick={() => handleSetTypeChange('myorep')}
                className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2"
                style={{ color: setType === 'myorep' ? '#2dd4bf' : 'var(--text-m)' }}
              >
                <span className="w-4 text-center font-semibold text-[11px]" style={{ color: '#2dd4bf' }}>MR</span>
                Myorep
              </button>
              <button
                onClick={() => !isFirstSet && handleSetTypeChange('myorep_match')}
                disabled={isFirstSet}
                className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 disabled:opacity-30"
                style={{ color: setType === 'myorep_match' ? '#fbbf24' : 'var(--text-m)' }}
              >
                <span className="w-4 text-center font-semibold text-[11px]" style={{ color: '#fbbf24' }}>MM</span>
                Myorep Match
              </button>
            </div>
          </>
        )}
      </div>

      {/* Weight input */}
      <div className="flex-1 relative">
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          value={isMatchLocked ? (resolvedWeight ?? set.weight ?? '') : (set.weight || '')}
          onChange={(e) => onUpdate(exercise.exercise_id, set.set_num, 'weight', parseFloat(e.target.value) || 0)}
          readOnly={set.completed || locked || isMatchLocked}
          className="set-input"
          style={{
            background: isMatchLocked ? 'rgba(251,191,36,0.06)' : styles.inputBg,
            border: `1px solid ${isMatchLocked ? 'rgba(251,191,36,0.15)' : styles.inputBorder}`,
            color: isMatchLocked ? '#fbbf24' : styles.textColor,
            opacity: isMatchLocked && !mmRefLogged ? 0.5 : 1,
          }}
          onClick={() => { if (isMatchLocked && !set.completed) triggerLockJiggle('weight') }}
        />
        {/* Pulsing lock when waiting */}
        {mmWaiting && !jiggleTarget && (
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 lock-pulse pointer-events-none" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
        {/* Jiggle lock on tap */}
        {jiggleTarget === 'weight' && (
          <svg className="absolute left-1/2 top-1/2 w-5 h-5 lock-jiggle pointer-events-none" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
      </div>

      {/* Reps input */}
      <div className="flex-1 relative">
        <input
          type="number"
          inputMode="numeric"
          value={isMatchLocked
            ? (set.completed ? (set.reps ?? '') : (mmRefLogged ? resolvedTargetReps : ''))
            : (set.completed ? (set.reps ?? '') : (set.reps || ''))
          }
          onChange={(e) => onUpdate(exercise.exercise_id, set.set_num, 'reps', parseInt(e.target.value) || 0)}
          readOnly={set.completed || locked || isMatchLocked}
          placeholder={isMatchLocked ? (mmRefLogged ? `${resolvedTargetReps}` : '...') : `${resolvedTargetReps}`}
          className="set-input reps-ghost"
          style={{
            background: isMatchLocked ? 'rgba(251,191,36,0.06)' : styles.inputBg,
            border: `1px solid ${isMatchLocked ? 'rgba(251,191,36,0.15)' : styles.inputBorder}`,
            color: isMatchLocked ? '#fbbf24' : styles.textColor,
            opacity: isMatchLocked && !mmRefLogged ? 0.5 : 1,
          }}
          onClick={() => { if (isMatchLocked && !set.completed) triggerLockJiggle('weight') }}
        />
        {/* Pulsing lock when waiting */}
        {mmWaiting && !jiggleTarget && (
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 lock-pulse pointer-events-none" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
      </div>

      {/* Check / State button */}
      <div className="w-12 flex justify-center">
        {(() => {
          if (locked) {
            return (
              <div
                className="w-9 h-9 rounded-lg border-2 flex items-center justify-center opacity-30"
                style={{ borderColor: 'var(--border)' }}
              />
            )
          }
          if (animPhase === 'saving') {
            return <SavingButton state={state} />
          }
          if (animPhase === 'success') {
            return (
              <CompletedButton
                state={state}
                onClick={() => onUncomplete(exercise.exercise_id, set.set_num)}
                animated
                onAnimEnd={() => onClearAnim(exercise.exercise_id, set.set_num)}
              />
            )
          }
          if (set.completed) {
            return <CompletedButton state={state} onClick={() => onUncomplete(exercise.exercise_id, set.set_num)} />
          }
          return (
            <button
              onClick={() => {
                const effectiveWeight = isMatchLocked ? (resolvedWeight ?? set.weight ?? 0) : (set.weight ?? 0)
                if (effectiveWeight > 0) {
                  if (isMatchLocked) {
                    onUpdate(exercise.exercise_id, set.set_num, 'weight', effectiveWeight)
                    onUpdate(exercise.exercise_id, set.set_num, 'reps', resolvedTargetReps)
                  } else if (!(set.reps ?? 0)) {
                    onUpdate(exercise.exercise_id, set.set_num, 'reps', resolvedTargetReps)
                  }
                  onComplete(exercise.exercise_id, set.set_num)
                }
              }}
              disabled={isMatchLocked ? !mmRefLogged : !(set.weight ?? 0)}
              className="w-9 h-9 rounded-lg border-2 flex items-center justify-center check-pop disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: isMatchLocked ? 'rgba(251,191,36,0.3)' : 'var(--border)' }}
            />
          )
        })()}
      </div>
    </div>
  )
})

const SET_ANIM_CONFIG: Record<Exclude<SetState, 'pending'>, { bg: string; spinner: string; ripple: string; iconPath: string; strokeWidth: number }> = {
  logged:   { bg: 'var(--accent-d)', spinner: 'var(--accent)', ripple: 'var(--accent)', iconPath: 'M5 13l4 4L19 7',   strokeWidth: 3 },
  exceeded: { bg: '#7c3aed', spinner: '#a855f7', ripple: '#a855f7', iconPath: 'M5 15l7-7 7 7',    strokeWidth: 2.5 },
  under:    { bg: '#dc2626', spinner: '#ef4444', ripple: '#ef4444', iconPath: 'M19 9l-7 7-7-7',   strokeWidth: 2.5 },
}

function SavingButton({ state }: { state: SetState }) {
  const cfg = SET_ANIM_CONFIG[state === 'pending' ? 'logged' : state]
  return (
    <div className="w-9 h-9 relative">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36">
        <rect
          x="1.5" y="1.5" width="33" height="33" rx="7"
          fill="none"
          stroke={cfg.spinner}
          strokeWidth="2.5"
          pathLength={100}
          strokeDasharray="22 78"
          strokeLinecap="round"
          style={{ animation: 'set-saving-trace 0.9s linear infinite' }}
        />
      </svg>
    </div>
  )
}

function CompletedButton({ state, onClick, animated, onAnimEnd }: {
  state: SetState
  onClick: () => void
  animated?: boolean
  onAnimEnd?: () => void
}) {
  const cfg = SET_ANIM_CONFIG[state === 'pending' ? 'logged' : state]

  useEffect(() => {
    if (!animated || !onAnimEnd) return
    const t = setTimeout(onAnimEnd, 600)
    return () => clearTimeout(t)
  }, [animated, onAnimEnd])

  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center check-pop relative overflow-hidden"
      style={{ background: cfg.bg }}
    >
      {animated && (
        <span
          className="absolute inset-0 rounded-lg"
          style={{
            background: cfg.ripple,
            animation: 'set-success-ripple 0.45s forwards',
          }}
        />
      )}
      <svg className="w-4 h-4 relative z-10" viewBox="0 0 24 24" fill="none">
        <path
          d={cfg.iconPath}
          stroke="white"
          strokeWidth={cfg.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(animated ? {
            strokeDasharray: 30,
            strokeDashoffset: 30,
            style: { animation: 'set-success-draw 0.28s 0.06s forwards' },
          } : {})}
        />
      </svg>
    </button>
  )
}

// --- Inline SVG Icons ---

function EllipsisIcon() {
  return (
    <svg className="w-5 h-5 text-[var(--text-m)]" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  )
}

function ReplaceIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}

function SkipIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
    </svg>
  )
}

function UnskipIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
    </svg>
  )
}
