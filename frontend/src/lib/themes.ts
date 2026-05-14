// ─── Theme Definitions ───────────────────────────────────────────
// Single source of truth for all theme palettes.
// Edit ONLY this file to tweak any theme's colors.
// Keep in sync with the blocking <script> in index.html.
// ──────────────────────────────────────────────────────────────────

export const THEME_IDS = [
  'dark', 'black', 'white', 'cyan', 'violet', 'gradient',
  'midnight', 'forest', 'crimson', 'mono',
] as const
export type ThemeId = (typeof THEME_IDS)[number]
export const DEFAULT_THEME: ThemeId = 'dark'

export interface ThemeColors {
  '--deep': string
  '--base': string
  '--card': string
  '--panel': string
  '--input': string
  '--border': string
  '--text-1': string
  '--text-2': string
  '--text-m': string
  '--accent-l': string
  '--accent': string
  '--accent-d': string
  '--accent-rgb': string
  '--nav-bg': string
  '--shadow': string
  '--vignette': string
  '--check-color': string
  '--btn-text': string
  '--logo-bg': string
  // v5 — brand gradient and aurora wave colors
  '--p-grad': string
  '--wave-c1': string
  '--wave-c2': string
  '--wave-c3': string
  '--wave-c4': string
}

export const themes: Record<ThemeId, ThemeColors> = {
  // ── Dark (default) ─────────────────────────────────────────
  dark: {
    '--deep': '#070d15',
    '--base': '#0d1b2a',
    '--card': '#0f1d2e',
    '--panel': '#132438',
    '--input': '#162a3e',
    '--border': '#1e3a52',
    '--text-1': '#e2e8f0',
    '--text-2': '#cbd5e1',
    '--text-m': '#475569',
    '--accent-l': '#38bdf8',
    '--accent': '#0ea5e9',
    '--accent-d': '#0284c7',
    '--accent-rgb': '14,165,233',
    '--nav-bg': 'rgba(13,27,42,0.95)',
    '--shadow': 'rgba(0,0,0,0.3)',
    '--vignette': '#070d15',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#0f172a',
    '--p-grad': 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #8b5cf6 100%)',
    '--wave-c1': '#0ea5e9',
    '--wave-c2': '#8b5cf6',
    '--wave-c3': '#22d3ee',
    '--wave-c4': '#ec4899',
  },

  // ── Black (AMOLED) ────────────────────────────────────────
  black: {
    '--deep': '#000000',
    '--base': '#050505',
    '--card': '#0c0c0c',
    '--panel': '#111111',
    '--input': '#1a1a1a',
    '--border': '#252525',
    '--text-1': '#e4e4e7',
    '--text-2': '#a1a1aa',
    '--text-m': '#52525b',
    '--accent-l': '#38bdf8',
    '--accent': '#0ea5e9',
    '--accent-d': '#0284c7',
    '--accent-rgb': '14,165,233',
    '--nav-bg': 'rgba(8,8,8,0.95)',
    '--shadow': 'rgba(0,0,0,0.5)',
    '--vignette': '#000000',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#050505',
    '--p-grad': 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #8b5cf6 100%)',
    '--wave-c1': '#0ea5e9',
    '--wave-c2': '#8b5cf6',
    '--wave-c3': '#22d3ee',
    '--wave-c4': '#ec4899',
  },

  // ── White (light mode) ────────────────────────────────────
  white: {
    '--deep': '#d4d8e0',
    '--base': '#f1f5f9',
    '--card': '#ffffff',
    '--panel': '#e8ecf2',
    '--input': '#e2e7ed',
    '--border': '#c8ced8',
    '--text-1': '#0f172a',
    '--text-2': '#334155',
    '--text-m': '#94a3b8',
    '--accent-l': '#0284c7',
    '--accent': '#0ea5e9',
    '--accent-d': '#38bdf8',
    '--accent-rgb': '14,165,233',
    '--nav-bg': 'rgba(241,245,249,0.95)',
    '--shadow': 'rgba(0,0,0,0.06)',
    '--vignette': '#c4c8d0',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#f1f5f9',
    '--p-grad': 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #8b5cf6 100%)',
    '--wave-c1': '#0ea5e9',
    '--wave-c2': '#8b5cf6',
    '--wave-c3': '#22d3ee',
    '--wave-c4': '#ec4899',
  },

  // ── Cyan (bright bg, dark cards) ──────────────────────────
  cyan: {
    '--deep': '#054560',
    '--base': '#0ea5e9',
    '--card': '#0a2a42',
    '--panel': '#0c3350',
    '--input': '#0a2538',
    '--border': '#186888',
    '--text-1': '#f0faff',
    '--text-2': '#bae6fd',
    '--text-m': '#78c8e8',
    '--accent-l': '#e0f6ff',
    '--accent': '#7dd3fc',
    '--accent-d': '#38bdf8',
    '--accent-rgb': '125,211,252',
    '--nav-bg': 'rgba(10,34,55,0.92)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#054560',
    '--check-color': 'white',
    '--btn-text': '#0a2a42',
    '--logo-bg': '#0ea5e9',
    '--p-grad': 'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #06b6d4 100%)',
    '--wave-c1': '#7dd3fc',
    '--wave-c2': '#06b6d4',
    '--wave-c3': '#22d3ee',
    '--wave-c4': '#0ea5e9',
  },

  // ── Violet (bright bg, dark cards) ────────────────────────
  violet: {
    '--deep': '#1a0840',
    '--base': '#8b5cf6',
    '--card': '#1a1038',
    '--panel': '#221448',
    '--input': '#180d30',
    '--border': '#402878',
    '--text-1': '#f5f0ff',
    '--text-2': '#ddd0fa',
    '--text-m': '#b8a0e8',
    '--accent-l': '#f0e8ff',
    '--accent': '#c4b5fd',
    '--accent-d': '#a78bfa',
    '--accent-rgb': '196,181,253',
    '--nav-bg': 'rgba(22,12,48,0.92)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#1a0840',
    '--check-color': 'white',
    '--btn-text': '#1a1038',
    '--logo-bg': '#8b5cf6',
    '--p-grad': 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #ec4899 100%)',
    '--wave-c1': '#a78bfa',
    '--wave-c2': '#ec4899',
    '--wave-c3': '#c4b5fd',
    '--wave-c4': '#8b5cf6',
  },

  // ── Gradient (gradient bg, white cards) ────────────────────
  gradient: {
    '--deep': '#0848a0',
    '--base': '#0ea5e9',
    '--card': '#ffffff',
    '--panel': '#f0ecf8',
    '--input': '#e8e4f2',
    '--border': '#ddd6ee',
    '--text-1': '#1a1030',
    '--text-2': '#40306a',
    '--text-m': '#8880a8',
    '--accent-l': '#6d45d6',
    '--accent': '#7c3aed',
    '--accent-d': '#8b5cf6',
    '--accent-rgb': '124,58,237',
    '--nav-bg': 'rgba(255,255,255,0.95)',
    '--shadow': 'rgba(0,0,0,0.1)',
    '--vignette': '#3a20a0',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#0f172a',
    '--p-grad': 'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 50%, #ec4899 100%)',
    '--wave-c1': '#0ea5e9',
    '--wave-c2': '#7c3aed',
    '--wave-c3': '#ec4899',
    '--wave-c4': '#38bdf8',
  },

  // ── Midnight (sunset accent on navy) ───────────────────────
  midnight: {
    '--deep': '#070d15',
    '--base': '#0d1b2a',
    '--card': '#0f1d2e',
    '--panel': '#132438',
    '--input': '#162a3e',
    '--border': '#1e3a52',
    '--text-1': '#e2e8f0',
    '--text-2': '#cbd5e1',
    '--text-m': '#64748b',
    '--accent-l': '#fdba74',
    '--accent': '#f97316',
    '--accent-d': '#ea580c',
    '--accent-rgb': '249,115,22',
    '--nav-bg': 'rgba(13,27,42,0.95)',
    '--shadow': 'rgba(0,0,0,0.3)',
    '--vignette': '#070d15',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#0f172a',
    '--p-grad': 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a855f7 100%)',
    '--wave-c1': '#f97316',
    '--wave-c2': '#a855f7',
    '--wave-c3': '#ec4899',
    '--wave-c4': '#22d3ee',
  },

  // ── Forest (emerald + teal) ───────────────────────────────
  forest: {
    '--deep': '#04140e',
    '--base': '#0a1f17',
    '--card': '#0d251c',
    '--panel': '#102e22',
    '--input': '#0f2a1f',
    '--border': '#1a3d2e',
    '--text-1': '#e6f4ec',
    '--text-2': '#c5dcd0',
    '--text-m': '#5d8472',
    '--accent-l': '#6ee7b7',
    '--accent': '#10b981',
    '--accent-d': '#059669',
    '--accent-rgb': '16,185,129',
    '--nav-bg': 'rgba(10,31,23,0.95)',
    '--shadow': 'rgba(0,0,0,0.3)',
    '--vignette': '#04140e',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#0d251c',
    '--p-grad': 'linear-gradient(135deg, #10b981 0%, #06b6d4 55%, #6366f1 100%)',
    '--wave-c1': '#10b981',
    '--wave-c2': '#06b6d4',
    '--wave-c3': '#84cc16',
    '--wave-c4': '#6366f1',
  },

  // ── Crimson (warm red / orange / yellow) ──────────────────
  crimson: {
    '--deep': '#15050a',
    '--base': '#1f0a12',
    '--card': '#260e17',
    '--panel': '#2e131e',
    '--input': '#2b101a',
    '--border': '#3d1d2d',
    '--text-1': '#f5e6ec',
    '--text-2': '#dcc5d0',
    '--text-m': '#8c5d70',
    '--accent-l': '#fda4af',
    '--accent': '#f43f5e',
    '--accent-d': '#e11d48',
    '--accent-rgb': '244,63,94',
    '--nav-bg': 'rgba(31,10,18,0.95)',
    '--shadow': 'rgba(0,0,0,0.3)',
    '--vignette': '#15050a',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#260e17',
    '--p-grad': 'linear-gradient(135deg, #f43f5e 0%, #f97316 50%, #eab308 100%)',
    '--wave-c1': '#f43f5e',
    '--wave-c2': '#f97316',
    '--wave-c3': '#eab308',
    '--wave-c4': '#ec4899',
  },

  // ── Mono (monochrome AMOLED) ──────────────────────────────
  mono: {
    '--deep': '#000000',
    '--base': '#050505',
    '--card': '#0c0c0c',
    '--panel': '#111111',
    '--input': '#1a1a1a',
    '--border': '#252525',
    '--text-1': '#fafafa',
    '--text-2': '#d4d4d4',
    '--text-m': '#737373',
    '--accent-l': '#fafafa',
    '--accent': '#a3a3a3',
    '--accent-d': '#737373',
    '--accent-rgb': '212,212,212',
    '--nav-bg': 'rgba(8,8,8,0.95)',
    '--shadow': 'rgba(0,0,0,0.5)',
    '--vignette': '#000000',
    '--check-color': 'white',
    '--btn-text': 'black',
    '--logo-bg': '#050505',
    '--p-grad': 'linear-gradient(135deg, #fafafa 0%, #a3a3a3 50%, #525252 100%)',
    '--wave-c1': '#d4d4d4',
    '--wave-c2': '#737373',
    '--wave-c3': '#a3a3a3',
    '--wave-c4': '#525252',
  },
}
