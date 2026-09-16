import { getMuscleColor } from '../lib/muscleColors'
import MuscleAccent from './MuscleAccent'
import type { MesoExercise } from '../types'

type PeekStatus = 'next' | 'queued' | 'done' | 'current' | 'skipped'

interface ExercisePeekCardProps {
  exercise: MesoExercise
  index: number
  status: PeekStatus
  onClick?: () => void
}

/**
 * Glass-blurred row used in the workout's "up next" list. Left edge has a
 * vertical gradient accent in the muscle color, body shows the index +
 * muscle pill + state tag + exercise name, right side shows per-set dots
 * (filled when logged) and a status icon. Skipped exercises stay in the
 * list, dimmed with a SKIPPED tag, so they can be tapped and un-skipped.
 */
export default function ExercisePeekCard({
  exercise,
  index,
  status,
  onClick,
}: ExercisePeekCardProps) {
  const c = getMuscleColor(exercise.muscle_group)
  const isActive = status === 'next' || status === 'current'
  const isSkipped = status === 'skipped'

  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none',
        textAlign: 'left',
        width: '100%',
        padding: '12px 14px',
        borderRadius: 14,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        background:
          status === 'done' || isSkipped
            ? 'color-mix(in oklab, var(--card) 60%, transparent)'
            : 'color-mix(in oklab, var(--card) 70%, transparent)',
        border: isActive
          ? '1px solid var(--border)'
          : isSkipped
          ? '1px dashed rgba(255,255,255,0.10)'
          : '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: status === 'done' ? 0.55 : isSkipped ? 0.45 : 1,
      }}
    >
      <div
        style={{
          width: 3,
          height: 44,
          borderRadius: 2,
          background: isSkipped
            ? 'rgba(148,163,184,0.5)'
            : `linear-gradient(180deg, ${c.primary}, ${c.light})`,
          opacity: isActive ? 1 : 0.7,
          boxShadow: isActive
            ? `0 0 10px color-mix(in oklab, ${c.primary} 50%, transparent)`
            : 'none',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              color: 'var(--text-m)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontWeight: 500,
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <MuscleAccent group={exercise.muscle_group} variant="dot" />
          {status === 'next' && (
            <span
              style={{
                fontSize: 8,
                color: 'var(--text-m)',
                letterSpacing: '0.18em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              }}
            >
              · NEXT
            </span>
          )}
          {status === 'done' && (
            <span
              style={{
                fontSize: 8,
                color: c.light,
                letterSpacing: '0.18em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              }}
            >
              · DONE
            </span>
          )}
          {status === 'current' && (
            <span
              style={{
                fontSize: 8,
                color: c.light,
                letterSpacing: '0.18em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              }}
            >
              · ACTIVE
            </span>
          )}
          {isSkipped && (
            <span
              style={{
                fontSize: 8,
                color: 'var(--text-m)',
                letterSpacing: '0.18em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              }}
            >
              · SKIPPED
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: status === 'done' || isSkipped ? 'var(--text-2)' : 'var(--text-1)',
            marginTop: 3,
            textDecoration: isSkipped ? 'line-through' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {exercise.exercise_name}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {exercise.sets.map((s, si) => (
          <div
            key={si}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: s.logged ? c.light : 'rgba(255,255,255,0.08)',
              boxShadow: s.logged
                ? `0 0 5px color-mix(in oklab, ${c.primary} 50%, transparent)`
                : 'none',
            }}
          />
        ))}
      </div>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={status === 'done' ? c.light : 'var(--text-m)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {status === 'done' ? (
          <polyline points="20 6 9 17 4 12" />
        ) : isSkipped ? (
          // Undo arrow: tap to bring the exercise back
          <>
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </>
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  )
}
