/* global React, PStatusBar, Icon */
const { useState: usV5 } = React;

function mvarV5(g) {
  return ({chest:'--m-chest',back:'--m-back',shoulders:'--m-shoulders',triceps:'--m-triceps',quads:'--m-quads',hamstrings:'--m-hams',biceps:'--m-biceps'})[g] || '--p-accent';
}

function GroupAccentV5({ g }) {
  const v = mvarV5(g);
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:7}}>
      <span style={{ width:11,height:11,borderRadius:'50%', background:`var(${v})`, boxShadow:`0 0 16px var(${v}), 0 0 4px var(${v})`, animation:'p-pulse-dot 2.6s ease-in-out infinite' }}/>
      <span style={{ fontSize: 10, fontWeight:600, letterSpacing:'0.18em', color:`var(${v}-l)`, textTransform:'uppercase' }}>{g}</span>
    </span>
  );
}

function ProgressRail({ ex, curIdx }) {
  return (
    <div style={{ display:'flex', gap: 4, alignItems:'center' }}>
      {ex.map((e,i)=>{
        const v = mvarV5(e.g);
        const isCur = i === curIdx;
        return (
          <div key={i} style={{flex: e.sets.length, display:'flex', gap:2}}>
            {e.sets.map((s,si)=>(
              <div key={si} style={{
                flex:1, height: isCur ? 4 : 3, borderRadius: 2,
                background: s[2] ? `var(${v}-l)` : isCur ? `color-mix(in oklab, var(${v}) 25%, rgba(255,255,255,0.06))` : 'rgba(255,255,255,0.06)',
                boxShadow: s[2] ? `0 0 6px color-mix(in oklab, var(${v}) 60%, transparent)` : 'none',
                transition: 'all 0.3s',
              }}/>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PeekCard({ e, i, status }) {
  // status: 'next' | 'queued' | 'done' | 'current'
  const v = mvarV5(e.g);
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 14, position:'relative', cursor:'pointer',
      background: status==='done'
        ? 'rgba(15,29,46,0.4)'
        : `linear-gradient(90deg, color-mix(in oklab, var(${v}) ${status==='next'||status==='current'?'10':'4'}%, transparent), transparent 65%), rgba(15,29,46,0.5)`,
      border: status==='next'
        ? `1px solid color-mix(in oklab, var(${v}) 35%, var(--p-border-soft))`
        : status==='current'
          ? `1px solid color-mix(in oklab, var(${v}) 45%, var(--p-border-soft))`
          : '1px solid var(--p-border-soft)',
      backdropFilter:'blur(20px)',
      display:'flex', alignItems:'center', gap:12,
      opacity: status==='done' ? 0.55 : 1,
    }}>
      <div style={{width:3, height:38, borderRadius:2, background:`linear-gradient(180deg, var(${v}), var(${v}-l))`, opacity: status==='next'||status==='current'?1:0.55}}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)'}}>0{i+1}</span>
          <GroupAccentV5 g={e.g} />
          {status==='next' && <span className="p-mono" style={{fontSize:8, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>· NEXT</span>}
          {status==='done' && <span className="p-mono" style={{fontSize:8, color:`var(${v}-l)`, letterSpacing:'0.18em'}}>· DONE</span>}
          {status==='current' && <span className="p-mono" style={{fontSize:8, color:`var(${v}-l)`, letterSpacing:'0.18em'}}>· ACTIVE</span>}
        </div>
        <div style={{fontSize:14, fontWeight:600, color: status==='done' ? 'var(--p-text-2)' : 'var(--p-text-1)', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.n}</div>
      </div>
      <div style={{display:'flex', gap:3}}>
        {e.sets.map((s,si)=>(
          <div key={si} style={{
            width:7, height:7, borderRadius:'50%',
            background: s[2] ? `var(${v}-l)` : 'rgba(255,255,255,0.08)',
            boxShadow: s[2] ? `0 0 5px color-mix(in oklab, var(${v}) 50%, transparent)`:'none',
          }}/>
        ))}
      </div>
      <span style={{width:14,height:14,color: status==='done' ? `var(${v}-l)`:'var(--p-text-m)'}}>
        {status==='done' ? Icon.check : Icon.arrowR}
      </span>
    </div>
  );
}

function WorkoutShell({ exercises, curIdx, children, hideHeroForDone, screenLabel }) {
  const cur = exercises[curIdx];
  const v = mvarV5(cur.g);
  const totalSets = exercises.reduce((a,e)=>a+e.sets.length, 0);
  const loggedSets = exercises.reduce((a,e)=>a + e.sets.filter(s=>s[2]).length, 0);
  return (
    <div className="p-screen" data-screen-label={screenLabel} style={{ background: 'var(--p-deep)', '--mc': `var(${v})`, '--mc-l': `var(${v}-l)` }}>
      <div className="wave-bg wave-muscle">
        <div className="aurora"/>
        <div className="blob b1"/><div className="blob b2"/><div className="blob b3"/><div className="blob b4"/>
      </div>
      <div className="grain soft"/>
      <div className="screen-vignette"/>
      <PStatusBar />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ position: 'relative', padding: '4px 20px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <button style={{ width:36,height:36,borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-2)', display:'grid', placeItems:'center' }}>
              <span style={{width:14,height:14,transform:'rotate(180deg)',display:'inline-block'}}>{Icon.arrowR}</span>
            </button>
            <div style={{ textAlign:'center' }}>
              <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.22em'}}>WEEK 1 · DAY 5</div>
              <div className="p-display" style={{fontSize:18, color:'var(--p-text-1)', marginTop:1, fontStyle:'italic'}}>Push</div>
            </div>
            <button style={{ width:36,height:36,borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-2)', display:'grid', placeItems:'center' }}>
              <span style={{width:14,height:14}}>{Icon.dots}</span>
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <ProgressRail ex={exercises} curIdx={curIdx} />
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginTop: 6}}>
            <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>{String(loggedSets).padStart(2,'0')} / {totalSets} SETS</span>
            <span className="p-mono" style={{fontSize:9, color:`var(${v}-l)`, letterSpacing:'0.18em'}}>EXERCISE {String(curIdx+1).padStart(2,'0')} / {String(exercises.length).padStart(2,'0')}</span>
          </div>
          {children}
        </div>
      </div>
      <window.BottomNavV3 active="workout" />
    </div>
  );
}

// ── 1. LOGGING ───────────────────────────────────────────────────
window.WorkoutLogging = function WorkoutLogging() {
  const [w, setW] = usV5(22.5);
  const [r, setR] = usV5(10);
  const ex = [
    { g:'chest',     n:'Dumbbell Bench Press', target:'3 × 10', sets:[[22.5,10,true],[22.5,10,true],[22.5,null,false]] },
    { g:'triceps',   n:'OH Triceps Extension', target:'3 × 12', sets:[[18,null,false],[18,null,false],[18,null,false]] },
    { g:'shoulders', n:'Lateral Raise',        target:'4 × 15', sets:[[10,null,false],[10,null,false],[10,null,false],[10,null,false]] },
    { g:'chest',     n:'Cable Fly',            target:'3 × 12', sets:[[25,null,false],[25,null,false],[25,null,false]] },
  ];
  const cur = ex[0];
  const v = mvarV5(cur.g);
  const activeSet = cur.sets.findIndex(s=>!s[2]);

  return (
    <WorkoutShell exercises={ex} curIdx={0} screenLabel="workout-logging">
      <div className="p-fade" style={{ marginTop: 28, textAlign: 'center' }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
          <GroupAccentV5 g={cur.g} />
        </div>
        <div style={{
          fontSize: 36, fontWeight: 700, color: 'var(--p-text-1)',
          lineHeight: 1.05, letterSpacing: '-0.025em',
          filter: `drop-shadow(0 0 28px color-mix(in oklab, var(${v}) 45%, transparent))`,
        }}>{cur.n}</div>
        <div className="p-display" style={{fontSize:14, color:'var(--p-text-m)', marginTop:8, fontStyle:'italic'}}>
          target {cur.target.toLowerCase()}
        </div>
      </div>

      <div className="p-fade" style={{ marginTop: 24, animationDelay: '0.05s' }}>
        <div style={{
          padding: 20, borderRadius: 22,
          background: `linear-gradient(180deg, color-mix(in oklab, var(${v}) 10%, rgba(15,29,46,0.6)) 0%, rgba(15,29,46,0.7) 100%)`,
          border: `1px solid color-mix(in oklab, var(${v}) 35%, var(--p-border))`,
          backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: `0 20px 60px -20px color-mix(in oklab, var(${v}) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position:'absolute', inset: 0, pointerEvents:'none', background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in oklab, var(${v}) 25%, transparent), transparent 70%)`, opacity: 0.7, animation: 'p-card-breathe-muscle 4s ease-in-out infinite' }}/>

          <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', letterSpacing:'0.2em'}}>SET {activeSet+1} OF {cur.sets.length}</div>
            <div className="p-mono" style={{fontSize:10, color:`var(${v}-l)`, letterSpacing:'0.2em'}}>LAST · {cur.sets[0][0]}×{cur.sets[0][1]}</div>
          </div>

          <div style={{position:'relative', display:'grid', gridTemplateColumns:'1fr 1px 1fr', gap:14, alignItems:'center', marginTop: 18}}>
            <div style={{textAlign:'center'}}>
              <div className="p-eyebrow" style={{color:`var(${v}-l)`}}>WEIGHT</div>
              <div className="p-mono" style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, marginTop: 8, color: 'var(--p-text-1)', textShadow: `0 0 30px color-mix(in oklab, var(${v}) 50%, transparent)`, letterSpacing: '-0.03em' }}>{w}</div>
              <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:10}}>
                <button onClick={()=>setW(x=>+(Math.max(0,x-1.25)).toFixed(2))} style={{ width:32,height:28,borderRadius:8, background:'rgba(255,255,255,0.05)', border:`1px solid color-mix(in oklab, var(${v}) 25%, var(--p-border))`, color:`var(${v}-l)`, fontSize:14, cursor:'pointer' }}>−</button>
                <button onClick={()=>setW(x=>+(x+1.25).toFixed(2))} style={{ width:32,height:28,borderRadius:8, background:'rgba(255,255,255,0.05)', border:`1px solid color-mix(in oklab, var(${v}) 25%, var(--p-border))`, color:`var(${v}-l)`, fontSize:14, cursor:'pointer' }}>+</button>
              </div>
              <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', marginTop:6, letterSpacing:'0.15em'}}>KG</div>
            </div>
            <div style={{height:70, background:`linear-gradient(180deg, transparent, color-mix(in oklab, var(${v}) 30%, var(--p-border)), transparent)`}}/>
            <div style={{textAlign:'center'}}>
              <div className="p-eyebrow" style={{color:`var(${v}-l)`}}>REPS</div>
              <div className="p-mono" style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, marginTop: 8, color: 'var(--p-text-1)', textShadow: `0 0 30px color-mix(in oklab, var(${v}) 50%, transparent)`, letterSpacing: '-0.03em' }}>{r}</div>
              <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:10}}>
                <button onClick={()=>setR(x=>Math.max(0,x-1))} style={{ width:32,height:28,borderRadius:8, background:'rgba(255,255,255,0.05)', border:`1px solid color-mix(in oklab, var(${v}) 25%, var(--p-border))`, color:`var(${v}-l)`, fontSize:14, cursor:'pointer' }}>−</button>
                <button onClick={()=>setR(x=>x+1)} style={{ width:32,height:28,borderRadius:8, background:'rgba(255,255,255,0.05)', border:`1px solid color-mix(in oklab, var(${v}) 25%, var(--p-border))`, color:`var(${v}-l)`, fontSize:14, cursor:'pointer' }}>+</button>
              </div>
              <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', marginTop:6, letterSpacing:'0.15em'}}>OF 10</div>
            </div>
          </div>

          <button style={{
            position:'relative', width:'100%', marginTop: 18, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, var(${v}), var(${v}-l))`,
            color: 'white', fontWeight: 700, fontSize: 16, border: 'none',
            letterSpacing: '0.2em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
            boxShadow: `0 14px 40px -10px color-mix(in oklab, var(${v}) 65%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)`,
            animation: `p-btn-breathe-${cur.g} 3.2s ease-in-out infinite`,
            overflow: 'hidden',
          }}>
            <div style={{ position:'absolute', top:0, left:0, width:'40%', height:'100%', background: 'linear-gradient(110deg, transparent, rgba(255,255,255,0.25), transparent)', animation: 'p-shimmer 3s ease-in-out infinite' }}/>
            LOG
          </button>
        </div>

        <div style={{marginTop:12, display:'flex', gap:6}}>
          {cur.sets.map((s,i)=>{
            const isActive = i === activeSet;
            const done = s[2];
            return <div key={i} style={{
              flex:1, padding:'10px 4px', borderRadius:10, textAlign:'center',
              background: isActive ? `color-mix(in oklab, var(${v}) 18%, rgba(255,255,255,0.02))` : done ? `color-mix(in oklab, var(${v}) 10%, transparent)` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive?`color-mix(in oklab, var(${v}) 45%, transparent)`:done?`color-mix(in oklab, var(${v}) 20%, transparent)`:'rgba(255,255,255,0.06)'}`,
              backdropFilter:'blur(20px)',
            }}>
              <div className="p-mono" style={{fontSize:8, color:'var(--p-text-m)', letterSpacing:'0.15em'}}>SET {i+1}</div>
              <div className="p-mono" style={{fontSize:13, fontWeight:600, marginTop:3, color: done?`var(${v}-l)`:isActive?'var(--p-text-1)':'var(--p-text-m)'}}>
                {s[1] ? `${s[0]}×${s[1]}` : '—'}
              </div>
            </div>;
          })}
          <button style={{width:36, padding:'10px 0', borderRadius:10, background:'transparent', border:'1px dashed rgba(255,255,255,0.08)', color:'var(--p-text-m)', display:'grid', placeItems:'center', cursor:'pointer'}}>
            <span style={{width:14,height:14}}>{Icon.plus}</span>
          </button>
        </div>
      </div>

      <div className="p-fade" style={{ marginTop: 28, animationDelay: '0.15s' }}>
        <div className="p-eyebrow" style={{marginBottom: 10}}>Up next</div>
        <div style={{display:'flex', flexDirection:'column', gap: 8}}>
          {ex.slice(1).map((e,i)=>{
            const idx = i+1;
            const status = idx === 1 ? 'next' : 'queued';
            return <PeekCard key={idx} e={e} i={idx} status={status} />;
          })}
        </div>
      </div>
    </WorkoutShell>
  );
};

