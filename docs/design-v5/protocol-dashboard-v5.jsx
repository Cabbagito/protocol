/* global React, PLogoBadge, PStatusBar, Icon */

// Original "before" pattern — letter cells, no separate labels, no inner dot
function WeekRow({ trained = [true, false, true, true, false], todayIdx = 4 }) {
  const labels = ['M','T','W','T','F','S','S'];
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {labels.map((d,i)=>{
        const did = trained[i];
        const isToday = i === todayIdx;
        const isPast = i < todayIdx;
        return (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: 8,
            background: isToday
              ? 'var(--p-grad)'
              : did
                ? 'rgba(var(--p-accent-rgb),0.18)'
                : 'rgba(255,255,255,0.04)',
            border: isToday
              ? 'none'
              : did
                ? '1px solid rgba(var(--p-accent-rgb),0.35)'
                : `1px ${isPast ? 'solid' : 'dashed'} rgba(255,255,255,0.08)`,
            display:'grid', placeItems:'center',
            fontSize: 11, fontWeight: 600, letterSpacing: 0,
            fontFamily: 'var(--p-mono)',
            color: isToday
              ? 'white'
              : did
                ? 'var(--p-accent-l)'
                : 'var(--p-text-2)',
            boxShadow: isToday ? '0 0 18px rgba(var(--p-accent-rgb),0.65)' : 'none',
          }}>{d}</div>
        );
      })}
    </div>
  );
}

function AuroraBg() {
  return (
    <>
      <div className="wave-bg">
        <div className="aurora"/>
        <div className="aurora-2"/>
        <div className="blob b1"/>
        <div className="blob b2"/>
        <div className="blob b3"/>
        <div className="blob b4"/>
      </div>
      <div className="grain soft"/>
      <div className="screen-vignette"/>
    </>
  );
}

window.Dashboard = function Dashboard() {
  return (
    <div className="p-screen" style={{ background: 'var(--p-deep)' }}>
      <AuroraBg />
      <PStatusBar />

      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding: '4px 22px 0', position: 'relative', minHeight: 'calc(780px - 110px - 50px)', display: 'flex', flexDirection: 'column' }}>
          {/* top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <PLogoBadge size={38} glow />
            <button style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--p-border-soft)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--p-text-2)', display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}>
              <span style={{width:16,height:16}}>{Icon.settings}</span>
            </button>
          </div>

          {/* date + week */}
          <div className="p-fade" style={{ marginTop: 28, textAlign: 'center' }}>
            <div className="p-mono" style={{ fontSize: 11, color: 'var(--p-text-2)', letterSpacing: '0.22em' }}>
              FRIDAY · MAY 8
            </div>
            <div style={{ marginTop: 14 }}>
              <WeekRow trained={[true,false,true,true,false]} todayIdx={4} />
            </div>
          </div>

          {/* Hero — title */}
          <div className="p-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
              {[['CHEST','var(--m-chest)'],['SHOULDERS','var(--m-shoulders)'],['TRICEPS','var(--m-triceps)']].map(([n,c],i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: '50%', background: c,
                    boxShadow: `0 0 14px ${c}, 0 0 4px ${c}`,
                    animation: `p-pulse-dot 2.6s ease-in-out infinite ${i*0.4}s`,
                  }}/>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--p-text-2)' }}>{n}</span>
                </div>
              ))}
            </div>

            <div className="p-grad-text" style={{
              fontSize: 130, fontWeight: 700, letterSpacing: '-0.06em', lineHeight: 0.9,
              filter: 'drop-shadow(0 0 40px rgba(var(--p-accent-rgb),0.35))',
            }}>
              Push
            </div>

            <div className="p-display" style={{
              fontSize: 17, color: 'var(--p-text-2)', marginTop: 12,
              fontStyle: 'italic', letterSpacing: '0.01em',
            }}>
              day five
            </div>
          </div>

          {/* Meso hairline */}
          <div className="p-fade" style={{ marginBottom: 14, animationDelay: '0.15s' }}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 8}}>
              <span className="p-mono" style={{fontSize:10, letterSpacing:'0.18em', color:'var(--p-text-m)'}}>MASS · PHASE 2</span>
              <span className="p-mono" style={{fontSize:10, letterSpacing:'0.18em', color:'var(--p-text-2)'}}>WK 1 / 4 · 20%</span>
            </div>
            <div style={{height:2, background:'rgba(255,255,255,0.06)', borderRadius:1, overflow:'hidden'}}>
              <div style={{width:'20%', height:'100%', background:'var(--p-grad)', boxShadow:'0 0 8px rgba(var(--p-accent-rgb),0.6)'}}/>
            </div>
          </div>

          <button className="p-btn p-btn-grad p-fade" style={{ width: '100%', height: 58, fontSize: 16, animationDelay: '0.2s', marginBottom: 20 }}>
            Continue workout
            <span style={{ width: 18, height: 18 }}>{Icon.arrowR}</span>
          </button>
        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};
