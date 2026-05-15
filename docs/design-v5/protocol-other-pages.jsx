/* global React, PStatusBar, Icon, PLogoBadge */
const { useState: usOP } = React;

function mv5(g) {
  return ({chest:'--m-chest',back:'--m-back',shoulders:'--m-shoulders',triceps:'--m-triceps',quads:'--m-quads',hamstrings:'--m-hams',biceps:'--m-biceps',glutes:'--m-glutes',calves:'--m-calves'})[g] || '--p-accent';
}

function ScreenChrome({ title, sub, back = true, settings = true, intense = false }) {
  return (
    <>
      <div className="wave-bg">
        <div className="aurora"/>
        <div className="blob b1"/><div className="blob b2"/><div className="blob b3"/><div className="blob b4"/>
      </div>
      <div className="grain soft"/>
      <div className="screen-vignette"/>

      <PStatusBar />
      <div style={{ padding:'4px 22px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:2 }}>
        {back ? <button style={{ width:36,height:36,borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-2)', display:'grid', placeItems:'center' }}><span style={{width:14,height:14,transform:'rotate(180deg)',display:'inline-block'}}>{Icon.arrowR}</span></button> : <div style={{width:36}}/>}
        <div style={{ textAlign:'center' }}>
          <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.22em'}}>{sub}</div>
          <div className="p-display" style={{fontSize:18, color:'var(--p-text-1)', marginTop:1, fontStyle:'italic'}}>{title}</div>
        </div>
        {settings ? <button style={{ width:36,height:36,borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-2)', display:'grid', placeItems:'center' }}><span style={{width:14,height:14}}>{Icon.dots}</span></button> : <div style={{width:36}}/>}
      </div>
    </>
  );
}

// ─── MESOCYCLES ───────────────────────────────────────────────────
window.MesocyclesPage = function MesocyclesPage() {
  return (
    <div className="p-screen" style={{ background: 'var(--p-deep)' }}>
      <ScreenChrome title="Mesocycles" sub="2 ACTIVE · 4 ARCHIVED" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>
          {/* Active meso — hero card */}
          <div className="p-fade" style={{
            borderRadius: 20, padding: 22, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(var(--p-accent-rgb),0.12), rgba(255,255,255,0.02))',
            border: '1px solid rgba(var(--p-accent-rgb),0.3)',
            backdropFilter:'blur(20px)',
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div>
                <div className="p-mono" style={{fontSize:10, color:'var(--p-accent-l)', letterSpacing:'0.22em'}}>ACTIVE</div>
                <div className="p-display" style={{fontSize:28, color:'var(--p-text-1)', lineHeight:1, marginTop:6, fontStyle:'italic'}}>Mass — Phase 2</div>
                <div className="p-mono" style={{fontSize:11, color:'var(--p-text-m)', marginTop:6}}>UPPER / LOWER · 4×WEEK · 4 WEEKS</div>
              </div>
              <div className="p-mono p-grad-text" style={{fontSize:32, fontWeight:600, letterSpacing:'-0.02em'}}>20<span style={{fontSize:14,opacity:0.6}}>%</span></div>
            </div>

            {/* Tiny weeks grid */}
            <div style={{display:'flex', flexDirection:'column', gap:6, marginTop:18}}>
              {['Upper A','Lower A','Upper B','Lower B'].map((row,ri)=>(
                <div key={ri} style={{display:'grid', gridTemplateColumns:'68px repeat(4, 1fr)', gap:6, alignItems:'center'}}>
                  <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)'}}>{row}</div>
                  {[0,1,2,3].map(wi=>{
                    const done = (ri < 2 && wi === 0);
                    const cur = (ri === 2 && wi === 0);
                    return <div key={wi} style={{
                      height: 22, borderRadius: 7,
                      background: cur ? 'var(--p-grad)' : done ? 'rgba(var(--p-accent-rgb),0.18)' : 'rgba(255,255,255,0.04)',
                      border: cur ? 'none' : `1px solid ${done?'rgba(var(--p-accent-rgb),0.3)':'rgba(255,255,255,0.06)'}`,
                      display:'grid', placeItems:'center',
                      boxShadow: cur ? '0 0 12px rgba(var(--p-accent-rgb),0.5)' : 'none',
                    }}>
                      {done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--p-accent-l)" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                      {cur && <span style={{width:5,height:5,borderRadius:'50%',background:'white'}}/>}
                    </div>;
                  })}
                </div>
              ))}
            </div>
            <div style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>W1 · R3</span>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>W2 · R2</span>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>W3 · R1</span>
              <span className="p-mono" style={{fontSize:9, color:'var(--m-quads-l)', letterSpacing:'0.18em'}}>W4 · DELOAD</span>
            </div>
          </div>

          {/* Archived list */}
          <div className="p-fade" style={{ marginTop: 22, animationDelay: '0.1s' }}>
            <div className="p-eyebrow" style={{marginBottom: 12}}>Archived · 4</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {[
                {n:'Mass — Phase 1', dates:'Mar 4 — Apr 1', pct:100},
                {n:'Strength', dates:'Feb 1 — Mar 1', pct:100},
                {n:'Hypertrophy I', dates:'Jan 8 — Feb 1', pct:100},
                {n:'Base', dates:'Dec 9 — Jan 6', pct:100},
              ].map((m,i)=>(
                <button key={i} style={{
                  padding:'14px 16px', borderRadius:13, textAlign:'left', display:'flex', alignItems:'center', gap:14, cursor:'pointer',
                  background: 'rgba(15,29,46,0.5)', border: '1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
                }}>
                  <div style={{width:8,height:8,borderRadius:'50%', background:'rgba(255,255,255,0.15)'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14, fontWeight:600, color:'var(--p-text-1)'}}>{m.n}</div>
                    <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:2}}>{m.dates}</div>
                  </div>
                  <span className="p-mono" style={{fontSize:11, color:'var(--p-text-m)'}}>{m.pct}%</span>
                  <span style={{width:14,height:14,color:'var(--p-text-m)'}}>{Icon.arrowR}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="p-btn p-btn-grad p-fade" style={{ width:'100%', height: 52, marginTop: 22, animationDelay:'0.2s' }}>
            <span style={{width:16,height:16}}>{Icon.plus}</span>
            New mesocycle
          </button>
        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};

// ─── EXERCISES LIBRARY ────────────────────────────────────────────
window.ExercisesPage = function ExercisesPage() {
  const groups = [
    { g:'chest', exs:['Bench Press','Incline DB Press','Cable Fly','Push-up','Dip'] },
    { g:'back',  exs:['Pull-up','Barbell Row','Lat Pulldown','Cable Row','Deadlift'] },
    { g:'shoulders', exs:['OH Press','Lateral Raise','Rear Delt Fly'] },
  ];
  const [active, setActive] = usOP('chest');
  return (
    <div className="p-screen" style={{ background: 'var(--p-deep)' }}>
      <ScreenChrome title="Exercises" sub="78 LIFTS · 12 GROUPS" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>
          {/* Search */}
          <div className="p-fade" style={{
            display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:14,
            background:'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--p-text-m)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
            <span style={{fontSize:14, color:'var(--p-text-m)'}}>Search lifts…</span>
          </div>

          {/* Muscle group chips */}
          <div className="p-fade" style={{marginTop:14, display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom: 4, animationDelay:'0.05s'}}>
            {['chest','back','shoulders','triceps','biceps','quads','hamstrings','glutes','calves'].map(g=>{
              const v = mv5(g); const sel = g === active;
              return (
                <button key={g} onClick={()=>setActive(g)} style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: 100,
                  background: sel ? `color-mix(in oklab, var(${v}) 18%, transparent)` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${sel ? `color-mix(in oklab, var(${v}) 40%, transparent)` : 'var(--p-border-soft)'}`,
                  color: sel ? `var(${v}-l)` : 'var(--p-text-2)',
                  fontSize: 11, fontWeight: 600, letterSpacing:'0.12em', textTransform:'uppercase',
                  display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer',
                }}>
                  <span style={{width:6,height:6,borderRadius:'50%', background:`var(${v})`, boxShadow: sel?`0 0 8px var(${v})`:'none'}}/>
                  {g}
                </button>
              );
            })}
          </div>

          {/* Sections by muscle */}
          <div style={{marginTop:18}}>
            {groups.map(grp => {
              const v = mv5(grp.g);
              return (
                <div key={grp.g} className="p-fade" style={{marginBottom: 24, animationDelay: '0.1s'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom: 10}}>
                    <span style={{width:8,height:8,borderRadius:'50%', background:`var(${v})`, boxShadow:`0 0 10px var(${v})`}}/>
                    <span className="p-mono" style={{fontSize:10, fontWeight:600, letterSpacing:'0.22em', color:`var(${v}-l)`, textTransform:'uppercase'}}>{grp.g}</span>
                    <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em', marginLeft:'auto'}}>{grp.exs.length} LIFTS</span>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:6}}>
                    {grp.exs.map((n,i)=>(
                      <div key={i} style={{
                        padding:'12px 14px', borderRadius:12, display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                        background:'rgba(15,29,46,0.4)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
                      }}>
                        <div style={{width:2, height:24, borderRadius:1, background:`linear-gradient(180deg, var(${v}), var(${v}-l))`, opacity:0.7}}/>
                        <span style={{fontSize:14, color:'var(--p-text-1)', flex:1, fontWeight:500}}>{n}</span>
                        <span style={{width:14,height:14,color:'var(--p-text-m)'}}>{Icon.arrowR}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};

// ─── DIET (sketch) ────────────────────────────────────────────────
window.DietPage = function DietPage() {
  const meals = [
    { n:'Breakfast', k:420, p:38, c:42, f:12, items:['Oats', 'Whey', 'Banana'] },
    { n:'Lunch', k:680, p:55, c:60, f:24, items:['Chicken', 'Rice', 'Veg'] },
    { n:'Snack', k:240, p:20, c:30, f:5, items:['Greek yogurt', 'Berries'] },
    { n:'Dinner', k:0, p:0, c:0, f:0, items:[], empty: true },
  ];
  const tot = { k:1340, kt:2400, p:113, pt:180, c:132, ct:280, f:41, ft:80 };
  return (
    <div className="p-screen" style={{ background: 'var(--p-deep)' }}>
      <ScreenChrome title="Diet" sub="FRIDAY · MAY 8" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>
          {/* Calorie ring */}
          <div className="p-fade" style={{
            padding: 22, borderRadius: 20, textAlign:'center',
            background:'linear-gradient(180deg, rgba(var(--p-accent-rgb),0.06), rgba(255,255,255,0))',
            border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
          }}>
            <div style={{position:'relative', width:180, height:180, margin:'0 auto'}}>
              <svg viewBox="0 0 200 200" style={{width:'100%',height:'100%',transform:'rotate(-90deg)'}}>
                <defs>
                  <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--p-accent)"/>
                    <stop offset="100%" stopColor="var(--p-violet)"/>
                  </linearGradient>
                </defs>
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14"/>
                <circle cx="100" cy="100" r="85" fill="none" stroke="url(#ring-grad)" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={`${(tot.k/tot.kt)*534} 534`} style={{filter:'drop-shadow(0 0 8px rgba(var(--p-accent-rgb),0.5))'}}/>
              </svg>
              <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center'}}>
                <div style={{textAlign:'center'}}>
                  <div className="p-mono" style={{fontSize:36, fontWeight:700, color:'var(--p-text-1)', lineHeight:1}}>{tot.k}</div>
                  <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:6, letterSpacing:'0.2em'}}>/ {tot.kt} KCAL</div>
                </div>
              </div>
            </div>
            {/* macro splits */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:18}}>
              {[
                ['PROTEIN', tot.p, tot.pt, 'var(--m-chest)'],
                ['CARBS',   tot.c, tot.ct, 'var(--p-accent)'],
                ['FAT',     tot.f, tot.ft, 'var(--m-quads)'],
              ].map(([n,v,tg,c])=>(
                <div key={n} style={{textAlign:'center'}}>
                  <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.15em'}}>{n}</div>
                  <div className="p-mono" style={{fontSize:18, fontWeight:600, color:'var(--p-text-1)', marginTop:4}}>{v}<span style={{fontSize:10, color:'var(--p-text-m)'}}>/{tg}g</span></div>
                  <div style={{height:2, marginTop:6, background:'rgba(255,255,255,0.06)', borderRadius:1}}>
                    <div style={{width:`${(v/tg)*100}%`, height:'100%', background:c, boxShadow:`0 0 6px ${c}`, borderRadius:1}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meals */}
          <div className="p-fade" style={{marginTop:22, animationDelay:'0.1s'}}>
            <div className="p-eyebrow" style={{marginBottom:12}}>Meals</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {meals.map((m,i)=>(
                <div key={i} style={{
                  padding:'14px 16px', borderRadius:14, cursor:'pointer',
                  background: m.empty ? 'transparent' : 'rgba(15,29,46,0.5)',
                  border: m.empty ? '1px dashed var(--p-border-soft)' : '1px solid var(--p-border-soft)',
                  backdropFilter:'blur(20px)',
                }}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <span style={{fontSize:14, fontWeight:600, color: m.empty?'var(--p-text-m)':'var(--p-text-1)'}}>{m.n}</span>
                    {m.empty
                      ? <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:'var(--p-accent-l)', fontWeight:500}}><span style={{width:12,height:12}}>{Icon.plus}</span> Log</span>
                      : <span className="p-mono" style={{fontSize:13, color:'var(--p-text-1)'}}>{m.k} <span style={{color:'var(--p-text-m)', fontSize:10}}>kcal</span></span>
                    }
                  </div>
                  {!m.empty && (
                    <div style={{marginTop:6, display:'flex', gap:8, alignItems:'center'}}>
                      <span className="p-mono" style={{fontSize:10, color:'var(--p-text-m)'}}>{m.items.join(' · ')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <window.BottomNavV3 active="diet" />
    </div>
  );
};

// ─── SETTINGS ─────────────────────────────────────────────────────
window.SettingsPage = function SettingsPage() {
  const sections = [
    { label: 'Profile', items: [
      ['Name', 'Marcus'],
      ['Units', 'Kilograms'],
      ['Default rest', '2 min'],
    ]},
    { label: 'Library', items: [
      ['Mesocycles', '2 active · 4 archived', 'arrow'],
      ['Splits', '4 templates', 'arrow'],
      ['Exercises', '78 lifts', 'arrow'],
    ]},
    { label: 'Appearance', items: [
      ['Theme', 'Dark · sky / violet', 'arrow'],
      ['Density', 'Comfy', 'arrow'],
      ['Motion', 'Full · breathing', 'arrow'],
    ]},
    { label: 'Account', items: [
      ['Export data', '', 'arrow'],
      ['Log out', '', 'arrow'],
    ]},
  ];
  return (
    <div className="p-screen" style={{ background: 'var(--p-deep)' }}>
      <ScreenChrome title="Settings" sub="" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>
          {/* profile head */}
          <div className="p-fade" style={{textAlign:'center', padding:'10px 0 24px'}}>
            <div style={{ width:80, height:80, margin:'0 auto', borderRadius:26, background:'var(--p-grad)', display:'grid', placeItems:'center', boxShadow:'0 12px 40px -8px rgba(var(--p-accent-rgb),0.5)' }}>
              <span className="p-display" style={{fontSize:34, color:'white', fontStyle:'italic'}}>M</span>
            </div>
            <div className="p-display" style={{fontSize:24, color:'var(--p-text-1)', marginTop:14, fontStyle:'italic'}}>Marcus</div>
            <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:6, letterSpacing:'0.2em'}}>184 DAYS · 142 WORKOUTS</div>
          </div>

          {sections.map((sec,i)=>(
            <div key={i} className="p-fade" style={{ marginBottom: 20, animationDelay: `${0.05*(i+1)}s` }}>
              <div className="p-eyebrow" style={{marginBottom:10}}>{sec.label}</div>
              <div style={{borderRadius:14, overflow:'hidden', border:'1px solid var(--p-border-soft)', background:'rgba(15,29,46,0.5)', backdropFilter:'blur(20px)'}}>
                {sec.items.map((it,ii)=>(
                  <div key={ii} style={{display:'flex', alignItems:'center', padding:'14px 16px', borderBottom: ii<sec.items.length-1 ? '1px solid var(--p-border-soft)':'none'}}>
                    <span style={{fontSize:14, color:'var(--p-text-1)', flex:1}}>{it[0]}</span>
                    {it[1] && <span className="p-mono" style={{fontSize:11, color:'var(--p-text-m)', marginRight: it[2]?10:0}}>{it[1]}</span>}
                    {it[2] && <span style={{width:14,height:14,color:'var(--p-text-m)'}}>{Icon.arrowR}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};
