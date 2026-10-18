import { useEffect, useRef, useState } from 'react'
import { useFoods } from '../../api/hooks'
import type { FoodItem } from '../../types'
import { amountLabel, fmtKcal } from '../../lib/diet'
import { BarcodeIcon, ChevronRight, SearchIcon } from './ui'
import { MONO, accentChipStyle, glassRow } from './styles'

const RECENT_LIMIT = 8

function kind(food: FoodItem): string {
  if (food.seeded) return 'Common food'
  if (food.barcode) return 'Product'
  return 'Yours'
}

function meta(food: FoodItem): string {
  const last = food.last_used ? amountLabel(food.last_used) : null
  const detail = last ? `last time ${last}` : `per 100 g ${fmtKcal(food.kcal_per_100g)} kcal`
  return `${kind(food)} · ${detail}`
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/**
 * "Add the next food": search box with the scanner inside it, results below
 * (recent foods while the box is empty), and the way to a new product.
 */
export default function FoodSearch({
  onPick,
  onScan,
  onNewProduct,
  autoFocus,
  resetKey,
}: {
  onPick: (food: FoodItem) => void
  onScan: () => void
  onNewProduct: () => void
  autoFocus?: boolean
  /** Changes when a food was added, which clears the box. */
  resetKey: number
}) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const query = useDebounced(q.trim(), 200)
  const { data, isFetching } = useFoods(query)

  useEffect(() => {
    setQ('')
  }, [resetKey])

  const results = (data ?? []).filter((f) => (query ? true : f.last_used !== null)).slice(0, query ? 30 : RECENT_LIMIT)
  const searched = query.length > 0

  return (
    <div>
      <label
        style={{
          height: 46,
          borderRadius: 12,
          background: 'var(--input)',
          border: '1px solid var(--accent)',
          boxShadow: '0 0 0 3px rgba(var(--accent-rgb),0.18)',
          padding: '0 6px 0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--text-2)',
        }}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search foods"
          aria-label="Search foods"
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-1)',
            fontSize: 16,
          }}
        />
        <button
          type="button"
          onClick={onScan}
          aria-label="Scan a barcode"
          style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'var(--accent-l)', cursor: 'pointer' }}
        >
          <BarcodeIcon />
        </button>
      </label>

      {results.length > 0 && (
        <div style={{ ...glassRow, marginTop: 8, padding: '0 14px' }}>
          {!searched && (
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--text-2)', opacity: 0.7, padding: '10px 0 2px' }}>
              RECENT
            </div>
          )}
          {results.map((food, i) => (
            <button
              key={food.id}
              type="button"
              onClick={() => onPick(food)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 0',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                background: 'transparent',
                color: 'var(--text-1)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>
                  {food.name}
                  {food.brand && <span style={{ color: 'var(--text-2)', fontWeight: 400 }}> · {food.brand}</span>}
                </span>
                <span style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, color: 'var(--text-2)', opacity: 0.8, marginTop: 3 }}>
                  {meta(food)}
                </span>
              </span>
              <span style={{ color: 'var(--text-2)', display: 'grid' }}>
                <ChevronRight />
              </span>
            </button>
          ))}
        </div>
      )}
      {searched && !isFetching && results.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '12px 2px 0' }}>No foods match “{query}”.</div>
      )}

      <div
        style={{
          marginTop: 10,
          padding: '12px 14px',
          borderRadius: 14,
          border: '1px dashed var(--fill-strong)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)' }}>Not in the list? Add it from the pack.</span>
        <button
          type="button"
          onClick={onNewProduct}
          style={{ ...accentChipStyle, padding: '7px 11px', fontSize: 12, fontWeight: 600 }}
        >
          New product
        </button>
      </div>
    </div>
  )
}
