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
        color: color.text,
        background: `color-mix(in oklab, ${color.primary} 10%, transparent)`,
        border: `1px solid color-mix(in oklab, ${color.primary} 15%, transparent)`,
      }}
    >
      {muscleGroup}
    </span>
  )
}
