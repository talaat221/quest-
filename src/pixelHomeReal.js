const MOBILE_QUERY = '(max-width: 760px)';
const STYLE_ID = 'quest-pixel-home';
let artUrl = null;
let overlay = null;
let refreshTimer = null;
let toastTimer = null;
let observer = null;
let legacyRoot = null;

const esc = (value = '') => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const num = (text) => Number(String(text || '').replace(/[^0-9.-]/g, '')) || 0;
const percent = (a, b) => b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0;

function base64ToUrl(base64, mime='image/webp') {
  const clean = String(base64 || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], {type:mime}));
}

async function loadArt(){
  if (artUrl) return artUrl;
  const res = await fetch('/quest-farm-hero.b64.txt');
  if (!res.ok) throw new Error('Farm art failed to load');
  artUrl = base64ToUrl(await res.text());
  return artUrl;
}

function readXp(){
  const daily = num(document.querySelector('.qd-xp-number')?.textContent);
  const maxText = [...document.querySelectorAll('.qd-xp-caption span')].map(n=>n.textContent).find(t=>/Max available today/i.test(t));
  const dailyMax = num(maxText) || Math.max(daily, num(document.querySelector('.qd-xp-progress-block .qd-xp-row-label strong')?.textContent)) || 100;
  const weeklyText = document.querySelector('.qd-weekly-xp-block .qd-xp-row-label strong')?.textContent || '';
  const weekly = num(weeklyText.split('/')[0]);
  const weeklyPoolText = [...document.querySelectorAll('.qd-weekly-xp-block .qd-xp-caption span')].map(n=>n.textContent).find(t=>/Weekly pool/i.test(t));
  const weeklyMax = num(weeklyPoolText) || Math.max(weekly, num(weeklyText.split('/')[1])) || 100;
  return {daily,dailyMax,weekly,weeklyMax,pct:percent(daily,dailyMax)};
}

function readTasks(){
  return [...document.querySelectorAll('.qd-today-task')].slice(0,5).map((node, index)=>({
    index,
    node,
    name: node.querySelector('.qd-today-name')?.textContent?.trim() || 'Quest',
    sub: node.querySelector('.qd-today-sub')?.textContent?.trim() || '',
    xp: node.querySelector('.qd-today-xp')?.textContent?.trim() || '',
    done: node.classList.contains('done')
  }));
}

function readClockItems(){
  return [...document.querySelectorAll('.qd-clock-item')].map((node,index)=>{
    const timeText=node.querySelector('.qd-clock-item-time')?.textContent?.trim() || '';
    const m=timeText.match(/(\d{1,2}):(\d{2})/);
    if(!m) return null;
    const nameNode=node.querySelector('.qd-clock-item-name');
    const name=nameNode?.textContent?.trim() || 'Item';
    const routine=!!node.querySelector('.qd-clock-routine');
    return {node,index,hour:Number(m[1]),minute:Number(m[2]),timeText,name,routine,done:node.classList.contains('done')};
  }).filter(Boolean);
}

function readAnchors(){
  const timed=readClockItems().filter(x=>x.routine);
  if(timed.length) return timed.slice(0,7);
  return [...document.querySelectorAll('.qd-anchor')].slice(0,7).map((node,index)=>({
    node,
    index,
    hour:null,
    minute:0,
    timeText:'—',
    name:node.querySelector('.qd-anchor-title')?.textContent?.trim() || 'Anchor',
    routine:true,
    done:false
  }));
}

function iconFor(text){
  const s=String(text||'');
  const match=s.match(/\p{Extended_Pictographic}/u);
  if(match) return match[0];
  const l=s.toLowerCase();
  if(l.includes('gym')||l.includes('movement')) return '🏋️';
  if(l.includes('read')||l.includes('anki')||l.includes('study')) return '📖';
  if(l.includes('edit')||l.includes('film')) return '🎬';
  if(l.includes('sleep')) return '🌙';
  return '🌱';
}

