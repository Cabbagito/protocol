import type { DailyTargets, MacroTotals } from '../../types'
import { fmtKcal } from '../../lib/diet'
import { MACRO_COLORS, MONO, macroLabelStyle } from './styles'

function leftOf(value: number, target: number): string {
  const diff = Math.round(target - value)
  return diff >= 0 ? `${fmtKcal(diff)} LEFT` : `${fmtKcal(-diff)} OVER`
}

function Bar({ pct, fill, height }: { pct: number; fill: string; height: number }) {
  return (
    <div style={{ height, borderRadius: 2, background: 'var(--fill)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: fill }} />
    </div>
  )
}

function Lead({
  label,
  color,
  value,
  unit,
  target,
  fill,
}: {
  label: string
  color: string
  value: number
  unit?: string
  target: number
  fill: string
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...macroLabelStyle(color, 10), letterSpacing: '0.2em' }}>{label}</div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: '-0.045em',
          lineHeight: 1,
          marginTop: 8,
          color: 'var(--text-1)',
        }}
      >
        {fmtKcal(value)}
        {unit && (
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-2)', letterSpacing: 0, marginLeft: 3 }}>
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: '0.05em',
          color: 'var(--text-2)',
          marginTop: 7,
          whiteSpace: 'nowrap',
        }}
      >
        {leftOf(value, target)} · OF {fmtKcal(target)}
      </div>
      <div style={{ marginTop: 10 }}>
        <Bar pct={target ? (value / target) * 100 : 0} fill={fill} height={3} />
      </div>
    </div>
  )
}

function Minor({ label, color, value, target, fill }: { label: string; color: string; value: number; target: number; fill: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10 }}>
        <span style={{ ...macroLabelStyle(color), letterSpacing: '0.18em' }}>{label}</span>
        <span style={{ color: 'var(--text-2)' }}>
          {Math.round(value)} / {Math.round(target)} g
        </span>
      </div>
      <div style={{ marginTop: 7 }}>
        <Bar pct={target ? (value / target) * 100 : 0} fill={fill} height={2} />
      </div>
    </div>
  )
}

/** The day's kcal and protein against target, carbs and fat beneath. */
export default function DayTotals({ totals, targets }: { totals: MacroTotals; targets: DailyTargets }) {
  return (
    <div
      style={{
        padding: '18px 16px 14px',
        borderRadius: 22,
        background: 'linear-gradient(180deg, rgba(var(--accent-rgb),0.11), var(--glass-row))',
        border: '1px solid rgba(var(--accent-rgb),0.16)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 18 }}>
        <Lead
          label="KCAL"
          color={MACRO_COLORS.kcal}
          value={totals.kcal}
          target={targets.kcal}
          fill="var(--p-grad-cta)"
        />
        <div style={{ background: 'linear-gradient(to bottom, transparent, var(--fill-strong), transparent)' }} />
        <Lead
          label="PROTEIN"
          color={MACRO_COLORS.protein}
          value={totals.protein_g}
          unit="g"
          target={targets.protein_g}
          fill="var(--macro-protein)"
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--line)',
        }}
      >
        <Minor label="CARBS" color={MACRO_COLORS.carbs} value={totals.carbs_g} target={targets.carbs_g} fill="var(--macro-carbs)" />
        <Minor label="FAT" color={MACRO_COLORS.fat} value={totals.fat_g} target={targets.fat_g} fill="var(--macro-fat)" />
      </div>
    </div>
  )
}
