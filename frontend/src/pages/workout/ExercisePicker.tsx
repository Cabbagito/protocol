import { useState, useMemo } from 'react'
import { useExercises } from '../../api/hooks'
import { MuscleGroupChips, EquipmentTypeToggles } from '../../components/ExerciseFilters'
import { getMuscleColor } from '../../lib/muscleColors'

interface ExercisePickerProps {
  mode?: 'replace' | 'add'
  initialMuscleGroup?: string
  initialEquipmentType?: string
  currentExerciseId?: string
  excludeExerciseIds?: string[]
  onSelect: (exerciseId: string, applyToFuture: boolean) => void
  onClose: () => void
}

export function ExercisePicker({ mode = 'replace', initialMuscleGroup, initialEquipmentType, currentExerciseId, excludeExerciseIds, onSelect, onClose }: ExercisePickerProps) {
  const { data: exercises } = useExercises()
  const [search, setSearch] = useState('')
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<string>>(() => initialMuscleGroup ? new Set([initialMuscleGroup]) : new Set())
  const [selectedEquipmentTypes, setSelectedEquipmentTypes] = useState<Set<string>>(() => initialEquipmentType ? new Set([initialEquipmentType]) : new Set())
  const [applyToFuture, setApplyToFuture] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const toggleMuscleGroup = (mg: string) => {
    setSelectedMuscleGroups(prev => {
      const next = new Set(prev)
      if (next.has(mg)) next.delete(mg)
      else next.add(mg)
      return next
    })
  }

  const toggleEquipmentType = (et: string) => {
    setSelectedEquipmentTypes(prev => {
      const next = new Set(prev)
      if (next.has(et)) next.delete(et)
      else next.add(et)
      return next
    })
  }

  const excludeIds = useMemo(() => {
    const ids = new Set(excludeExerciseIds ?? [])
    if (currentExerciseId) ids.add(currentExerciseId)
    return ids
  }, [currentExerciseId, excludeExerciseIds])

  const filtered = useMemo(() => {
    if (!exercises) return []
    return exercises.filter(ex => {
      if (excludeIds.has(ex.id)) return false
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false
      if (selectedMuscleGroups.size > 0 && !selectedMuscleGroups.has(ex.muscle_group)) return false
      if (selectedEquipmentTypes.size > 0 && !selectedEquipmentTypes.has(ex.equipment_type)) return false
      return true
    })
  }, [exercises, excludeIds, search, selectedMuscleGroups, selectedEquipmentTypes])

  return (
    <div
      className="fixed inset-0 z-[102] flex flex-col"
      style={{ background: 'var(--base)', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={onClose} className="text-[var(--text-2)] p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-[var(--text-1)] flex-1">{mode === 'add' ? 'Add Exercise' : 'Replace Exercise'}</h2>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="input"
          style={{ fontSize: 15 }}
        />
      </div>

      {/* Muscle Group Chips */}
      <div className="px-4 pb-2">
        <MuscleGroupChips selected={selectedMuscleGroups} onToggle={toggleMuscleGroup} />
      </div>

      {/* Equipment Type Toggles */}
      <div className="px-4 pb-3">
        <EquipmentTypeToggles selected={selectedEquipmentTypes} onToggle={toggleEquipmentType} />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4">
        {filtered.map(ex => {
          const color = getMuscleColor(ex.muscle_group)
          return (
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
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: color.light }}>
                    {ex.muscle_group}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-m)' }}>&middot;</span>
                  <span className="text-[10px] capitalize" style={{ color: 'var(--text-m)' }}>
                    {ex.equipment_type}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[var(--text-m)] py-8 text-sm">No exercises found</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pt-3 pb-safe" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {mode === 'replace' && (
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
        )}
        <button
          onClick={() => selectedId && onSelect(selectedId, mode === 'add' ? true : applyToFuture)}
          disabled={!selectedId}
          className="btn btn-primary w-full disabled:opacity-40"
        >
          {mode === 'add' ? 'Add' : 'Replace'}
        </button>
      </div>
    </div>
  )
}