function cleanName(text){
  return String(text||'').replace(/^[^A-Za-z0-9\u0600-\u06ff]+/u,'').trim();
}

function drawClock(items){
  const now=new Date();
  const cx=100, cy=100;
  const marks=items.slice(0,8).map((it)=>{
    const frac=(it.hour+it.minute/60)/24;
    const a=(frac*Math.PI*2)-Math.PI/2;
    const x=cx+Math.cos(a)*64, y=cy+Math.sin(a)*64;
    const labelX=cx+Math.cos(a)*80, labelY=cy+Math.sin(a)*80;
    const short=cleanName(it.name).split(/\s+/).slice(0,2).join(' ');
    const icon=iconFor(it.name);
    return `<g data-clock-index="${it.index}" class="ph-clock-marker" style="cursor:pointer"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${it.done?'#79d86d':'#0a2a43'}" stroke="${it.routine?'#f3c766':'#82a6c2'}" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="middle" font-size="7">${esc(icon)}</text><text x="${labelX.toFixed(1)}" y="${(labelY-2).toFixed(1)}" text-anchor="middle" fill="#fff0c8" font-size="5.5" font-family="monospace">${String(it.hour).padStart(2,'0')}:00</text><text x="${labelX.toFixed(1)}" y="${(labelY+6).toFixed(1)}" text-anchor="middle" fill="#d3e1eb" font-size="5" font-family="sans-serif">${esc(short)}</text></g>`;
  }).join('');
  const minA=((now.getMinutes()/60)*Math.PI*2)-Math.PI/2;
  const hourA=(((now.getHours()%12)+now.getMinutes()/60)/12*Math.PI*2)-Math.PI/2;
  const mx=cx+Math.cos(minA)*56,my=cy+Math.sin(minA)*56;
  const hx=cx+Math.cos(hourA)*38,hy=cy+Math.sin(hourA)*38;
  return `<svg viewBox="0 0 200 200" aria-label="24 hour daily clock"><circle cx="100" cy="100" r="96" fill="#714625"/><circle cx="100" cy="100" r="89" fill="#092942" stroke="#2b5a6f" stroke-width="2"/><circle cx="100" cy="100" r="71" fill="none" stroke="#2f765f" stroke-width="1" opacity=".8"/>${[0,6,12,18].map(h=>{const a=(h/24*Math.PI*2)-Math.PI/2; const x=100+Math.cos(a)*82,y=100+Math.sin(a)*82;return `<text x="${x}" y="${y+3}" text-anchor="middle" fill="#fff0c8" font-family="monospace" font-size="7">${h}</text>`}).join('')}${marks}<line x1="100" y1="100" x2="${hx}" y2="${hy}" stroke="#f5c767" stroke-width="3" stroke-linecap="round"/><line x1="100" y1="100" x2="${mx}" y2="${my}" stroke="#f5c767" stroke-width="2" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="#f0a64e" stroke="#ffe0a2" stroke-width="2"/><text x="100" y="126" text-anchor="middle" fill="#fff0c8" font-family="monospace" font-size="8">${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}</text></svg>`;
}

function formatDate(){
  const d=new Date();
  return {line:d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}).toUpperCase(), year:d.getFullYear()};
}

function getGreeting(){
  const h=new Date().getHours();
  return h<12?'GOOD MORNING,':h<18?'GOOD AFTERNOON,':'GOOD EVENING,';
}

function getLegacyModal(){
  return document.querySelector('#root [role="dialog"], #root .qd-celebration-backdrop, #root .qd-time-modal-backdrop, #root .qd-voyage-modal-backdrop');
}

function showToast(text){
  const node=overlay?.querySelector('.ph-toast');
  if(!node) return;
  node.textContent=text;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>node.classList.remove('show'),1800);
}

