/* global React, PStatusBar, Icon, PLogoBadge */
const { useState: usMP } = React;

// ── shared helpers ─────────────────────────────────────────────────
function mvar(g) {
  return ({chest:'--m-chest',back:'--m-back',shoulders:'--m-shoulders',triceps:'--m-triceps',quads:'--m-quads',hamstrings:'--m-hams',hams:'--m-hams',biceps:'--m-biceps',glutes:'--m-glutes',calves:'--m-calves',core:'--m-core',traps:'--m-traps'})[g] || '--p-accent';
}

function Bg() {
  return (
    <>
      <div className="wave-bg">
        <div className="aurora"/>
        <div className="blob b1"/><div className="blob b2"/><div className="blob b3"/><div className="blob b4"/>
      </div>
      <div className="grain soft"/>
      <div className="screen-vignette"/>
    </>
  );
}

function Chrome({ title, sub, back = true, settings = true }) {
  return (
    <>
      <Bg />
      <PStatusBar />
      <div style={{ padding:'4px 22px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:2 }}>
        {back
          ? <button style={{ width:36,height:36,borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-2)', display:'grid', placeItems:'center' }}><span style={{width:14,height:14,transform:'rotate(180deg)',display:'inline-block'}}>{Icon.arrowR}</span></button>
          : <div style={{width:36}}/>}
        <div style={{ textAlign:'center' }}>
          <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.22em'}}>{sub}</div>
          <div className="p-display" style={{fontSize:18, color:'var(--p-text-1)', marginTop:1, fontStyle:'italic'}}>{title}</div>
        </div>
        {settings
          ? <button style={{ width:36,height:36,borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-2)', display:'grid', placeItems:'center' }}><span style={{width:14,height:14}}>{Icon.dots}</span></button>
          : <div style={{width:36}}/>}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// MESOCYCLE DETAIL — single meso, all weeks visible, next session CTA
// ─────────────────────────────────────────────────────────────────
window.MesocycleDetailPage = function MesocycleDetailPage() {
  // 4-week meso: rows = sessions per week, cols = weeks
  const sessions = ['Upper A','Lower A','Upper B','Lower B'];
  // [weekIdx][sessionIdx] → 'done' | 'current' | 'queued' | 'deload-queued' | 'deload-done'
  const grid = [
    ['done','done','done','done'],
    ['done','done','current','queued'],
    ['queued','queued','queued','queued'],
    ['deload-queued','deload-queued','deload-queued','deload-queued'],
  ];
  const volume = [
    { g:'chest', sets:32, peak:38 },
    { g:'back',  sets:28, peak:38 },
    { g:'shoulders', sets:18, peak:24 },
    { g:'quads', sets:22, peak:28 },
    { g:'hams',  sets:14, peak:20 },
    { g:'biceps',sets:12, peak:18 },
    { g:'triceps',sets:12, peak:18 },
  ];
  return (
    <div className="p-screen" style={{ background:'var(--p-deep)' }}>
      <Chrome title="Mass — Phase 2" sub="MESOCYCLE · ACTIVE" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>

          {/* hero */}
          <div className="p-fade" style={{ textAlign:'center', padding:'4px 0 18px' }}>
            <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', letterSpacing:'0.28em'}}>PROGRESS</div>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'center', gap:6, marginTop:10}}>
              <div className="p-grad-text" style={{
                fontSize: 78, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.9,
                filter: 'drop-shadow(0 0 28px rgba(var(--p-accent-rgb),0.35))',
              }}>40</div>
              <div className="p-grad-text" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1, opacity: 0.7 }}>%</div>
            </div>
            <div className="p-mono" style={{fontSize:11, color:'var(--p-accent-l)', marginTop:6, letterSpacing:'0.2em'}}>
              6 / 16 SESSIONS · WEEK 2 OF 4
            </div>
            <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', marginTop:6, letterSpacing:'0.22em'}}>
              UPPER / LOWER · 4× WEEK
            </div>
          </div>

          {/* week grid */}
          <div className="p-fade" style={{
            padding: 16, borderRadius: 18, marginTop: 4,
            background: 'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
            animationDelay:'0.05s',
          }}>
            <div style={{display:'grid', gridTemplateColumns:'60px repeat(4, 1fr)', gap:6, alignItems:'center', marginBottom:8}}>
              <div/>
              {['W1','W2','W3','W4'].map((w,i)=>(
                <div key={w} className="p-mono" style={{fontSize:9, color: i===3?'var(--m-quads-l)':'var(--p-text-m)', letterSpacing:'0.18em', textAlign:'center'}}>
                  {w}{i===3?' · D':''}
                </div>
              ))}
            </div>
            {sessions.map((s, ri)=>(
              <div key={ri} style={{display:'grid', gridTemplateColumns:'60px repeat(4, 1fr)', gap:6, alignItems:'center', marginBottom: ri<3?5:0}}>
                <div className="p-mono" style={{fontSize:10, color:'var(--p-text-2)', whiteSpace:'nowrap'}}>{s}</div>
                {[0,1,2,3].map(wi=>{
                  const st = grid[wi][ri];
                  const cur = st==='current';
                  const done = st==='done';
                  const deload = st.startsWith('deload');
                  return (
                    <div key={wi} style={{
                      height: 26, borderRadius: 7,
                      background: cur ? 'var(--p-grad)'
                        : done ? 'rgba(var(--p-accent-rgb),0.18)'
                        : deload ? 'rgba(234,179,8,0.10)'
                        : 'rgba(255,255,255,0.03)',
                      border: cur ? 'none'
                        : done ? '1px solid rgba(var(--p-accent-rgb),0.30)'
                        : deload ? '1px solid rgba(234,179,8,0.25)'
                        : '1px solid rgba(255,255,255,0.06)',
                      display:'grid', placeItems:'center',
                      boxShadow: cur ? '0 0 14px rgba(var(--p-accent-rgb),0.55)' : 'none',
                    }}>
                      {done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--p-accent-l)" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
                      {cur && <span style={{width:5,height:5,borderRadius:'50%',background:'white'}}/>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* up-next CTA */}
          <div className="p-fade" style={{ marginTop: 14, animationDelay: '0.1s' }}>
            <div style={{
              padding: 16, borderRadius: 16, position:'relative', overflow:'hidden',
              background: 'linear-gradient(180deg, rgba(var(--p-accent-rgb),0.12), rgba(15,29,46,0.6))',
              border: '1px solid rgba(var(--p-accent-rgb),0.30)',
              backdropFilter:'blur(24px)',
              boxShadow:'0 20px 50px -22px rgba(var(--p-accent-rgb),0.45)',
            }}>
              <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(var(--p-accent-rgb),0.20), transparent 70%)'}}/>
              <div style={{position:'relative', display:'flex', alignItems:'center', gap:14}}>
                <div style={{width:4, height:50, borderRadius:2, background:'var(--p-grad)'}}/>
                <div style={{flex:1}}>
                  <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.22em'}}>NEXT SESSION</div>
                  <div style={{fontSize:18, fontWeight:600, color:'var(--p-text-1)', marginTop:3, letterSpacing:'-0.01em'}}>Upper B · Week 2</div>
                  <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:2, letterSpacing:'0.18em'}}>4 LIFTS · ~52 MIN</div>
                </div>
                <button className="p-btn p-btn-grad" style={{height:42, padding:'0 16px', fontSize:12, letterSpacing:'0.18em'}}>
                  START
                  <span style={{width:12,height:12}}>{Icon.arrowR}</span>
                </button>
              </div>
            </div>
          </div>

          {/* volume by muscle */}
          <div className="p-fade" style={{ marginTop: 22, animationDelay: '0.15s' }}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 12}}>
              <div className="p-eyebrow">Volume · this week</div>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>SETS / PEAK</span>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8, padding:14, borderRadius:14, background:'rgba(15,29,46,0.4)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)'}}>
              {volume.map(v=>{
                const c = mvar(v.g);
                return (
                  <div key={v.g} style={{display:'grid', gridTemplateColumns:'78px 1fr 56px', gap:10, alignItems:'center'}}>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{width:7, height:7, borderRadius:'50%', background:`var(${c})`, boxShadow:`0 0 7px var(${c})`}}/>
                      <span className="p-mono" style={{fontSize:9, color:`var(${c}-l)`, letterSpacing:'0.15em', textTransform:'uppercase'}}>{v.g}</span>
                    </div>
                    <div style={{height:6, borderRadius:3, background:'rgba(255,255,255,0.05)', overflow:'hidden', position:'relative'}}>
                      <div style={{
                        width: `${(v.sets/v.peak)*100}%`, height:'100%',
                        background:`linear-gradient(90deg, var(${c}), var(${c}-l))`,
                        boxShadow:`0 0 8px var(${c})`,
                      }}/>
                    </div>
                    <div className="p-mono" style={{fontSize:11, color:'var(--p-text-2)', textAlign:'right'}}>
                      {v.sets}<span style={{color:'var(--p-text-m)'}}> / {v.peak}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* actions */}
          <div className="p-fade" style={{ marginTop:18, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, animationDelay:'0.2s' }}>
            <button style={{ height:46, borderRadius:13, background:'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-1)', fontSize:13, fontWeight:500, cursor:'pointer' }}>Edit</button>
            <button style={{ height:46, borderRadius:13, background:'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', color:'var(--p-text-m)', fontSize:13, fontWeight:500, cursor:'pointer' }}>Archive</button>
          </div>

        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// MESOCYCLES (list) — v5 polish, replaces other-pages version on canvas
// ─────────────────────────────────────────────────────────────────
window.MesocyclesV5Page = function MesocyclesV5Page() {
  return (
    <div className="p-screen" style={{ background:'var(--p-deep)' }}>
      <Chrome title="Mesocycles" sub="2 ACTIVE · 4 ARCHIVED" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>
          {/* hero meso */}
          <div className="p-fade" style={{
            borderRadius: 20, padding: 20, position:'relative', overflow:'hidden',
            background:'linear-gradient(180deg, rgba(var(--p-accent-rgb),0.14), rgba(15,29,46,0.6))',
            border:'1px solid rgba(var(--p-accent-rgb),0.30)', backdropFilter:'blur(20px)',
          }}>
            <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(var(--p-accent-rgb),0.20), transparent 70%)'}}/>
            <div style={{position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div className="p-mono" style={{fontSize:9, color:'var(--p-accent-l)', letterSpacing:'0.28em'}}>ACTIVE · WEEK 2</div>
                <div className="p-display" style={{fontSize:30, color:'var(--p-text-1)', lineHeight:1, marginTop:6, fontStyle:'italic', letterSpacing:'-0.02em'}}>Mass — Phase 2</div>
                <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:6, letterSpacing:'0.18em'}}>UPPER / LOWER · 4×WEEK</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="p-grad-text p-mono" style={{fontSize:32, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1}}>40<span style={{fontSize:14, opacity:0.6}}>%</span></div>
                <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em', marginTop:4}}>4 WEEKS</div>
              </div>
            </div>
            {/* mini progress strip */}
            <div style={{position:'relative', display:'flex', gap:4, marginTop:18}}>
              {[1,1,0.6,0.2,0,0,0,0,0,0,0,0,0,0,0,0].map((p,i)=>(
                <div key={i} style={{
                  flex:1, height: i===2?6:4, borderRadius:2,
                  background: p>0.5 ? 'var(--p-accent-l)'
                    : p>0 ? `color-mix(in oklab, var(--p-accent) ${Math.round(p*100)}%, rgba(255,255,255,0.06))`
                    : 'rgba(255,255,255,0.05)',
                  boxShadow: p>0.5 ? '0 0 6px var(--p-accent)':'none',
                  alignSelf:'center',
                }}/>
              ))}
            </div>
          </div>

          {/* second active */}
          <div className="p-fade" style={{ marginTop:12, animationDelay:'0.05s', padding:16, borderRadius:14, background:'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{width:3, height:46, borderRadius:2, background:`linear-gradient(180deg, var(--m-quads), var(--m-quads-l))`}}/>
            <div style={{flex:1}}>
              <div className="p-mono" style={{fontSize:9, color:'var(--m-quads-l)', letterSpacing:'0.22em'}}>ACTIVE · PAUSED</div>
              <div style={{fontSize:15, fontWeight:600, color:'var(--p-text-1)', marginTop:2}}>Endurance — Run</div>
              <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:2, letterSpacing:'0.15em'}}>5×WEEK · 6 WEEKS · 30%</div>
            </div>
            <span style={{width:14,height:14,color:'var(--p-text-m)'}}>{Icon.arrowR}</span>
          </div>

          {/* archived */}
          <div className="p-fade" style={{ marginTop:22, animationDelay:'0.1s' }}>
            <div className="p-eyebrow" style={{marginBottom:12}}>Archived · 4</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {[
                {n:'Mass — Phase 1', dates:'Mar 4 — Apr 1'},
                {n:'Strength block', dates:'Feb 1 — Mar 1'},
                {n:'Hypertrophy I', dates:'Jan 8 — Feb 1'},
                {n:'Base', dates:'Dec 9 — Jan 6'},
              ].map((m,i)=>(
                <button key={i} style={{
                  padding:'12px 14px', borderRadius:12, textAlign:'left', display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                  background:'rgba(15,29,46,0.4)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
                }}>
                  <div style={{width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.15)'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:500, color:'var(--p-text-2)'}}>{m.n}</div>
                    <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:2, letterSpacing:'0.1em'}}>{m.dates}</div>
                  </div>
                  <span className="p-mono" style={{fontSize:10, color:'var(--p-text-m)'}}>100%</span>
                </button>
              ))}
            </div>
          </div>

          <button className="p-btn p-btn-grad p-fade" style={{ width:'100%', height: 52, marginTop: 18, animationDelay:'0.2s' }}>
            <span style={{width:16,height:16}}>{Icon.plus}</span>
            New mesocycle
          </button>
        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// SPLITS LIST — color-coded split templates
// ─────────────────────────────────────────────────────────────────
window.SplitsPage = function SplitsPage() {
  const splits = [
    { name:'Upper / Lower', color:'--p-accent', days:[
      {n:'Upper A', groups:['chest','back','shoulders','triceps','biceps']},
      {n:'Lower A', groups:['quads','hams','glutes','calves']},
      {n:'Upper B', groups:['back','chest','shoulders','biceps','triceps']},
      {n:'Lower B', groups:['hams','quads','glutes','calves']},
    ], active:true },
    { name:'Push · Pull · Legs', color:'--m-triceps', days:[
      {n:'Push', groups:['chest','shoulders','triceps']},
      {n:'Pull', groups:['back','biceps']},
      {n:'Legs', groups:['quads','hams','glutes','calves']},
    ] },
    { name:'Full body — 3 day', color:'--m-back', days:[
      {n:'Day A', groups:['chest','back','quads']},
      {n:'Day B', groups:['shoulders','hams','core']},
      {n:'Day C', groups:['chest','back','glutes']},
    ] },
    { name:'Bro split', color:'--m-quads', days:[
      {n:'Chest', groups:['chest']},
      {n:'Back', groups:['back']},
      {n:'Legs', groups:['quads','hams']},
      {n:'Shoulders', groups:['shoulders']},
      {n:'Arms', groups:['biceps','triceps']},
    ] },
  ];
  return (
    <div className="p-screen" style={{ background:'var(--p-deep)' }}>
      <Chrome title="Splits" sub="4 TEMPLATES" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            {splits.map((s, si)=>(
              <div key={si} className="p-fade" style={{
                position:'relative', overflow:'hidden',
                padding: 16, borderRadius: 18,
                background: s.active
                  ? `linear-gradient(180deg, color-mix(in oklab, var(${s.color}) 14%, rgba(15,29,46,0.5)), rgba(15,29,46,0.6))`
                  : 'rgba(15,29,46,0.45)',
                border: s.active
                  ? `1px solid color-mix(in oklab, var(${s.color}) 35%, var(--p-border-soft))`
                  : '1px solid var(--p-border-soft)',
                backdropFilter:'blur(20px)',
                animationDelay: `${si*0.04}s`,
              }}>
                {s.active && <div style={{position:'absolute', inset:0, pointerEvents:'none', background:`radial-gradient(ellipse 70% 50% at 0% 0%, color-mix(in oklab, var(${s.color}) 18%, transparent), transparent 70%)`}}/>}

                <div style={{position:'relative', display:'flex', alignItems:'center', gap:14, marginBottom:14}}>
                  <div style={{width:4, height:38, borderRadius:2, background:`linear-gradient(180deg, var(${s.color}), var(${s.color}-l, var(${s.color})))`, boxShadow:`0 0 12px var(${s.color})`}}/>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <div style={{fontSize:17, fontWeight:600, color:'var(--p-text-1)', letterSpacing:'-0.01em'}}>{s.name}</div>
                      {s.active && <span className="p-mono" style={{fontSize:8, color:`var(${s.color}-l, var(${s.color}))`, letterSpacing:'0.22em', padding:'2px 7px', borderRadius:100, border:`1px solid color-mix(in oklab, var(${s.color}) 40%, transparent)`, background:`color-mix(in oklab, var(${s.color}) 12%, transparent)`}}>· LIVE</span>}
                    </div>
                    <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:3, letterSpacing:'0.18em'}}>{s.days.length} DAYS · {s.days.reduce((a,d)=>a+d.groups.length,0)} GROUPS</div>
                  </div>
                  <span style={{width:14,height:14,color:'var(--p-text-m)'}}>{Icon.arrowR}</span>
                </div>

                <div style={{position:'relative', display:'flex', flexDirection:'column', gap:4}}>
                  {s.days.map((d,di)=>(
                    <div key={di} style={{display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderTop: di>0?'1px solid rgba(255,255,255,0.04)':'none'}}>
                      <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em', width:18}}>D{di+1}</span>
                      <span style={{fontSize:12, fontWeight:500, color:'var(--p-text-2)', minWidth:64}}>{d.n}</span>
                      <div style={{flex:1, display:'flex', gap:4, flexWrap:'wrap'}}>
                        {d.groups.map((g,gi)=>{
                          const c = mvar(g);
                          return (
                            <span key={gi} style={{
                              display:'inline-flex', alignItems:'center', gap:4,
                              padding:'2px 7px', borderRadius:100,
                              fontSize:9, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase',
                              background:`color-mix(in oklab, var(${c}) 12%, transparent)`,
                              border:`1px solid color-mix(in oklab, var(${c}) 25%, transparent)`,
                              color:`var(${c}-l)`,
                            }}>
                              <span style={{width:4, height:4, borderRadius:'50%', background:`var(${c})`}}/>
                              {g}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="p-btn p-fade" style={{ width:'100%', height: 50, marginTop: 14, background:'transparent', border:'1px dashed var(--p-border-soft)', color:'var(--p-accent-l)', animationDelay:'0.2s' }}>
            <span style={{width:14,height:14}}>{Icon.plus}</span>
            New split
          </button>
        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// SPLIT EDITOR — editing one split day by day
// ─────────────────────────────────────────────────────────────────
window.SplitEditorPage = function SplitEditorPage() {
  const [expanded, setExpanded] = usMP(0);
  const days = [
    { n:'Upper A', exs:[
      {g:'chest', n:'Dumbbell Bench Press'},
      {g:'back',  n:'Barbell Row'},
      {g:'shoulders', n:'OH Press'},
      {g:'triceps', n:'OH Triceps Extension'},
      {g:'biceps', n:'Incline DB Curl'},
    ]},
    { n:'Lower A', exs:[
      {g:'quads', n:'Back Squat'},
      {g:'hams',  n:'Romanian Deadlift'},
      {g:'glutes', n:'Hip Thrust'},
      {g:'calves', n:'Standing Calf Raise'},
    ]},
    { n:'Upper B', exs:[
      {g:'back', n:'Pull-up'},
      {g:'chest', n:'Incline DB Press'},
    ]},
    { n:'Lower B', exs:[] },
  ];
  return (
    <div className="p-screen" style={{ background:'var(--p-deep)' }}>
      <Chrome title="Upper / Lower" sub="EDIT SPLIT · UNSAVED" />
      <div className="p-scroll" style={{ paddingBottom: 130 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>

          {/* name + color */}
          <div className="p-fade" style={{
            padding:14, borderRadius:14, background:'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
            display:'flex', alignItems:'center', gap:12,
          }}>
            <button style={{width:36, height:36, borderRadius:10, background:'var(--p-grad)', border:'none', boxShadow:'0 0 16px rgba(var(--p-accent-rgb),0.55)', cursor:'pointer'}}/>
            <div style={{flex:1}}>
              <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>SPLIT NAME</div>
              <div style={{fontSize:15, fontWeight:600, color:'var(--p-text-1)', marginTop:2}}>Upper / Lower</div>
            </div>
            <span style={{width:14,height:14,color:'var(--p-text-m)'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </span>
          </div>

          {/* color picker swatches */}
          <div className="p-fade" style={{marginTop:10, display:'flex', gap:6, animationDelay:'0.04s'}}>
            {['--p-accent','--m-chest','--m-back','--m-quads','--m-triceps','--m-shoulders','--m-glutes','--m-calves'].map((c,i)=>(
              <button key={c} style={{
                width:30, height:30, borderRadius:10, cursor:'pointer',
                background: `linear-gradient(135deg, var(${c}), var(${c}-l, var(${c})))`,
                border: i===0?'2px solid var(--p-text-1)':'1px solid var(--p-border-soft)',
                boxShadow: i===0?`0 0 10px var(${c})`:'none',
                outline: i===0?'2px solid rgba(255,255,255,0.1)':'none',
                outlineOffset: 2,
              }}/>
            ))}
          </div>

          {/* days */}
          <div className="p-fade" style={{marginTop:20, animationDelay:'0.08s'}}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10}}>
              <div className="p-eyebrow">Days · 4</div>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>DRAG TO REORDER</span>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {days.map((d, di)=>{
                const open = expanded === di;
                return (
                  <div key={di} style={{
                    borderRadius:14, background:'rgba(15,29,46,0.5)', border: open ? '1px solid rgba(var(--p-accent-rgb),0.30)' : '1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', overflow:'hidden',
                  }}>
                    <button onClick={()=>setExpanded(open?-1:di)} style={{
                      width:'100%', padding:'12px 14px', display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                      background:'transparent', border:'none', textAlign:'left',
                    }}>
                      <span style={{width:14, height:14, color:'var(--p-text-d)'}}>{Icon.drag}</span>
                      <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em', width:18}}>D{di+1}</span>
                      <span style={{flex:1, fontSize:14, fontWeight:600, color: open?'var(--p-text-1)':'var(--p-text-2)'}}>{d.n || <span style={{color:'var(--p-text-d)', fontWeight:400, fontStyle:'italic'}}>Untitled</span>}</span>
                      <span className="p-mono" style={{fontSize:10, color:'var(--p-text-m)'}}>{d.exs.length} {d.exs.length===1?'lift':'lifts'}</span>
                      <span style={{width:12, height:12, color:'var(--p-text-m)', transform: open?'rotate(90deg)':'none', transition:'transform 0.2s'}}>{Icon.arrowR}</span>
                    </button>
                    {open && (
                      <div style={{padding:'0 12px 12px'}}>
                        <div style={{display:'flex', flexDirection:'column', gap:5}}>
                          {d.exs.map((e, ei)=>{
                            const c = mvar(e.g);
                            return (
                              <div key={ei} style={{
                                display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10,
                                background:'rgba(255,255,255,0.02)', border:'1px solid var(--p-border-soft)',
                              }}>
                                <span style={{width:12, height:12, color:'var(--p-text-d)'}}>{Icon.drag}</span>
                                <div style={{width:2, height:18, borderRadius:1, background:`linear-gradient(180deg, var(${c}), var(${c}-l))`}}/>
                                <div style={{flex:1, minWidth:0}}>
                                  <div style={{fontSize:13, color:'var(--p-text-1)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.n}</div>
                                  <div className="p-mono" style={{fontSize:9, color:`var(${c}-l)`, letterSpacing:'0.15em', textTransform:'uppercase'}}>{e.g}</div>
                                </div>
                                <button style={{width:24, height:24, borderRadius:6, background:'transparent', border:'none', color:'var(--p-text-d)', cursor:'pointer', display:'grid', placeItems:'center'}}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            );
                          })}
                          {d.exs.length === 0 && (
                            <div style={{padding:'14px 12px', textAlign:'center', borderRadius:10, border:'1px dashed var(--p-border-soft)'}}>
                              <span className="p-mono" style={{fontSize:10, color:'var(--p-text-d)', letterSpacing:'0.18em'}}>NO LIFTS YET</span>
                            </div>
                          )}
                          <button style={{
                            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                            padding:'10px 12px', borderRadius:10,
                            background:'transparent', border:'1px dashed var(--p-border-soft)',
                            color:'var(--p-accent-l)', fontSize:12, fontWeight:500, cursor:'pointer',
                          }}>
                            <span style={{width:12,height:12}}>{Icon.plus}</span>
                            Add lift
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                padding:'12px 12px', borderRadius:12, marginTop:4,
                background:'transparent', border:'1px dashed var(--p-border-soft)',
                color:'var(--p-text-m)', fontSize:12, fontWeight:500, cursor:'pointer',
              }}>
                <span style={{width:12,height:12}}>{Icon.plus}</span>
                Add day
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Sticky save bar */}
      <div style={{
        position:'absolute', left:18, right:18, bottom: 96,
        padding:8, borderRadius:18, display:'flex', gap:8, zIndex:4,
        background:'rgba(15,29,46,0.85)', backdropFilter:'blur(24px) saturate(180%)',
        border:'1px solid var(--p-border-soft)', boxShadow:'0 12px 40px -10px rgba(0,0,0,0.6)',
      }}>
        <button style={{flex:1, height:42, borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid var(--p-border-soft)', color:'var(--p-text-2)', fontSize:13, fontWeight:500, cursor:'pointer'}}>Discard</button>
        <button className="p-btn p-btn-grad" style={{flex:2, height:42, borderRadius:12, fontSize:13, letterSpacing:'0.18em'}}>SAVE SPLIT</button>
      </div>

      <window.BottomNavV3 active="home" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// PROGRESS — exercise sparkline + stats + volume by week
// ─────────────────────────────────────────────────────────────────
function Sparkline({ pts, color = '--p-accent', height = 70, fill = true }) {
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const w = 312;
  const h = height;
  const stepX = w / (pts.length - 1);
  const ys = pts.map(v => h - ((v - min) / range) * (h - 10) - 5);
  const xs = pts.map((_, i) => i * stepX);
  const d = pts.map((_,i)=>`${i===0?'M':'L'}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const dFill = `M${xs[0]},${h} L${xs[0]},${ys[0]} ` + xs.slice(1).map((x,i)=>`L${x.toFixed(1)},${ys[i+1].toFixed(1)}`).join(' ') + ` L${xs[xs.length-1]},${h} Z`;
  const id = React.useId().replace(/:/g, '');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{display:'block', overflow:'visible'}}>
      <defs>
        <linearGradient id={`sp-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={`var(${color})`} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={`var(${color})`} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {fill && <path d={dFill} fill={`url(#sp-${id})`}/>}
      <path d={d} fill="none" stroke={`var(${color}-l)`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 6px var(${color}))`}}/>
      {pts.map((_,i)=>{
        const isLast = i === pts.length - 1;
        return <circle key={i} cx={xs[i]} cy={ys[i]} r={isLast?3.5:0} fill={`var(${color}-l)`} stroke="white" strokeWidth={isLast?1.5:0} style={isLast?{filter:`drop-shadow(0 0 8px var(${color}))`}:null}/>;
      })}
    </svg>
  );
}

window.ProgressPage = function ProgressPage() {
  const [period, setPeriod] = usMP('8w');
  const series = [60, 62.5, 65, 65, 67.5, 70, 70, 72.5];
  const others = [
    { g:'back',  n:'Barbell Row', pts:[40,42.5,42.5,45,45,47.5,47.5,50], delta:'+25%' },
    { g:'quads', n:'Back Squat',  pts:[80,82.5,85,87.5,90,90,92.5,95], delta:'+19%' },
    { g:'shoulders', n:'OH Press', pts:[35,35,37.5,37.5,37.5,40,40,40], delta:'+14%' },
    { g:'biceps', n:'Incline DB Curl', pts:[12,12,14,14,14,16,16,16], delta:'+33%' },
  ];
  const weeklyVolume = [
    {w:'W1', v:12400},
    {w:'W2', v:13200},
    {w:'W3', v:14100},
    {w:'W4', v:11800},
    {w:'W5', v:14600},
    {w:'W6', v:15400},
    {w:'W7', v:16200},
    {w:'W8', v:17100},
  ];
  const maxV = Math.max(...weeklyVolume.map(x=>x.v));
  return (
    <div className="p-screen" style={{ background:'var(--p-deep)' }}>
      <Chrome title="Progress" sub="LAST 8 WEEKS" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>

          {/* hero: dumbbell bench press */}
          <div className="p-fade" style={{
            padding: 20, borderRadius: 20, position:'relative', overflow:'hidden',
            background:'linear-gradient(180deg, color-mix(in oklab, var(--m-chest) 12%, rgba(15,29,46,0.6)), rgba(15,29,46,0.6))',
            border:'1px solid color-mix(in oklab, var(--m-chest) 28%, var(--p-border-soft))',
            backdropFilter:'blur(24px)',
          }}>
            <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklab, var(--m-chest) 22%, transparent), transparent 70%)'}}/>
            <div style={{position:'relative', display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
              <div>
                <div style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <span style={{width:8, height:8, borderRadius:'50%', background:'var(--m-chest)', boxShadow:'0 0 10px var(--m-chest)'}}/>
                  <span className="p-mono" style={{fontSize:9, color:'var(--m-chest-l)', letterSpacing:'0.22em'}}>CHEST</span>
                </div>
                <div style={{fontSize:22, fontWeight:600, color:'var(--p-text-1)', marginTop:4, letterSpacing:'-0.015em'}}>Dumbbell Bench Press</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.2em'}}>EST 1RM</div>
                <div className="p-mono" style={{fontSize:24, fontWeight:700, color:'var(--p-text-1)', lineHeight:1, marginTop:2, letterSpacing:'-0.02em'}}>96<span style={{fontSize:11, color:'var(--p-text-m)', fontWeight:500}}>kg</span></div>
              </div>
            </div>
            <div style={{position:'relative', marginTop:14}}>
              <Sparkline pts={series} color="--m-chest" height={82}/>
            </div>
            <div style={{position:'relative', display:'flex', justifyContent:'space-between', marginTop:6}}>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>MAR 4</span>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>NOW</span>
            </div>
          </div>

          {/* stats trio */}
          <div className="p-fade" style={{marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, animationDelay:'0.05s'}}>
            {[
              { l:'BEST SET',  v:'72.5×8', s:'+5kg' },
              { l:'TREND',     v:'+21%', s:'8 WK' },
              { l:'CONSISTENCY', v:'94%', s:'18/19' },
            ].map((s,i)=>(
              <div key={i} style={{padding:'12px 12px', borderRadius:13, background:'rgba(15,29,46,0.45)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)'}}>
                <div className="p-mono" style={{fontSize:8, color:'var(--p-text-m)', letterSpacing:'0.18em'}}>{s.l}</div>
                <div className="p-mono" style={{fontSize:16, fontWeight:700, color:'var(--p-text-1)', marginTop:4, letterSpacing:'-0.01em'}}>{s.v}</div>
                <div className="p-mono" style={{fontSize:9, color:'var(--m-chest-l)', marginTop:2, letterSpacing:'0.15em'}}>{s.s}</div>
              </div>
            ))}
          </div>

          {/* period toggle */}
          <div className="p-fade" style={{marginTop:18, display:'flex', gap:4, padding:4, borderRadius:12, background:'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)', animationDelay:'0.08s'}}>
            {[['4w','4 WEEKS'], ['8w','8 WEEKS'], ['12w','12 WEEKS'], ['all','ALL']].map(([id,lbl])=>(
              <button key={id} onClick={()=>setPeriod(id)} style={{
                flex:1, height:32, borderRadius:8, background: period===id?'rgba(var(--p-accent-rgb),0.18)':'transparent',
                border: period===id?'1px solid rgba(var(--p-accent-rgb),0.35)':'1px solid transparent',
                color: period===id?'var(--p-accent-l)':'var(--p-text-m)', cursor:'pointer',
                fontSize: 10, fontFamily:'var(--p-mono)', fontWeight:600, letterSpacing:'0.15em',
              }}>{lbl}</button>
            ))}
          </div>

          {/* weekly volume */}
          <div className="p-fade" style={{marginTop:22, animationDelay:'0.12s'}}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12}}>
              <div className="p-eyebrow">Weekly volume</div>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-accent-l)', letterSpacing:'0.18em'}}>+38% · 8WK</span>
            </div>
            <div style={{
              padding:'18px 14px 12px', borderRadius:14, background:'rgba(15,29,46,0.4)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
            }}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gap:6, alignItems:'end', height:96}}>
                {weeklyVolume.map((d,i)=>{
                  const h = (d.v / maxV) * 92;
                  return (
                    <div key={i} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                      <div style={{
                        width:'100%', height: h, borderRadius:'3px 3px 0 0',
                        background: i===weeklyVolume.length-1
                          ? 'linear-gradient(180deg, var(--p-accent-l), var(--p-accent))'
                          : 'linear-gradient(180deg, color-mix(in oklab, var(--p-accent) 30%, rgba(255,255,255,0.08)), rgba(255,255,255,0.03))',
                        boxShadow: i===weeklyVolume.length-1 ? '0 0 10px rgba(var(--p-accent-rgb),0.5)' : 'none',
                      }}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gap:6, marginTop:8}}>
                {weeklyVolume.map(d=>(
                  <div key={d.w} className="p-mono" style={{fontSize:8, color:'var(--p-text-m)', textAlign:'center', letterSpacing:'0.1em'}}>{d.w}</div>
                ))}
              </div>
            </div>
          </div>

          {/* other exercises */}
          <div className="p-fade" style={{marginTop:22, animationDelay:'0.16s'}}>
            <div className="p-eyebrow" style={{marginBottom:10}}>Other lifts</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {others.map((o,i)=>{
                const c = mvar(o.g);
                return (
                  <div key={i} style={{
                    padding:'12px 14px', borderRadius:13, display:'grid', gridTemplateColumns:'1fr 110px 56px', gap:12, alignItems:'center', cursor:'pointer',
                    background:'rgba(15,29,46,0.45)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
                  }}>
                    <div>
                      <div style={{display:'inline-flex', alignItems:'center', gap:5}}>
                        <span style={{width:6, height:6, borderRadius:'50%', background:`var(${c})`, boxShadow:`0 0 6px var(${c})`}}/>
                        <span className="p-mono" style={{fontSize:8, color:`var(${c}-l)`, letterSpacing:'0.18em', textTransform:'uppercase'}}>{o.g}</span>
                      </div>
                      <div style={{fontSize:13, fontWeight:500, color:'var(--p-text-1)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{o.n}</div>
                    </div>
                    <div style={{width:110, height:28}}>
                      <svg width="100%" height="100%" viewBox="0 0 110 28" preserveAspectRatio="none">
                        {(()=>{
                          const min = Math.min(...o.pts), max = Math.max(...o.pts), r = max-min||1;
                          const d = o.pts.map((v,i)=>`${i===0?'M':'L'}${(i*110/(o.pts.length-1)).toFixed(1)},${(24 - ((v-min)/r)*22).toFixed(1)}`).join(' ');
                          return <path d={d} fill="none" stroke={`var(${c}-l)`} strokeWidth="1.5" strokeLinecap="round" style={{filter:`drop-shadow(0 0 4px var(${c}))`}}/>;
                        })()}
                      </svg>
                    </div>
                    <div className="p-mono" style={{fontSize:11, color:`var(${c}-l)`, textAlign:'right', fontWeight:600, letterSpacing:'0.05em'}}>{o.delta}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
      <window.BottomNavV3 active="home" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// EXERCISES LIBRARY — refined v5 (search + filter chips + grouped)
// ─────────────────────────────────────────────────────────────────
window.ExercisesV5Page = function ExercisesV5Page() {
  const [mg, setMg] = usMP(new Set(['chest']));
  const [eq, setEq] = usMP(new Set());

  const toggleMg = g => setMg(prev => {
    const next = new Set(prev);
    next.has(g) ? next.delete(g) : next.add(g);
    return next;
  });
  const toggleEq = e => setEq(prev => {
    const next = new Set(prev);
    next.has(e) ? next.delete(e) : next.add(e);
    return next;
  });

  const rows = [
    { label:'PUSH', groups:['chest','shoulders','triceps'] },
    { label:'PULL', groups:['back','biceps','traps'] },
    { label:'LEGS', groups:['quads','hams','glutes','calves'] },
    { label:'CORE', groups:['core'] },
  ];
  const equipment = [
    { id:'barbell',   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M2 12h2M20 12h2M5 8v8M19 8v8M8 10v4M16 10v4M8 12h8"/></svg> },
    { id:'dumbbell',  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M5 9v6M3 11v2M19 9v6M21 11v2M8 8v8M16 8v8M8 12h8"/></svg> },
    { id:'machine',   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10v4M16 10v4M10 8h4"/></svg> },
    { id:'cable',     icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3v8a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4v2"/><circle cx="5" cy="3" r="1.5"/><circle cx="19" cy="21" r="1.5"/></svg> },
    { id:'bodyweight',icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 8v6M9 11l3-2 3 2M9 21l3-7 3 7"/></svg> },
  ];

  const groups = [
    { g:'chest', exs:[
      {n:'Dumbbell Bench Press', last:'72.5kg · 4 wks ago', sets:148},
      {n:'Incline DB Press', last:'30kg · 6 days ago', sets:96},
      {n:'Cable Fly', last:'25kg · 2 days ago', sets:72},
      {n:'Push-up', last:'BW · 3 wks ago', sets:24},
    ]},
    { g:'back', exs:[
      {n:'Pull-up', last:'BW · 3 days ago', sets:88},
      {n:'Barbell Row', last:'70kg · 2 days ago', sets:104},
      {n:'Lat Pulldown', last:'55kg · 5 days ago', sets:72},
    ]},
    { g:'shoulders', exs:[
      {n:'OH Press', last:'40kg · 6 days ago', sets:64},
      {n:'Lateral Raise', last:'10kg · today', sets:80},
    ]},
  ];
  return (
    <div className="p-screen" style={{ background:'var(--p-deep)' }}>
      <Chrome title="Exercises" sub="78 LIFTS · 12 GROUPS" />
      <div className="p-scroll" style={{ paddingBottom: 110 }}>
        <div style={{ padding:'0 22px', position:'relative' }}>

          {/* search */}
          <div className="p-fade" style={{
            display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:14,
            background:'rgba(15,29,46,0.5)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--p-text-m)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
            <span style={{fontSize:14, color:'var(--p-text-m)', flex:1}}>Search lifts…</span>
            <span className="p-mono" style={{fontSize:9, color:'var(--p-text-d)', letterSpacing:'0.18em', padding:'2px 6px', borderRadius:5, border:'1px solid var(--p-border-soft)'}}>⌘K</span>
          </div>

          {/* muscle group rows — always visible */}
          <div className="p-fade" style={{
            marginTop:10, padding:'10px 12px', borderRadius:14,
            background:'rgba(15,29,46,0.4)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
            display:'flex', flexDirection:'column', gap:6,
            animationDelay:'0.04s',
          }}>
            {rows.map(row=>(
              <div key={row.label} style={{display:'flex', alignItems:'center', gap:8}}>
                <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.2em', width:30, flexShrink:0}}>{row.label}</span>
                <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                  {row.groups.map(g=>{
                    const v = mvar(g); const sel = mg.has(g);
                    return (
                      <button key={g} onClick={()=>toggleMg(g)} style={{
                        padding: '4px 9px', borderRadius: 100,
                        background: sel ? `color-mix(in oklab, var(${v}) 18%, transparent)` : 'transparent',
                        border: `1px solid ${sel ? `color-mix(in oklab, var(${v}) 40%, transparent)` : 'var(--p-border-soft)'}`,
                        color: sel ? `var(${v}-l)` : 'var(--p-text-2)',
                        fontSize: 10, fontWeight: 600, letterSpacing:'0.1em', textTransform:'uppercase',
                        display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer',
                        fontFamily:'var(--p-mono)',
                      }}>
                        <span style={{width:4,height:4,borderRadius:'50%', background:`var(${v})`, boxShadow: sel?`0 0 6px var(${v})`:'none'}}/>
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* equipment row */}
            <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, paddingTop:8, borderTop:'1px solid var(--p-border-soft)'}}>
              <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.2em', width:30, flexShrink:0}}>GEAR</span>
              <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                {equipment.map(e=>{
                  const sel = eq.has(e.id);
                  return (
                    <button key={e.id} onClick={()=>toggleEq(e.id)} style={{
                      padding:'4px 9px 4px 7px', borderRadius:100,
                      background: sel ? 'rgba(var(--p-accent-rgb),0.16)' : 'transparent',
                      border: sel ? '1px solid rgba(var(--p-accent-rgb),0.40)' : '1px solid var(--p-border-soft)',
                      color: sel ? 'var(--p-accent-l)' : 'var(--p-text-2)',
                      fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase',
                      display:'inline-flex', alignItems:'center', gap:5, cursor:'pointer',
                      fontFamily:'var(--p-mono)',
                    }}>
                      <span style={{width:11, height:11, display:'inline-flex'}}>{e.icon}</span>
                      {e.id}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* sections */}
          <div style={{marginTop:20}}>
            {groups.map((grp,gi) => {
              const v = mvar(grp.g);
              return (
                <div key={grp.g} className="p-fade" style={{marginBottom: 22, animationDelay: `${0.08 + gi*0.04}s`}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom: 10}}>
                    <span style={{width:8,height:8,borderRadius:'50%', background:`var(${v})`, boxShadow:`0 0 10px var(${v})`}}/>
                    <span className="p-mono" style={{fontSize:10, fontWeight:600, letterSpacing:'0.22em', color:`var(${v}-l)`, textTransform:'uppercase'}}>{grp.g}</span>
                    <span className="p-mono" style={{fontSize:9, color:'var(--p-text-m)', letterSpacing:'0.18em', marginLeft:'auto'}}>{grp.exs.length} LIFTS</span>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:6}}>
                    {grp.exs.map((e,i)=>(
                      <div key={i} style={{
                        padding:'12px 14px', borderRadius:12, display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                        background:'rgba(15,29,46,0.4)', border:'1px solid var(--p-border-soft)', backdropFilter:'blur(20px)',
                      }}>
                        <div style={{width:2, height:30, borderRadius:1, background:`linear-gradient(180deg, var(${v}), var(${v}-l))`, opacity:0.85}}/>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:14, color:'var(--p-text-1)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{e.n}</div>
                          <div className="p-mono" style={{fontSize:10, color:'var(--p-text-m)', marginTop:2, letterSpacing:'0.05em'}}>{e.last}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div className="p-mono" style={{fontSize:13, fontWeight:600, color:`var(${v}-l)`, lineHeight:1}}>{e.sets}</div>
                          <div className="p-mono" style={{fontSize:8, color:'var(--p-text-m)', letterSpacing:'0.18em', marginTop:2}}>SETS</div>
                        </div>
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
