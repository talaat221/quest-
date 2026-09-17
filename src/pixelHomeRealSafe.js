const MOBILE_QUERY='(max-width:760px)';
let overlay=null;
let legacyRoot=null;
let artUrl='';
let lastSignature='';
let timer=null;

const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const num=(v)=>Number(String(v||'').replace(/[^0-9.-]/g,''))||0;
const pct=(a,b)=>b>0?Math.max(0,Math.min(100,a/b*100)):0;

async function loadArt(){
  try{
    const r=await fetch('/quest-farm-hero.b64.txt',{cache:'force-cache'});
    if(!r.ok) return;
    const clean=(await r.text()).replace(/\s+/g,'');
    const bin=atob(clean);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    artUrl=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
  }catch(e){console.warn('Quest farm art unavailable',e)}
}

function legacyModal(){
  return document.querySelector('#root [role="dialog"],#root .qd-celebration-backdrop,#root .qd-time-modal-backdrop,#root .qd-voyage-modal-backdrop');
}

function showLegacy(show){
  if(!legacyRoot) legacyRoot=document.getElementById('root');
  if(!legacyRoot) return;
  if(show){
    legacyRoot.style.visibility='visible';
    legacyRoot.style.position='relative';
    legacyRoot.style.left='';
    legacyRoot.style.pointerEvents='auto';
    if(overlay) overlay.style.display='none';
  }else{
    legacyRoot.style.visibility='hidden';
    legacyRoot.style.position='absolute';
    legacyRoot.style.left='-10000px';
    legacyRoot.style.pointerEvents='none';
    if(overlay) overlay.style.display='block';
  }
}

function readXp(){
  const daily=num(document.querySelector('.qd-xp-number')?.textContent);
  const cap=[...document.querySelectorAll('.qd-xp-caption span')].find(n=>/Max available today/i.test(n.textContent||''));
  const label=document.querySelector('.qd-xp-progress-block .qd-xp-row-label strong')?.textContent||'';
  const dailyMax=num(cap?.textContent)||num(label.split('/')[1])||Math.max(100,daily);
  const w=document.querySelector('.qd-weekly-xp-block .qd-xp-row-label strong')?.textContent||'';
  const weekly=num(w.split('/')[0]);
  const wCap=[...document.querySelectorAll('.qd-weekly-xp-block .qd-xp-caption span')].find(n=>/Weekly pool/i.test(n.textContent||''));
  const weeklyMax=num(wCap?.textContent)||num(w.split('/')[1])||Math.max(100,weekly);
  return {daily,dailyMax,weekly,weeklyMax,p:pct(daily,dailyMax)};
}

function readTasks(){
  return [...document.querySelectorAll('.qd-today-task')].slice(0,5).map((node,index)=>({
    node,index,name:node.querySelector('.qd-today-name')?.textContent?.trim()||'Quest',
    sub:node.querySelector('.qd-today-sub')?.textContent?.trim()||'',
    xp:node.querySelector('.qd-today-xp')?.textContent?.trim()||'',
    done:node.classList.contains('done')
  }));
}

function readClock(){
  return [...document.querySelectorAll('.qd-clock-item')].map((node,index)=>{
    const time=node.querySelector('.qd-clock-item-time')?.textContent?.trim()||'';
    const m=time.match(/(\d{1,2}):(\d{2})/); if(!m) return null;
    return {node,index,h:+m[1],m:+m[2],time,name:node.querySelector('.qd-clock-item-name')?.textContent?.trim()||'Item',routine:!!node.querySelector('.qd-clock-routine'),done:node.classList.contains('done')};
  }).filter(Boolean);
}

function readAnchors(clock){
  const timed=clock.filter(x=>x.routine);
  if(timed.length) return timed.slice(0,7);
  return [...document.querySelectorAll('.qd-anchor')].slice(0,7).map((node,index)=>({node,index,time:'—',name:node.querySelector('.qd-anchor-title')?.textContent?.trim()||'Anchor',done:node.classList.contains('done')}));
}

function iconFor(t){
  const s=String(t||''); const emo=s.match(/\p{Extended_Pictographic}/u); if(emo) return emo[0];
  const l=s.toLowerCase(); if(l.includes('gym')||l.includes('movement')) return '🏋️'; if(l.includes('read')||l.includes('anki')||l.includes('study')) return '📖'; if(l.includes('edit')||l.includes('film')) return '🎬'; if(l.includes('sleep')) return '🌙'; return '🌱';
}
function clean(t){return String(t||'').replace(/^[^A-Za-z0-9\u0600-\u06ff]+/u,'').trim()}

