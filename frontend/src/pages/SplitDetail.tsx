import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { ChevronUpIcon, ChevronDownIcon, PencilIcon, TrashIcon } from '../components/Icons'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import {
  useSplit,
  useUpdateSplit,
  useDeleteSplit,
  useExercises,
  useAddSession,
  useUpdateSession,
  useDeleteSession,
  useReorderSessions,
} from '../api/hooks'
import type { Session, Exercise } from '../types'

interface SessionExerciseInput {
  exercise_id: string
  order: number
  sets: number
}

const SPLIT_COLORS = [
  '#14b8a6', '#6366f1', '#f97316', '#ec4899',
  '#22c55e', '#eab308', '#06b6d4', '#f43f5e',
]

export default function SplitDetail() {
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: split, isLoading } = useSplit(id!)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [editColor, setEditColor] = useState<string | null>(null)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const updateSplitMutation = useUpdateSplit(id!)
  const deleteSplitMutation = useDeleteSplit()
  const deleteSessionMutation = useDeleteSession(id!)
  const reorderMutation = useReorderSessions(id!)

  const handleUpdateName = async () => {
    if (!split || !name.trim()) return
    try {
      await updateSplitMutation.mutateAsync({ name, color: editColor })
      setEditingName(false)
    } catch {
      toast.showError('Failed to update split')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session?')) return
    try {
      await deleteSessionMutation.mutateAsync(sessionId)
    } catch {
      toast.showError('Failed to delete session')
    }
  }

  const handleDeleteSplit = async () => {
    if (!confirm('Delete this split? This cannot be undone.')) return
    try {
      await deleteSplitMutation.mutateAsync(id!)
      navigate('/splits')
    } catch {
      toast.showError('Failed to delete split')
    }
  }

  const handleMoveSession = async (sessionId: string, direction: 'up' | 'down') => {
    if (!split) return
    const idx = split.sessions.findIndex((s) => s.id === sessionId)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === split.sessions.length - 1) return

    const newSessions = [...split.sessions]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newSessions[idx], newSessions[swapIdx]] = [newSessions[swapIdx]!, newSessions[idx]!]

    try {
      await reorderMutation.mutateAsync(newSessions.map((s) => s.id))
    } catch {
      toast.showError('Failed to reorder sessions')
    }
  }

  if (isLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  if (!split) {
    return <div className="text-[var(--text-2)] text-center py-8">Split not found</div>
  }

  return (
    <div>
      <AppHeader
        title={
          editingName ? (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input flex-1 text-[15px]"
                  autoFocus
                />
                <button onClick={handleUpdateName} className="btn btn-primary text-xs py-1 px-2">
                  Save
                </button>
                <button onClick={() => setEditingName(false)} className="btn btn-secondary text-xs py-1 px-2">
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                {SPLIT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className="w-5 h-5 rounded-full shrink-0"
                    style={{
                      background: c,
                      boxShadow: editColor === c ? `0 0 0 2px var(--base), 0 0 0 3.5px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <span
              className="cursor-pointer hover:text-protocol-400 flex items-center gap-2"
              onClick={() => {
                setName(split.name)
                setEditColor(split.color)
                setEditingName(true)
              }}
            >
              {split.color && (
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: split.color }} />
              )}
              {split.name}
            </span>
          )
        }
        breadcrumb={{ label: 'Splits', to: '/splits' }}
      />

      <div className="px-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-[var(--text-2)]">Sessions</h2>
        <button
          onClick={() => {
            setEditingSession(null)
            setShowSessionForm(true)
          }}
          className="btn btn-primary text-sm"
        >
          + Add Session
        </button>
      </div>

      {(showSessionForm || editingSession) && (
        <SessionForm
          splitId={id!}
          session={editingSession}
          onSave={() => {
            setShowSessionForm(false)
            setEditingSession(null)
          }}
          onCancel={() => {
            setShowSessionForm(false)
            setEditingSession(null)
          }}
        />
      )}

      {split.sessions.length === 0 ? (
        <div className="text-[var(--text-2)] text-center py-8">
          No sessions yet. Add your first workout session!
        </div>
      ) : (
        <div className="space-y-2">
          {split.sessions.map((session, index) => (
            <div key={session.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-m)] text-sm">Day {index + 1}</span>
                    <span className="font-medium">{session.name}</span>
                    {session.is_rest_day && (
                      <span className="text-xs bg-[var(--input)] text-[var(--text-2)] px-2 py-0.5 rounded">
                        Rest
                      </span>
                    )}
                  </div>
                  {!session.is_rest_day && session.exercises.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {session.exercises.map((ex) => (
                        <div key={ex.id} className="text-sm text-[var(--text-2)] flex items-center gap-2">
                          <span>{ex.exercise_name}</span>
                          <span className="text-[var(--text-m)]">
                            {ex.sets} sets
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveSession(session.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-30"
                  >
                    <ChevronUpIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleMoveSession(session.id, 'down')}
                    disabled={index === split.sessions.length - 1}
                    className="p-1 text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-30"
                  >
                    <ChevronDownIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setEditingSession(session)}
                    className="p-1 text-[var(--text-2)] hover:text-[var(--text-1)]"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-1 text-[var(--text-2)] hover:text-red-400"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Split */}
      <button
        onClick={handleDeleteSplit}
        className="w-full py-3 text-sm font-medium text-red-400 rounded-lg border border-red-400/20 hover:bg-red-400/5 transition-colors"
      >
        Delete Split
      </button>
      </div>
    </div>
  )
}

interface SessionFormProps {
  splitId: string
  session: Session | null
  onSave: () => void
  onCancel: () => void
}

function SessionForm({ splitId, session, onSave, onCancel }: SessionFormProps) {
  const toast = useToast()
  const [sessionName, setSessionName] = useState(session?.name ?? '')
  const [isRestDay, setIsRestDay] = useState(session?.is_rest_day ?? false)
  const [exercises, setExercises] = useState<SessionExerciseInput[]>(
    session?.exercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      order: ex.order,
      sets: ex.sets,
    })) ?? []
  )
  const { data: availableExercises = [] } = useExercises()
  const addSessionMutation = useAddSession(splitId)
  const updateSessionMutation = useUpdateSession(splitId)

  const handleAddExercise = () => {
    if (availableExercises.length === 0) return
    setExercises([
      ...exercises,
      {
        exercise_id: availableExercises[0]!.id,
        order: exercises.length,
        sets: 3,
      },
    ])
  }

  const handleRemoveExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index).map((ex, i) => ({ ...ex, order: i })))
  }

  const handleExerciseChange = (index: number, field: keyof SessionExerciseInput, value: string | number) => {
    setExercises(
      exercises.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    )
  }

  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === exercises.length - 1) return
    const newExercises = [...exercises]
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    ;[newExercises[index], newExercises[swapIdx]] = [newExercises[swapIdx]!, newExercises[index]!]
    setExercises(newExercises.map((ex, i) => ({ ...ex, order: i })))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        name: sessionName,
        is_rest_day: isRestDay,
        exercises: isRestDay ? [] : exercises,
      }

      if (session) {
        await updateSessionMutation.mutateAsync({ sessionId: session.id, data: payload })
      } else {
        await addSessionMutation.mutateAsync(payload)
      }
      onSave()
    } catch {
      toast.showError('Failed to save session')
    }
  }

  const isSaving = addSessionMutation.isPending || updateSessionMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <input
        type="text"
        value={sessionName}
        onChange={(e) => setSessionName(e.target.value)}
        placeholder="Session name (e.g., Push, Pull, Legs)"
        className="input"
        autoFocus
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isRestDay}
          onChange={(e) => setIsRestDay(e.target.checked)}
          className="rounded border-[var(--border)] bg-[var(--input)] text-protocol-500 focus:ring-protocol-500"
        />
        <span>Rest day</span>
      </label>

      {!isRestDay && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-2)]">Exercises</span>
            <button
              type="button"
              onClick={handleAddExercise}
              className="text-sm text-protocol-400 hover:text-protocol-300"
              disabled={availableExercises.length === 0}
            >
              + Add Exercise
            </button>
          </div>

          {availableExercises.length === 0 ? (
            <div className="text-[var(--text-m)] text-sm py-2">
              No exercises available. Create some exercises first.
            </div>
          ) : exercises.length === 0 ? (
            <div className="text-[var(--text-m)] text-sm py-2">No exercises added yet.</div>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex, index) => (
                <div key={index} className="bg-[var(--card)] rounded p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={ex.exercise_id}
                      onChange={(e) => handleExerciseChange(index, 'exercise_id', e.target.value)}
                      className="input flex-1 text-sm"
                    >
                      {availableExercises.map((ae: Exercise) => (
                        <option key={ae.id} value={ae.id}>
                          {ae.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-30"
                    >
                      <ChevronUpIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(index, 'down')}
                      disabled={index === exercises.length - 1}
                      className="p-1 text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-30"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(index)}
                      className="p-1 text-[var(--text-2)] hover:text-red-400"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <div className="flex-1">
                      <label className="text-xs text-[var(--text-m)]">Sets</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={ex.sets}
                        onChange={(e) => handleExerciseChange(index, 'sets', parseInt(e.target.value) || 1)}
                        className="input text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !sessionName}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : session ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  )
}
