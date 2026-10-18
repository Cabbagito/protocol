import { useState } from 'react'
import { themes, THEME_GROUPS, type ThemeId } from '../lib/themes'
import { applyTheme, getSavedTheme } from '../lib/theme'

const THEME_LABELS: Record<ThemeId, string> = {
  mono: 'Mono',
  slate: 'Slate',
  stone: 'Stone',
  teal: 'Teal',
  navy: 'Navy',
  indigo: 'Indigo',
  plum: 'Plum',
  rose: 'Rose',
  brick: 'Brick',
  clay: 'Clay',
  ochre: 'Ochre',
  sage: 'Sage',
  paper: 'Paper',
  mist: 'Mist',
  linen: 'Linen',
}

function MiniLogo({ theme, size = 40 }: { theme: ThemeId; size?: number }) {
  const t = themes[theme]

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`tg-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={t['--accent']} />
          <stop offset="100%" stopColor={t['--accent-l']} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={t['--logo-bg']} stroke={t['--border']} strokeWidth="2" />
      <path
        fillRule="evenodd"
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
    <div className="flex flex-col gap-3">
      {THEME_GROUPS.map((group) => (
        <div key={group.label}>
          <div
            className="mb-2"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-m)',
            }}
          >
            {group.label}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {group.ids.map((id) => {
              const isActive = id === active
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id)}
                  aria-pressed={isActive}
                  className="flex flex-col items-center justify-center gap-1.5 transition-colors"
                  style={{
                    height: 82,
                    borderRadius: 14,
                    background: 'var(--fill-soft)',
                    border: isActive ? '1.5px solid var(--accent-l)' : '1px solid var(--line)',
                  }}
                >
                  <div className="relative">
                    <MiniLogo theme={id} />
                    {isActive && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent-l)', color: 'var(--btn-text)' }}
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
                    className="text-[12px] font-semibold"
                    style={{ color: isActive ? 'var(--text-1)' : 'var(--text-2)' }}
                  >
                    {THEME_LABELS[id]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
