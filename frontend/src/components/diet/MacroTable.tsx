import type { MealItem } from '../../types'
import { amountLabel, fmtKcal, fmtMacro, sumMacros } from '../../lib/diet'
import { MACRO_COLORS, MONO, glassRow } from './styles'

const COLUMNS = '1fr 36px 32px 32px 32px'

const rowGrid = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  gap: 6,
  alignItems: 'center',
  fontFamily: MONO,
  fontSize: 11.5,
  textAlign: 'right',
} as const

/** Every food in a meal with all four macros, and the total. Rows open Amount. */
export default function MacroTable({ items, onPick }: { items: MealItem[]; onPick: (index: number) => void }) {
  const total = sumMacros(items)
  return (
    <div style={{ ...glassRow, padding: '0 12px' }}>
      <div
        style={{
          ...rowGrid,
          padding: '9px 0 7px',
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: '0.14em',
        }}
      >
        <span />
        <span style={{ color: MACRO_COLORS.kcal }}>KCAL</span>
        <span style={{ color: MACRO_COLORS.protein }}>P</span>
        <span style={{ color: MACRO_COLORS.carbs }}>C</span>
        <span style={{ color: MACRO_COLORS.fat }}>F</span>
      </div>
      {items.map((item, i) => (
        <button
          key={item.id ?? i}
          type="button"
          onClick={() => onPick(i)}
          style={{
            ...rowGrid,
            width: '100%',
            padding: '9px 0',
            border: 'none',
            borderTop: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--text-1)',
            cursor: 'pointer',
          }}
        >
          <span style={{ minWidth: 0, textAlign: 'left', fontFamily: 'inherit' }}>
            <span
              style={{
                display: 'block',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 13.5,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.name}
            </span>
            {amountLabel(item) && (
              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-2)', opacity: 0.75, marginTop: 2 }}>
                {amountLabel(item)}
              </span>
            )}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtKcal(item.kcal)}</span>
          <span style={{ color: MACRO_COLORS.protein }}>{fmtMacro(item.protein_g)}</span>
          <span>{fmtMacro(item.carbs_g)}</span>
          <span>{fmtMacro(item.fat_g)}</span>
        </button>
      ))}
      <div
        style={{
          ...rowGrid,
          padding: '10px 0',
          borderTop: '1px solid var(--fill-strong)',
          fontWeight: 700,
        }}
      >
        <span style={{ textAlign: 'left', fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-2)' }}>TOTAL</span>
        <span style={{ fontSize: 12.5 }}>{fmtKcal(total.kcal)}</span>
        <span style={{ color: MACRO_COLORS.protein }}>{fmtMacro(total.protein_g)}</span>
        <span>{fmtMacro(total.carbs_g)}</span>
        <span>{fmtMacro(total.fat_g)}</span>
      </div>
    </div>
  )
}
