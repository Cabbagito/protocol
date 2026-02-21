interface RirBadgeProps {
  rir: number
}

export default function RirBadge({ rir }: RirBadgeProps) {
  const isDeload = rir === -1

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <span className="text-[10px] font-medium uppercase tracking-wider mb-1 text-[var(--text-m)]">
        RiR
      </span>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: 'rgba(var(--accent-rgb),0.1)',
          border: '1px solid rgba(var(--accent-rgb),0.15)',
        }}
      >
        <span className="text-lg font-bold" style={{ color: 'var(--accent-l)' }}>
          {isDeload ? 'DL' : rir}
        </span>
      </div>
    </div>
  )
}
