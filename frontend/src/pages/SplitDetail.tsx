import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Split, Session, Exercise } from '../types'

interface SessionExerciseInput {
  exercise_id: string
  order: number
  sets: number
  rep_min: number
  rep_max: number
}

export default function SplitDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [split, setSplit] = useState<Split | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)

  useEffect(() => {
    loadSplit()
  }, [id])

  const loadSplit = async () => {
    try {
      const data = await api.get<Split>(`/splits/${id}`)
      setSplit(data)
      setName(data.name)
    } catch (error) {
      console.error('Failed to load split:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async () => {
    if (!split || !name.trim()) return
    try {
      await api.put(`/splits/${id}`, { name })
      setSplit({ ...split, name })
      setEditingName(false)
    } catch (error) {
      console.error('Failed to update split:', error)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session?')) return
    try {
      await api.delete(`/splits/${id}/sessions/${sessionId}`)
      loadSplit()
    } catch (error) {
      console.error('Failed to delete session:', error)
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
      await api.put(`/splits/${id}/sessions/reorder`, {
        session_ids: newSessions.map((s) => s.id),
      })
      loadSplit()
    } catch (error) {
      console.error('Failed to reorder sessions:', error)
    }
  }

  if (loading) {
    return <div className="text-slate-400 text-center py-8">Loading...</div>
  }

  if (!split) {
    return <div className="text-slate-400 text-center py-8">Split not found</div>
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate('/splits')} className="text-slate-400 hover:text-slate-200">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        {editingName ? (
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input flex-1"
              autoFocus
            />
            <button onClick={handleUpdateName} className="btn btn-primary">
              Save
            </button>
            <button onClick={() => setEditingName(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        ) : (
          <h1
            className="text-xl font-bold flex-1 cursor-pointer hover:text-protocol-400"
            onClick={() => setEditingName(true)}
          >
            {split.name}
          </h1>
        )}
      </header>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-slate-300">Sessions</h2>
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
            loadSplit()
          }}
          onCancel={() => {
            setShowSessionForm(false)
            setEditingSession(null)
          }}
        />
      )}

      {split.sessions.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          No sessions yet. Add your first workout session!
        </div>
      ) : (
        <div className="space-y-2">
          {split.sessions.map((session, index) => (
            <div key={session.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-sm">Day {index + 1}</span>
                    <span className="font-medium">{session.name}</span>
                    {session.is_rest_day && (
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                        Rest
                      </span>
                    )}
                  </div>
                  {!session.is_rest_day && session.exercises.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {session.exercises.map((ex) => (
                        <div key={ex.id} className="text-sm text-slate-400 flex items-center gap-2">
                          <span>{ex.exercise_name}</span>
                          <span className="text-slate-500">
                            {ex.sets}x{ex.rep_min}-{ex.rep_max}
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
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronUpIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleMoveSession(session.id, 'down')}
                    disabled={index === split.sessions.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronDownIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setEditingSession(session)}
                    className="p-1 text-slate-400 hover:text-slate-200"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-1 text-slate-400 hover:text-red-400"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [name, setName] = useState(session?.name ?? '')
  const [isRestDay, setIsRestDay] = useState(session?.is_rest_day ?? false)
  const [exercises, setExercises] = useState<SessionExerciseInput[]>(
    session?.exercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      order: ex.order,
      sets: ex.sets,
      rep_min: ex.rep_min,
      rep_max: ex.rep_max,
    })) ?? []
  )
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadExercises()
  }, [])

  const loadExercises = async () => {
    try {
      const data = await api.get<Exercise[]>('/exercises')
      setAvailableExercises(data)
    } catch (error) {
      console.error('Failed to load exercises:', error)
    }
  }

  const handleAddExercise = () => {
    if (availableExercises.length === 0) return
    setExercises([
      ...exercises,
      {
        exercise_id: availableExercises[0]!.id,
        order: exercises.length,
        sets: 3,
        rep_min: 8,
        rep_max: 12,
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
    setSaving(true)

    try {
      const payload = {
        name,
        is_rest_day: isRestDay,
        exercises: isRestDay ? [] : exercises,
      }

      if (session) {
        await api.put(`/splits/${splitId}/sessions/${session.id}`, payload)
      } else {
        await api.post(`/splits/${splitId}/sessions`, payload)
      }
      onSave()
    } catch (error) {
      console.error('Failed to save session:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Session name (e.g., Push, Pull, Legs)"
        className="input"
        autoFocus
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isRestDay}
          onChange={(e) => setIsRestDay(e.target.checked)}
          className="rounded border-slate-600 bg-slate-700 text-protocol-500 focus:ring-protocol-500"
        />
        <span>Rest day</span>
      </label>

      {!isRestDay && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Exercises</span>
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
            <div className="text-slate-500 text-sm py-2">
              No exercises available. Create some exercises first.
            </div>
          ) : exercises.length === 0 ? (
            <div className="text-slate-500 text-sm py-2">No exercises added yet.</div>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex, index) => (
                <div key={index} className="bg-slate-800 rounded p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={ex.exercise_id}
                      onChange={(e) => handleExerciseChange(index, 'exercise_id', e.target.value)}
                      className="input flex-1 text-sm"
                    >
                      {availableExercises.map((ae) => (
                        <option key={ae.id} value={ae.id}>
                          {ae.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                    >
                      <ChevronUpIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(index, 'down')}
                      disabled={index === exercises.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(index)}
                      className="p-1 text-slate-400 hover:text-red-400"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Sets</label>
                      <input
                        type="number"
                        min="1"
                        value={ex.sets}
                        onChange={(e) => handleExerciseChange(index, 'sets', parseInt(e.target.value) || 1)}
                        className="input text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Min Reps</label>
                      <input
                        type="number"
                        min="1"
                        value={ex.rep_min}
                        onChange={(e) => handleExerciseChange(index, 'rep_min', parseInt(e.target.value) || 1)}
                        className="input text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Max Reps</label>
                      <input
                        type="number"
                        min="1"
                        value={ex.rep_max}
                        onChange={(e) => handleExerciseChange(index, 'rep_max', parseInt(e.target.value) || 1)}
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
          disabled={saving || !name}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? 'Saving...' : session ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}
