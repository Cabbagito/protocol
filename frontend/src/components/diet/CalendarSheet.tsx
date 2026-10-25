import { useState } from 'react'
import { useDietDays } from '../../api/hooks'
import { localDateKey, parseIso } from '../../lib/dates'
import { KcalBar } from './DayStrip'
import { Sheet, SheetHeader } from '../Sheet'
import { ChevronLeft, ChevronRight, ChromeButton } from './ui'
import { MONO, ctaStyle, dayCellStyle, eyebrowStyle } from './styles'

const HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const count = new Date(y!, m!, 0).getDate()
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return localDateKey(new Date(y!, m! - 1 + delta, 1)).slice(0, 7)
}

/** A month of days, each with its kcal against the target. */
export default function CalendarSheet({
  open,
  onClose,
  date,
  today,
  target,
  onPick,
}: {
  open: boolean
  onClose: () => void
  date: string
  today: string
  target: number
  onPick: (date: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Calendar">
      <SheetHeader title="Pick a day" onClose={onClose} />
      {open && <Month key={monthOf(date)} date={date} today={today} target={target} onPick={onPick} />}
    </Sheet>
  )
}

function Month({ date, today, target, onPick }: { date: string; today: string; target: number; onPick: (date: string) => void }) {
  const [month, setMonth] = useState(monthOf(date))
  const days = monthDays(month)
  const { data } = useDietDays(days[0]!, days[days.length - 1]!)
  const kcal = new Map((data ?? []).map((d) => [d.date, d.kcal]))
  const lead = (parseIso(days[0]!).getDay() + 6) % 7
  const first = parseIso(days[0]!)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <ChromeButton label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft />
        </ChromeButton>
        <div style={{ textAlign: 'center' }}>
          <div style={eyebrowStyle}>{first.getFullYear()}</div>
          <div className="p-display" style={{ fontSize: 18, color: 'var(--text-1)', marginTop: 1 }}>
            {first.toLocaleDateString('en-US', { month: 'long' })}
          </div>
        </div>
        <ChromeButton
          label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= monthOf(today)}
        >
          <ChevronRight />
        </ChromeButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginTop: 16 }}>
        {HEADS.map((h, i) => (
          <div
            key={i}
            style={{ textAlign: 'center', fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-2)', opacity: 0.7 }}
          >
            {h}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {days.map((day) => {
          const k = kcal.get(day) ?? 0
          const future = day > today
          const look = dayCellStyle({ selected: day === date, future, empty: k === 0 })
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => onPick(day)}
              aria-label={`${parseIso(day).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${k ? `, ${Math.round(k)} kcal` : ''}`}
              aria-pressed={day === date}
              style={{
                height: 46,
                borderRadius: 11,
                border: look.border,
                background: look.background,
                color: day === date ? look.color : 'var(--text-1)',
                opacity: look.opacity,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                cursor: future ? 'default' : 'pointer',
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{parseIso(day).getDate()}</span>
              <KcalBar pct={target ? (k / target) * 100 : 0} track={look.track} bar={look.bar} width={20} />
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: 'var(--text-2)' }}>
        <KcalBar pct={70} track="var(--fill)" bar="var(--accent-l)" width={20} />
        Calories eaten against your target
      </div>

      <button type="button" onClick={() => onPick(today)} style={{ ...ctaStyle, marginTop: 22, height: 50 }}>
        Back to today
      </button>
    </div>
  )
}