function clockSvg(items){
  const now=new Date(),cx=100,cy=100;
  const marks=items.slice(0,8).map(it=>{
    const a=((it.h+it.m/60)/24)*Math.PI*2-Math.PI/2;
    const x=cx+Math.cos(a)*63,y=cy+Math.sin(a)*63,lx=cx+Math.cos(a)*80,ly=cy+Math.sin(a)*80;
    const nm=clean(it.name).split(/\s+/).slice(0,2).join(' ');
    return `<g data-clock-index="${it.index}" class="ph-clock-marker"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${it.done?'#79d86d':'#0a2a43'}" stroke="${it.routine?'#f3c766':'#82a6c2'}" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="middle" font-size="7">${esc(iconFor(it.name))}</text><text x="${lx.toFixed(1)}" y="${(ly-2).toFixed(1)}" text-anchor="middle" fill="#fff0c8" font-size="5.5">${String(it.h).padStart(2,'0')}:00</text><text x="${lx.toFixed(1)}" y="${(ly+6).toFixed(1)}" text-anchor="middle" fill="#d3e1eb" font-size="5">${esc(nm)}</text></g>`;
  }).join('');
  const ma=now.getMinutes()/60*Math.PI*2-Math.PI/2,ha=((now.getHours()%12)+now.getMinutes()/60)/12*Math.PI*2-Math.PI/2;
  return `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" fill="#714625"/><circle cx="100" cy="100" r="89" fill="#092942" stroke="#2b5a6f" stroke-width="2"/><circle cx="100" cy="100" r="71" fill="none" stroke="#2f765f" stroke-width="1"/>${[0,6,12,18].map(h=>{const a=h/24*Math.PI*2-Math.PI/2;return `<text x="${100+Math.cos(a)*82}" y="${103+Math.sin(a)*82}" text-anchor="middle" fill="#fff0c8" font-size="7">${h}</text>`}).join('')}${marks}<line x1="100" y1="100" x2="${100+Math.cos(ha)*38}" y2="${100+Math.sin(ha)*38}" stroke="#f5c767" stroke-width="3"/><line x1="100" y1="100" x2="${100+Math.cos(ma)*56}" y2="${100+Math.sin(ma)*56}" stroke="#f5c767" stroke-width="2"/><circle cx="100" cy="100" r="6" fill="#f0a64e" stroke="#ffe0a2" stroke-width="2"/></svg>`;
}

function signature(){
  const root=document.querySelector('.qd-root'); if(!root) return '';
  const minute=new Date().toISOString().slice(0,16);
  return [minute,document.querySelector('.qd-xp-card')?.textContent,document.querySelector('.qd-today-panel')?.textContent,document.querySelector('.qd-anchor-panel')?.textContent,document.querySelector('.qd-clock-list')?.textContent].map(x=>String(x||'').replace(/\s+/g,' ').slice(0,5000)).join('|');
}

