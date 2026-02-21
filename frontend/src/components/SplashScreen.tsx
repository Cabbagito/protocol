import { useState, useEffect } from 'react'

export const SPLASH_STORAGE_KEY = 'protocol_splash_shown'
const ANIMATION_DURATION = 3800 // 3.8s

interface SplashScreenProps {
  children: React.ReactNode
}

export default function SplashScreen({ children }: SplashScreenProps) {
  const [state, setState] = useState<'playing' | 'fading' | 'done'>(() =>
    sessionStorage.getItem(SPLASH_STORAGE_KEY) ? 'done' : 'playing'
  )

  useEffect(() => {
    if (state !== 'playing') return
    const fadeTimer = setTimeout(() => setState('fading'), ANIMATION_DURATION)
    return () => clearTimeout(fadeTimer)
  }, [state])

  useEffect(() => {
    if (state !== 'fading') return
    const doneTimer = setTimeout(() => {
      setState('done')
      sessionStorage.setItem(SPLASH_STORAGE_KEY, '1')
    }, 400)
    return () => clearTimeout(doneTimer)
  }, [state])

  return (
    <>
      {children}
      {state !== 'done' && (
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center ${state === 'fading' ? 'splash-fade-out' : ''}`}
          style={{ background: '#050810' }}
        >
          <svg width="300" height="340" viewBox="0 0 300 340" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'hidden' }}>
            <defs>
              <linearGradient id="spl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <radialGradient id="spl-flash-grad" cx="50%" cy="38%" r="45%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            {/* Flash */}
            <rect className="spl-flash" width="300" height="340" fill="url(#spl-flash-grad)" opacity="0" />

            {/* Orbit track */}
            <circle className="spl-track" cx="150" cy="130" r="52" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 7" opacity="0" />

            {/* Pulse rings */}
            <circle className="spl-pulse-1" cx="150" cy="130" r="10" fill="none" stroke="url(#spl-grad)" strokeWidth="3" />
            <circle className="spl-pulse-2" cx="150" cy="130" r="8" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0" />

            {/* Orbiting dots */}
            <g className="d1-orbit" style={{ transformOrigin: '150px 130px' }}>
              <circle className="d1-entry" cx="150" cy="130" r="3.5" fill="#0ea5e9" opacity="0" />
            </g>
            <g className="d2-orbit" style={{ transformOrigin: '150px 130px' }}>
              <circle className="d2-entry" cx="150" cy="130" r="2.5" fill="#8b5cf6" opacity="0" />
            </g>
            <g className="d3-orbit" style={{ transformOrigin: '150px 130px' }}>
              <circle className="d3-entry" cx="150" cy="130" r="2" fill="#22d3ee" opacity="0" />
            </g>

            {/* Side lines */}
            <rect className="spl-line-l" x="15" y="129" height="1.5" rx="1" fill="url(#spl-grad)" style={{ width: 0 }} />
            <rect className="spl-line-r" x="218" y="129" height="1.5" rx="1" fill="url(#spl-grad)" style={{ width: 0 }} />

            {/* Logo layers */}
            <g transform="translate(112, 90) scale(0.76)">
              <path className="spl-lb" d="M36 80 L36 24 L58 24 C69 24 76 31 76 40 C76 49 69 56 58 56 L48 56 L48 80 Z M48 34 L56 34 C62 34 64 37 64 40 C64 43 62 46 56 46 L48 46 Z" fill="url(#spl-grad)" opacity="0" />
              <path className="spl-lm" d="M33 78 L33 22 L55 22 C66 22 73 29 73 38 C73 47 66 54 55 54 L45 54 L45 78 Z M45 32 L53 32 C59 32 61 35 61 38 C61 41 59 44 53 44 L45 44 Z" fill="url(#spl-grad)" opacity="0" />
              <path className="spl-lf" d="M30 76 L30 20 L52 20 C63 20 70 27 70 36 C70 45 63 52 52 52 L42 52 L42 76 Z M42 30 L50 30 C56 30 58 33 58 36 C58 39 56 42 50 42 L42 42 Z" fill="url(#spl-grad)" opacity="0" />
            </g>

            {/* Wordmark */}
            <text className="spl-word" x="150" y="214" fontFamily="Outfit, sans-serif" fontSize="26" fontWeight="700" fill="url(#spl-grad)" textAnchor="middle" opacity="0">Protocol</text>
          </svg>
        </div>
      )}
    </>
  )
}
