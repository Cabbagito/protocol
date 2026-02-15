import { useState } from 'react'
import { useToast } from '../components/Toast'
import { useExercises, useCreateExercise } from '../api/hooks'
import MuscleGroupBadge from '../components/MuscleGroupBadge'

export default function Exercises() {
  const { data: exercises = [], isLoading } = useExercises()
  const [showForm, setShowForm] = useState(false)

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
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="text-slate-400 text-center py-8">Loading...</div>
      ) : exercises.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          No exercises yet. Add your first one!
        </div>
      ) : (
        <div className="space-y-2">
          {exercises.map((exercise) => (
            <div key={exercise.id} className="card">
              <div className="flex items-center gap-2">
                <div className="font-medium flex-1">{exercise.name}</div>
                <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
              </div>
              <div className="text-sm text-slate-500 mt-1 capitalize">
                {exercise.equipment_type}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MUSCLE_GROUPS = [
  'back', 'biceps', 'front delt', 'rear delt', 'side delt',
  'chest', 'triceps', 'quads', 'hamstrings', 'glutes',
  'calves', 'abs', 'traps', 'forearms',
]

interface ExerciseFormProps {
  onSave: () => void
  onCancel: () => void
}

function ExerciseForm({ onSave, onCancel }: ExerciseFormProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('chest')
  const [equipmentType, setEquipmentType] = useState('barbell')
  const createExercise = useCreateExercise()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createExercise.mutateAsync({
        name,
        muscle_group: muscleGroup,
        equipment_type: equipmentType,
      })
      onSave()
    } catch {
      toast.showError('Failed to save exercise')
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
      <select
        value={muscleGroup}
        onChange={(e) => setMuscleGroup(e.target.value)}
        className="input"
      >
        {MUSCLE_GROUPS.map((mg) => (
          <option key={mg} value={mg}>
            {mg}
          </option>
        ))}
      </select>
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
          disabled={createExercise.isPending || !name}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {createExercise.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
