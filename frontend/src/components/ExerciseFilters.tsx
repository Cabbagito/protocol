import { getMuscleColor } from '../lib/muscleColors'
import type { EquipmentType } from '../types'

export const MUSCLE_GROUPS = [
  'back', 'biceps', 'front delt', 'rear delt', 'side delt',
  'chest', 'triceps', 'quads', 'hamstrings', 'glutes',
  'calves', 'abs', 'traps', 'forearms',
]

export const MUSCLE_GROUP_ROWS: { label: string; groups: string[] }[] = [
  { label: 'Push', groups: ['chest', 'front delt', 'side delt', 'triceps'] },
  { label: 'Pull', groups: ['back', 'rear delt', 'biceps', 'traps', 'forearms'] },
  { label: 'Legs', groups: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Core', groups: ['abs'] },
]

export const EQUIPMENT_TYPES: EquipmentType[] = [
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight',
]

export function MuscleGroupChips({
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
          <span className="text-[9px] font-medium uppercase tracking-wider w-7 shrink-0" style={{ color: 'var(--text-m)' }}>
            {row.label}
          </span>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {row.groups.map((mg) => {
              const color = getMuscleColor(mg)
              const isSelected = selected.has(mg)
              return (
                <button
                  key={mg}
                  onClick={() => onToggle(mg)}
                  className="filter-chip"
                  style={{
                    color: isSelected ? color.light : 'var(--text-2)',
                    background: isSelected ? color.bg : 'transparent',
                    borderColor: isSelected ? color.primary : 'rgba(148,163,184,0.15)',
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

export function EquipmentTypeToggles({
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
            className="equip-chip"
            style={{
              color: isSelected ? 'var(--accent-l)' : 'var(--text-2)',
              background: isSelected ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
              borderColor: isSelected ? 'rgba(var(--accent-rgb),0.25)' : 'rgba(148,163,184,0.15)',
            }}
          >
            {et}
          </button>
        )
      })}
    </div>
  )
}
