import { getMuscleColor } from '../lib/muscleColors'

interface MuscleSpotlightProps {
  group: string
}

export default function MuscleSpotlight({ group }: MuscleSpotlightProps) {
  const c = getMuscleColor(group)
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 120,
        left: 0,
        right: 0,
        height: 320,
        background: `radial-gradient(ellipse 65% 55% at 50% 50%, color-mix(in oklab, ${c.primary} 60%, transparent) 0%, transparent 70%)`,
        filter: 'blur(30px)',
        mixBlendMode: 'screen',
        opacity: 0.55,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
