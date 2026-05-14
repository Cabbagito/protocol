import { getMuscleColor } from '../lib/muscleColors'

interface NumeralsCardProps {
  group: string
  weight: number
  reps: number
  setNum: number
  totalSets: number
  /** Previous-session reference, e.g. "22.5×10". Optional. */
  lastSummary?: string | null
  /** Target rep count, e.g. 10. Renders as "OF 10" under reps. */
  targetReps?: number | null
  onWeightChange: (next: number) => void
  onRepsChange: (next: number) => void
  onLog: () => void
  weightStep?: number
  /** Disable the LOG button (e.g. while saving). */
  disabled?: boolean
}

/**
 * Hero numerals card on the v5 workout screen. Weight + reps in 56px mono,
 * tinted muscle-color background, glass-blurred. The LOG button uses the
 * muscle gradient and a breathing border keyframe (p-btn-breathe-<group>).
 */
export default function NumeralsCard({
  group,
  weight,
  reps,
  setNum,
  totalSets,
  lastSummary,
  targetReps,
  onWeightChange,
  onRepsChange,
  onLog,
  weightStep = 1.25,
  disabled = false,
}: NumeralsCardProps) {
  const c = getMuscleColor(group)
  // CSS keyframe names use lowercase + hyphens; muscle groups in the data
  // may contain spaces ("front delt"). Translate.
  const breatheKey = group.toLowerCase().replace(/\s+/g, '-')

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 22,
        background: `linear-gradient(180deg, color-mix(in oklab, ${c.primary} 10%, color-mix(in oklab, var(--card) 60%, transparent)) 0%, color-mix(in oklab, var(--card) 70%, transparent) 100%)`,
        border: `1px solid color-mix(in oklab, ${c.primary} 35%, var(--border))`,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: `0 20px 60px -20px color-mix(in oklab, ${c.primary} 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-m)',
            letterSpacing: '0.2em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontWeight: 500,
          }}
        >
          SET {setNum} OF {totalSets}
        </div>
        {lastSummary && (
          <div
            style={{
              fontSize: 10,
              color: c.light,
              letterSpacing: '0.2em',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontWeight: 500,
            }}
          >
            LAST · {lastSummary}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1fr 1px 1fr',
          gap: 14,
          alignItems: 'center',
          marginTop: 18,
        }}
      >
        <Column
          label="WEIGHT"
          accent={c.light}
          value={weight}
          unit="KG"
          step={weightStep}
          minValue={0}
          onChange={onWeightChange}
          color={c}
        />
        <div
          style={{
            height: 70,
            background: `linear-gradient(180deg, transparent, color-mix(in oklab, ${c.primary} 30%, var(--border)), transparent)`,
          }}
        />
        <Column
          label="REPS"
          accent={c.light}
          value={reps}
          unit={targetReps != null ? `OF ${targetReps}` : ''}
          step={1}
          minValue={0}
          onChange={onRepsChange}
          color={c}
        />
      </div>

      <button
        onClick={onLog}
        disabled={disabled}
        style={{
          position: 'relative',
          width: '100%',
          marginTop: 18,
          height: 56,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${c.primary}, ${c.light})`,
          color: 'white',
          fontWeight: 700,
          fontSize: 16,
          border: '1px solid transparent',
          letterSpacing: '0.2em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: `0 14px 40px -10px color-mix(in oklab, ${c.primary} 65%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)`,
          animation: disabled ? 'none' : `p-btn-breathe-${breatheKey} 3.2s ease-in-out infinite`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '40%',
            height: '100%',
            background:
              'linear-gradient(110deg, transparent, rgba(255,255,255,0.25), transparent)',
            animation: 'p-shimmer 3s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
        LOG
      </button>
    </div>
  )
}

interface ColumnProps {
  label: string
  accent: string
  value: number
  unit: string
  step: number
  minValue: number
  onChange: (n: number) => void
  color: { primary: string; light: string }
}

function Column({
  label, accent, value, unit, step, minValue, onChange, color,
}: ColumnProps) {
  function fmt(n: number): string {
    // 56px display: drop trailing .0 on integers, keep one decimal otherwise.
    return Number.isInteger(n) ? String(n) : String(+n.toFixed(2))
  }
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: accent,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 8,
          color: 'var(--text-1)',
          textShadow: `0 0 30px color-mix(in oklab, ${color.primary} 50%, transparent)`,
          letterSpacing: '-0.03em',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        }}
      >
        {fmt(value)}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          justifyContent: 'center',
          marginTop: 10,
        }}
      >
        <NudgeButton color={color} onClick={() => onChange(Math.max(minValue, +(value - step).toFixed(2)))}>−</NudgeButton>
        <NudgeButton color={color} onClick={() => onChange(+(value + step).toFixed(2))}>+</NudgeButton>
      </div>
      {unit && (
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-m)',
            marginTop: 6,
            letterSpacing: '0.15em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          {unit}
        </div>
      )}
    </div>
  )
}

function NudgeButton({ color, onClick, children }: { color: { primary: string; light: string }; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 32,
        height: 28,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid color-mix(in oklab, ${color.primary} 25%, var(--border))`,
        color: color.light,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
