interface MetricToggleProps {
  value: 'strength' | 'stimulus'
  onChange: (value: 'strength' | 'stimulus') => void
  size?: 'sm' | 'md'
  className?: string
}

export default function MetricToggle({ value, onChange, size = 'md', className }: MetricToggleProps) {
  return (
    <div
      className={`flex ${size === 'md' ? 'rounded-lg' : 'rounded-md'} overflow-hidden ${className ?? ''}`}
      style={{ border: '1px solid var(--border)' }}
    >
      {(['strength', 'stimulus'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`${size === 'md' ? 'flex-1 py-1.5 text-[12px]' : 'px-2.5 py-0.5 text-[9px]'} font-medium transition-colors`}
          style={{
            background: value === m ? 'rgba(139,92,246,0.15)' : 'transparent',
            color: value === m ? '#a78bfa' : 'var(--text-m)',
          }}
        >
          {m === 'strength' ? 'Strength' : 'Stimulus'}
        </button>
      ))}
    </div>
  )
}
