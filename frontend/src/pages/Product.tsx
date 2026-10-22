import { useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BarcodeScanner from '../components/BarcodeScanner'
import DecimalInput from '../components/DecimalInput'
import PageLoader from '../components/PageLoader'
import { useToast } from '../components/Toast'
import UnitList, { type UnitRow } from '../components/diet/UnitList'
import { AiSpinner, BarcodeIcon, CameraIcon, ChevronLeft, Chrome, ChromeButton, CloseIcon, SectionLabel, SparkleIcon } from '../components/diet/ui'
import { MACRO_COLORS, MONO, ctaStyle, glassRow } from '../components/diet/styles'
import { ApiError } from '../api/client'
import { useBarcodeLookup, useCreateFood, useFood, useReadLabel, useUpdateFood } from '../api/hooks'
import { parseDecimal } from '../lib/decimal'
import { fmtQty } from '../lib/diet'
import { shrinkImage, type ShrunkImage } from '../lib/images'
import { useBack } from '../lib/navigation'
import type { FoodDraft, FoodInput, FoodItem } from '../types'

const MAX_PHOTOS = 4
const PHOTO_LABELS = ['FRONT', 'NUTRITION', 'PHOTO 3', 'PHOTO 4']

type FieldKey = 'name' | 'brand' | 'kcal' | 'protein' | 'carbs' | 'fat'
type Fields = Record<FieldKey, string>

const EMPTY: Fields = { name: '', brand: '', kcal: '', protein: '', carbs: '', fat: '' }

/** Under the photos: the read button, and Claude at work while it reads. */
const aiBar: CSSProperties = {
  marginTop: 10,
  width: '100%',
  height: 40,
  borderRadius: 12,
  background: 'rgba(var(--ai-rgb),0.12)',
  border: '1px solid rgba(var(--ai-rgb),0.35)',
  color: 'var(--ai)',
  fontSize: 13,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

function num(n: number | null | undefined): string {
  return n == null ? '' : fmtQty(n)
}

function fieldsOf(source: FoodDraft | FoodItem | null | undefined): Fields {
  if (!source) return EMPTY
  return {
    name: source.name ?? '',
    brand: source.brand ?? '',
    kcal: num(source.kcal_per_100g),
    protein: num(source.protein_per_100g),
    carbs: num(source.carbs_per_100g),
    fat: num(source.fat_per_100g),
  }
}

function rowsOf(units: { name: string; grams: number }[], read: boolean): UnitRow[] {
  return units.map((u) => ({ key: crypto.randomUUID(), name: u.name, grams: fmtQty(u.grams), read }))
}

/** "5901234123457" → "5 901234 123457" (EAN-13 groups); other lengths as is. */
function formatBarcode(code: string): string {
  return code.length === 13 ? `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}` : code
}

/** Where to go once the product is saved: back to the meal, measuring it. */
function withAdd(back: string, foodId: string): string {
  const url = new URL(back, window.location.origin)
  url.searchParams.set('add', foodId)
  return url.pathname + url.search
}

/**
 * New product (/diet/products/new?barcode=&back=) from photos of the pack,
 * or a correction of one (/diet/products/:id). Claude's reading is marked
 * until it's changed; everything stays editable.
 */
export default function ProductPage() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const { data: food, isLoading } = useFood(isNew ? null : id)
  if (!isNew && isLoading) return <PageLoader className="min-h-[60vh]" />
  return <ProductForm key={id} food={isNew ? null : (food ?? null)} />
}

function ProductForm({ food }: { food: FoodItem | null }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const backTo = params.get('back')?.startsWith('/diet') ? params.get('back')! : '/diet'
  const back = useBack(backTo)

  const draft = (location.state as { draft?: FoodDraft | null } | null)?.draft ?? null
  const [barcode, setBarcode] = useState<string | null>(food?.barcode ?? params.get('barcode') ?? draft?.barcode ?? null)
  const [fields, setFields] = useState<Fields>(() => fieldsOf(food ?? draft))
  const [read, setRead] = useState<Set<FieldKey>>(new Set())
  const [units, setUnits] = useState<UnitRow[]>(() =>
    rowsOf(food ? food.units.filter((u) => u.user_id === null) : (draft?.units ?? []), false),
  )
  const [photos, setPhotos] = useState<ShrunkImage[]>([])
  const [readCount, setReadCount] = useState(0)
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const readLabel = useReadLabel()
  const createFood = useCreateFood()
  const updateFood = useUpdateFood()
  const lookup = useBarcodeLookup()

  function setField(key: FieldKey, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
    setRead((r) => {
      const next = new Set(r)
      next.delete(key)
      return next
    })
  }

  async function readPhotos(images: ShrunkImage[]) {
    setReadCount(images.length)
    try {
      const result = await readLabel.mutateAsync(images.map(({ media_type, data }) => ({ media_type, data })))
      const next = fieldsOf(result)
      const filled = (Object.keys(next) as FieldKey[]).filter((k) => next[k] !== '')
      setFields((f) => ({ ...f, ...Object.fromEntries(filled.map((k) => [k, next[k]])) }))
      setRead(new Set(filled))
      if (result.units.length > 0) {
        setUnits((rows) => {
          const keep = rows.filter((r) => !result.units.some((u) => u.name.toLowerCase() === r.name.trim().toLowerCase()))
          return [...rowsOf(result.units, true), ...keep.filter((r) => r.name.trim() !== '')]
        })
      }
    } catch (e) {
      setReadCount(0) // offer the button again
      toast.showError(
        e instanceof ApiError && e.status === 503 ? 'Reading labels is not set up' : 'Could not read the photos',
      )
    }
  }

  async function addPhoto(file: File) {
    try {
      const image = await shrinkImage(file)
      const next = [...photos, image].slice(0, MAX_PHOTOS)
      setPhotos(next)
      // Front and nutrition table: enough to read.
      if (next.length === 2) readPhotos(next)
    } catch {
      toast.showError('Could not open the photo')
    }
  }

  async function rescanned(code: string) {
    setScanning(false)
    try {
      const result = await lookup.mutateAsync(code)
      if (result.status === 'found' && result.food && !food) {
        // Already known: measure that one instead.
        navigate(withAdd(backTo, result.food.id), { replace: true })
        return
      }
      setBarcode(code)
      if (result.draft) {
        const known = fieldsOf(result.draft)
        setFields((f) => {
          const merged = { ...f }
          for (const k of Object.keys(known) as FieldKey[]) if (!merged[k] && known[k]) merged[k] = known[k]
          return merged
        })
      }
    } catch {
      toast.showError('Failed to look up the barcode')
    }
  }

  const numbers = {
    kcal: parseDecimal(fields.kcal),
    protein: parseDecimal(fields.protein),
    carbs: parseDecimal(fields.carbs),
    fat: parseDecimal(fields.fat),
  }
  const unitRows = units.filter((u) => u.name.trim() !== '' || u.grams !== '')
  const unitsOk =
    unitRows.every((u) => u.name.trim() && parseDecimal(u.grams) > 0 && !/^(g|grams?)$/i.test(u.name.trim())) &&
    new Set(unitRows.map((u) => u.name.trim().toLowerCase())).size === unitRows.length
  const valid =
    fields.name.trim() !== '' && Object.values(numbers).every((n) => Number.isFinite(n) && n >= 0) && unitsOk
  const saving = createFood.isPending || updateFood.isPending

  async function save() {
    if (!valid || saving) return
    const data: FoodInput = {
      name: fields.name.trim(),
      brand: fields.brand.trim() || null,
      kcal_per_100g: numbers.kcal,
      protein_per_100g: numbers.protein,
      carbs_per_100g: numbers.carbs,
      fat_per_100g: numbers.fat,
      units: unitRows.map((u) => ({ name: u.name.trim(), grams: parseDecimal(u.grams) })),
    }
    try {
      if (food) {
        await updateFood.mutateAsync({ id: food.id, data })
        back()
      } else {
        const created = await createFood.mutateAsync({ ...data, barcode })
        navigate(withAdd(backTo, created.id), { replace: true })
      }
    } catch {
      toast.showError('Failed to save product')
    }
  }

  const reading = readLabel.isPending
  const showReadButton = photos.length > 0 && !reading && readCount !== photos.length

  return (
    <div style={{ padding: '12px 22px 0' }}>
      <Chrome
        left={
          <ChromeButton label="Back to the meal" onClick={back}>
            <ChevronLeft />
          </ChromeButton>
        }
        eyebrow={food ? 'Product' : 'For this meal'}
        title={food ? 'Edit product' : 'New product'}
      />

      {!food && (
        <>
          <SectionLabel first hint="front · nutrition">
            Photos of the pack
          </SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {photos.map((photo, i) => (
              <div
                key={i}
                style={{ position: 'relative', height: 128, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--deep)' }}
              >
                <img src={photo.url} alt={`Photo ${i + 1} of the pack`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span
                  style={{
                    position: 'absolute',
                    left: 6,
                    bottom: 6,
                    fontFamily: MONO,
                    fontSize: 8.5,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    color: '#fff',
                    background: 'rgba(0,0,0,0.55)',
                    padding: '2px 5px',
                    borderRadius: 4,
                  }}
                >
                  {PHOTO_LABELS[i]}
                </span>
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <CloseIcon size={10} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  height: 128,
                  borderRadius: 14,
                  border: '1px dashed var(--fill-strong)',
                  background: 'transparent',
                  color: 'var(--accent-l)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <CameraIcon />
                {photos.length === 0 ? 'Photo of the front' : photos.length === 1 ? 'Nutrition table' : 'Add photo'}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) addPhoto(file)
            }}
          />
          {reading && (
            <div role="status" style={aiBar}>
              <AiSpinner size={14} />
              Reading the photos…
            </div>
          )}
          {showReadButton && (
            <button type="button" onClick={() => readPhotos(photos)} style={{ ...aiBar, cursor: 'pointer' }}>
              <SparkleIcon />
              {readCount > 0 ? 'Read the photos again' : photos.length === 1 ? 'Read this photo' : 'Read the photos'}
            </button>
          )}
        </>
      )}

      {(barcode || !food) && (
        <>
          <SectionLabel first={!!food}>Barcode</SectionLabel>
          <div style={{ ...glassRow, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
            <span style={{ color: 'var(--accent-l)', display: 'grid' }}>
              <BarcodeIcon size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {barcode ? (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '0.06em' }}>{formatBarcode(barcode)}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>
                    {food ? 'Shared with everyone who scans it' : 'Scanned · not in the food database yet'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>None · only you will see this food</div>
              )}
            </div>
            {!food && (
              <button
                type="button"
                onClick={() => setScanning(true)}
                style={{ border: 'none', background: 'transparent', color: 'var(--accent-l)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {barcode ? 'Rescan' : 'Scan'}
              </button>
            )}
          </div>
        </>
      )}

      {(read.size > 0 || reading) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            margin: '22px 0 10px',
            fontFamily: MONO,
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: 'var(--ai)',
          }}
        >
          {reading ? <AiSpinner /> : <SparkleIcon />}
          {reading ? 'READING THE PHOTOS…' : 'READ FROM THE PHOTOS · CHECK THEM'}
        </div>
      )}
      {read.size === 0 && !reading && <SectionLabel first={!!food && !barcode}>Product</SectionLabel>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px', gap: 6 }}>
        <Field label="NAME" read={read.has('name')}>
          <input value={fields.name} onChange={(e) => setField('name', e.target.value)} aria-label="Name" maxLength={255} style={textInput} />
        </Field>
        <Field label="BRAND" read={read.has('brand')}>
          <input value={fields.brand} onChange={(e) => setField('brand', e.target.value)} aria-label="Brand" maxLength={100} style={textInput} />
        </Field>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--text-2)', opacity: 0.8, margin: '14px 0 6px' }}>
        PER 100 G
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
        {(
          [
            ['kcal', 'KCAL', MACRO_COLORS.kcal, 'Kcal per 100 g'],
            ['protein', 'PROT', MACRO_COLORS.protein, 'Protein per 100 g'],
            ['carbs', 'CARB', MACRO_COLORS.carbs, 'Carbs per 100 g'],
            ['fat', 'FAT', MACRO_COLORS.fat, 'Fat per 100 g'],
          ] as const
        ).map(([key, label, color, aria]) => (
          <Field key={key} label={label} color={color} read={read.has(key)}>
            <DecimalInput
              value={fields[key]}
              onChange={(v) => setField(key, v)}
              aria-label={aria}
              placeholder="0"
              style={{ ...textInput, fontFamily: MONO, fontWeight: 600 }}
            />
          </Field>
        ))}
      </div>

      <SectionLabel hint="how you count it">Units</SectionLabel>
      <UnitList rows={units} onChange={setUnits} />

      <button type="button" onClick={save} disabled={!valid || saving} style={{ ...ctaStyle, marginTop: 24, opacity: valid ? 1 : 0.5 }}>
        {food ? 'Save' : 'Save product'}
      </button>
      {!food && (
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-2)', opacity: 0.7, textAlign: 'center', margin: '10px 0 8px' }}>
          THEN PICK HOW MUCH YOU ATE
        </div>
      )}

      {scanning && <BarcodeScanner onDetected={rescanned} onClose={() => setScanning(false)} />}
    </div>
  )
}

const textInput = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--text-1)',
  fontSize: 16,
  padding: 0,
  marginTop: 3,
} as const

function Field({
  label,
  color = 'var(--text-2)',
  read,
  children,
}: {
  label: string
  color?: string
  read: boolean
  children: React.ReactNode
}) {
  return (
    <label
      style={{
        display: 'block',
        padding: '8px 10px',
        borderRadius: 11,
        background: 'var(--input)',
        border: `1px solid ${read ? 'rgba(var(--ai-rgb),0.35)' : 'var(--border)'}`,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'block', fontFamily: MONO, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color }}>{label}</span>
      {children}
    </label>
  )
}
