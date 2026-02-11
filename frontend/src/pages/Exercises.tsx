import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import type { Exercise } from '../types'

export default function Exercises() {
  const toast = useToast()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadExercises()
  }, [])

  const loadExercises = async () => {
    try {
      const data = await api.get<Exercise[]>('/exercises')
      setExercises(data)
    } catch {
      toast.showError('Failed to load exercises')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Exercises</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary text-sm"
        >
          + Add
        </button>
      </header>

      {showForm && (
        <ExerciseForm
          onSave={() => {
            setShowForm(false)
            loadExercises()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-slate-400 text-center py-8">Loading...</div>
      ) : exercises.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          No exercises yet. Add your first one!
        </div>
      ) : (
        <div className="space-y-2">
          {exercises.map((exercise) => (
            <div key={exercise.id} className="card">
              <div className="font-medium">{exercise.name}</div>
              <div className="text-sm text-slate-400 mt-1">
                {exercise.muscle_groups.join(', ')} &middot; {exercise.equipment_type}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface ExerciseFormProps {
  onSave: () => void
  onCancel: () => void
}

function ExerciseForm({ onSave, onCancel }: ExerciseFormProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [muscleGroups, setMuscleGroups] = useState('')
  const [equipmentType, setEquipmentType] = useState('barbell')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await api.post('/exercises', {
        name,
        muscle_groups: muscleGroups.split(',').map((s) => s.trim()).filter(Boolean),
        equipment_type: equipmentType,
      })
      onSave()
    } catch {
      toast.showError('Failed to save exercise')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise name"
        className="input"
        autoFocus
      />
      <input
        type="text"
        value={muscleGroups}
        onChange={(e) => setMuscleGroups(e.target.value)}
        placeholder="Muscle groups (comma separated)"
        className="input"
      />
      <select
        value={equipmentType}
        onChange={(e) => setEquipmentType(e.target.value)}
        className="input"
      >
        <option value="barbell">Barbell</option>
        <option value="dumbbell">Dumbbell</option>
        <option value="machine">Machine</option>
        <option value="cable">Cable</option>
        <option value="bodyweight">Bodyweight</option>
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
