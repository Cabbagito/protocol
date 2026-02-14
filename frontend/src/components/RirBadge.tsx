interface RirBadgeProps {
  rir: number
}

export default function RirBadge({ rir }: RirBadgeProps) {
  const isDeload = rir === -1

  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <span className="text-[10px] font-medium uppercase tracking-wider mb-1 text-slate-600">
        RiR
      </span>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: 'rgba(56,189,248,0.1)',
          border: '1px solid rgba(56,189,248,0.15)',
        }}
      >
        <span className="text-lg font-bold" style={{ color: '#38bdf8' }}>
          {isDeload ? 'DL' : rir}
        </span>
      </div>
    </div>
  )
}
