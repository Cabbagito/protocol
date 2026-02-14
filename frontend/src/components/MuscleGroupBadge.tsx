import { getMuscleColor } from '../lib/muscleColors'

interface MuscleGroupBadgeProps {
  muscleGroups: string[]
}

export default function MuscleGroupBadge({ muscleGroups }: MuscleGroupBadgeProps) {
  if (!muscleGroups.length) return null
  const label = muscleGroups[0]
  const color = getMuscleColor(muscleGroups)

  return (
    <span
      className="pill-badge"
      style={{
        color: color.light,
        background: color.bg,
        border: `1px solid ${color.border}`,
      }}
    >
      {label}
    </span>
  )
}
