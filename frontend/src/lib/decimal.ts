/**
 * Normalize typed decimal text: accept "," as the decimal separator
 * (European keyboards), keep digits and a single ".".
 */
export function sanitizeDecimal(raw: string): string {
  const s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  return dot === -1 ? s : s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
}

/** Parse sanitized decimal text; blank or invalid → NaN. */
export function parseDecimal(s: string): number {
  if (s.trim() === '' || s === '.') return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
