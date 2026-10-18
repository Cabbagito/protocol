import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import BodyweightCard from '../components/BodyweightCard'
import DayStrip from '../components/diet/DayStrip'
import DayTotals from '../components/diet/DayTotals'
import MealCard from '../components/diet/MealCard'
import CalendarSheet from '../components/diet/CalendarSheet'
import { ChevronLeft, ChevronRight, Chrome, ChromeButton, PlusIcon, SectionLabel } from '../components/diet/ui'
import { MONO } from '../components/diet/styles'
import { useDailyTargets, useDietDay, useDietDays } from '../api/hooks'
import { addDays, parseIso, weekStart } from '../lib/dates'
import { ZERO } from '../lib/diet'
import { useToday } from '../hooks/useToday'

// Shown only until the targets load; every user has a real row.
const FALLBACK_TARGETS = { kcal: 2270, protein_g: 160, carbs_g: 250, fat_g: 70 }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function eyebrow(date: string, today: string): string {
  const d = parseIso(date)
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
  return `${weekday} · ${day}`
}

function title(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  const d = parseIso(date)
  if (date > addDays(today, -7)) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Diet() {
  const today = useToday()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const picked = params.get('date')
  // No date (or a stale one) follows today, so a PWA resumed the next
  // morning shows the new day.
  const date = picked && ISO_DATE.test(picked) && picked < today ? picked : today
  const [calendarOpen, setCalendarOpen] = useState(false)

  const { data, isLoading } = useDietDay(date)
  const { data: savedTargets } = useDailyTargets()
  const targets = data?.targets ?? savedTargets ?? FALLBACK_TARGETS
  const start = weekStart(date)
  const { data: week } = useDietDays(start, addDays(start, 6))
  const kcalByDate = new Map((week ?? []).map((d) => [d.date, d.kcal]))
  if (data) kcalByDate.set(date, data.totals.kcal)

  const meals = data?.meals ?? []

  function goTo(next: string) {
    setCalendarOpen(false)
    setParams(next >= today ? {} : { date: next }, { replace: true })
  }

  function logMeal() {
    navigate(`/diet/meals/new${date === today ? '' : `?date=${date}`}`)
  }

  return (
    <div style={{ padding: '12px 22px 0', overflowX: 'clip' }}>
      <Chrome
        left={
          <ChromeButton label="Previous day" onClick={() => goTo(addDays(date, -1))}>
            <ChevronLeft />
          </ChromeButton>
        }
        eyebrow={eyebrow(date, today)}
        title={title(date, today)}
        onTitleClick={() => setCalendarOpen(true)}
        titleLabel="Open the calendar"
        right={
          <ChromeButton label="Next day" onClick={() => goTo(addDays(date, 1))} disabled={date >= today}>
            <ChevronRight />
          </ChromeButton>
        }
      />

      <DayStrip date={date} today={today} kcalByDate={kcalByDate} target={targets.kcal} onPick={goTo} />

      <DayTotals totals={data?.totals ?? ZERO} targets={targets} />

      {isLoading && !data ? (
        <PageLoader />
      ) : (
        <>
          <SectionLabel>{meals.length === 1 ? '1 meal' : `${meals.length} meals`}</SectionLabel>
          {meals.length === 0 ? (
            <button
              type="button"
              onClick={logMeal}
              style={{
                width: '100%',
                padding: '18px 16px',
                borderRadius: 14,
                background: 'transparent',
                border: '1px dashed var(--fill-strong)',
                color: 'var(--text-2)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {date === today ? 'Nothing logged yet today' : 'Nothing logged on this day'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {meals.map((meal, i) => (
                <MealCard key={meal.id} meal={meal} to={`/diet/meals/${meal.id}`} last={i === meals.length - 1} />
              ))}
            </div>
          )}
        </>
      )}

      <BodyweightCard date={date} today={today} />
      {/* Room for the Log meal pill */}
      <div style={{ height: 64 }} />

      <Link
        to={`/diet/meals/new${date === today ? '' : `?date=${date}`}`}
        style={{
          position: 'fixed',
          zIndex: 100,
          right: 22,
          bottom: 'var(--above-nav)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
          borderRadius: 999,
          background: 'var(--p-grad-cta)',
          color: 'var(--btn-text)',
          fontFamily: MONO,
          fontWeight: 500,
          fontSize: 12,
          letterSpacing: '0.05em',
          textDecoration: 'none',
          boxShadow: '0 14px 40px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        <PlusIcon />
        Log meal
      </Link>

      <CalendarSheet
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        date={date}
        today={today}
        target={targets.kcal}
        onPick={goTo}
      />
    </div>
  )
}
