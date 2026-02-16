import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { useToast } from '../components/Toast'
import { useExercises, useCreateExercise, useExerciseProgress } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import { ChevronDownIcon } from '../components/Icons'
import ExerciseMiniChart from '../components/ExerciseMiniChart'
import type { Exercise, EquipmentType } from '../types'

const MUSCLE_GROUPS = [
  'back', 'biceps', 'front delt', 'rear delt', 'side delt',
  'chest', 'triceps', 'quads', 'hamstrings', 'glutes',
  'calves', 'abs', 'traps', 'forearms',
]

const MUSCLE_GROUP_ROWS: { label: string; groups: string[] }[] = [
  { label: 'Push', groups: ['chest', 'front delt', 'side delt', 'triceps'] },
  { label: 'Pull', groups: ['back', 'rear delt', 'biceps', 'traps', 'forearms'] },
  { label: 'Legs', groups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Core', groups: ['abs'] },
]

const EQUIPMENT_TYPES: EquipmentType[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight',
]

export default function Exercises() {
  const { data: exercises = [], isLoading } = useExercises()
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<string>>(new Set())
  const [selectedEquipmentTypes, setSelectedEquipmentTypes] = useState<Set<string>>(new Set())
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)

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
          onSave={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search exercises..."
        className="input"
      />

      {/* Muscle group chips */}
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
        <div className="text-sm text-slate-400">
          Showing {filteredExercises.length} of {exercises.length}
        </div>
      )}

      {/* Exercise list */}
      {isLoading ? (
        <div className="text-slate-400 text-center py-8">Loading...</div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          {hasActiveFilters ? 'No exercises match your filters.' : 'No exercises yet. Add your first one!'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isExpanded={expandedExerciseId === exercise.id}
              onToggle={() =>
                setExpandedExerciseId(
                  expandedExerciseId === exercise.id ? null : exercise.id
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Muscle Group Chips ---

function MuscleGroupChips({
  selected,
  onToggle,
}: {
  selected: Set<string>
  onToggle: (mg: string) => void
}) {
  return (
    <div className="space-y-2">
      {MUSCLE_GROUP_ROWS.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 w-8 shrink-0">
            {row.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {row.groups.map((mg) => {
              const color = getMuscleColor(mg)
              const isSelected = selected.has(mg)
              return (
                <button
                  key={mg}
                  onClick={() => onToggle(mg)}
                  className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    color: isSelected ? color.light : '#94a3b8',
                    background: isSelected ? color.bg : 'transparent',
                    border: `1px solid ${isSelected ? color.primary : 'rgba(148,163,184,0.2)'}`,
                  }}
                >
                  {mg}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Equipment Type Toggles ---

function EquipmentTypeToggles({
  selected,
  onToggle,
}: {
  selected: Set<string>
  onToggle: (et: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {EQUIPMENT_TYPES.map((et) => {
        const isSelected = selected.has(et)
        return (
          <button
            key={et}
            onClick={() => onToggle(et)}
            className={clsx(
              'text-xs font-medium capitalize px-3 py-1.5 rounded-lg transition-colors',
              isSelected
                ? 'bg-protocol-600/20 text-protocol-300 border border-protocol-500/40'
                : 'text-slate-400 border border-slate-700 hover:border-slate-600'
            )}
          >
            {et}
          </button>
        )
      })}
    </div>
  )
}

// --- Exercise Card ---

function ExerciseCard({
  exercise,
  isExpanded,
  onToggle,
}: {
  exercise: Exercise
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="card cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-2">
        <div className="font-medium flex-1">{exercise.name}</div>
        <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
        <ChevronDownIcon
          className={clsx(
            'w-4 h-4 text-slate-400 transition-transform duration-300',
            isExpanded && 'rotate-180'
          )}
        />
      </div>
      <div className="text-sm text-slate-500 mt-1 capitalize">
        {exercise.equipment_type}
      </div>

      {/* Expandable content */}
      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {isExpanded && (
            <div className="pt-3 mt-3 border-t border-slate-700/50" onClick={(e) => e.stopPropagation()}>
              <ExerciseExpandedContent exerciseId={exercise.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Expanded Content ---

function ExerciseExpandedContent({ exerciseId }: { exerciseId: string }) {
  const { data: progressData, isLoading } = useExerciseProgress(exerciseId)

  if (isLoading) {
    return <div className="text-slate-500 text-sm text-center py-4">Loading progress...</div>
  }

  if (!progressData || progressData.length === 0) {
    return <div className="text-slate-500 text-sm text-center py-4">No data yet</div>
  }

  const prWeight = Math.max(...progressData.map((d) => d.max_weight))
  const lastEntry = progressData[progressData.length - 1]!
  const lastDate = new Date(lastEntry.date).toLocaleDateString()

  return (
    <div className="space-y-3">
      <ExerciseMiniChart data={progressData} />
      <div className="flex justify-between text-sm">
        <div>
          <span className="text-slate-400">Last: </span>
          <span className="text-slate-200 font-medium">{lastEntry.max_weight}kg</span>
          <span className="text-slate-500 ml-1.5">{lastDate}</span>
        </div>
        <div>
          <span className="text-slate-400">PR: </span>
          <span className="text-protocol-400 font-medium">{prWeight}kg</span>
        </div>
      </div>
    </div>
  )
}

// --- Exercise Form (unchanged) ---

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
