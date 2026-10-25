import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import BottomSheet from '../components/BottomSheet'
import PageLoader from '../components/PageLoader'
import { SyncPill } from '../components/SyncPill'
import { useToast } from '../components/Toast'
import AmountSheet, { type AmountTarget } from '../components/diet/AmountSheet'
import FoodSearch from '../components/diet/FoodSearch'
import MacroTable from '../components/diet/MacroTable'
import { BarcodeIcon, ChevronLeft, ChevronRight, Chrome, ChromeButton, DotsIcon, NamingTag, SearchIcon, SectionLabel } from '../components/diet/ui'
import { Sheet, SheetHeader } from '../components/Sheet'
import { MACRO_COLORS, MONO, accentChipStyle, ctaStyle, glassRow, macroLabelStyle } from '../components/diet/styles'
import { ApiError, NetworkError } from '../api/client'
import { useBarcodeLookup, useDailyTargets, useFood, useMeal } from '../api/hooks'
import { getUserId } from '../lib/auth'
import { parseIso } from '../lib/dates'
import { ZERO, dayPath, fmtKcal, mealName, newMealId, nowHHMM, sumMacros } from '../lib/diet'
import { isDirty, mealSync, useMealSyncStatus, type MealDraft } from '../lib/mealSync'
import { useBack } from '../lib/navigation'
import { useToday } from '../hooks/useToday'
import type { FoodItem, Meal as MealType, MealItem, MealSnapshot } from '../types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HH_MM = /^\d{2}:\d{2}$/

/**
 * /diet/meals/new starts a meal: it gets its id here and keeps its date and
 * time in the address until the first food saves it, so a reload or a trip
 * to New product comes back to the same meal.
 */
export default function MealPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const today = useToday()

  useEffect(() => {
    if (id !== 'new') return
    const date = params.get('date')
    const day = date && ISO_DATE.test(date) && date <= today ? date : today
    const at = day === today ? nowHHMM() : '12:00'
    navigate(`/diet/meals/${newMealId()}?new=1&date=${day}&at=${at}`, { replace: true })
  }, [id, params, today, navigate])

  if (id === 'new') return null
  return <MealEditor key={id} id={id} />
}

function shortDay(date: string): string {
  return parseIso(date)
    .toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    .replace(',', '')
}

