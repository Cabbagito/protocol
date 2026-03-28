export function formatVolume(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return v.toLocaleString()
}