function render(){
  if(!document.querySelector('.qd-root')) return;
  const x=readXp(),tasks=readTasks(),clock=readClock(),anchors=readAnchors(clock),d=new Date();
  if(!overlay){overlay=document.createElement('div');overlay.id='quest-pixel-home';document.body.appendChild(overlay)}
  const xpPct=x.p.toFixed(1)+'%';
  const farmStage=x.p<25?'Fresh sprouts':x.p<55?'Taking root':x.p<80?'Growing strong':'Full bloom';
  overlay.innerHTML=`<div class="ph-hero"><div class="ph-sky-stars"></div><div class="ph-greeting"><small>${d.getHours()<12?'GOOD MORNING,':d.getHours()<18?'GOOD AFTERNOON,':'GOOD EVENING,'}</small><strong>Talaat 🌱</strong><p>Small steps, a brighter tomorrow.</p></div><div class="ph-date-sign"><span>${esc(d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}).toUpperCase())}</span><span>🌱 ${d.getFullYear()}</span></div>${artUrl?`<img class="ph-farm-art" src="${artUrl}" alt="Cozy pixel farm at night">`:''}<div class="ph-xp-orb" style="--xp-pct:${xpPct}"><div class="ph-orb-label">TODAY</div><div class="ph-xp-orb-ring"><div class="ph-xp-orb-inner"><div class="ph-xp-leaf">🌱</div><b>${x.daily} / ${x.dailyMax}</b><span>XP</span></div></div></div><div class="ph-clock-wrap">${clockSvg(clock)}</div></div><div class="ph-xp-strip"><span>TODAY</span><div class="ph-xp-track"><div class="ph-xp-fill" style="width:${xpPct}"></div></div><span>${x.daily} / ${x.dailyMax} XP</span></div><section class="ph-panel"><div class="ph-panel-head"><span>⚓</span><span>Today's Anchors</span><span class="ph-view">View all ›</span></div><div class="ph-anchors-row">${anchors.length?anchors.map((a,i)=>`<button class="ph-anchor-item ${a.done?'done':''}" data-anchor-index="${i}"><span class="ph-anchor-time">${esc(a.time||'—')}</span><span class="ph-anchor-icon">${esc(iconFor(a.name))}</span><span class="ph-anchor-name">${esc(clean(a.name))}</span><span class="ph-anchor-dot">${a.done?'✓':''}</span></button>`).join(''):'<div class="ph-empty">No timed anchors today.</div>'}</div></section><div class="ph-two-col"><section class="ph-panel"><div class="ph-panel-head"><span>📋</span><span>Today's Quests</span><span class="ph-view">View all ›</span></div><div class="ph-quests-list">${tasks.length?tasks.map((t,i)=>`<button class="ph-task ${t.done?'done':''}" data-task-index="${i}"><span class="ph-task-check">${t.done?'✓':''}</span><span class="ph-task-main"><span class="ph-task-name">${esc(t.name)}</span><span class="ph-task-sub">${esc(t.sub)}</span></span><span class="ph-task-xp">${esc(t.xp)}</span></button>`).join(''):'<div class="ph-empty">No quests scheduled today.</div>'}</div></section><div class="ph-side-stack"><section class="ph-side-card"><h3>🌱 Farm Status</h3><div class="ph-farm-mini">${[0,1,2,3,4,5].map((_,i)=>`<span class="ph-sprout">${i*16<x.p?'🌿':'🌱'}</span>`).join('')}</div><div class="ph-side-copy">${farmStage}. Your progress today is growing something real.</div></section><section class="ph-side-card"><h3>✨ Weekly XP</h3><div class="ph-week-num">${x.weekly}</div><div class="ph-week-caption">of ${x.weeklyMax} available this week</div></section></div></div><button class="ph-stop-day"><strong>■ STOP DAY</strong><span>Adjust today's voyage and protect your progress</span></button><nav class="ph-nav"><button class="active"><span class="ph-nav-icon">⌂</span><span>Home</span></button><button data-go="#quests"><span class="ph-nav-icon">▤</span><span>Quests</span></button><button data-go="#anchors"><span class="ph-nav-icon">⚓</span><span>Anchors</span></button><button data-go="#voyage"><span class="ph-nav-icon">▥</span><span>Stats</span></button><button data-go="#rewards"><span class="ph-nav-icon">•••</span><span>More</span></button></nav>`;
  overlay.querySelectorAll('[data-task-index]').forEach(b=>b.onclick=()=>{tasks[+b.dataset.taskIndex]?.node?.click()});
  overlay.querySelectorAll('[data-anchor-index]').forEach(b=>b.onclick=()=>{anchors[+b.dataset.anchorIndex]?.node?.click()});
  overlay.querySelectorAll('[data-clock-index]').forEach(g=>g.onclick=()=>{clock.find(x=>x.index===+g.dataset.clockIndex)?.node?.click()});
  overlay.querySelector('.ph-stop-day').onclick=()=>document.querySelector('.qd-voyage-adjust-btn,.qd-voyage-restore-btn')?.click();
  overlay.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{showLegacy(true);setTimeout(()=>document.querySelector(b.dataset.go)?.scrollIntoView({behavior:'smooth'}),40)});
}

async function tick(){
  if(!window.matchMedia(MOBILE_QUERY).matches){if(overlay) overlay.style.display='none';showLegacy(true);return}
  if(!document.querySelector('.qd-root')){showLegacy(true);return}
  if(legacyModal()){showLegacy(true);return}
  showLegacy(false);
  const sig=signature();
  if(sig!==lastSignature){lastSignature=sig;render()}
}

async function start(){
  await loadArt();
  timer=setInterval(tick,350);
  tick();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