function MealEditor({ id }: { id: string }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const today = useToday()
  const toast = useToast()

  const isDraft = params.get('new') === '1'
  // Opened as a new meal: the logging layout stays for this visit.
  const [mode] = useState<'new' | 'edit'>(isDraft ? 'new' : 'edit')
  const { data: current, draft, deleted, isLoading, error } = useMeal(id, !isDraft)
  // Deleted here: keep showing it while the screen goes back to the day.
  const [leaving, setLeaving] = useState<MealType | null>(null)
  const saved = current ?? leaving ?? undefined
  const { data: targets } = useDailyTargets()
  const lookup = useBarcodeLookup()
  const userId = getUserId()

  const draftDate = params.get('date')
  const draftAt = params.get('at')
  const meal: MealType = saved ?? {
    id,
    eaten_on: draftDate && ISO_DATE.test(draftDate) ? draftDate : today,
    eaten_at: draftAt && HH_MM.test(draftAt) ? draftAt : nowHHMM(),
    name: null,
    name_source: 'auto',
    summary: null,
    naming: false,
    totals: ZERO,
    items: [],
  }
  const back = useBack(dayPath(meal.eaten_on, today))

  const [amount, setAmount] = useState<AmountTarget | null>(null)
  const [searching, setSearching] = useState(mode === 'new')
  const [scanning, setScanning] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  // Back from New product with a food to measure (?add=<food id>).
  const addId = params.get('add')
  const { data: addFood } = useFood(addId)
  useEffect(() => {
    if (!addId || !addFood) return
    setAmount({ food: addFood })
    setParams(
      (p) => {
        p.delete('add')
        return p
      },
      { replace: true },
    )
  }, [addId, addFood, setParams])

  // An existing meal's food, to measure it again.
  const editingFoodId = amount?.item?.food_item_id ?? null
  const {
    data: editingFood,
    isLoading: editingFoodLoading,
    offline: editingFoodOffline,
  } = useFood(amount?.item && !amount.food ? editingFoodId : null)
  const amountTarget: AmountTarget | null =
    amount && amount.item && !amount.food && editingFoodId
      ? editingFood
        ? { ...amount, food: editingFood }
        : editingFoodLoading
          ? null
          : { ...amount, offline: editingFoodOffline }
      : amount

  /** Saved on the phone first; the sync queue sends it to the server. */
  function store(mealId: string, snapshot: MealSnapshot | null) {
    if (userId) mealSync.save(userId, mealId, snapshot)
  }

  function deleteAndLeave() {
    setLeaving(meal)
    store(id, null)
    back()
  }

  function save(change: { items?: MealItem[]; eaten_at?: string; name?: string | null }) {
    const items = change.items ?? meal.items
    if (items.length === 0) {
      if (!saved) return
      if (mode === 'edit') return deleteAndLeave()
      store(id, null)
      // A new meal with nothing left in it is a draft again.
      setParams({ new: '1', date: meal.eaten_on, at: meal.eaten_at }, { replace: true })
      return
    }
    store(id, {
      eaten_on: meal.eaten_on,
      eaten_at: change.eaten_at ?? meal.eaten_at,
      name: change.name !== undefined ? change.name : meal.name_source === 'user' ? meal.name : null,
      items,
    })
    // Saved: the address no longer needs the draft's date and time.
    if (isDraft) setParams({}, { replace: true })
  }

  function done(item: MealItem, index: number | undefined) {
    const items = index === undefined ? [...meal.items, item] : meal.items.map((it, i) => (i === index ? item : it))
    save({ items })
    setAmount(null)
    setResetKey((k) => k + 1)
  }

  function remove(index: number) {
    save({ items: meal.items.filter((_, i) => i !== index) })
    setAmount(null)
  }

  const here = location.pathname + location.search

  function newProduct(barcode?: string, state?: unknown) {
    const q = new URLSearchParams({ back: here })
    if (barcode) q.set('barcode', barcode)
    navigate(`/diet/products/new?${q}`, { state })
  }

  async function scanned(code: string) {
    setScanning(false)
    try {
      const result = await lookup.mutateAsync(code)
      if (result.status === 'found' && result.food) setAmount({ food: result.food })
      else newProduct(code, { draft: result.draft })
    } catch (e) {
      toast.showError(e instanceof NetworkError ? 'Offline · scanning needs a connection' : 'Failed to look up the barcode')
    }
  }

  function logAgainToday() {
    const copy = newMealId()
    store(copy, {
      eaten_on: today,
      eaten_at: nowHHMM(),
      name: meal.name_source === 'user' ? meal.name : null,
      items: meal.items.map((item) => ({ ...item, id: undefined })),
    })
    navigate(`/diet/meals/${copy}`, { replace: true })
  }

  if (!saved && !isDraft) {
    if (isLoading) return <PageLoader className="min-h-[60vh]" />
    const gone = deleted || (error instanceof ApiError && error.status === 404)
    return (
      <div style={{ padding: '12px 22px 0' }}>
        <Chrome
          left={
            <ChromeButton label="Back to the day" onClick={back}>
              <ChevronLeft />
            </ChromeButton>
          }
          eyebrow="Meal"
          title={gone ? 'Not found' : 'Offline'}
        />
        <div style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center', marginTop: 24 }}>
          {gone ? 'This meal was deleted.' : 'This meal can’t be loaded without a connection.'}
        </div>
      </div>
    )
  }

  const hasItems = meal.items.length > 0
  const eyebrow = `Meal · ${shortDay(meal.eaten_on)} · ${meal.eaten_at}`
  const pctOfTarget = targets?.kcal ? Math.round((meal.totals.kcal / targets.kcal) * 100) : null

  return (
    <div style={{ padding: '12px 22px 0' }}>
      <Chrome
        left={
          <ChromeButton label="Back to the day" onClick={back}>
            <ChevronLeft />
          </ChromeButton>
        }
        eyebrow={eyebrow}
        title={mode === 'new' ? 'New meal' : mealName(meal)}
        status={saved && !leaving && <MealSyncPill draft={draft} />}
        right={
          saved ? (
            <ChromeButton label="Meal actions" onClick={() => setActionsOpen(true)}>
              <DotsIcon />
            </ChromeButton>
          ) : undefined
        }
      />

      {mode === 'edit' && <MealTotals meal={meal} pctOfTarget={pctOfTarget} />}

      <div style={{ ...glassRow, borderRadius: 14, overflow: 'hidden', marginTop: mode === 'edit' ? 14 : 0 }}>
        {mode === 'edit' && (
          <button type="button" onClick={() => setRenaming(true)} style={rowStyle}>
            Name
            <span style={{ marginLeft: 'auto', fontSize: 14, color: meal.naming ? 'var(--text-2)' : 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {mealName(meal)}
            </span>
            {meal.naming ? (
              <NamingTag />
            ) : meal.name_source === 'auto' && meal.name && (
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--ai)' }}>AUTO</span>
            )}
            <span style={{ color: 'var(--text-2)', display: 'grid' }}>
              <ChevronRight />
            </span>
          </button>
        )}
        <label style={{ ...rowStyle, borderTop: mode === 'edit' ? '1px solid var(--line)' : 'none', position: 'relative' }}>
          Eaten at
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 14, color: 'var(--text-1)' }}>{meal.eaten_at}</span>
          <span style={{ color: 'var(--text-2)', display: 'grid' }}>
            <ChevronRight />
          </span>
          <input
            type="time"
            aria-label="Eaten at"
            value={meal.eaten_at}
            onChange={(e) => {
              if (!HH_MM.test(e.target.value)) return
              if (hasItems) save({ eaten_at: e.target.value })
              else setParams((p) => { p.set('at', e.target.value); return p }, { replace: true })
            }}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </label>
      </div>

      {hasItems && (
        <>
          <SectionLabel hint="tap to change">
            {mode === 'new' ? `In this meal · ${meal.items.length}` : meal.items.length === 1 ? '1 food' : `${meal.items.length} foods`}
          </SectionLabel>
          <MacroTable items={meal.items} onPick={(index) => setAmount({ food: null, item: meal.items[index], index })} />
        </>
      )}

      {searching ? (
        <>
          <SectionLabel>Add the next food</SectionLabel>
          <FoodSearch
            onPick={(food: FoodItem) => setAmount({ food })}
            onScan={() => setScanning(true)}
            onNewProduct={() => newProduct()}
            autoFocus={mode === 'edit'}
            resetKey={resetKey}
          />
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 18,
            padding: 8,
            borderRadius: 18,
            background: 'var(--glass-strong)',
            border: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            onClick={() => setSearching(true)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              background: 'var(--input)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 14px',
              color: 'var(--text-2)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <SearchIcon />
            Add food
          </button>
          <button
            type="button"
            onClick={() => setScanning(true)}
            aria-label="Scan a barcode"
            style={{ ...accentChipStyle, width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center' }}
          >
            <BarcodeIcon />
          </button>
        </div>
      )}

      <button type="button" onClick={back} style={{ ...ctaStyle, marginTop: 24, marginBottom: 8 }}>
        Done
      </button>

      <AmountSheet
        target={amountTarget}
        onClose={() => setAmount(null)}
        onDone={done}
        onRemove={remove}
        onEditProduct={(food) => {
          setAmount(null)
          navigate(`/diet/products/${food.id}?${new URLSearchParams({ back: here })}`)
        }}
      />

      {scanning && <BarcodeScanner onDetected={scanned} onClose={() => setScanning(false)} />}

      <RenameSheet
        open={renaming}
        meal={meal}
        onClose={() => setRenaming(false)}
        onSave={(name) => {
          setRenaming(false)
          save({ name })
        }}
      />

      <BottomSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={mealName(meal)}
        actions={[
          { label: 'Log again today', onClick: logAgainToday },
          {
            label: 'Delete meal',
            variant: 'danger',
            onClick: deleteAndLeave,
          },
        ]}
      />
    </div>
  )
}

/** This meal's sync: on the phone only, being sent, or on the server. */
function MealSyncPill({ draft }: { draft: MealDraft | null }) {
  const { state } = useMealSyncStatus()
  return (
    <SyncPill
      status={{
        state: draft?.error ? 'error' : state,
        pending: draft && isDirty(draft) ? 1 : 0,
        error: draft?.error ?? null,
      }}
      onRetry={() => {
        const userId = getUserId()
        if (userId) mealSync.retryRejected(userId)
      }}
    />
  )
}

const rowStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '0 16px',
  minHeight: 49,
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text-1)',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
} as const

