import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { useExercises, useCreateExercise } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import { ChevronRightIcon } from '../components/Icons'
import { MUSCLE_GROUPS, MuscleGroupChips, EquipmentTypeToggles } from '../components/ExerciseFilters'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import ExerciseSparkline from '../components/ExerciseSparkline'
import type { Exercise } from '../types'

export default function Exercises() {
  const navigate = useNavigate()
  const { data: exercises = [], isLoading } = useExercises()
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<string>>(new Set())
  const [selectedEquipmentTypes, setSelectedEquipmentTypes] = useState<Set<string>>(new Set())

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      if (searchQuery && !ex.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (selectedMuscleGroups.size > 0 && !selectedMuscleGroups.has(ex.muscle_group)) {
        return false
      }
      if (selectedEquipmentTypes.size > 0 && !selectedEquipmentTypes.has(ex.equipment_type)) {
        return false
      }
      return true
    })
  }, [exercises, searchQuery, selectedMuscleGroups, selectedEquipmentTypes])

  const hasActiveFilters = searchQuery || selectedMuscleGroups.size > 0 || selectedEquipmentTypes.size > 0

  function toggleMuscleGroup(mg: string) {
    setSelectedMuscleGroups((prev) => {
      const next = new Set(prev)
      if (next.has(mg)) next.delete(mg)
      else next.add(mg)
      return next
    })
  }

  function toggleEquipmentType(et: string) {
    setSelectedEquipmentTypes((prev) => {
      const next = new Set(prev)
      if (next.has(et)) next.delete(et)
      else next.add(et)
      return next
    })
  }

  return (
    <div>
      <AppHeader
        title="Exercises"
        subtitle={`${exercises.length} exercises`}
        rightContent={
          <button onClick={() => setShowForm(!showForm)} className="plus-btn">
            <svg className="w-3.5 h-3.5" style={{ color: 'var(--accent-l)' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--accent-l)' }}>Add</span>
          </button>
        }
      />

      <div className="px-4 space-y-3">
      {showForm && (
        <ExerciseForm
          onSave={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--input)', border: '1px solid var(--border)' }}>
        <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-m)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercises..."
          className="bg-transparent text-sm text-[var(--text-1)] placeholder-[var(--text-m)] outline-none flex-1"
        />
      </div>

      {/* Muscle group filter chips */}
      <MuscleGroupChips
        selected={selectedMuscleGroups}
        onToggle={toggleMuscleGroup}
      />

      {/* Equipment toggles */}
      <EquipmentTypeToggles
        selected={selectedEquipmentTypes}
        onToggle={toggleEquipmentType}
      />

      {/* Filter count */}
      {hasActiveFilters && (
        <div className="text-[11px]" style={{ color: 'var(--text-m)' }}>
          Showing <span style={{ color: 'var(--text-2)' }}>{filteredExercises.length}</span> of <span style={{ color: 'var(--text-2)' }}>{exercises.length}</span> exercises
        </div>
      )}

      {/* Exercise list */}
      {isLoading ? (
        <PageLoader />
      ) : filteredExercises.length === 0 ? (
        <div className="text-[var(--text-2)] text-center py-8">
          {hasActiveFilters ? 'No exercises match your filters.' : 'No exercises yet. Add your first one!'}
        </div>
      ) : (
        <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {filteredExercises.map((exercise, idx) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              isLast={idx === filteredExercises.length - 1}
              onClick={() => navigate('/progress')}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

// --- Exercise Row ---

function ExerciseRow({
  exercise,
  isLast,
  onClick,
}: {
  exercise: Exercise
  isLast: boolean
  onClick: () => void
}) {
  const color = getMuscleColor(exercise.muscle_group)

  return (
    <div
      className="list-row flex items-center gap-3 px-4 py-4 stagger"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
      onClick={onClick}
    >
      <div className="accent-strip" style={{ background: color.primary }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--text-1)]">{exercise.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: color.light }}>
            {exercise.muscle_group}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-m)' }}>&middot;</span>
          <span className="text-[10px] capitalize" style={{ color: 'var(--text-m)' }}>
            {exercise.equipment_type}
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <ExerciseSparkline exerciseId={exercise.id} color={color.primary} />
      </div>
      <ChevronRightIcon className="w-4 h-4 shrink-0 text-[var(--text-m)]" />
    </div>
  )
}

// --- Exercise Form ---

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
