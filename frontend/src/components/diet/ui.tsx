/**
 * Small building blocks shared by the Diet screens, after the Protocol design
 * system (Chrome, SectionLabel, the inline icons).
 */
import type { CSSProperties, ReactNode } from 'react'
import { OFFLINE_COLOR } from '../SyncPill'
import { MONO, eyebrowStyle } from './styles'

const chromeButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: 'var(--fill-soft)',
  border: '1px solid var(--line)',
  color: 'var(--text-2)',
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  cursor: 'pointer',
  padding: 0,
}

export function ChromeButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{ ...chromeButtonStyle, opacity: disabled ? 0.3 : 1 }}
    >
      {children}
    </button>
  )
}

export function ChromeSpacer() {
  return <div style={{ width: 36, flex: 'none' }} />
}

/** Back button (or day arrows), eyebrow, Fraunces title, and a right slot. */
export function Chrome({
  left,
  eyebrow,
  title,
  right,
  onTitleClick,
  titleLabel,
  status,
}: {
  left: ReactNode
  eyebrow: string
  title: string
  right?: ReactNode
  onTitleClick?: () => void
  titleLabel?: string
  /** Under the title, e.g. a sync pill. */
  status?: ReactNode
}) {
  const middle = (
    <>
      <div style={eyebrowStyle}>{eyebrow}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%' }}>
        <span
          className="p-display"
          style={{
            fontSize: 18,
            color: 'var(--text-1)',
            marginTop: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        {onTitleClick && <ChevronDown size={12} />}
      </div>
    </>
  )
  const center = onTitleClick ? (
    <button
      type="button"
      onClick={onTitleClick}
      aria-label={titleLabel}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '0 8px',
        textAlign: 'center',
        minWidth: 0,
        cursor: 'pointer',
        color: 'var(--text-1)',
      }}
    >
      {middle}
    </button>
  ) : (
    <div style={{ textAlign: 'center', minWidth: 0, padding: '0 8px' }}>{middle}</div>
  )
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0 18px',
        gap: 8,
      }}
    >
      {left}
      {status ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          {center}
          {status}
        </div>
      ) : (
        center
      )}
      {right ?? <ChromeSpacer />}
    </div>
  )
}

/** What needs a connection, said in passing ("Offline · search needs a connection"). */
export function OfflineNote({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: OFFLINE_COLOR,
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', flex: 'none' }} />
      {children}
    </div>
  )
}

/** Uppercase mono heading with an optional hint on the right. */
export function SectionLabel({
  children,
  hint,
  first,
}: {
  children: ReactNode
  hint?: ReactNode
  first?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        margin: `${first ? 0 : 22}px 0 12px`,
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--text-m)',
      }}
    >
      <span>{children}</span>
      {hint && <span>{hint}</span>}
    </div>
  )
}

/* ─── Inline icons (Heroicons-style strokes) ─────────────────────── */

type IconProps = { size?: number }

export function ChevronLeft({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function ChevronRight({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function ChevronDown({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function CloseIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <path d="M12 4v16m8-8H4" />
    </svg>
  )
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

export function BarcodeIcon({ size = 19 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12" />
    </svg>
  )
}

export function DotsIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

export function CameraIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}

/** Claude at work: a ring turning in the AI colour (still under reduced motion). */
export function AiSpinner({ size = 12 }: IconProps) {
  return (
    <svg className="motion-safe:animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

/** Beside a meal's name while Claude names it. */
export function NamingTag() {
  return (
    <span
      role="status"
      aria-label="Claude is naming this meal"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        flex: 'none',
        padding: '3px 7px',
        borderRadius: 999,
        background: 'rgba(var(--ai-rgb),0.12)',
        border: '1px solid rgba(var(--ai-rgb),0.35)',
        color: 'var(--ai)',
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.14em',
        lineHeight: 1,
      }}
    >
      <AiSpinner size={10} />
      NAMING
    </span>
  )
}

/** Marks what Claude filled in. */
export function SparkleIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
    </svg>
  )
}
