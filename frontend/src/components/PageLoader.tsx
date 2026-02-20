import ProtocolMark from './ProtocolMark'

interface PageLoaderProps {
  size?: 'sm' | 'md'
  className?: string
}

export default function PageLoader({ size = 'sm', className }: PageLoaderProps) {
  const sizeClass = size === 'md' ? 'w-[120px] h-[120px]' : 'w-[80px] h-[80px]'

  return (
    <div className={`flex items-center justify-center py-8 ${className ?? ''}`}>
      <ProtocolMark mode="loading" className={sizeClass} />
    </div>
  )
}
