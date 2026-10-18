import { useState } from 'react'
import type { FoodItem, FoodUnit, MealItem } from '../../types'
import { useAddUnit } from '../../api/hooks'
import { NetworkError } from '../../api/client'
import { useToast } from '../Toast'
import DecimalInput from '../DecimalInput'
import { parseDecimal } from '../../lib/decimal'
import {
  findUnit,
  fmtKcal,
  fmtMacro,
  fmtQty,
  gramsOf,
  itemFor,
  macrosFor,
  per100OfFood,
  per100OfItem,
  unitWord,
} from '../../lib/diet'
import { CloseButton, OfflineNote, Sheet } from './ui'
import { MACRO_COLORS, MONO, ctaStyle, macroLabelStyle } from './styles'

export interface AmountTarget {
  /** The food to measure; null when a logged item's food was deleted. */
  food: FoodItem | null
  /** Editing this logged item (by index in the meal); absent when adding. */
  item?: MealItem
  index?: number
  /** The logged item's food couldn't be loaded (offline): only its logged unit is known. */
  offline?: boolean
}

function startingAmount(target: AmountTarget, units: FoodUnit[]): { unit: string | null; qty: number } {
  const { food, item } = target
  if (item) {
    const unit = findUnit(units, item.unit_name)
    if (unit && item.unit_quantity != null) return { unit: unit.name, qty: item.unit_quantity }
    return { unit: null, qty: Math.round(item.quantity_g ?? 100) }
  }
  const last = food?.last_used
  if (last) {
    const unit = findUnit(units, last.unit_name)
    if (unit && last.unit_quantity != null) return { unit: unit.name, qty: last.unit_quantity }
    if (last.quantity_g != null) return { unit: null, qty: Math.round(last.quantity_g) }
  }
  const first = units[0]
  return first ? { unit: first.name, qty: 1 } : { unit: null, qty: 100 }
}

function step(qty: number, unit: FoodUnit | null, up: boolean): number {
  if (unit) {
    if (up) return qty < 1 ? qty + 0.5 : qty + 1
    return Math.max(0.5, qty <= 1 ? qty - 0.5 : qty - 1)
  }
  const size = qty > 10 || (up && qty >= 10) ? 10 : 1
  return Math.max(1, up ? qty + size : qty - size)
}

const pill = (on: boolean) =>
  ({
    padding: '8px 12px',
    borderRadius: 11,
    border: on ? '1px solid rgba(var(--accent-rgb),0.5)' : '1px solid var(--fill-strong)',
    background: on ? 'rgba(var(--accent-rgb),0.13)' : 'var(--fill-soft)',
    color: on ? 'var(--accent-l)' : 'var(--text-2)',
    fontFamily: MONO,
    fontSize: 11.5,
    cursor: 'pointer',
  }) as const

const nudge = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: 'var(--fill-soft)',
  border: '1px solid rgba(var(--accent-rgb),0.25)',
  color: 'var(--accent-l)',
  fontSize: 20,
  flex: 'none',
  cursor: 'pointer',
} as const

const fieldStyle = {
  height: 40,
  borderRadius: 10,
  background: 'var(--input)',
  border: '1px solid var(--border)',
  color: 'var(--text-1)',
  padding: '0 10px',
  fontSize: 16,
  outline: 'none',
  minWidth: 0,
} as const

/**
 * How much of one food: pick what it's measured in (grams or the food's own
 * units), type one number, see the grams and the macros.
 */
export default function AmountSheet({
  target,
  onClose,
  onDone,
  onRemove,
  onEditProduct,
}: {
  target: AmountTarget | null
  onClose: () => void
  onDone: (item: MealItem, index: number | undefined) => void
  onRemove: (index: number) => void
  onEditProduct?: (food: FoodItem) => void
}) {
  return (
    <Sheet open={!!target} onClose={onClose} label="Amount">
      {target && (
        <AmountBody
          key={`${target.food?.id ?? ''}:${target.index ?? 'new'}`}
          target={target}
          onClose={onClose}
          onDone={onDone}
          onRemove={onRemove}
          onEditProduct={onEditProduct}
        />
      )}
    </Sheet>
  )
}

