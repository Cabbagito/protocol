import { getMuscleColor } from '../lib/muscleColors'
import type { MesoExercise, MesoSet } from '../types'

interface ProgressRailProps {
  exercises: MesoExercise[]
  currentIndex: number
}

interface ProgressRailEx {
  group: string
  sets: { logged: boolean }[]
}

/**
 * Horizontal segmented progress bar — one segment per exercise, each
 * subdivided by its sets. Logged ticks glow in the exercise's muscle
 * color; the current exercise's segment is 4px tall (others 3px).
 *
 * Also renders the eyebrow line below: "02 / 13 SETS" left, "EXERCISE 01 / 04"
 * right (in current muscle color).
 */
export default function ProgressRail({ exercises, currentIndex }: ProgressRailProps) {
  const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0)
  const loggedSets = exercises.reduce(
    (a, e) => a + e.sets.filter(s => s.logged).length, 0,
  )
  const current = exercises[currentIndex]
  const currentColor = current ? getMuscleColor(current.muscle_group) : null

  const items: ProgressRailEx[] = exercises.map(e => ({
    group: e.muscle_group,
    sets: e.sets.map(s => ({ logged: !!s.logged })),
  }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {items.map((e, i) => {
          const c = getMuscleColor(e.group)
          const isCur = i === currentIndex
          return (
            <div
              key={i}
              style={{ flex: e.sets.length, display: 'flex', gap: 2 }}
            >
              {e.sets.map((s: { logged: boolean }, si: number) => (
                <div
                  key={si}
                  style={{
                    flex: 1,
                    height: isCur ? 4 : 3,
                    borderRadius: 2,
                    background: s.logged
                      ? c.light
                      : isCur
                      ? `color-mix(in oklab, ${c.primary} 25%, rgba(255,255,255,0.06))`
                      : 'rgba(255,255,255,0.06)',
                    boxShadow: s.logged
                      ? `0 0 6px color-mix(in oklab, ${c.primary} 60%, transparent)`
                      : 'none',
                    transition: 'all 0.3s',
                  }}
                />
              ))}
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-m)',
            letterSpacing: '0.18em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontWeight: 500,
          }}
        >
          {String(loggedSets).padStart(2, '0')} / {totalSets} SETS
        </span>
        <span
          style={{
            fontSize: 9,
            color: currentColor?.light ?? 'var(--text-m)',
            letterSpacing: '0.18em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontWeight: 500,
          }}
        >
          EXERCISE {String(currentIndex + 1).padStart(2, '0')} /{' '}
          {String(exercises.length).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}

// Silence: ProgressRail uses MesoSet shape implicitly through MesoExercise.sets;
// keep the type imported so future readers can find it.
export type { MesoSet }
