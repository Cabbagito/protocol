import DecimalInput from '../DecimalInput'
import { CloseIcon, SparkleIcon } from './ui'
import { MONO, glassRow } from './styles'

export interface UnitRow {
  key: string
  name: string
  grams: string
  /** Filled in from the photos and not changed since. */
  read: boolean
}

const GRID = '1fr 96px 28px'

const field = (read: boolean) =>
  ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    background: 'var(--input)',
    border: `1px solid ${read ? 'rgba(var(--ai-rgb),0.35)' : 'var(--border)'}`,
    padding: '0 10px',
    boxSizing: 'border-box',
  }) as const

const bare = {
  flex: 1,
  minWidth: 0,
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text-1)',
  fontSize: 16,
  padding: 0,
} as const

/** A food's units: grams always, plus named amounts with what one weighs. */
export default function UnitList({ rows, onChange }: { rows: UnitRow[]; onChange: (rows: UnitRow[]) => void }) {
  function update(key: string, change: Partial<UnitRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...change, read: false } : r)))
  }
  return (
    <div style={{ ...glassRow, padding: '4px 12px 12px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: 8,
          padding: '6px 0',
          fontFamily: MONO,
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: '0.14em',
          color: 'var(--text-2)',
          opacity: 0.8,
        }}
      >
        <span>NAME</span>
        <span>WEIGHS</span>
        <span />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
        <span style={{ fontSize: 14 }}>grams</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-2)' }}>always there</span>
        <span />
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)' }}
        >
          <label style={field(row.read)}>
            <input
              value={row.name}
              onChange={(e) => update(row.key, { name: e.target.value })}
              placeholder="cookie, pack…"
              aria-label="Unit name"
              maxLength={50}
              style={bare}
            />
            {row.read && (
              <span role="img" aria-label="Read from the label" style={{ color: 'var(--ai)', display: 'grid' }}>
                <SparkleIcon size={11} />
              </span>
            )}
          </label>
          <label style={field(row.read)}>
            <DecimalInput
              value={row.grams}
              onChange={(grams) => update(row.key, { grams })}
              placeholder="0"
              aria-label="Grams in one"
              style={{ ...bare, fontFamily: MONO, textAlign: 'right' }}
            />
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-2)' }}>g</span>
          </label>
          <button
            type="button"
            aria-label="Remove unit"
            onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--fill-strong)',
              color: 'var(--text-2)',
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <CloseIcon size={11} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { key: crypto.randomUUID(), name: '', grams: '', read: false }])}
        style={{
          marginTop: 8,
          width: '100%',
          height: 40,
          borderRadius: 10,
          border: '1px dashed var(--fill-strong)',
          background: 'transparent',
          color: 'var(--accent-l)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Add unit
      </button>
    </div>
  )
}
