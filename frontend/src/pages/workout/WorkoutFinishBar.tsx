import type { SessionExercise } from '../../lib/workoutSession'

/* Sticky finish bar — shown when every set is logged or skipped, and
   throughout an edit. */

interface WorkoutFinishBarProps {
  exercises: SessionExercise[]
  label: string
  eyebrow: string
  busy: boolean
  onFinish: () => void
}

export function WorkoutFinishBar({
  exercises, label, eyebrow, busy, onFinish,
}: WorkoutFinishBarProps) {
  const totalSets = exercises.reduce((n, ex) => n + ex.sets.filter(s => s.logged).length, 0)
  const exerciseCount = exercises.filter(ex => !ex.skipped).length

  return (
    <div
      style={{
        position: 'fixed',
        left: 18, right: 18,
        bottom: 'var(--above-nav)',
        zIndex: 100,
        maxWidth: 480,
        marginLeft: 'auto', marginRight: 'auto',
        padding: 14,
        borderRadius: 22,
        background: 'color-mix(in oklab, var(--card) 88%, transparent)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow:
          '0 18px 50px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px 10px',
        }}
      >
        <span
          style={{
            fontSize: 10, color: 'var(--accent-l)', letterSpacing: '0.22em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontWeight: 600, textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            fontSize: 10, color: 'var(--text-m)', letterSpacing: '0.18em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 500,
          }}
        >
          {totalSets} SETS · {exerciseCount} EX
        </span>
      </div>
      <button
        type="button"
        onClick={onFinish}
        disabled={busy}
        style={{
          width: '100%', height: 54, borderRadius: 16,
          background: 'var(--p-grad-cta)',
          color: 'var(--btn-text)',
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontWeight: 500, fontSize: 13,
          letterSpacing: '0.22em',
          border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.7 : 1,
          boxShadow:
            '0 14px 36px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        {label}
      </button>
    </div>
  )
}
