import MuscleAccent from '../../components/MuscleAccent'
import { getMuscleColor } from '../../lib/muscleColors'
import type { SessionExercise } from '../../lib/workoutSession'

/* Skipped exercise — same shell as logging, but dimmed with an undo. */

interface SkippedExerciseStateProps {
  exercise: SessionExercise
  onUnskip: () => void
  onAdvanceExercise: () => void
  hasNextExercise: boolean
}

export function SkippedExerciseState({ exercise, onUnskip, onAdvanceExercise, hasNextExercise }: SkippedExerciseStateProps) {
  const c = getMuscleColor(exercise.muscle_group)
  const loggedCount = exercise.sets.filter(s => s.logged).length

  return (
    <div style={{ marginTop: 28, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, opacity: 0.5 }}>
        <MuscleAccent group={exercise.muscle_group} variant="dot" />
      </div>
      <div
        style={{
          fontSize: 36, fontWeight: 700,
          color: 'var(--text-2)',
          lineHeight: 1.05, letterSpacing: '-0.025em',
          padding: '0 12px',
          textDecoration: 'line-through',
          textDecorationColor: 'rgba(148,163,184,0.5)',
        }}
      >
        {exercise.exercise_name}
      </div>
      <div
        style={{
          fontSize: 11, color: 'var(--text-m)', marginTop: 8, letterSpacing: '0.22em',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          textTransform: 'uppercase', fontWeight: 600,
        }}
      >
        Exercise skipped
      </div>
      {loggedCount > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-m)', marginTop: 6 }}>
          {loggedCount} logged {loggedCount === 1 ? 'set is' : 'sets are'} kept.
        </div>
      )}

      <button
        type="button"
        onClick={onUnskip}
        style={{
          marginTop: 24, width: '100%', height: 50, borderRadius: 14,
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid color-mix(in oklab, ${c.primary} 40%, transparent)`,
          color: 'var(--text-1)', fontWeight: 600, fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Undo skip
      </button>

      {hasNextExercise && (
        <button
          type="button"
          onClick={onAdvanceExercise}
          style={{
            marginTop: 10, width: '100%', height: 44, borderRadius: 14,
            background: 'transparent', border: 'none',
            color: 'var(--text-m)', fontWeight: 600, fontSize: 12, letterSpacing: '0.2em',
            cursor: 'pointer',
          }}
        >
          NEXT EXERCISE →
        </button>
      )}
    </div>
  )
}
