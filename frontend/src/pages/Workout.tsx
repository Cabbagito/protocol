import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { ProtocolLogo, CheckIcon, ArrowUpIcon, ArrowDownIcon } from '../components/Icons'
import { useLogSets } from '../api/hooks'
import { api } from '../api/client'
import ProgressBar from '../components/ProgressBar'
import RirBadge from '../components/RirBadge'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import { getMuscleColor } from '../lib/muscleColors'
import type { WorkoutTemplate, MesoExercise, MesoSet } from '../types'

interface WorkingSet extends MesoSet {
  exercise_id: string
  exercise_name: string
  completed: boolean
}

export default function Workout() {
  const toast = useToast()
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
  const logSets = useLogSets()
  const [sets, setSets] = useState<WorkingSet[]>([])
  const [notes, setNotes] = useState('')
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [initialized, setInitialized] = useState(false)

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
      setInitialized(true)
    }
  }, [template, initialized])

  useEffect(() => {
    let interval: number | undefined
    if (timerRunning && restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer((t) => (t !== null && t > 0 ? t - 1 : 0))
      }, 1000)
    } else if (restTimer === 0) {
      setTimerRunning(false)
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200])
      }
    }
    return () => clearInterval(interval)
  }, [timerRunning, restTimer])

  const updateSet = useCallback((exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean) => {
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, [field]: value }
          : s
      )
    )
  }, [])

  const completeSet = useCallback((exerciseId: string, setNum: number) => {
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, completed: true }
          : s
      )
    )
    setRestTimer(90)
    setTimerRunning(true)
  }, [])

  const handleSave = async () => {
    if (!mesocycleId || !template) return

    try {
      await logSets.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        notes: notes || null,
        sets: sets.filter((s) => s.completed).map((s) => ({
          exercise_id: s.exercise_id,
          set_num: s.set_num,
          weight: s.weight ?? 0,
          reps: s.reps ?? 0,
          rir: s.rir,
        })),
      })
      navigate(`/mesocycles/${mesocycleId}`)
    } catch {
      toast.showError('Failed to save workout')
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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

  return (
    <div className="pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40" style={{ background: '#0d1b2a' }}>
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)} className="flex-shrink-0">
              <ProtocolLogo className="w-9 h-9" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold truncate text-slate-200">
                {template.session_name}
              </h1>
              <span className="text-[11px] text-slate-600">
                Week {template.week_number}
              </span>
            </div>
          </div>
          <RirBadge rir={template.target_rir} />
        </div>
        <ProgressBar percent={totalSets > 0 ? (completedSets / totalSets) * 100 : 0} />
      </div>

      {/* Rest Timer */}
      {timerRunning && restTimer !== null && (
        <div className="mx-2.5 mt-4">
          <div className="card" style={{ borderColor: 'rgba(56,189,248,0.2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Rest Timer</div>
                <div className="text-3xl font-bold text-protocol-400">{formatTime(restTimer)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRestTimer((t) => (t || 0) + 30)}
                  className="btn btn-secondary text-sm px-3"
                >
                  +30s
                </button>
                <button
                  onClick={() => {
                    setTimerRunning(false)
                    setRestTimer(null)
                  }}
                  className="btn btn-secondary text-sm px-3"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Cards */}
      <div className="px-2.5 pt-4 flex flex-col gap-3">
        {exerciseGroups.map((ex) => (
          <ExerciseCard
            key={ex.exercise_id}
            exercise={ex}
            sets={ex.workingSets}
            targetRir={template.target_rir}
            onUpdateSet={updateSet}
            onCompleteSet={completeSet}
          />
        ))}

        {/* Notes */}
        <div className="card">
          <label className="text-sm text-slate-500 block mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this workout..."
            className="input min-h-[80px]"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={logSets.isPending || completedSets === 0}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {logSets.isPending ? 'Saving...' : `Save Workout (${completedSets} sets)`}
        </button>
      </div>
    </div>
  )
}

interface ExerciseCardProps {
  exercise: MesoExercise
  sets: WorkingSet[]
  targetRir: number
  onUpdateSet: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean) => void
  onCompleteSet: (exerciseId: string, setNum: number) => void
}

function ExerciseCard({ exercise, sets, targetRir, onUpdateSet, onCompleteSet }: ExerciseCardProps) {
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
    inputBorder: '#1e3a52',
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

function SetRow({ set, exercise, onUpdate, onComplete }: SetRowProps) {
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
          readOnly={set.completed}
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
          readOnly={set.completed}
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
        {set.completed ? (
          <CompletedButton state={state} />
        ) : (
          <button
            onClick={() => {
              if ((set.weight ?? 0) > 0 && (set.reps ?? 0) > 0) {
                onComplete(exercise.exercise_id, set.set_num)
              }
            }}
            disabled={!(set.weight ?? 0) || !(set.reps ?? 0)}
            className="w-9 h-9 rounded-lg border-2 flex items-center justify-center check-pop disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderColor: '#1e3a52' }}
          />
        )}
      </div>
    </div>
  )
}

function CompletedButton({ state }: { state: SetState }) {
  if (state === 'exceeded') {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center check-pop"
        style={{ background: '#7c3aed' }}
      >
        <ArrowUpIcon className="w-4 h-4 text-white" />
      </div>
    )
  }

  if (state === 'under') {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center check-pop"
        style={{ background: '#dc2626' }}
      >
        <ArrowDownIcon className="w-4 h-4 text-white" />
      </div>
    )
  }

  // logged (met target)
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center check-pop"
      style={{ background: '#0284c7' }}
    >
      <CheckIcon className="w-4 h-4 text-white" />
    </div>
  )
}
