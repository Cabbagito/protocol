import { addDays, parseIso, weekStart } from '../../lib/dates'
import { MONO, dayCellStyle } from './styles'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function KcalBar({ pct, track, bar, width }: { pct: number; track: string; bar: string; width: number }) {
  return (
    <span style={{ width, height: 3, borderRadius: 2, background: track, overflow: 'hidden', display: 'block' }}>
      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: bar }} />
    </span>
  )
}

/** The week of the shown day: each day's kcal against the target. */
export default function DayStrip({
  date,
  today,
  kcalByDate,
  target,
  onPick,
}: {
  date: string
  today: string
  kcalByDate: Map<string, number>
  target: number
  onPick: (date: string) => void
}) {
  const start = weekStart(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 18 }}>
      {days.map((day, i) => {
        const kcal = kcalByDate.get(day) ?? 0
        const future = day > today
        const look = dayCellStyle({ selected: day === date, future, empty: kcal === 0 })
        const n = parseIso(day).getDate()
        return (
          <button
            key={day}
            type="button"
            disabled={future}
            onClick={() => onPick(day)}
            aria-label={`${parseIso(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${kcal ? `, ${Math.round(kcal)} kcal` : ''}`}
            aria-pressed={day === date}
            style={{
              height: 54,
              borderRadius: 12,
              border: look.border,
              background: look.background,
              color: look.color,
              opacity: look.opacity,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: 0,
              cursor: future ? 'default' : 'pointer',
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', opacity: 0.8 }}>
              {LETTERS[i]}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600 }}>{n}</span>
            <KcalBar pct={target ? (kcal / target) * 100 : 0} track={look.track} bar={look.bar} width={22} />
          </button>
        )
      })}
    </div>
  )
}
