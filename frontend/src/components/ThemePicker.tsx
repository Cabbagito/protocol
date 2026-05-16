import { useState } from 'react'
import { themes, THEME_IDS, type ThemeId } from '../lib/themes'
import { applyTheme, getSavedTheme } from '../lib/theme'

const THEME_LABELS: Record<ThemeId, string> = {
  dark: 'Dark',
  black: 'Black',
  white: 'White',
  cyan: 'Cyan',
  violet: 'Violet',
  gradient: 'Gradient',
  midnight: 'Midnight',
  forest: 'Forest',
  crimson: 'Crimson',
  mono: 'Mono',
  walnut: 'Walnut',
  gruvbox: 'Gruvbox',
  'onyx-gold': 'Onyx Gold',
  'onyx-wine': 'Onyx Wine',
  graphite: 'Graphite',
  slate: 'Slate',
  linen: 'Linen',
}

function MiniLogo({ theme, size = 44 }: { theme: ThemeId; size?: number }) {
  const t = themes[theme]
  const isGradient = theme === 'gradient'

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`tg-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={t['--accent']} />
          <stop offset="100%" stopColor={t['--accent-l']} />
        </linearGradient>
        {isGradient && (
          <linearGradient id="tg-gradient-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        )}
      </defs>
      <rect
        width="100"
        height="100"
        rx="22"
        fill={isGradient ? 'url(#tg-gradient-bg)' : t['--logo-bg']}
      />
      <path
        d="M30 76 L30 20 L52 20 C63 20 70 27 70 36 C70 45 63 52 52 52 L42 52 L42 76 Z M42 30 L50 30 C56 30 58 33 58 36 C58 39 56 42 50 42 L42 42 Z"
        fill={`url(#tg-${theme})`}
      />
    </svg>
  )
}

export default function ThemePicker() {
  const [active, setActive] = useState<ThemeId>(getSavedTheme)

  function handleSelect(id: ThemeId) {
    setActive(id)
    applyTheme(id)
  }

  return (
    <div className="card">
      <div className="mb-1 font-medium">Theme</div>
      <div className="text-[11px] mb-4" style={{ color: 'var(--text-m)' }}>
        Choose your app appearance
      </div>
      <div className="grid grid-cols-3 gap-3">
        {THEME_IDS.map((id) => {
          const isActive = id === active
          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className="flex flex-col items-center gap-1.5 py-2 rounded-xl transition-all"
              style={{
                background: isActive ? `rgba(var(--accent-rgb),0.1)` : 'transparent',
                border: isActive ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              }}
            >
              <div className="relative">
                <MiniLogo theme={id} />
                {isActive && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent)', color: 'var(--check-color)' }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2.5 6L5 8.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? 'var(--accent-l)' : 'var(--text-m)' }}
              >
                {THEME_LABELS[id]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