function MealTotals({ meal, pctOfTarget }: { meal: MealType; pctOfTarget: number | null }) {
  const totals = sumMacros(meal.items)
  const big = { fontFamily: MONO, fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 6 } as const
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 20,
        background: 'linear-gradient(180deg, rgba(var(--accent-rgb),0.09), var(--glass-row))',
        border: '1px solid rgba(var(--accent-rgb),0.14)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 16, alignItems: 'end' }}>
        <div>
          <div style={{ ...macroLabelStyle(MACRO_COLORS.kcal, 10), letterSpacing: '0.2em' }}>KCAL</div>
          <div style={big}>{fmtKcal(totals.kcal)}</div>
        </div>
        <div style={{ height: 44, background: 'linear-gradient(to bottom, transparent, var(--fill-strong), transparent)' }} />
        <div>
          <div style={{ ...macroLabelStyle(MACRO_COLORS.protein, 10), letterSpacing: '0.2em' }}>PROTEIN</div>
          <div style={big}>
            {Math.round(totals.protein_g)}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', letterSpacing: 0, marginLeft: 3 }}>g</span>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 22,
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--line)',
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--text-1)',
        }}
      >
        <span>
          <span style={macroLabelStyle(MACRO_COLORS.carbs)}>CARBS</span> {Math.round(totals.carbs_g)} g
        </span>
        <span>
          <span style={macroLabelStyle(MACRO_COLORS.fat)}>FAT</span> {Math.round(totals.fat_g)} g
        </span>
        {pctOfTarget !== null && <span style={{ marginLeft: 'auto', color: 'var(--text-2)' }}>{pctOfTarget}% OF TARGET</span>}
      </div>
    </div>
  )
}

