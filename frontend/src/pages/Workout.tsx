import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { CheckIcon, ArrowUpIcon, ArrowDownIcon } from '../components/Icons'
import { useLogSets, useMesocycle, queryKeys } from '../api/hooks'
import { api } from '../api/client'
import AppHeader from '../components/AppHeader'
import RirBadge from '../components/RirBadge'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import MesoGrid from '../components/MesoGrid'
import { getCurrentPosition } from '../lib/mesoUtils'
import { getMuscleColor } from '../lib/muscleColors'
import type { WorkoutTemplate, MesoExercise, MesoSet, Mesocycle } from '../types'

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
  const [sets, setSets] = useState<WorkingSet[]>([])
  const [initialized, setInitialized] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const pendingSavesRef = useRef(0)
  const prevCompletedRef = useRef(0)

  const currentPos = useMemo(() => {
    if (!mesocycle) return null
    return getCurrentPosition(mesocycle.structure)
  }, [mesocycle])

  const isFutureSession = useMemo(() => {
    if (!template || !currentPos) return false
    return template.week_index !== currentPos.weekIndex
        || template.session_index !== currentPos.sessionIndex
  }, [template, currentPos])

  // Reset state when navigating to a different session (same route, different query params)
  useEffect(() => {
    setInitialized(false)
    setSets([])
    prevCompletedRef.current = 0
  }, [weekParam, sessionParam])

  useEffect(() => {
    if (template && !initialized) {
      const initialSets: WorkingSet[] = []
      for (const ex of template.exercises) {
        for (const s of ex.sets) {
          initialSets.push({
            ...s,
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            weight: s.suggested_weight ?? s.weight ?? 0,
            reps: s.reps ?? 0,
            rir: template.target_rir >= 0 ? template.target_rir : null,
            completed: s.logged,
          })
        }
      }
      setSets(initialSets)
      prevCompletedRef.current = initialSets.filter(s => s.completed).length
      setInitialized(true)
    }
  }, [template, initialized])

  const updateSet = useCallback((exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean) => {
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
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, completed: true }
          : s
      )
    )
  }, [isFutureSession])

  const uncompleteSet = useCallback((exerciseId: string, setNum: number) => {
    if (isFutureSession) return
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, completed: false }
          : s
      )
    )
  }, [isFutureSession])

  // Auto-save: send all completed sets to backend
  const triggerAutoSave = useCallback((currentSets: WorkingSet[]) => {
    if (!mesocycleId || !template || isFutureSession) return
    const completed = currentSets.filter(s => s.completed)

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
      })),
      notes: null,
    }).catch(() => {
      toast.showError('Auto-save failed')
    }).finally(() => {
      pendingSavesRef.current--
      if (pendingSavesRef.current === 0) setIsSaving(false)
    })
  }, [mesocycleId, template, logSets, toast, isFutureSession])

  // Trigger auto-save when completed count changes (log or un-log)
  useEffect(() => {
    if (!initialized) return
    const count = sets.filter(s => s.completed).length
    if (count !== prevCompletedRef.current) {
      triggerAutoSave(sets)
    }
    prevCompletedRef.current = count
  }, [sets, initialized, triggerAutoSave])

  const isLastSession = useMemo(() => {
    if (!mesocycle || !template) return false
    return getNextSession(template.week_index, template.session_index, mesocycle) === null
  }, [mesocycle, template])

  const handleFinishOrNext = async () => {
    // Wait for in-flight saves
    if (pendingSavesRef.current > 0) {
      setIsSaving(true)
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (pendingSavesRef.current === 0) { clearInterval(check); resolve() }
        }, 100)
      })
    }

    // Invalidate caches before navigation
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

  // Current workout info for the CTA button
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
    return <div className="text-slate-500 text-center py-8">Loading workout...</div>
  }

  if (!template) {
    return <div className="text-slate-500 text-center py-8">Workout template not found</div>
  }

  const completedSets = sets.filter((s) => s.completed).length
  const totalSets = sets.length

  const exerciseGroups = template.exercises.map((ex) => ({
    ...ex,
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
              <svg className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Preview</span>
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
        savingIndicator={isSaving}
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
            sets={ex.workingSets}
            targetRir={template.target_rir}
            onUpdateSet={updateSet}
            onCompleteSet={completeSet}
            onUncompleteSet={uncompleteSet}
            locked={isFutureSession}
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
                background: 'rgba(2,132,199,0.15)',
                border: '1.5px solid rgba(2,132,199,0.3)',
                color: '#38bdf8',
              }}
            >
              Go to Current Workout
            </button>
            <span className="text-[11px] text-center" style={{ color: '#64748b' }}>
              {currentWorkoutInfo.name} · Week {currentWorkoutInfo.week} · {currentWorkoutInfo.rir}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

interface ExerciseCardProps {
  exercise: MesoExercise
  sets: WorkingSet[]
  targetRir: number
  onUpdateSet: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean) => void
  onCompleteSet: (exerciseId: string, setNum: number) => void
  onUncompleteSet: (exerciseId: string, setNum: number) => void
  locked?: boolean
}

