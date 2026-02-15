import { getMuscleColor } from '../lib/muscleColors'

interface MuscleGroupBadgeProps {
  muscleGroup: string
}

export default function MuscleGroupBadge({ muscleGroup }: MuscleGroupBadgeProps) {
  if (!muscleGroup) return null
  const color = getMuscleColor(muscleGroup)

  return (
    <span
      className="pill-badge"
      style={{
        color: color.light,
        background: color.bg,
        border: `1px solid ${color.border}`,
      }}
    >
      {muscleGroup}
    </span>
  )
}