// ── 2. EXERCISE DONE — show prev / next list ────────────────────
window.WorkoutExerciseDone = function WorkoutExerciseDone() {
  const ex = [
    { g:'chest',     n:'Dumbbell Bench Press', target:'3 × 10', sets:[[22.5,10,true],[22.5,10,true],[22.5,10,true]] },
    { g:'triceps',   n:'OH Triceps Extension', target:'3 × 12', sets:[[18,null,false],[18,null,false],[18,null,false]] },
    { g:'shoulders', n:'Lateral Raise',        target:'4 × 15', sets:[[10,null,false],[10,null,false],[10,null,false],[10,null,false]] },
    { g:'chest',     n:'Cable Fly',            target:'3 × 12', sets:[[25,null,false],[25,null,false],[25,null,false]] },
  ];
  const cur = ex[0];
  const v = mvarV5(cur.g);
  const next = ex[1];
  const nv = mvarV5(next.g);

  return (
    <WorkoutShell exercises={ex} curIdx={0} screenLabel="workout-exdone">
      <div className="p-fade" style={{ marginTop: 28, textAlign: 'center' }}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
          <GroupAccentV5 g={cur.g} />
        </div>
        <div style={{
          fontSize: 36, fontWeight: 700, color: 'var(--p-text-1)',
          lineHeight: 1.05, letterSpacing: '-0.025em',
          filter: `drop-shadow(0 0 28px color-mix(in oklab, var(${v}) 45%, transparent))`,
        }}>{cur.n}</div>
        <div className="p-mono" style={{fontSize:11, color:`var(${v}-l)`, marginTop:10, letterSpacing:'0.22em'}}>
          COMPLETE · 3 × 10 @ 22.5
        </div>
      </div>

      {/* Up-next card */}
      <div className="p-fade" style={{ marginTop: 24, animationDelay: '0.05s' }}>
        <div style={{
          padding: 18, borderRadius: 18,
          background: `linear-gradient(180deg, color-mix(in oklab, var(${nv}) 12%, rgba(15,29,46,0.7)) 0%, rgba(15,29,46,0.7) 100%)`,
          border: `1px solid color-mix(in oklab, var(${nv}) 40%, var(--p-border))`,
          backdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: `0 20px 60px -20px color-mix(in oklab, var(${nv}) 40%, transparent)`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in oklab, var(${nv}) 25%, transparent), transparent 70%)`, opacity:0.7, animation:'p-card-breathe-muscle 4s ease-in-out infinite' }}/>
          <div style={{ position:'relative', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{width:4, height:54, borderRadius:2, background:`linear-gradient(180deg, var(${nv}), var(${nv}-l))`}}/>
            <div style={{ flex:1 }}>
              <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', letterSpacing:'0.22em'}}>UP NEXT</div>
              <div style={{fontSize:20, fontWeight:600, color:'var(--p-text-1)', marginTop:4, letterSpacing:'-0.015em'}}>{next.n}</div>
              <div className="p-mono" style={{fontSize:11, color:'var(--p-text-m)', marginTop:4, letterSpacing:'0.18em'}}>TARGET · {next.target.toUpperCase()}</div>
            </div>
          </div>
          <button style={{
            position:'relative', width:'100%', marginTop: 16, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, var(${nv}), var(${nv}-l))`,
            color: 'white', fontWeight: 700, fontSize: 14, border: 'none',
            letterSpacing: '0.2em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
            boxShadow: `0 14px 40px -10px color-mix(in oklab, var(${nv}) 65%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)`,
            overflow:'hidden',
          }}>
            <div style={{ position:'absolute', top:0, left:0, width:'40%', height:'100%', background: 'linear-gradient(110deg, transparent, rgba(255,255,255,0.25), transparent)', animation: 'p-shimmer 3s ease-in-out infinite' }}/>
            START
            <span style={{width:14,height:14, position:'relative'}}>{Icon.arrowR}</span>
          </button>
        </div>
      </div>

      {/* Full list — done above, queued below */}
      <div className="p-fade" style={{ marginTop: 28, animationDelay: '0.1s' }}>
        <div className="p-eyebrow" style={{marginBottom: 10}}>Workout · 4 exercises</div>
        <div style={{display:'flex', flexDirection:'column', gap: 8}}>
          {ex.map((e,i)=>{
            const allDone = e.sets.every(s=>s[2]);
            let status = 'queued';
            if (allDone) status = 'done';
            else if (i === 1) status = 'next';
            return <PeekCard key={i} e={e} i={i} status={status} />;
          })}
        </div>
      </div>
    </WorkoutShell>
  );
};

