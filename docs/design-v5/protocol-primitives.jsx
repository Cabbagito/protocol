/* global React */

// ── Protocol P logo (gradient, 3-layer cascade) ──────────────────
window.PLogo = function PLogo({ size = 44, animate = true, mode = 'static' }) {
  const id = React.useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id={`pg-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--p-accent)" />
          <stop offset="100%" stopColor="var(--p-violet)" />
        </linearGradient>
      </defs>
      <path d="M36 80 L36 24 L58 24 C69 24 76 31 76 40 C76 49 69 56 58 56 L48 56 L48 80 Z M48 34 L56 34 C62 34 64 37 64 40 C64 43 62 46 56 46 L48 46 Z" fill={`url(#pg-${id})`} opacity="0.18" transform="translate(6,4)" />
      <path d="M33 78 L33 22 L55 22 C66 22 73 29 73 38 C73 47 66 54 55 54 L45 54 L45 78 Z M45 32 L53 32 C59 32 61 35 61 38 C61 41 59 44 53 44 L45 44 Z" fill={`url(#pg-${id})`} opacity="0.45" transform="translate(3,2)" />
      <path d="M30 76 L30 20 L52 20 C63 20 70 27 70 36 C70 45 63 52 52 52 L42 52 L42 76 Z M42 30 L50 30 C56 30 58 33 58 36 C58 39 56 42 50 42 L42 42 Z" fill={`url(#pg-${id})`} />
    </svg>
  );
};

// ── Logo with badge container ────────────────────────────────────
window.PLogoBadge = function PLogoBadge({ size = 44, glow = false }) {
  return (
    <div className="p-logo-box" style={{ width: size, height: size }}>
      {glow && <div style={{
        position: 'absolute', inset: '-30%',
        background: 'radial-gradient(circle, rgba(var(--p-accent-rgb),0.3), transparent 60%)',
        filter: 'blur(12px)', pointerEvents: 'none',
      }} />}
      <PLogo size={size * 0.95} />
    </div>
  );
};

// ── iPhone status bar (compact) ──────────────────────────────────
window.PStatusBar = function PStatusBar({ time = '9:41' }) {
  return (
    <div style={{
      height: 54, paddingTop: 18, paddingLeft: 30, paddingRight: 28,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontFamily: 'var(--p-sans)', fontSize: 16, fontWeight: 600, color: 'var(--p-text-1)',
      position: 'relative', zIndex: 6,
    }}>
      <span>{time}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="0.5"/><rect x="5" y="4" width="3" height="7" rx="0.5"/><rect x="10" y="2" width="3" height="9" rx="0.5"/><rect x="15" y="0" width="3" height="11" rx="0.5"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M8 0a8 8 0 0 1 5.7 2.4l-1.4 1.4A6 6 0 0 0 8 2a6 6 0 0 0-4.3 1.8L2.3 2.4A8 8 0 0 1 8 0Zm0 4a4 4 0 0 1 2.8 1.2l-1.4 1.4A2 2 0 0 0 8 6a2 2 0 0 0-1.4.6L5.2 5.2A4 4 0 0 1 8 4Zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/></svg>
        <div style={{ width: 25, height: 12, border: '1px solid currentColor', borderRadius: 3, position: 'relative', opacity: 0.9 }}>
          <div style={{ position: 'absolute', inset: 1.5, width: 14, background: 'currentColor', borderRadius: 1.5 }} />
          <div style={{ position: 'absolute', right: -3, top: 3, width: 1.5, height: 4, background: 'currentColor', borderRadius: '0 1px 1px 0' }} />
        </div>
      </div>
    </div>
  );
};

// ── Icons ────────────────────────────────────────────────────────
window.Icon = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1Z"/></svg>,
  workout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 8v8M3 10v4M18 8v8M21 10v4M8 12h8"/></svg>,
  diet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4c2 0 3 1 5 1s4 2 4 6c0 6-4 11-7 11-1 0-1-1-2-1s-1 1-2 1c-3 0-7-5-7-11 0-4 2-6 4-6s3-1 5-1Z"/><path d="M12 4c0-1 1-2 2-2"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>,
  arrowR: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  flame: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M12 2c1 4 4 5 4 9a4 4 0 1 1-8 0c0-2 1-3 1-5l3 4 1-2 0 0c0-3-1-4-1-6Z"/></svg>,
  dots: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>,
  timer: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>,
  drag: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>,
};
