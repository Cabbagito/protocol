import { getMuscleColor } from '../lib/muscleColors'

interface MuscleAccentProps {
  group: string
  variant?: 'pill' | 'dot'
}

/**
 * Two flavors of the muscle-group identifier used throughout v5:
 *   - "pill": solid uppercase chip, used in list rows + headers.
 *   - "dot":  glowing pulsing dot + uppercase label, used as hero accents.
 */
export default function MuscleAccent({ group, variant = 'pill' }: MuscleAccentProps) {
  const c = getMuscleColor(group)
  const label = group.toUpperCase()

  if (variant === 'dot') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: c.primary,
            boxShadow: `0 0 16px ${c.primary}, 0 0 4px ${c.primary}`,
            animation: 'p-pulse-dot 2.6s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.18em',
            color: c.light,
            textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          {label}
        </span>
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: 6,
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 600,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        background: `color-mix(in oklab, ${c.primary} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${c.primary} 22%, transparent)`,
        color: c.light,
      }}
    >
      {label}
    </span>
  )
}
