interface ProtocolMarkProps {
  mode?: 'idle' | 'loading'
  className?: string
}

export default function ProtocolMark({ mode = 'idle', className }: ProtocolMarkProps) {
  if (mode === 'loading') {
    return (
      <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="load-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="l-shim-s" />
            <stop offset="100%" className="l-shim-e" />
          </linearGradient>
        </defs>
        {/* Orbit track */}
        <circle cx="100" cy="100" r="58" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 8" opacity="0.4" />
        {/* Orbiting dots */}
        <g style={{ transformOrigin: '100px 100px' }}>
          <circle className="orb-1" cx="100" cy="100" r="3.5" fill="#0ea5e9" opacity="0.9" />
          <circle className="orb-2" cx="100" cy="100" r="2.5" fill="#8b5cf6" opacity="0.7" />
          <circle className="orb-3" cx="100" cy="100" r="2" fill="#22d3ee" opacity="0.5" />
        </g>
        {/* Logo layers */}
        <g transform="translate(58, 58) scale(0.84)">
          <path className="lb-back" d="M36 80 L36 24 L58 24 C69 24 76 31 76 40 C76 49 69 56 58 56 L48 56 L48 80 Z M48 34 L56 34 C62 34 64 37 64 40 C64 43 62 46 56 46 L48 46 Z" fill="url(#load-grad)" opacity="0.15" />
          <path className="lb-mid" d="M33 78 L33 22 L55 22 C66 22 73 29 73 38 C73 47 66 54 55 54 L45 54 L45 78 Z M45 32 L53 32 C59 32 61 35 61 38 C61 41 59 44 53 44 L45 44 Z" fill="url(#load-grad)" opacity="0.4" />
          <path className="lb-front" d="M30 76 L30 20 L52 20 C63 20 70 27 70 36 C70 45 63 52 52 52 L42 52 L42 76 Z M42 30 L50 30 C56 30 58 33 58 36 C58 39 56 42 50 42 L42 42 Z" fill="url(#load-grad)" />
        </g>
      </svg>
    )
  }

  // Idle mode — cascade shimmer
  return (
    <svg className={className} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="idle-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="cascade-fs" />
          <stop offset="100%" className="cascade-fe" />
        </linearGradient>
        <radialGradient id="idle-vig" cx="42%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="#0f172a" />
      <rect width="100" height="100" rx="22" fill="url(#idle-vig)" />
      <path className="cascade-back" d="M36 80 L36 24 L58 24 C69 24 76 31 76 40 C76 49 69 56 58 56 L48 56 L48 80 Z M48 34 L56 34 C62 34 64 37 64 40 C64 43 62 46 56 46 L48 46 Z" fill="#0ea5e9" opacity="0.15" />
      <path className="cascade-mid" d="M33 78 L33 22 L55 22 C66 22 73 29 73 38 C73 47 66 54 55 54 L45 54 L45 78 Z M45 32 L53 32 C59 32 61 35 61 38 C61 41 59 44 53 44 L45 44 Z" fill="#0ea5e9" opacity="0.4" />
      <path d="M30 76 L30 20 L52 20 C63 20 70 27 70 36 C70 45 63 52 52 52 L42 52 L42 76 Z M42 30 L50 30 C56 30 58 33 58 36 C58 39 56 42 50 42 L42 42 Z" fill="url(#idle-grad)" />
    </svg>
  )
}
