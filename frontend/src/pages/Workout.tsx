import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import { ChevronLeftIcon, CheckIcon } from '../components/Icons'
import type { WorkoutTemplate, SetData, ExerciseInSession } from '../types'

interface WorkingSet extends SetData {
  exercise_name: string
  target_reps_min: number
  target_reps_max: number
}

export default function Workout() {
  const toast = useToast()
  const { mesocycleId, sessionId } = useParams<{ mesocycleId: string; sessionId: string }>()
  const navigate = useNavigate()
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [sets, setSets] = useState<WorkingSet[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)

  useEffect(() => {
    loadTemplate()
  }, [mesocycleId, sessionId])

  // Rest timer effect
  useEffect(() => {
    let interval: number | undefined
    if (timerRunning && restTimer !== null && restTimer > 0) {
      interval = window.setInterval(() => {
        setRestTimer((t) => (t !== null && t > 0 ? t - 1 : 0))
      }, 1000)
    } else if (restTimer === 0) {
      setTimerRunning(false)
      // Vibrate on timer end (if supported)
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200])
      }
    }
    return () => clearInterval(interval)
  }, [timerRunning, restTimer])

  const loadTemplate = async () => {
    try {
      const data = await api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}/${sessionId}`)
      setTemplate(data)

      // Initialize sets from template
      const initialSets: WorkingSet[] = []
      for (const ex of data.exercises) {
        for (let i = 0; i < ex.target_sets; i++) {
          initialSets.push({
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            set_num: i + 1,
            weight: ex.suggested_weight || ex.last_weight || 0,
            reps: 0,
            rir: data.target_rir >= 0 ? data.target_rir : null,
            completed: false,
            target_reps_min: ex.target_rep_min,
            target_reps_max: ex.target_rep_max,
          })
        }
      }
      setSets(initialSets)
    } catch {
      toast.showError('Failed to load workout template')
    } finally {
      setLoading(false)
    }
  }

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
    // Start rest timer (90 seconds default)
    setRestTimer(90)
    setTimerRunning(true)
  }, [])

  const handleSave = async () => {
    if (!mesocycleId || !sessionId) return
    setSaving(true)

    try {
      await api.post('/workouts', {
        mesocycle_id: mesocycleId,
        session_id: sessionId,
        notes: notes || null,
        sets: sets.filter((s) => s.completed).map((s) => ({
          exercise_id: s.exercise_id,
          set_num: s.set_num,
          weight: s.weight,
          reps: s.reps,
          rir: s.rir,
          completed: s.completed,
        })),
      })
      navigate(`/mesocycles/${mesocycleId}`)
    } catch {
      toast.showError('Failed to save workout')
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return <div className="text-slate-400 text-center py-8">Loading workout...</div>
  }

  if (!template) {
    return <div className="text-slate-400 text-center py-8">Workout template not found</div>
  }

  const completedSets = sets.filter((s) => s.completed).length
  const totalSets = sets.length
  const isDeloadWeek = template.target_rir === -1

  // Group sets by exercise
  const exerciseGroups = template.exercises.map((ex) => ({
    ...ex,
    sets: sets.filter((s) => s.exercise_id === ex.exercise_id),
  }))

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <header className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{template.session_name}</h1>
          <div className="text-sm text-slate-400">
            Week {template.week_number} &middot;{' '}
            {isDeloadWeek ? (
              <span className="text-yellow-400">Deload</span>
            ) : (
              `Target RiR ${template.target_rir}`
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-protocol-400">
            {completedSets}/{totalSets}
          </div>
          <div className="text-xs text-slate-400">sets</div>
        </div>
      </header>

      {/* Rest Timer */}
      {timerRunning && restTimer !== null && (
        <div className="card bg-protocol-900 border border-protocol-600">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Rest Timer</div>
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
      )}

      {/* Exercises */}
      {exerciseGroups.map((ex) => (
        <ExerciseCard
          key={ex.exercise_id}
          exercise={ex}
          sets={ex.sets}
          targetRir={template.target_rir}
          onUpdateSet={updateSet}
          onCompleteSet={completeSet}
        />
      ))}

      {/* Notes */}
      <div className="card">
        <label className="text-sm text-slate-400 block mb-2">Notes (optional)</label>
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
        disabled={saving || completedSets === 0}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {saving ? 'Saving...' : `Save Workout (${completedSets} sets)`}
      </button>
    </div>
  )
}

interface ExerciseCardProps {
  exercise: ExerciseInSession
  sets: WorkingSet[]
  targetRir: number
  onUpdateSet: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean) => void
  onCompleteSet: (exerciseId: string, setNum: number) => void
}

function ExerciseCard({ exercise, sets, targetRir, onUpdateSet, onCompleteSet }: ExerciseCardProps) {
  const completedSets = sets.filter((s) => s.completed).length
  const allCompleted = completedSets === sets.length

  return (
    <div className={`card ${allCompleted ? 'border border-green-600/50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-medium">{exercise.exercise_name}</div>
          <div className="text-sm text-slate-400">
            {exercise.target_sets}x{exercise.target_rep_min}-{exercise.target_rep_max}
            {exercise.progression_note && (
              <span className="text-green-400 ml-2">{exercise.progression_note}</span>
            )}
          </div>
        </div>
        <div className="text-sm text-slate-500">
          {completedSets}/{sets.length}
        </div>
      </div>

      <div className="space-y-2">
        {sets.map((set) => (
          <SetRow
            key={set.set_num}
            set={set}
            exerciseId={exercise.exercise_id}
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
  exerciseId: string
  targetRir: number
  onUpdate: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean) => void
  onComplete: (exerciseId: string, setNum: number) => void
}

function SetRow({ set, exerciseId, targetRir, onUpdate, onComplete }: SetRowProps) {
  const isDeload = targetRir === -1

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded ${
        set.completed ? 'bg-green-900/30' : 'bg-slate-800'
      }`}
    >
      <div className="w-8 text-center text-sm text-slate-500">#{set.set_num}</div>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs text-slate-500">Weight</label>
          <input
            type="number"
            step="0.5"
            value={set.weight || ''}
            onChange={(e) => onUpdate(exerciseId, set.set_num, 'weight', parseFloat(e.target.value) || 0)}
            className="input text-sm py-1"
            disabled={set.completed}
          />
        </div>

        <div className="w-16">
          <label className="text-xs text-slate-500">Reps</label>
          <input
            type="number"
            value={set.reps || ''}
            onChange={(e) => onUpdate(exerciseId, set.set_num, 'reps', parseInt(e.target.value) || 0)}
            className="input text-sm py-1"
            disabled={set.completed}
            placeholder={`${set.target_reps_min}-${set.target_reps_max}`}
          />
        </div>

        {!isDeload && (
          <div className="w-14">
            <label className="text-xs text-slate-500">RiR</label>
            <input
              type="number"
              min="0"
              max="5"
              value={set.rir ?? ''}
              onChange={(e) => onUpdate(exerciseId, set.set_num, 'rir', parseInt(e.target.value) || 0)}
              className="input text-sm py-1"
              disabled={set.completed}
            />
          </div>
        )}
      </div>

      {set.completed ? (
        <div className="w-10 flex justify-center">
          <CheckIcon className="w-6 h-6 text-green-400" />
        </div>
      ) : (
        <button
          onClick={() => {
            if (set.weight > 0 && set.reps > 0) {
              onComplete(exerciseId, set.set_num)
            }
          }}
          disabled={!set.weight || !set.reps}
          className="w-10 h-10 flex items-center justify-center rounded bg-protocol-600 hover:bg-protocol-500 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <CheckIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

