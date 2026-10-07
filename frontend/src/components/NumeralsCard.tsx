import { useState, useEffect } from 'react'
import { getMuscleColor } from '../lib/muscleColors'
import './NumeralsCard.css'

interface NumeralsCardProps {
  group: string
  /** Shown as entered values; null reps show the target as a grey placeholder. */
  weight: number | null
  reps: number | null
  /** Reps to aim for (last time's set). Shown greyed until the user types. */
  repsTarget?: number | null
  /** Overrides the WEIGHT label, e.g. for bodyweight exercises. */
  weightLabel?: string
  setNum: number
  totalSets: number
  /** Previous-session reference, e.g. "22.5×10". Optional. */
  lastSummary?: string | null
  /** If supplied, the LAST · ... line becomes a button that opens history. */
  onLastClick?: () => void
  onWeightChange: (next: number) => void
  onRepsChange: (next: number) => void
  onLog: () => void
  /** Disable the LOG button (e.g. while saving). */
  disabled?: boolean
  /** Override the LOG label (e.g. "UPDATE" for a re-log). */
  logLabel?: string
  /** Per-set secondary actions under LOG. Each is hidden when omitted. */
  onSkipSet?: () => void
  onRemoveSet?: () => void
  /** The active set is skipped: header says so and Skip becomes Unskip. */
  setSkipped?: boolean
}

/**
 * Hero weight/reps card on the v5 workout screen. The 56px mono numerals
 * are tap-editable text inputs (decimal comma accepted). -/+ nudges step by
 * 0.5kg for weight and 1 for reps. Untouched reps show last time's value
 * as a grey placeholder; LOG accepts whatever is shown.
 */
export default function NumeralsCard({
  group,
  weight,
  reps,
  repsTarget = null,
  weightLabel = 'WEIGHT',
  setNum,
  totalSets,
  lastSummary,
  onLastClick,
  onWeightChange,
  onRepsChange,
  onLog,
  disabled = false,
  logLabel = 'LOG',
  onSkipSet,
  onRemoveSet,
  setSkipped = false,
}: NumeralsCardProps) {
  const c = getMuscleColor(group)

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 22,
        background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 60%), color-mix(in oklab, var(--card) 82%, transparent)`,
        border: `1px solid color-mix(in oklab, ${c.primary} 18%, var(--border))`,
        boxShadow: `0 20px 60px -20px rgba(0,0,0,0.5), inset 0 0 30px -10px color-mix(in oklab, ${c.primary} 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)`,
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
          SET {setNum} OF {totalSets}{setSkipped ? ' · SKIPPED' : ''}
        </div>
        {lastSummary && (
          onLastClick ? (
            <button
              type="button"
              onClick={onLastClick}
              style={{
                fontSize: 10,
                color: c.light,
                letterSpacing: '0.2em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                borderBottom: `1px dotted color-mix(in oklab, ${c.primary} 40%, transparent)`,
                paddingBottom: 1,
                cursor: 'pointer',
              }}
              aria-label="Open exercise history"
            >
              LAST · {lastSummary}
            </button>
          ) : (
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
          )
        )}
        {!lastSummary && onLastClick && (
          <button
            type="button"
            onClick={onLastClick}
            style={{
              fontSize: 10,
              color: 'var(--text-m)',
              letterSpacing: '0.2em',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontWeight: 500,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dotted rgba(255,255,255,0.15)',
              paddingBottom: 1,
              cursor: 'pointer',
            }}
            aria-label="Open exercise history"
          >
            HISTORY
          </button>
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
          label={weightLabel}
          value={weight}
          step={0.5}
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
          value={reps}
          placeholder={repsTarget}
          step={1}
          minValue={0}
          onChange={onRepsChange}
          color={c}
          integerOnly
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
        }}
      >
        {logLabel}
      </button>

      {(onSkipSet || onRemoveSet) && (
        <div
          style={{
            position: 'relative',
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: onSkipSet && onRemoveSet ? '1fr 1fr' : '1fr',
            gap: 8,
          }}
        >
          {onSkipSet && (
            <SecondaryButton onClick={onSkipSet} color="var(--text-2)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
              {setSkipped ? 'Unskip set' : 'Skip set'}
            </SecondaryButton>
          )}
          {onRemoveSet && (
            <SecondaryButton onClick={onRemoveSet} color="#fb7185">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              Remove set
            </SecondaryButton>
          )}
        </div>
      )}
    </div>
  )
}

function SecondaryButton({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 40,
        borderRadius: 12,
        background: 'transparent',
        border: 'none',
        color,
        fontSize: 12,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

interface ColumnProps {
  label: string
  value: number | null
  placeholder?: number | null
  step: number
  minValue: number
  onChange: (n: number) => void
  color: { primary: string; light: string }
  /** Block decimals (used for reps). */
  integerOnly?: boolean
}

function fmt(n: number | null): string {
  if (n === null) return ''
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(2))
}

function Column({
  label, value, placeholder = null, step, minValue, onChange, color, integerOnly,
}: ColumnProps) {
  // Local text state lets the input go through transient invalid states
  // (e.g. trailing "." while typing 22.5) without snapping back.
  const [text, setText] = useState<string>(() => fmt(value))
  useEffect(() => {
    // Sync from parent when value changes externally (nudge buttons / set switch).
    setText(fmt(value))
  }, [value])

  function commit(raw: string) {
    const normalized = raw.replace(',', '.')
    if (normalized === '' || normalized === '.' || normalized === '-') {
      // Clearing the field goes back to the target placeholder.
      setText(fmt(value))
      return
    }
    let n = Number(normalized)
    if (!Number.isFinite(n)) {
      setText(fmt(value))
      return
    }
    if (integerOnly) n = Math.round(n)
    if (n < minValue) n = minValue
    onChange(n)
    setText(fmt(n))
  }

  const base = value ?? placeholder ?? 0

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: color.light,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        }}
      >
        {label}
      </div>
      <input
        type="text"
        className="p-num-input"
        inputMode={integerOnly ? 'numeric' : 'decimal'}
        aria-label={label}
        value={text}
        placeholder={placeholder != null ? fmt(placeholder) : '0'}
        onChange={(e) => setText(
          integerOnly
            ? e.target.value.replace(/\D/g, '')
            : e.target.value.replace(/[^\d.,]/g, '').replace(',', '.')
        )}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        onFocus={(e) => e.target.select()}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 8,
          color: 'var(--text-1)',
          textShadow: value === null ? 'none' : `0 0 30px color-mix(in oklab, ${color.primary} 50%, transparent)`,
          letterSpacing: '-0.03em',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          textAlign: 'center',
          padding: 0,
        }}
      />
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          marginTop: 10,
        }}
      >
        <NudgeButton label={`Decrease ${label.toLowerCase()}`} color={color} onClick={() => commit(String(Math.max(minValue, +(base - step).toFixed(2))))}>−</NudgeButton>
        <NudgeButton label={`Increase ${label.toLowerCase()}`} color={color} onClick={() => commit(String(+(base + step).toFixed(2)))}>+</NudgeButton>
      </div>
    </div>
  )
}

function NudgeButton({ label, color, onClick, children }: { label: string; color: { primary: string; light: string }; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 48,
        height: 40,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid color-mix(in oklab, ${color.primary} 25%, var(--border))`,
        color: color.light,
        fontSize: 18,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
