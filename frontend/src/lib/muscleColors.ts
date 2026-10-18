import { MUSCLE_GROUP_ROWS } from '../components/exerciseConstants'

// The colours themselves live in index.css (--m-<muscle>, -l, -d, -t); this
// hands out the CSS variables for a muscle group. Tint with color-mix().
export interface MuscleColor {
  /** Fill: dots, bars, tints, glows. */
  primary: string
  /** Lighter step: the light end of gradients, logged ticks. */
  light: string
  /** Text, icons and chart lines in the muscle's colour (dark on light themes). */
  text: string
}

const MUSCLE_GROUPS = new Set(MUSCLE_GROUP_ROWS.flatMap((row) => row.groups))

// Unknown groups fall back to the theme's own neutrals
const DEFAULT_COLOR: MuscleColor = {
  primary: 'var(--text-m)',
  light: 'var(--text-2)',
  text: 'var(--text-m)',
}

export function getMuscleColor(muscleGroup: string): MuscleColor {
  const key = muscleGroup?.toLowerCase()
  if (!key || !MUSCLE_GROUPS.has(key)) return DEFAULT_COLOR
  const v = `--m-${key.replace(/\s+/g, '-')}`
  return { primary: `var(${v})`, light: `var(${v}-l)`, text: `var(${v}-t)` }
}