function syncModalVisibility(){
  if(!overlay || !legacyRoot) return;
  const modal=getLegacyModal();
  if(modal){
    overlay.style.display='none';
    legacyRoot.style.visibility='visible';
    legacyRoot.style.position='relative';
    legacyRoot.style.pointerEvents='auto';
  }else if(window.matchMedia(MOBILE_QUERY).matches && document.querySelector('.qd-root')){
    overlay.style.display='block';
    legacyRoot.style.visibility='hidden';
    legacyRoot.style.position='absolute';
    legacyRoot.style.left='-10000px';
    legacyRoot.style.pointerEvents='none';
  }
}

function buildOverlay(){
  if(overlay || !window.matchMedia(MOBILE_QUERY).matches || !document.querySelector('.qd-root')) return;
  legacyRoot=document.getElementById('root');
  if(!legacyRoot) return;
  overlay=document.createElement('div');
  overlay.id=STYLE_ID;
  document.body.appendChild(overlay);
  syncModalVisibility();
  refresh();
}

function destroyOverlay(){
  if(overlay){overlay.remove();overlay=null;}
  if(legacyRoot){legacyRoot.style.visibility='';legacyRoot.style.position='';legacyRoot.style.left='';legacyRoot.style.pointerEvents='';legacyRoot=null;}
  clearInterval(refreshTimer);refreshTimer=null;
}