function ExerciseCard({ exercise, sets, targetRir, onUpdateSet, onCompleteSet, onUncompleteSet, locked }: ExerciseCardProps) {
  const color = getMuscleColor(exercise.muscle_group)

  return (
    <div className="exercise-card" style={{ borderColor: color.cardBorder }}>
      {/* Muscle group badge */}
      <div className="mb-2">
        <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
      </div>

      {/* Exercise name + equipment */}
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-200">{exercise.exercise_name}</h2>
        {exercise.equipment_type && (
          <span className="text-xs text-slate-600 capitalize">{exercise.equipment_type}</span>
        )}
      </div>

      {/* Sets panel */}
      <div className="panel-frosted">
        {/* Column headers */}
        <div className="flex items-center mb-2 px-2 pt-1">
          <div className="flex-1 text-center text-[11px] font-medium uppercase tracking-wider text-slate-600">
            Weight
          </div>
          <div className="flex-1 text-center text-[11px] font-medium uppercase tracking-wider text-slate-600">
            Reps
          </div>
          <div className="w-12 text-center text-[11px] font-medium uppercase tracking-wider text-slate-600">
            Log
          </div>
        </div>

        {/* Set rows */}
        {sets.map((set) => (
          <SetRow
            key={set.set_num}
            set={set}
            exercise={exercise}
            targetRir={targetRir}
            onUpdate={onUpdateSet}
            onComplete={onCompleteSet}
            onUncomplete={onUncompleteSet}
            locked={locked}
          />
        ))}
      </div>
    </div>
  )
}

interface SetRowProps {
  set: WorkingSet
  exercise: MesoExercise
  targetRir: number
  onUpdate: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean) => void
  onComplete: (exerciseId: string, setNum: number) => void
  onUncomplete: (exerciseId: string, setNum: number) => void
  locked?: boolean
}

type SetState = 'pending' | 'logged' | 'exceeded' | 'under'

function getSetState(set: WorkingSet): SetState {
  if (!set.completed) return 'pending'
  if ((set.reps ?? 0) > set.target_reps) return 'exceeded'
  if ((set.reps ?? 0) < set.target_reps) return 'under'
  return 'logged'
}

const SET_STYLES: Record<SetState, { inputBg: string; inputBorder: string; textColor: string }> = {
  pending: {
    inputBg: '#162a3e',
    inputBorder: '#244868',
    textColor: '#cbd5e1',
  },
  logged: {
    inputBg: '#0c2d4e',
    inputBorder: '#164e7a',
    textColor: '#38bdf8',
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

function SetRow({ set, exercise, onUpdate, onComplete, onUncomplete, locked }: SetRowProps) {
  const state = getSetState(set)
  const styles = SET_STYLES[state]

  return (
    <div className="flex items-center gap-2 mb-1.5 rounded-lg px-2 py-1.5">
      {/* Weight input */}
      <div className="flex-1">
        <input
          type="number"
          step="0.5"
          value={set.weight || ''}
          onChange={(e) => onUpdate(exercise.exercise_id, set.set_num, 'weight', parseFloat(e.target.value) || 0)}
          readOnly={set.completed || locked}
          className="set-input"
          style={{
            background: styles.inputBg,
            border: `1px solid ${styles.inputBorder}`,
            color: styles.textColor,
          }}
        />
      </div>

      {/* Reps input */}
      <div className="flex-1">
        <input
          type="number"
          value={set.completed ? (set.reps ?? '') : (set.reps || '')}
          onChange={(e) => onUpdate(exercise.exercise_id, set.set_num, 'reps', parseInt(e.target.value) || 0)}
          readOnly={set.completed || locked}
          placeholder={`${set.target_reps}`}
          className="set-input reps-ghost"
          style={{
            background: styles.inputBg,
            border: `1px solid ${styles.inputBorder}`,
            color: styles.textColor,
          }}
        />
      </div>

      {/* Check / State button */}
      <div className="w-12 flex justify-center">
        {locked ? (
          <div
            className="w-9 h-9 rounded-lg border-2 flex items-center justify-center opacity-30"
            style={{ borderColor: '#244868' }}
          />
        ) : set.completed ? (
          <CompletedButton state={state} onClick={() => onUncomplete(exercise.exercise_id, set.set_num)} />
        ) : (
          <button
            onClick={() => {
              if ((set.weight ?? 0) > 0) {
                if (!(set.reps ?? 0)) {
                  onUpdate(exercise.exercise_id, set.set_num, 'reps', set.target_reps)
                }
                onComplete(exercise.exercise_id, set.set_num)
              }
            }}
            disabled={!(set.weight ?? 0)}
            className="w-9 h-9 rounded-lg border-2 flex items-center justify-center check-pop disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderColor: '#244868' }}
          />
        )}
      </div>
    </div>
  )
}

function CompletedButton({ state, onClick }: { state: SetState; onClick: () => void }) {
  if (state === 'exceeded') {
    return (
      <button
        onClick={onClick}
        className="w-9 h-9 rounded-lg flex items-center justify-center check-pop"
        style={{ background: '#7c3aed' }}
      >
        <ArrowUpIcon className="w-4 h-4 text-white" />
      </button>
    )
  }

  if (state === 'under') {
    return (
      <button
        onClick={onClick}
        className="w-9 h-9 rounded-lg flex items-center justify-center check-pop"
        style={{ background: '#dc2626' }}
      >
        <ArrowDownIcon className="w-4 h-4 text-white" />
      </button>
    )
  }

  // logged (met target)
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center check-pop"
      style={{ background: '#0284c7' }}
    >
      <CheckIcon className="w-4 h-4 text-white" />
    </button>
  )
}