function AmountBody({
  target,
  onClose,
  onDone,
  onRemove,
  onEditProduct,
}: {
  target: AmountTarget
  onClose: () => void
  onDone: (item: MealItem, index: number | undefined) => void
  onRemove: (index: number) => void
  onEditProduct?: (food: FoodItem) => void
}) {
  const { food, item, index } = target
  const editing = item !== undefined && index !== undefined
  const per100 = food ? per100OfFood(food) : item ? per100OfItem(item) : null

  // A logged item whose food is gone keeps the unit it was logged in.
  const [units, setUnits] = useState<FoodUnit[]>(() => {
    if (food) return food.units
    if (item?.unit_name && item.unit_quantity && item.quantity_g) {
      return [{ id: 'logged', name: item.unit_name, grams: item.quantity_g / item.unit_quantity, user_id: null }]
    }
    return []
  })
  const start = startingAmount(target, units)
  const [unitName, setUnitName] = useState<string | null>(start.unit)
  const [qtyText, setQtyText] = useState(fmtQty(start.qty))
  const [adding, setAdding] = useState(false)

  const unit = findUnit(units, unitName)
  const qty = parseDecimal(qtyText)
  const valid = Number.isFinite(qty) && qty > 0
  const grams = valid ? gramsOf(unit, qty) : 0
  const macros = per100 && valid ? macrosFor(per100, grams) : null
  const name = food?.name ?? item?.name ?? ''

  function pick(next: FoodUnit | null) {
    // Same amount, counted differently.
    if (valid) {
      const converted = next ? grams / next.grams : grams
      setQtyText(fmtQty(next ? Math.max(0.1, converted) : Math.round(converted)))
    }
    setUnitName(next ? next.name : null)
  }

  function done() {
    if (!valid || !per100) return
    if (food) {
      onDone(itemFor(food, unit, qty), index)
    } else if (item) {
      onDone({ ...item, unit_name: unit?.name ?? null, unit_quantity: qty, quantity_g: grams, ...macrosFor(per100, grams) }, index)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>{name}</div>
          {per100 && (
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: '0.06em',
                color: 'var(--text-2)',
                opacity: 0.8,
                marginTop: 5,
              }}
            >
              PER 100 G · {fmtKcal(per100.kcal)} KCAL · {fmtQty(per100.protein_g)} P · {fmtQty(per100.carbs_g)} C ·{' '}
              {fmtQty(per100.fat_g)} F
            </div>
          )}
          {food?.editable && onEditProduct && (
            <button
              type="button"
              onClick={() => onEditProduct(food)}
              style={{
                marginTop: 6,
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: 'var(--accent-l)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Edit product
            </button>
          )}
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {target.offline && per100 && (
        <OfflineNote style={{ marginTop: 12 }}>Offline · units need a connection</OfflineNote>
      )}

      {!per100 ? (
        <div style={{ fontSize: 13, color: 'var(--text-2)', margin: '18px 0 8px' }}>
          Logged without a weight, so it can only be removed.
        </div>
      ) : (
        <>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: 'var(--text-2)',
              opacity: 0.8,
              margin: '18px 0 8px',
            }}
          >
            MEASURED IN
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" aria-pressed={!unit} onClick={() => pick(null)} style={pill(!unit)}>
              grams
            </button>
            {units.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={unit?.id === u.id}
                onClick={() => pick(u)}
                style={pill(unit?.id === u.id)}
              >
                {u.name} · {fmtQty(u.grams)} g
              </button>
            ))}
            {food && !adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                style={{ ...pill(false), border: '1px dashed var(--fill-strong)', background: 'transparent' }}
              >
                + unit
              </button>
            )}
          </div>
          {food && adding && (
            <NewUnitForm
              food={food}
              onCancel={() => setAdding(false)}
              onAdded={(updated, added) => {
                setUnits(updated.units)
                setAdding(false)
                setUnitName(added)
                setQtyText('1')
              }}
            />
          )}

          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 20,
              background: 'linear-gradient(180deg, rgba(var(--accent-rgb),0.10), var(--glass-row))',
              border: '1px solid rgba(var(--accent-rgb),0.16)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                aria-label="Less"
                style={nudge}
                onClick={() => valid && setQtyText(fmtQty(step(qty, unit, false)))}
              >
                −
              </button>
              <label
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 64,
                  borderRadius: 14,
                  background: 'var(--input)',
                  border: '1px solid var(--accent)',
                  boxShadow: '0 0 0 3px rgba(var(--accent-rgb),0.16)',
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 12px 0',
                  boxSizing: 'border-box',
                }}
              >
                <DecimalInput
                  value={qtyText}
                  onChange={setQtyText}
                  aria-label="Amount"
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    width: 110,
                    minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-1)',
                    fontFamily: MONO,
                    fontSize: 40,
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    textAlign: 'right',
                    padding: 0,
                  }}
                />
                <span style={{ fontFamily: MONO, fontSize: 14, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                  {unit ? unitWord(unit.name, valid ? qty : 2) : 'g'}
                </span>
              </label>
              <button
                type="button"
                aria-label="More"
                style={nudge}
                onClick={() => setQtyText(fmtQty(valid ? step(qty, unit, true) : unit ? 1 : 100))}
              >
                +
              </button>
            </div>
            {unit && (
              <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>
                = {valid ? Math.round(grams) : '–'} g
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid var(--line)',
                textAlign: 'center',
              }}
            >
              {(
                [
                  ['KCAL', macros ? fmtKcal(macros.kcal) : '–', MACRO_COLORS.kcal, 'var(--text-1)'],
                  ['PROTEIN', macros ? fmtMacro(macros.protein_g) : '–', MACRO_COLORS.protein, MACRO_COLORS.protein],
                  ['CARBS', macros ? fmtMacro(macros.carbs_g) : '–', MACRO_COLORS.carbs, 'var(--text-1)'],
                  ['FAT', macros ? fmtMacro(macros.fat_g) : '–', MACRO_COLORS.fat, 'var(--text-1)'],
                ] as const
              ).map(([label, value, labelColor, valueColor]) => (
                <div key={label}>
                  <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: valueColor }}>{value}</div>
                  <div style={{ ...macroLabelStyle(labelColor, 8.5), marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={done}
            disabled={!valid}
            style={{ ...ctaStyle, marginTop: 20, opacity: valid ? 1 : 0.5 }}
          >
            {editing ? 'Save' : 'Add to meal'}
          </button>
        </>
      )}
      {editing && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{
            margin: '8px auto 0',
            height: 40,
            padding: '0 14px',
            border: 'none',
            background: 'transparent',
            color: 'var(--danger-soft)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Remove from meal
        </button>
      )}
    </div>
  )
}

/** "+ unit": name it and say what one weighs. Personal to the user. */
function NewUnitForm({
  food,
  onCancel,
  onAdded,
}: {
  food: FoodItem
  onCancel: () => void
  onAdded: (food: FoodItem, unitName: string) => void
}) {
  const [name, setName] = useState('')
  const [gramsText, setGramsText] = useState('')
  const addUnit = useAddUnit()
  const toast = useToast()
  const grams = parseDecimal(gramsText)
  const ok = name.trim().length > 0 && Number.isFinite(grams) && grams > 0

  async function add() {
    if (!ok) return
    try {
      const updated = await addUnit.mutateAsync({ foodId: food.id, unit: { name: name.trim(), grams } })
      onAdded(updated, name.trim())
    } catch (e) {
      toast.showError(
        e instanceof NetworkError
          ? 'Offline · adding a unit needs a connection'
          : e instanceof Error && e.message !== 'Request failed'
            ? e.message
            : 'Failed to add unit',
      )
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="slice, bowl…"
        aria-label="Unit name"
        autoFocus
        maxLength={50}
        style={{ ...fieldStyle, flex: 1 }}
      />
      <label style={{ ...fieldStyle, width: 92, display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px' }}>
        <DecimalInput
          value={gramsText}
          onChange={setGramsText}
          placeholder="0"
          aria-label="Grams in one"
          style={{ width: '100%', minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-1)', fontFamily: MONO, fontSize: 16, textAlign: 'right' }}
        />
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-2)' }}>g</span>
      </label>
      <button
        type="button"
        onClick={add}
        disabled={!ok || addUnit.isPending}
        style={{
          height: 40,
          padding: '0 12px',
          borderRadius: 10,
          background: 'rgba(var(--accent-rgb),0.12)',
          border: '1px solid rgba(var(--accent-rgb),0.28)',
          color: 'var(--accent-l)',
          fontSize: 12,
          fontWeight: 600,
          opacity: ok ? 1 : 0.5,
          cursor: 'pointer',
        }}
      >
        Add
      </button>
      <CloseButton onClick={onCancel} label="Cancel" />
    </div>
  )
}
