import { getMuscleColor } from '../lib/muscleColors'

interface MuscleWaveBackgroundProps {
  /** Muscle-group key as stored on exercises (e.g. "chest", "back", "side delt"). */
  group: string
}

/**
 * Variant of AuroraBackground that recolors the blobs to a single muscle's
 * accent palette. The .wave-muscle class makes the blob backgrounds read
 * from --mc / --mc-l, which we set inline from lib/muscleColors.
 *
 * Used on the active-workout screen so the bg recolors as the user moves
 * between exercises.
 */
export default function MuscleWaveBackground({ group }: MuscleWaveBackgroundProps) {
  const c = getMuscleColor(group)
  return (
    <div
      className="wave-bg wave-muscle"
      aria-hidden="true"
      style={{ ['--mc' as string]: c.primary, ['--mc-l' as string]: c.light }}
    >
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="blob b4" />
      <div className="aurora" />
      <div className="aurora-2" />
      <div className="grain" />
    </div>
  )
}
