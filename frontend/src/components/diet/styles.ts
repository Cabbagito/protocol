/** Style constants shared by the Diet screens (tokens only). */
import type { CSSProperties } from 'react'

export const MONO = "'JetBrains Mono', 'SF Mono', ui-monospace, monospace"

export const eyebrowStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--text-m)',
}

/** Tiny macro label: KCAL, PROTEIN, CARBS, FAT. */
export function macroLabelStyle(color: string, size = 9): CSSProperties {
  return { fontFamily: MONO, fontSize: size, fontWeight: 600, letterSpacing: '0.16em', color }
}

export const MACRO_COLORS = {
  kcal: 'var(--accent-l)',
  protein: 'var(--macro-protein-l)',
  carbs: 'var(--macro-carbs-l)',
  fat: 'var(--macro-fat-l)',
}

export const glassRow: CSSProperties = {
  borderRadius: 16,
  background: 'var(--glass-row)',
  border: '1px solid var(--line)',
}

export const ctaStyle: CSSProperties = {
  width: '100%',
  height: 54,
  border: 'none',
  borderRadius: 16,
  background: 'var(--p-grad-cta)',
  color: 'var(--btn-text)',
  fontFamily: MONO,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '0.04em',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  cursor: 'pointer',
  boxShadow: '0 14px 40px -10px rgba(var(--accent-rgb), 0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
}

export const accentChipStyle: CSSProperties = {
  borderRadius: 10,
  background: 'rgba(var(--accent-rgb), 0.12)',
  border: '1px solid rgba(var(--accent-rgb), 0.28)',
  color: 'var(--accent-l)',
  cursor: 'pointer',
}


/** A day cell's look: shared by the week strip and the month calendar. */
export function dayCellStyle(opts: { selected: boolean; future: boolean; empty: boolean }) {
  const { selected, future, empty } = opts
  return {
    background: selected ? 'var(--p-grad-cta)' : future ? 'transparent' : 'var(--fill-soft)',
    border:
      selected || future ? '1px solid transparent' : empty ? '1px dashed var(--fill-strong)' : '1px solid var(--line)',
    color: selected ? 'var(--btn-text)' : 'var(--text-2)',
    track: selected ? 'color-mix(in oklab, var(--btn-text) 30%, transparent)' : future ? 'transparent' : 'var(--fill)',
    bar: selected ? 'var(--btn-text)' : 'var(--accent-l)',
    opacity: future ? 0.35 : 1,
  }
}
