/* global React, Icon, PLogo */

// ── Bottom Nav V1 — minimal text + dot indicator ──
window.BottomNavV1 = function BottomNavV1({ active = 'home' }) {
  const items = [
    { id: 'home', label: 'Home', icon: Icon.home },
    { id: 'workout', label: 'Workout', icon: Icon.workout },
    { id: 'diet', label: 'Diet', icon: Icon.diet },
  ];
  return (
    <div className="p-bottom-nav">
      {items.map(it => {
        const isA = it.id === active;
        return (
          <button key={it.id} style={{
            flex: 1, height: 60, background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: isA ? 'var(--p-accent-l)' : 'var(--p-text-m)', cursor: 'pointer',
            position: 'relative',
          }}>
            <span style={{ width: 22, height: 22 }}>{it.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.04em' }}>{it.label}</span>
            {isA && <div style={{ position: 'absolute', top: -1, width: 26, height: 2, borderRadius: 2, background: 'var(--p-grad)', boxShadow: '0 0 8px rgba(var(--p-accent-rgb),0.6)' }} />}
          </button>
        );
      })}
    </div>
  );
};

// ── Bottom Nav V2 — editorial: icons-only with mono label under active ──
window.BottomNavV2 = function BottomNavV2({ active = 'home' }) {
  const items = [
    { id: 'home', label: 'HOME', icon: Icon.home },
    { id: 'workout', label: 'WORKOUT', icon: Icon.workout },
    { id: 'diet', label: 'DIET', icon: Icon.diet },
    { id: 'stats', label: 'STATS', icon: Icon.chart },
  ];
  return (
    <div className="p-bottom-nav" style={{ paddingTop: 18 }}>
      {items.map(it => {
        const isA = it.id === active;
        return (
          <button key={it.id} style={{
            flex: 1, height: 56, background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            color: isA ? 'var(--p-text-1)' : 'var(--p-text-d)', cursor: 'pointer',
          }}>
            <span style={{ width: 22, height: 22 }}>{it.icon}</span>
            <span className="p-mono" style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', opacity: isA ? 1 : 0 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ── Bottom Nav V3 — pill / capsule with floating accent ──
window.BottomNavV3 = function BottomNavV3({ active = 'home' }) {
  const items = [
    { id: 'home', label: 'Home', icon: Icon.home },
    { id: 'workout', label: 'Workout', icon: Icon.workout },
    { id: 'diet', label: 'Diet', icon: Icon.diet },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 18, left: 18, right: 18,
      height: 64, borderRadius: 22,
      background: 'rgba(15,29,46,0.85)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      border: '1px solid var(--p-border-soft)',
      boxShadow: '0 12px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
      display: 'flex', alignItems: 'center', padding: 6, zIndex: 5,
    }}>
      {items.map(it => {
        const isA = it.id === active;
        return (
          <button key={it.id} style={{
            flex: 1, height: 52, borderRadius: 16,
            background: isA ? 'var(--p-grad)' : 'transparent',
            color: isA ? 'white' : 'var(--p-text-m)',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            boxShadow: isA ? '0 6px 20px -6px rgba(var(--p-accent-rgb),0.6)' : 'none',
            transition: 'all 0.2s',
          }}>
            <span style={{ width: 20, height: 20 }}>{it.icon}</span>
            {isA && <span>{it.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

// ── Splash Screen — gradient P with breathing orbits ──
window.SplashScreen = function SplashScreen({ variant = 'orbital' }) {
  const [stage, setStage] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(()=>setStage(1), 600);
    const t2 = setTimeout(()=>setStage(2), 1500);
    const loop = setInterval(()=>setStage(s => s===0?1:0), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(loop); };
  }, []);

  if (variant === 'minimal') {
    return (
      <div className="p-screen" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div className="ambient" style={{ width: 280, height: 280, top: -60, left: '50%', marginLeft: -140, background: 'radial-gradient(circle, rgba(var(--p-accent-rgb),0.4), transparent 60%)' }} />
          <div style={{ position: 'relative' }}>
            <PLogo size={120} />
          </div>
          <div className="p-display" style={{ fontSize: 24, color: 'var(--p-text-2)', marginTop: 28, letterSpacing: '0.2em', fontStyle: 'italic' }}>
            Protocol
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'editorial') {
    return (
      <div className="p-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px 32px' }}>
        <div className="p-mono" style={{ fontSize: 11, color: 'var(--p-text-m)', letterSpacing: '0.2em' }}>EST · 2024</div>
        <div style={{ position: 'relative' }}>
          <div className="ambient" style={{ width: 220, height: 220, top: -40, left: -40, background: 'radial-gradient(circle, rgba(var(--p-accent-rgb),0.35), transparent 60%)' }} />
          <div className="ambient" style={{ width: 220, height: 220, bottom: -60, right: -40, background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 60%)', animationDelay: '2s' }} />
          <div style={{ position: 'relative' }}>
            <PLogo size={64} />
            <div className="p-display" style={{ fontSize: 84, color: 'var(--p-text-1)', lineHeight: 0.95, marginTop: 24, letterSpacing: '-0.04em' }}>
              Pro<span className="p-grad-text" style={{ fontStyle: 'italic' }}>tocol</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--p-text-m)', marginTop: 12, fontStyle: 'italic' }} className="p-display">
              The discipline of progress.
            </div>
          </div>
        </div>
        <div className="p-mono" style={{ fontSize: 10, color: 'var(--p-text-d)', letterSpacing: '0.2em', display: 'flex', justifyContent: 'space-between' }}>
          <span>VERSION 2.0</span>
          <span>LOADING…</span>
        </div>
      </div>
    );
  }

  // orbital (default)
  return (
    <div className="p-screen" style={{ display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', width: 240, height: 240 }}>
        {/* pulsing ring */}
        <div style={{
          position: 'absolute', inset: 30, borderRadius: '50%',
          border: '1px dashed rgba(var(--p-accent-rgb),0.3)',
          animation: 'p-spin 14s linear infinite',
        }} />
        {/* glow */}
        <div className="ambient" style={{ inset: 20, background: 'radial-gradient(circle, rgba(var(--p-accent-rgb),0.4), transparent 60%)' }} />
        {/* orbit dots */}
        <div style={{ position: 'absolute', inset: 30, animation: 'p-spin 8s linear infinite' }}>
          <div style={{ position: 'absolute', top: -3, left: '50%', width: 6, height: 6, borderRadius: '50%', background: 'var(--p-accent-l)', boxShadow: '0 0 10px var(--p-accent)', marginLeft: -3 }} />
        </div>
        <div style={{ position: 'absolute', inset: 30, animation: 'p-spin-r 10s linear infinite' }}>
          <div style={{ position: 'absolute', bottom: -3, left: '50%', width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 10px #8b5cf6', marginLeft: -2.5 }} />
        </div>
        {/* horizontal lines */}
        <div style={{ position: 'absolute', top: '50%', left: -10, width: 60, height: 1, background: 'linear-gradient(to right, transparent, rgba(var(--p-accent-rgb),0.4))' }} />
        <div style={{ position: 'absolute', top: '50%', right: -10, width: 60, height: 1, background: 'linear-gradient(to left, transparent, rgba(var(--p-accent-rgb),0.4))' }} />
        {/* logo */}
        <div style={{ position: 'absolute', inset: 70, display: 'grid', placeItems: 'center' }}>
          <PLogo size={100} />
        </div>
      </div>
      <div className="p-display" style={{ position: 'absolute', bottom: '28%', fontSize: 22, color: 'var(--p-text-m)', letterSpacing: '0.3em', textTransform: 'lowercase' }}>
        protocol
      </div>
    </div>
  );
};
