interface ProgressBarProps {
  percent: number
}

export default function ProgressBar({ percent }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="relative h-[3px] w-full" style={{ background: '#162a3e' }}>
      <div
        className="absolute left-0 top-0 h-full rounded-r-full progress-glow transition-all duration-500"
        style={{ width: `${clamped}%`, background: '#4ade80' }}
      />
    </div>
  )
}