// ── 3. WORKOUT DONE — simpler ────────────────────────────────────
window.WorkoutDone = function WorkoutDone() {
  const ex = [
    { g:'chest',     n:'Dumbbell Bench Press', target:'3 × 10', sets:[[22.5,10,true],[22.5,10,true],[22.5,10,true]] },
    { g:'triceps',   n:'OH Triceps Extension', target:'3 × 12', sets:[[18,12,true],[18,12,true],[18,11,true]] },
    { g:'shoulders', n:'Lateral Raise',        target:'4 × 15', sets:[[10,15,true],[10,15,true],[10,14,true],[10,12,true]] },
    { g:'chest',     n:'Cable Fly',            target:'3 × 12', sets:[[25,12,true],[25,12,true],[25,11,true]] },
  ];
  const v = mvarV5('chest');
  return (
    <WorkoutShell exercises={ex} curIdx={3} screenLabel="workout-done">
      <div className="p-fade" style={{ marginTop: 56, textAlign: 'center' }}>
        <div className="p-mono" style={{fontSize:11, color:`var(--p-accent-l)`, letterSpacing:'0.3em'}}>SESSION COMPLETE</div>
        <div className="p-grad-text" style={{
          fontSize: 110, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.9, marginTop: 18,
          filter: 'drop-shadow(0 0 40px rgba(var(--p-accent-rgb),0.4))',
        }}>
          Done.
        </div>
        <div className="p-display" style={{fontSize:18, color:'var(--p-text-2)', marginTop:14, fontStyle:'italic'}}>
          push · day five
        </div>
        <div className="p-mono" style={{fontSize:11, color:'var(--p-text-m)', marginTop:10, letterSpacing:'0.22em'}}>
          13 SETS · 4 EXERCISES · 54 MIN
        </div>
      </div>

      <div className="p-fade" style={{ marginTop: 60, animationDelay: '0.1s', display:'flex', flexDirection:'column', gap: 10 }}>
        <button className="p-btn p-btn-grad" style={{ width:'100%', height: 58, fontSize: 14, fontWeight:700, letterSpacing:'0.2em' }}>
          FINISH
        </button>
        <button style={{
          width:'100%', height: 50, borderRadius:14,
          background:'transparent', border:'1px solid var(--p-border-soft)',
          color:'var(--p-text-2)', fontSize: 13, fontWeight:500, letterSpacing:'0.05em',
          backdropFilter:'blur(20px)', cursor:'pointer',
        }}>
          Review sets
        </button>
      </div>
    </WorkoutShell>
  );
};