function refresh(){
  if(!overlay || getLegacyModal()) {syncModalVisibility();return;}
  if(!document.querySelector('.qd-root')) {destroyOverlay();return;}
  const xp=readXp();
  const tasks=readTasks();
  const anchors=readAnchors();
  const clockItems=readClockItems();
  const d=formatDate();
  const xpPct=xp.pct.toFixed(1)+'%';
  const farmStage=xp.pct<25?'Fresh sprouts':xp.pct<55?'Taking root':xp.pct<80?'Growing strong':'Full bloom';

  overlay.innerHTML=`<div class="ph-hero"><div class="ph-sky-stars"></div><div class="ph-greeting"><small>${getGreeting()}</small><strong>Talaat 🌱</strong><p>Small steps, a brighter tomorrow.</p></div><div class="ph-date-sign"><span>${esc(d.line)}</span><span>🌱 ${d.year}</span></div><img class="ph-farm-art" src="${artUrl||''}" alt="Cozy pixel farm at night"><div class="ph-xp-orb" style="--xp-pct:${xpPct}"><div class="ph-orb-label">TODAY</div><div class="ph-xp-orb-ring"><div class="ph-xp-orb-inner"><div class="ph-xp-leaf">🌱</div><b>${xp.daily} / ${xp.dailyMax}</b><span>XP</span></div></div></div><div class="ph-clock-wrap">${drawClock(clockItems)}</div></div>
  <div class="ph-xp-strip"><span>TODAY</span><div class="ph-xp-track"><div class="ph-xp-fill" style="width:${xpPct}"></div></div><span>${xp.daily} / ${xp.dailyMax} XP</span></div>
  <section class="ph-panel"><div class="ph-panel-head"><span>⚓</span><span>Today's Anchors</span><span class="ph-view">View all ›</span></div><div class="ph-anchors-row">${anchors.length?anchors.map((a,i)=>`<button type="button" class="ph-anchor-item ${a.done?'done':''}" data-anchor-index="${i}"><span class="ph-anchor-time">${esc(a.timeText||'—')}</span><span class="ph-anchor-icon">${esc(iconFor(a.name))}</span><span class="ph-anchor-name">${esc(cleanName(a.name))}</span><span class="ph-anchor-dot">${a.done?'✓':''}</span></button>`).join(''):'<div class="ph-empty">No timed anchors today.</div>'}</div></section>
  <div class="ph-two-col"><section class="ph-panel"><div class="ph-panel-head"><span>📋</span><span>Today's Quests</span><span class="ph-view">View all ›</span></div><div class="ph-quests-list">${tasks.length?tasks.map((t,i)=>`<button type="button" class="ph-task ${t.done?'done':''}" data-task-index="${i}"><span class="ph-task-check">${t.done?'✓':''}</span><span class="ph-task-main"><span class="ph-task-name">${esc(t.name)}</span><span class="ph-task-sub">${esc(t.sub)}</span></span><span class="ph-task-xp">${esc(t.xp)}</span></button>`).join(''):'<div class="ph-empty">No quests scheduled today.</div>'}</div></section><div class="ph-side-stack"><section class="ph-side-card"><h3>🌱 Farm Status</h3><div class="ph-farm-mini">${[0,1,2,3,4,5].map((_,i)=>`<span class="ph-sprout">${i*16<xp.pct?'🌿':'🌱'}</span>`).join('')}</div><div class="ph-side-copy">${farmStage}. Your progress today is growing something real.</div></section><section class="ph-side-card"><h3>✨ Weekly XP</h3><div class="ph-week-num">${xp.weekly}</div><div class="ph-week-caption">of ${xp.weeklyMax} available this week</div></section></div></div>
  <button type="button" class="ph-stop-day"><strong>■ STOP DAY</strong><span>Adjust today's voyage and protect your progress</span></button>
  <nav class="ph-nav"><button type="button" class="active" data-nav="home"><span class="ph-nav-icon">⌂</span><span>Home</span></button><button type="button" data-nav="quests"><span class="ph-nav-icon">▤</span><span>Quests</span></button><button type="button" data-nav="anchors"><span class="ph-nav-icon">⚓</span><span>Anchors</span></button><button type="button" data-nav="stats"><span class="ph-nav-icon">▥</span><span>Stats</span></button><button type="button" data-nav="more"><span class="ph-nav-icon">•••</span><span>More</span></button></nav><div class="ph-toast"></div>`;

  overlay.querySelectorAll('[data-task-index]').forEach(btn=>btn.addEventListener('click',()=>{const item=tasks[Number(btn.dataset.taskIndex)];item?.node?.click();setTimeout(()=>{syncModalVisibility();refresh()},60)}));
  overlay.querySelectorAll('[data-anchor-index]').forEach(btn=>btn.addEventListener('click',()=>{const item=anchors[Number(btn.dataset.anchorIndex)];item?.node?.click();setTimeout(refresh,80)}));
  overlay.querySelectorAll('[data-clock-index]').forEach(g=>g.addEventListener('click',()=>{const idx=Number(g.getAttribute('data-clock-index'));const item=clockItems.find(x=>x.index===idx);item?.node?.click();setTimeout(()=>{syncModalVisibility();refresh()},80)}));
  overlay.querySelector('.ph-stop-day')?.addEventListener('click',()=>{const action=document.querySelector('.qd-voyage-adjust-btn');const restore=document.querySelector('.qd-voyage-restore-btn');if(action){action.click();setTimeout(syncModalVisibility,40)}else if(restore){showToast('Today is already adjusted. Open More to restore it.')}else showToast('Voyage adjustment is unavailable right now.');});
  overlay.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.nav==='home')window.scrollTo({top:0,behavior:'smooth'});else showToast(`${btn.textContent.trim()} page is the next build.`)}));
}

async function start(){
  if(!window.matchMedia(MOBILE_QUERY).matches) return;
  try{await loadArt();}catch(error){console.warn(error)}
  const boot=()=>{if(document.querySelector('.qd-root')&&!document.querySelector('.pixel-login')){buildOverlay();refresh();}else if(!document.querySelector('.qd-root')) destroyOverlay();syncModalVisibility();};
  observer=new MutationObserver(()=>{boot();});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  boot();
  refreshTimer=setInterval(()=>{if(overlay) refresh();},30000);
  window.addEventListener('resize',()=>{if(window.matchMedia(MOBILE_QUERY).matches) boot();else destroyOverlay();});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
