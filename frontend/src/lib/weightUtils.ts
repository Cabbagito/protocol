/** Parse a weight string, accepting both comma and dot as decimal separator. */
export function parseWeight(raw: string): number {
  const normalized = raw.replace(',', '.')
  const value = parseFloat(normalized)
  return Number.isFinite(value) ? value : 0
}

/** Format a weight number for display, trimming unnecessary trailing zeros. */
export function formatWeight(v: number): string {
  if (!Number.isFinite(v)) return '0'
  // Round to 1 decimal to avoid floating-point artifacts
  const rounded = Math.round(v * 10) / 10
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}
