interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export default function SearchInput({ value, onChange, placeholder = 'Search exercises...', className, autoFocus }: SearchInputProps) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg ${className ?? ''}`} style={{ background: 'var(--input)', border: '1px solid var(--border)' }}>
      <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-m)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent text-sm text-[var(--text-1)] placeholder-[var(--text-m)] outline-none flex-1"
        autoFocus={autoFocus}
      />
    </div>
  )
}