/** Rename a meal; an empty name, or "Use Claude's name", hands it back. */
function RenameSheet({
  open,
  meal,
  onClose,
  onSave,
}: {
  open: boolean
  meal: MealType
  onClose: () => void
  onSave: (name: string | null) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Rename meal">
      <SheetHeader title="Name this meal" onClose={onClose} />
      {open && <RenameBody meal={meal} onSave={onSave} />}
    </Sheet>
  )
}

function RenameBody({ meal, onSave }: { meal: MealType; onSave: (name: string | null) => void }) {
  const [value, setValue] = useState(meal.name_source === 'user' ? (meal.name ?? '') : mealName(meal))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const name = value.trim()
        onSave(name && !(meal.name_source === 'auto' && name === mealName(meal)) ? name : null)
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Meal name"
        autoFocus
        maxLength={255}
        style={{
          width: '100%',
          height: 46,
          marginTop: 14,
          borderRadius: 12,
          background: 'var(--input)',
          border: '1px solid var(--accent)',
          padding: '0 14px',
          color: 'var(--text-1)',
          fontSize: 16,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <button type="submit" style={{ ...ctaStyle, marginTop: 16 }}>
        Save
      </button>
      {meal.name_source === 'user' && (
        <button
          type="button"
          onClick={() => onSave(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '8px auto 0',
            height: 40,
            border: 'none',
            background: 'transparent',
            color: 'var(--ai)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Use Claude’s name
        </button>
      )}
    </form>
  )
}
