import { themes, THEME_IDS, DEFAULT_THEME, type ThemeId, type ThemeColors } from './themes'

const STORAGE_KEY = 'protocol_theme'

export function getSavedTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && THEME_IDS.includes(stored as ThemeId)) return stored as ThemeId
  } catch {
    // localStorage blocked
  }
  return DEFAULT_THEME
}

export function applyTheme(id: ThemeId): void {
  const t = themes[id]
  if (!t) return

  const root = document.documentElement

  // Set data-theme attribute (drives CSS gradient overrides)
  root.setAttribute('data-theme', id)

  // Apply all CSS custom properties
  for (const [prop, value] of Object.entries(t) as [keyof ThemeColors, string][]) {
    root.style.setProperty(prop, value)
  }

  // Update <meta theme-color> for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t['--base'])

  // Persist
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // localStorage blocked
  }
}

export function initTheme(): void {
  applyTheme(getSavedTheme())
}
