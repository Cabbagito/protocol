interface MesoSparklineProps {
  weights: number[]
  color: string
}

export default function MesoSparkline({ weights, color }: MesoSparklineProps) {
  if (weights.length < 2) return null

  const W = 136
  const H = 40
  const padX = 4
  const padTop = 6
  const padBot = 4
  const plotW = W - padX * 2
  const plotH = H - padTop - padBot

  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1

  const points = weights.map((w, i) => {
    const x = padX + (i / (weights.length - 1)) * plotW
    const y = padTop + plotH - ((w - min) / range) * plotH
    return { x, y }
  })

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const last = points[points.length - 1]!

  // Gradient fill path: line path + close along bottom
  const fillPath =
    `M${points[0]!.x},${points[0]!.y} ` +
    points.slice(1).map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${last.x},${H - padBot} L${points[0]!.x},${H - padBot} Z`

  const gradId = `grad-${Math.random().toString(36).slice(2, 8)}`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      <circle cx={last.x} cy={last.y} r={3} fill={color} />
    </svg>
  )
}
