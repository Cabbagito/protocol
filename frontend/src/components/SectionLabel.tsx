export default function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider ${className ?? ''}`}
      style={{ color: 'var(--text-m)', letterSpacing: '0.08em' }}
    >
      {children}
    </span>
  )
}
