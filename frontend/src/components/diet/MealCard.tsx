import { Link } from 'react-router-dom'
import type { Meal } from '../../types'
import { amountLabel, cardLines, fmtKcal, mealName } from '../../lib/diet'
import { ChevronRight } from './ui'
import { MACRO_COLORS, MONO, glassRow, macroLabelStyle } from './styles'

const big = {
  fontFamily: MONO,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: 1,
} as const

const unitStyle = {
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.06em',
  color: 'var(--text-2)',
  marginLeft: 4,
} as const

/** One meal on the day's timeline: time on the rail, the card opens the meal. */
export default function MealCard({ meal, to, last }: { meal: Meal; to: string; last: boolean }) {
  const single = meal.items.length === 1 ? meal.items[0] : null
  const { lines, more } = cardLines(meal)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', columnGap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginTop: 14 }}>
          {meal.eaten_at}
        </div>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px rgba(var(--accent-rgb),0.7)',
            marginTop: 8,
          }}
        />
        {!last && (
          <div
            style={{
              flex: 1,
              width: 1,
              background: 'linear-gradient(to bottom, rgba(var(--accent-rgb),0.35), var(--fill))',
              marginTop: 6,
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: 10, minWidth: 0 }}>
        <Link
          to={to}
          style={{ ...glassRow, display: 'block', textDecoration: 'none', color: 'inherit', padding: '12px 14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {mealName(meal)}
            </div>
            <span style={{ color: 'var(--text-2)', display: 'grid' }}>
              <ChevronRight />
            </span>
          </div>
          {single && amountLabel(single) && (
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--text-2)', opacity: 0.75, marginTop: 2 }}>
              {amountLabel(single)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 10 }}>
            <div style={{ ...big, color: 'var(--text-1)' }}>
              {fmtKcal(meal.totals.kcal)}
              <span style={unitStyle}>KCAL</span>
            </div>
            <div style={{ ...big, color: MACRO_COLORS.protein }}>
              {Math.round(meal.totals.protein_g)}
              <span style={unitStyle}>G PROTEIN</span>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                fontFamily: MONO,
                fontSize: 10.5,
                lineHeight: 1.5,
                textAlign: 'right',
                color: 'var(--text-1)',
                whiteSpace: 'nowrap',
              }}
            >
              <div>
                <span style={{ ...macroLabelStyle(MACRO_COLORS.carbs), letterSpacing: '0.1em' }}>CARBS</span>{' '}
                {Math.round(meal.totals.carbs_g)}g
              </div>
              <div>
                <span style={{ ...macroLabelStyle(MACRO_COLORS.fat), letterSpacing: '0.1em' }}>FAT</span>{' '}
                {Math.round(meal.totals.fat_g)}g
              </div>
            </div>
          </div>
          {!single && lines.length > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 8,
                borderTop: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              {lines.map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12.5,
                      color: 'var(--text-2)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {line.text}
                  </span>
                  {line.amount && (
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--text-2)', opacity: 0.75, whiteSpace: 'nowrap' }}>
                      {line.amount}
                    </span>
                  )}
                </div>
              ))}
              {(more > 0 || (meal.summary && meal.items.length > 3)) && (
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-2)', opacity: 0.6, marginTop: 2 }}>
                  {more > 0 ? `+ ${more} MORE` : `${meal.items.length} FOODS`}
                </div>
              )}
            </div>
          )}
        </Link>
      </div>
    </div>
  )
}
