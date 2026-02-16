import { useExerciseProgress } from '../api/hooks'

interface ExerciseSparklineProps {
  exerciseId: string
  color: string
}

export default function ExerciseSparkline({ exerciseId, color }: ExerciseSparklineProps) {
  const { data: progressData } = useExerciseProgress(exerciseId)

  if (!progressData || progressData.length === 0) {
    return <div className="w-[48px]" />
  }

  const points = progressData.slice(-6)
  const weights = points.map((p) => p.max_weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1

  const svgPoints = points
    .map((p, i) => {
      const x = 2 + (i / Math.max(points.length - 1, 1)) * 44
      const y = 18 - ((p.max_weight - min) / range) * 14
      return `${x},${y}`
    })
    .join(' ')

  const lastX = 2 + ((points.length - 1) / Math.max(points.length - 1, 1)) * 44
  const lastY = 18 - ((weights[weights.length - 1]! - min) / range) * 14

  return (
    <svg width="48" height="20" viewBox="0 0 48 20">
      <polyline className="sparkline" stroke={color} points={svgPoints} />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  )
}
