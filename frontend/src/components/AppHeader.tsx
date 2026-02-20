import { Link } from 'react-router-dom'
import { ChevronDownIcon } from './Icons'
import ProtocolMark from './ProtocolMark'
import ProgressBar from './ProgressBar'

interface AppHeaderProps {
  title: React.ReactNode
  subtitle?: string
  breadcrumb?: { label: string; to: string }
  rightContent?: React.ReactNode
  progressPercent?: number
  drawerContent?: React.ReactNode
  drawerExpanded?: boolean
  onHeaderAreaClick?: () => void
}

export default function AppHeader({
  title,
  subtitle,
  breadcrumb,
  rightContent,
  progressPercent,
  drawerContent,
  drawerExpanded,
  onHeaderAreaClick,
}: AppHeaderProps) {
  const hasProgressBar = progressPercent !== undefined

  return (
    <div
      className="sticky top-0 z-40 relative"
      style={{
        marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: '#0d1b2a',
        borderBottom: hasProgressBar ? 'none' : '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Main header row */}
      <div
        className={`px-5 pt-5 pb-4 flex items-center gap-3 min-h-[96px]${onHeaderAreaClick ? ' cursor-pointer' : ''}`}
        onClick={onHeaderAreaClick}
      >
        <Link
          to="/"
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ProtocolMark mode="idle" className="w-9 h-9" />
        </Link>

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold truncate text-slate-200">
            {title}
          </h1>
          {breadcrumb ? (
            <Link
              to={breadcrumb.to}
              className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              &#8249; {breadcrumb.label}
            </Link>
          ) : subtitle ? (
            <p className="text-[11px] text-slate-600">{subtitle}</p>
          ) : null}
        </div>

        {rightContent && (
          <div
            className="flex-shrink-0 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {rightContent}
          </div>
        )}

        {/* Drawer expand indicator */}
        {drawerContent && (
          <ChevronDownIcon
            className={`w-4 h-4 flex-shrink-0 text-slate-600 transition-transform duration-300 ${drawerExpanded ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {/* Progress bar (replaces border) */}
      {hasProgressBar && <ProgressBar percent={progressPercent} />}

      {/* Expandable drawer — absolutely positioned overlay, animated with translateY (GPU-only) */}
      {drawerContent && (
        <div
          className="absolute left-0 right-0 overflow-hidden pointer-events-none"
          style={{ top: '100%', paddingBottom: 60 }}
        >
          <div
            className="transition-transform duration-300 ease-in-out"
            style={{
              transform: drawerExpanded ? 'translateY(0)' : 'translateY(-100%)',
              willChange: 'transform',
              padding: '6px 8px 0',
            }}
          >
            <div className="pointer-events-auto" style={{
              background: '#132438',
              borderRadius: 12,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              border: '1.5px solid #244868',
            }}>
              <div className="px-4 pt-4 pb-5">
                {drawerContent}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
