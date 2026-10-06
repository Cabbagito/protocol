import { useEffect, useState, useMemo, lazy, Suspense } from 'react'
import {
  useFoods,
  useCreateLog,
  useCreateFood,
  useUpdateFood,
  useBarcodeLookup,
  type FoodItemPayload,
} from '../api/hooks'
import { useToast } from './Toast'
import { useScrollLock } from '../hooks/useScrollLock'
import SearchInput from './SearchInput'
import PageLoader from './PageLoader'
import { round1 } from '../lib/formatters'
import type { FoodItem, FoodDraft } from '../types'

const BarcodeScanner = lazy(() => import('./BarcodeScanner'))

interface AddFoodSheetProps {
  open: boolean
  onClose: () => void
  date: string
}

type Tab = 'search' | 'scan' | 'custom'

export default function AddFoodSheet({ open, onClose, date }: AddFoodSheetProps) {
  const [tab, setTab] = useState<Tab>('search')

  useScrollLock(open)

  useEffect(() => {
    if (!open) setTab('search')
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[102] flex flex-col">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      <div
        className="relative flex flex-col ml-auto mr-auto w-full max-w-lg mt-auto rounded-t-2xl slide-up"
        style={{
          background: 'var(--base)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top) - 24px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--border)]">
          <div className="text-sm font-semibold text-[var(--text-1)]">Log food</div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3">
          <div className="flex panel-frosted">
            <TabButton label="Search" active={tab === 'search'} onClick={() => setTab('search')} />
            <TabButton label="Scan" active={tab === 'scan'} onClick={() => setTab('scan')} />
            <TabButton label="Custom" active={tab === 'custom'} onClick={() => setTab('custom')} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {tab === 'search' ? (
            <SearchTab date={date} onLogged={onClose} />
          ) : tab === 'scan' ? (
            <ScanTab date={date} onLogged={onClose} onCancel={() => setTab('search')} />
          ) : (
            <CustomTab date={date} onLogged={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2 text-[12px] font-semibold uppercase tracking-wider rounded-md transition-all"
      style={{
        background: active ? 'var(--card)' : 'transparent',
        color: active ? 'var(--text-1)' : 'var(--text-m)',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      {label}
    </button>
  )
}

// --- Search Tab ---

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function SearchTab({ date, onLogged }: { date: string; onLogged: () => void }) {
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 200)
  const { data: foods = [], isLoading } = useFoods(debounced)
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [editing, setEditing] = useState<FoodItem | null>(null)

  return (
    <div className="space-y-3">
      <SearchInput value={query} onChange={setQuery} placeholder="Search foods..." />

      {editing ? (
        <EditFoodForm
          food={editing}
          onBack={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : selected ? (
        <SelectedFoodForm
          food={selected}
          date={date}
          onBack={() => setSelected(null)}
          onLogged={onLogged}
        />
      ) : isLoading ? (
        <PageLoader />
      ) : foods.length === 0 ? (
        <div className="text-[var(--text-2)] text-center py-8 text-sm">
          {query ? 'No matches. Try the Custom tab.' : 'Start typing to search.'}
        </div>
      ) : (
        <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {foods.map((food, idx) => (
            <button
              key={food.id}
              onClick={() => setSelected(food)}
              className="list-row w-full text-left flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: idx === foods.length - 1 ? 'none' : '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--text-1)] truncate">{food.name}</div>
                <div className="mono text-[11px] text-[var(--text-m)] mt-0.5">
                  {Math.round(food.kcal_per_100g)} kcal · {food.protein_per_100g}P · {food.carbs_per_100g}C · {food.fat_per_100g}F
                  <span className="ml-1">/ 100g</span>
                </div>
              </div>
              {!food.seeded && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing(food)
                  }}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-m)]"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                  aria-label={`Edit ${food.name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectedFoodForm({
  food,
  date,
  onBack,
  onLogged,
}: {
  food: FoodItem
  date: string
  onBack: () => void
  onLogged: () => void
}) {
  const toast = useToast()
  const createLog = useCreateLog()
  const [quantity, setQuantity] = useState<string>(String(food.default_serving_g ?? 100))

  const grams = useMemo(() => {
    const n = parseFloat(quantity)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [quantity])

  const preview = useMemo(() => {
    const ratio = grams / 100
    return {
      kcal: food.kcal_per_100g * ratio,
      protein_g: food.protein_per_100g * ratio,
      carbs_g: food.carbs_per_100g * ratio,
      fat_g: food.fat_per_100g * ratio,
    }
  }, [grams, food])

  const canSubmit = grams > 0 && !createLog.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    try {
      await createLog.mutateAsync({
        logged_on: date,
        food_item_id: food.id,
        name: food.name,
        quantity_g: grams,
        kcal: round1(preview.kcal),
        protein_g: round1(preview.protein_g),
        carbs_g: round1(preview.carbs_g),
        fat_g: round1(preview.fat_g),
      })
      onLogged()
    } catch {
      toast.showError('Failed to log food')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text-1)] truncate">{food.name}</div>
          <div className="mono text-[11px] text-[var(--text-m)] mt-0.5">
            {Math.round(food.kcal_per_100g)} kcal / 100g
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-[11px] text-[var(--accent-l)] font-medium shrink-0"
        >
          Change
        </button>
      </div>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-m)]">
          Quantity (g)
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="input mt-1"
          autoFocus
        />
      </label>

      <div className="flex items-baseline justify-between pt-1 border-t border-[var(--border)]">
        <div>
          <div className="mono text-2xl font-bold text-[var(--text-1)]">
            {Math.round(preview.kcal)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-m)]">kcal</div>
        </div>
        <div className="mono text-[11px] text-[var(--text-2)]">
          {round1(preview.protein_g)}P · {round1(preview.carbs_g)}C · {round1(preview.fat_g)}F
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {createLog.isPending ? 'Saving...' : 'Add to log'}
      </button>
    </form>
  )
}

// --- Scan Tab ---

type ScanStep =
  | { step: 'scanning' }
  | { step: 'looking-up' }
  | { step: 'log'; food: FoodItem }
  | { step: 'create'; draft: FoodDraft }

function ScanTab({
  date,
  onLogged,
  onCancel,
}: {
  date: string
  onLogged: () => void
  onCancel: () => void
}) {
  const toast = useToast()
  const lookup = useBarcodeLookup()
  const [state, setState] = useState<ScanStep>({ step: 'scanning' })

  async function handleDetected(barcode: string) {
    setState({ step: 'looking-up' })
    try {
      const result = await lookup.mutateAsync(barcode)
      if (result.status === 'found' && result.food) {
        setState({ step: 'log', food: result.food })
      } else {
        setState({ step: 'create', draft: result.draft ?? emptyDraft(barcode) })
      }
    } catch {
      toast.showError('Lookup failed')
      setState({ step: 'scanning' })
    }
  }

  if (state.step === 'scanning') {
    return (
      <Suspense fallback={<PageLoader />}>
        <BarcodeScanner onDetected={handleDetected} onClose={onCancel} />
      </Suspense>
    )
  }

  if (state.step === 'looking-up') return <PageLoader />

  if (state.step === 'log') {
    return (
      <SelectedFoodForm
        food={state.food}
        date={date}
        onBack={() => setState({ step: 'scanning' })}
        onLogged={onLogged}
      />
    )
  }

  return (
    <CreateFoodForm
      draft={state.draft}
      onBack={() => setState({ step: 'scanning' })}
      onCreated={(food) => setState({ step: 'log', food })}
    />
  )
}

function emptyDraft(barcode: string): FoodDraft {
  return {
    barcode,
    name: null,
    brand: null,
    kcal_per_100g: null,
    protein_per_100g: null,
    carbs_per_100g: null,
    fat_per_100g: null,
    default_serving_g: null,
  }
}

// --- Food item create/edit forms ---

interface FoodFormValues {
  name: string
  brand: string
  kcal: string
  protein: string
  carbs: string
  fat: string
  serving: string
}

function CreateFoodForm({
  draft,
  onBack,
  onCreated,
}: {
  draft: FoodDraft
  onBack: () => void
  onCreated: (food: FoodItem) => void
}) {
  const toast = useToast()
  const createFood = useCreateFood()

  async function handleSubmit(payload: FoodItemPayload) {
    try {
      const food = await createFood.mutateAsync({ ...payload, barcode: draft.barcode })
      onCreated(food)
    } catch {
      toast.showError('Failed to save food')
    }
  }

  return (
    <FoodItemForm
      title="New food"
      subtitle="Not in the database yet — enter the label values"
      barcode={draft.barcode}
      initial={{
        name: draft.name ?? '',
        brand: draft.brand ?? '',
        kcal: draft.kcal_per_100g != null ? String(draft.kcal_per_100g) : '',
        protein: draft.protein_per_100g != null ? String(draft.protein_per_100g) : '',
        carbs: draft.carbs_per_100g != null ? String(draft.carbs_per_100g) : '',
        fat: draft.fat_per_100g != null ? String(draft.fat_per_100g) : '',
        serving: draft.default_serving_g != null ? String(draft.default_serving_g) : '',
      }}
      pending={createFood.isPending}
      submitLabel="Save food"
      onBack={onBack}
      onSubmit={handleSubmit}
    />
  )
}

function EditFoodForm({
  food,
  onBack,
  onSaved,
}: {
  food: FoodItem
  onBack: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const updateFood = useUpdateFood()

  async function handleSubmit(payload: FoodItemPayload) {
    try {
      await updateFood.mutateAsync({ id: food.id, data: payload })
      onSaved()
    } catch {
      toast.showError('Failed to update food')
    }
  }

  return (
    <FoodItemForm
      title={`Edit ${food.name}`}
      barcode={food.barcode}
      initial={{
        name: food.name,
        brand: food.brand ?? '',
        kcal: String(food.kcal_per_100g),
        protein: String(food.protein_per_100g),
        carbs: String(food.carbs_per_100g),
        fat: String(food.fat_per_100g),
        serving: food.default_serving_g != null ? String(food.default_serving_g) : '',
      }}
      pending={updateFood.isPending}
      submitLabel="Save changes"
      onBack={onBack}
      onSubmit={handleSubmit}
    />
  )
}

function FoodItemForm({
  title,
  subtitle,
  barcode,
  initial,
  pending,
  submitLabel,
  onBack,
  onSubmit,
}: {
  title: string
  subtitle?: string
  barcode: string | null
  initial: FoodFormValues
  pending: boolean
  submitLabel: string
  onBack: () => void
  onSubmit: (payload: FoodItemPayload) => void
}) {
  const [values, setValues] = useState<FoodFormValues>(initial)
  const set = (key: keyof FoodFormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }))

  const p = parseNum(values.protein)
  const c = parseNum(values.carbs)
  const f = parseNum(values.fat)
  const macrosValid = [p, c, f].every((n) => Number.isFinite(n) && n >= 0)
  // Blank kcal derives from macros (4/4/9); an explicit label value wins.
  const kcalInput = parseNum(values.kcal)
  const kcal = values.kcal.trim()
    ? kcalInput
    : macrosValid
      ? round1(p * 4 + c * 4 + f * 9)
      : NaN
  const serving = values.serving.trim() ? parseNum(values.serving) : null

  const canSubmit =
    values.name.trim().length > 0 &&
    macrosValid &&
    Number.isFinite(kcal) &&
    kcal >= 0 &&
    (serving === null || (Number.isFinite(serving) && serving > 0)) &&
    !pending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      name: values.name.trim(),
      brand: values.brand.trim() || null,
      kcal_per_100g: kcal,
      protein_per_100g: p,
      carbs_per_100g: c,
      fat_per_100g: f,
      default_serving_g: serving,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text-1)] truncate">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-[var(--text-m)] mt-0.5">{subtitle}</div>
          )}
          {barcode && (
            <div className="mono text-[11px] text-[var(--text-m)] mt-0.5">{barcode}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-[11px] text-[var(--accent-l)] font-medium shrink-0"
        >
          Back
        </button>
      </div>

      <input
        type="text"
        value={values.name}
        onChange={(e) => set('name')(e.target.value)}
        placeholder="Name"
        className="input"
        autoFocus={!values.name}
      />
      <input
        type="text"
        value={values.brand}
        onChange={(e) => set('brand')(e.target.value)}
        placeholder="Brand (optional)"
        className="input"
      />
      <div className="grid grid-cols-3 gap-2">
        <MacroField label="Protein (g)" value={values.protein} onChange={set('protein')} />
        <MacroField label="Carbs (g)" value={values.carbs} onChange={set('carbs')} />
        <MacroField label="Fat (g)" value={values.fat} onChange={set('fat')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MacroField label="Kcal / 100g" value={values.kcal} onChange={set('kcal')} />
        <MacroField label="Serving (g)" value={values.serving} onChange={set('serving')} />
      </div>
      <div className="text-[10px] text-[var(--text-m)]">
        Values per 100g. Leave kcal blank to derive 4·P + 4·C + 9·F.
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {pending ? 'Saving...' : submitLabel}
      </button>
    </form>
  )
}

// --- Custom Tab ---

function CustomTab({ date, onLogged }: { date: string; onLogged: () => void }) {
  const toast = useToast()
  const createLog = useCreateLog()
  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  const p = parseNum(protein)
  const c = parseNum(carbs)
  const f = parseNum(fat)
  const kcal = (Number.isFinite(p) ? p : 0) * 4 + (Number.isFinite(c) ? c : 0) * 4 + (Number.isFinite(f) ? f : 0) * 9

  const canSubmit =
    name.trim().length > 0 &&
    (Number.isFinite(p) && p >= 0) &&
    (Number.isFinite(c) && c >= 0) &&
    (Number.isFinite(f) && f >= 0) &&
    !createLog.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    try {
      await createLog.mutateAsync({
        logged_on: date,
        food_item_id: null,
        quantity_g: null,
        name: name.trim(),
        kcal: round1(kcal),
        protein_g: p,
        carbs_g: c,
        fat_g: f,
      })
      onLogged()
    } catch {
      toast.showError('Failed to log food')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (e.g. Protein shake)"
        className="input"
        autoFocus
      />
      <div className="grid grid-cols-3 gap-2">
        <MacroField label="Protein (g)" value={protein} onChange={setProtein} />
        <MacroField label="Carbs (g)" value={carbs} onChange={setCarbs} />
        <MacroField label="Fat (g)" value={fat} onChange={setFat} />
      </div>
      <div className="flex items-baseline justify-between pt-1 border-t border-[var(--border)]">
        <div>
          <div className="mono text-2xl font-bold text-[var(--text-1)]">
            {Math.round(kcal)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-m)]">kcal</div>
        </div>
        <div className="text-[10px] text-[var(--text-m)]">
          4·P + 4·C + 9·F
        </div>
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {createLog.isPending ? 'Saving...' : 'Add to log'}
      </button>
    </form>
  )
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-m)]">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1"
      />
    </label>
  )
}

function parseNum(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}
