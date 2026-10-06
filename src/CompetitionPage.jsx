import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { blockQuestUser, ensureQuestProfile, loadFriendHub, reportQuestUser } from './friends.js';
import { otherFriendId } from './friends-core.js';
import { loadWeeklyChallenge, cancelWeeklyChallenge, leaveWeeklyChallenge, respondWeeklyChallenge } from './challenges.js';
import { competitionWeekStats } from './competition.js';
import { createContests, friendLimit, inviteContestMembers, leaveContest, loadContests, respondToContest, setContestPrivacy, startContest } from './contests.js';
import { activityLabel, rankedMembers, remainingTime, roundPhase, timeAgo } from './competition-view.js';
import { flushQuestSync, getQuestSyncSnapshot, subscribeQuestSync } from './supabaseClient';
import ReportUserDialog from './ReportUserDialog.jsx';
import './competition.css';

function Icon({ kind = 'cup', ...props }) {
  const paths = {
    cup: 'M6 2h12v3h4v8h-4v3h-4v3h4v3H6v-3h4v-3H6v-3H2V5h4Zm0 6H4v3h2Zm12 0v3h2V8Z',
    friends: 'M4 3h6v7H4Zm10 1h6v6h-6ZM2 12h10v10H2Zm12 0h8v10h-8Z',
    flag: 'M4 2h2v20H4ZM7 3h14v9H7Z',
    leaf: 'M12 5h8v7h-6v4h-2v6h-2v-8H4V7h6v5h2Z',
    lock: 'M7 2h10v3h3v7h2v10H2V12h2V5h3Zm1 3v7h8V5Zm3 10v4h2v-4Z',
    check: 'M2 11h4v4h3v3h3v-3h3v-3h3V7h4V3h-4v4h-3v3h-3v3H9v-3H6V7H2Z',
    clock: 'M6 2h12v2h4v16h-4v2H6v-2H2V4h4Zm4 4v8h7v-3h-4V6Z',
    gift: 'M3 8h7L6 4V1h5l2 4 2-4h5v4l-4 3h6v5h-9v9h-3v-9H1V8Zm0 7h5v7H3Zm12 0h5v7h-5Z',
    bell: 'M10 2h4v3h3v3h2v8h2v3H3v-3h2V8h2V5h3ZM9 21h6v2H9Z',
    arrow: 'M4 10h11V5h3v3h3v8h-3v3h-3v-5H4Z',
  };
  return <svg {...props} viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d={paths[kind] || paths.cup}/></svg>;
}
function Panel({ as:Tag='section', className='', children, ...props }) {
  return <Tag className={`cg-panel ${className}`} {...props}>{children}</Tag>;
}
function Toggle({ checked, onChange, title, children, disabled }) {
  return <label className="cg-toggle"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled}/><span><strong>{title}</strong>{children && <small>{children}</small>}</span></label>;
}
function Modal({ title, children, onClose, busy }) {
  const ref=useRef(null); const heading=useId();
  useEffect(()=>{ const dialog=ref.current; dialog.showModal(); return ()=>dialog.close(); },[]);
  return <dialog ref={ref} className="cg-modal" aria-labelledby={heading} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <div className="cg-modal-top"><h2 id={heading}>{title}</h2><button type="button" className="cg-close" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>{children}
  </dialog>;
}
function Rules({ round }) {
  return <div className="cg-rules"><span><Icon kind="clock"/>{round.duration==='month'?'1 month':'7 days'}</span><span><Icon kind="leaf"/>{round.includeAnchors?'Anchors included':'Quest tasks only'}</span>{round.prize && <div className="cg-prize"><Icon kind="gift"/><span><small>WINNER’S TREAT</small><strong>{round.prize}</strong></span></div>}</div>;
}
function CreateRound({ friends, initialMode, onCreate, onClose, busy, error }) {
  const [step,setStep]=useState(0);
  const [query,setQuery]=useState('');
  const [form,setForm]=useState({ mode:initialMode, duration:'week', name:initialMode==='league'?'The harvest league':'A friendly challenge', prize:'', includeAnchors:false, shareTaskNames:false, friendIds:[] });
  const change=(key,value)=>setForm(old=>({...old,[key]:value,...(key==='mode'?{friendIds:old.friendIds.slice(0,friendLimit(value))}:{})}));
  const visible=friends.filter(f=>`${f.name} ${f.username}`.toLowerCase().includes(query.toLowerCase()));
  const selected=friends.filter(f=>form.friendIds.includes(f.id));
  return <Modal title="Plant a friendly challenge" onClose={onClose} busy={busy}>
    <ol className="cg-steps" aria-label="Create competition steps">{['The round','Your friends','Review'].map((s,i)=><li key={s} aria-current={step===i?'step':undefined}><span>{i+1}</span>{s}</li>)}</ol>
    <form onSubmit={e=>{e.preventDefault();if(step<2)setStep(step+1);else onCreate(form);}}>
      {step===0 && <div className="cg-form-fields">
        <fieldset><legend>How do you want to compete?</legend><div className="cg-choice-grid">{[['league','A shared league','One leaderboard · 10 people total'],['duel','Individual challenges','You vs each friend · up to 10']].map(([value,title,sub])=><label className="cg-choice" key={value}><input type="radio" name="round-mode" value={value} checked={form.mode===value} onChange={()=>change('mode',value)}/><span><strong>{title}</strong><small>{sub}</small></span></label>)}</div></fieldset>
        <label className="cg-field">Round name<input value={form.name} required maxLength={60} onChange={e=>change('name',e.target.value)}/></label>
        <fieldset><legend>Duration from the moment it starts</legend><div className="cg-segment">{[['week','One week'],['month','One month']].map(([value,title])=><label key={value}><input type="radio" name="duration" checked={form.duration===value} onChange={()=>change('duration',value)}/><span>{title}</span></label>)}</div></fieldset>
        <Toggle checked={form.includeAnchors} onChange={v=>change('includeAnchors',v)} title="Count daily anchors">Include their earned XP along with quest tasks. This rule applies to everyone.</Toggle>
        <label className="cg-field">Winner’s treat <small>optional</small><input placeholder="e.g. Coffee together, on us" maxLength={160} value={form.prize} onChange={e=>change('prize',e.target.value)}/><small>Everyone sees and agrees to the prize before joining.</small></label>
      </div>}
      {step===1 && <div className="cg-form-fields"><p className="cg-help">{form.mode==='league'?'You + up to 9 friends on one board.':'A separate head-to-head round with each selected friend.'}</p>
        <div className="cg-between"><h3>Choose your friends</h3><span className="cg-count">{form.friendIds.length} / {friendLimit(form.mode)}</span></div>
        {friends.length>5 && <input type="search" aria-label="Find a friend" placeholder="Find a friend…" value={query} onChange={e=>setQuery(e.target.value)}/>}
        {!friends.length?<div className="cg-empty"><Icon kind="friends"/><h3>A good rivalry starts with a friend.</h3><p>Add friends to Quest first, then invite them here.</p><a href="#friends" className="cg-button" onClick={onClose}>Find friends</a></div>:<div className="cg-friend-list">{visible.map(f=>{const checked=form.friendIds.includes(f.id);return <label className="cg-friend" key={f.id}><span className="cg-avatar">{f.name.slice(0,1).toUpperCase()}</span><span><strong>{f.name}</strong><small>@{f.username}</small></span><input type="checkbox" aria-label={`Select ${f.name}`} checked={checked} disabled={!checked&&form.friendIds.length>=friendLimit(form.mode)} onChange={()=>change('friendIds',checked?form.friendIds.filter(id=>id!==f.id):[...form.friendIds,f.id])}/></label>;})}</div>}
        {friends.length>0 && !visible.length && <p>No friends match that name.</p>}
      </div>}
      {step===2 && <div className="cg-form-fields"><Panel className="cg-review"><span className="cg-eyebrow">{form.mode==='league'?'SHARED LEAGUE':`${selected.length} INDIVIDUAL ${selected.length===1?'CHALLENGE':'CHALLENGES'}`}</span><h3>{form.name}</h3><Rules round={form}/><p>With {selected.map(f=>f.name).join(', ')}.</p></Panel>
        <Toggle checked={form.shareTaskNames} onChange={v=>change('shareTaskNames',v)} title="Share my completed task names">Off means others see “A quest task” or “A daily anchor”. Each friend makes their own choice. You can change yours later.</Toggle>
        <p className="cg-help">Start once one friend has joined. Others can accept or be invited while the league is running. Only work completed after joining the active round counts.</p>
        {form.mode==='duel' && <p className="cg-help">Each friend has their own round and prize. They cannot see your other opponents.</p>}
      </div>}
      {error && <p className="cg-error" role="alert">{error}</p>}
      <div className="cg-modal-actions">{step>0&&<button type="button" className="cg-button is-quiet" disabled={busy} onClick={()=>setStep(step-1)}>Back</button>}<button className="cg-button is-gold" disabled={busy||(step===1&&!form.friendIds.length)||(step===0&&!form.name.trim())} type="submit">{busy?'Sending…':step===2?'Send invitations':'Continue'}<Icon kind="arrow"/></button></div>
    </form>
  </Modal>;
}
function InviteMembers({ round, friends, onInvite, onClose, busy, error }) {
  const [selected,setSelected]=useState([]);
  const occupied=round.members.filter(m=>['accepted','pending'].includes(m.status));
  const available=friends.filter(f=>!occupied.some(m=>m.id===f.id));
  const slots=Math.max(0,10-occupied.length);
  return <Modal title="Make room for a friend" onClose={onClose} busy={busy}>
    <p className="cg-help">{slots} of 10 places available. Anyone in the league can invite their friends. New members start earning points when they join.</p>
    {available.length&&slots?<form onSubmit={e=>{e.preventDefault();onInvite(selected);}}>
      <div className="cg-friend-list">{available.map(f=><label className="cg-friend" key={f.id}><span className="cg-avatar">{f.name.slice(0,1).toUpperCase()}</span><span><strong>{f.name}</strong><small>@{f.username}</small></span><input type="checkbox" aria-label={`Invite ${f.name}`} checked={selected.includes(f.id)} disabled={busy||(!selected.includes(f.id)&&selected.length>=slots)} onChange={e=>setSelected(old=>e.target.checked?[...old,f.id]:old.filter(id=>id!==f.id))}/></label>)}</div>
      {error&&<p role="alert" className="cg-error">{error}</p>}
      <div className="cg-modal-actions"><button type="submit" className="cg-button is-gold" disabled={busy||!selected.length}>{busy?'Sending…':`Invite ${selected.length||''} ${selected.length===1?'friend':'friends'}`}</button></div>
    </form>:<div className="cg-empty"><Icon kind="friends"/><p>{slots?'All your friends are already here or invited.':'Your league is full, including pending invitations.'}</p>{slots>0&&<a href="#friends" onClick={onClose}>Find more friends ›</a>}</div>}
  </Modal>;
}
function ConnectionStatus({ sync, notifications:n, busy, onSync }) {
  const synced=sync.state==='synced'&&!sync.pending;
  return <section className="cg-connection" aria-label="Scores and notifications">
    <div className="cg-save-status"><span className={`cg-signal ${synced?'is-on':''}`} aria-hidden="true"/><p>{synced?'Scores follow your saved tasks.':sync.state==='conflict'?'Your recent tasks are saved on this device. Sync needs attention before friends can see them.':sync.state==='offline'?'Offline · your work stays saved here until you reconnect.':'Saving your work · scores update after sync.'}</p>{!synced&&(sync.state==='conflict'?<a href="#more">Review sync ›</a>:<button type="button" className="cg-text-button" disabled={busy||sync.state==='syncing'} onClick={onSync}>Sync now</button>)}</div>
    {n&&<details className="cg-alert-settings"><summary><Icon kind="bell"/><span>Friend alerts <b>{n.preferences.friends?'On':'Off'}</b></span><span aria-hidden="true">+</span></summary>
      <Toggle title="When a friend completes a task" checked={n.preferences.friends} disabled={n.busy} onChange={value=>n.update({friends:value})}>Updates from your competitions. Task names stay private on the lock screen.</Toggle>
      <p className="cg-help">{n.enabled?'This device is connected for phone alerts.':n.needsInstall?'On iPhone, open Quest from its Home Screen icon to enable phone alerts.':'Phone alerts are off on this device. In-app alerts work while Quest is open.'}</p>
      {!n.enabled&&!n.needsInstall&&n.canPush&&<button className="cg-button is-gold" disabled={n.busy||n.permission==='denied'} onClick={n.enable}>Enable phone alerts</button>}
      <a href="#more">Notification settings & test ›</a>
      {(n.error||n.feedError)&&<p className="cg-error" role="alert">{n.error||n.feedError}</p>}
    </details>}
  </section>;
}
function RoundBoard({ round, userId, now, busy, onAction, onLeave, onInvite }) {
  const phase=roundPhase(round,now); const host=round.creatorId===userId;
  const accepted=rankedMembers(round.members); const pending=round.members.filter(m=>m.status==='pending');
  const [share,setShare]=useState(false);
  const joined=round.myStatus==='accepted'; const leaders=accepted.filter(m=>m.rank===1);
  const mine=accepted.find(m=>m.id===userId); const open=['lobby','active'].includes(phase);
  return <Panel className="cg-round" aria-label={`${round.name} competition`}>
    <div className="cg-round-heading"><span className="cg-eyebrow">{round.duration==='month'?'MONTHLY':'WEEKLY'} {round.mode==='league'?'LEAGUE':'HEAD TO HEAD'}</span><span className={`cg-status is-${phase}`}>{phase==='active'?remainingTime(round.endsAt,now):phase==='lobby'?'Gathering friends':phase==='finished'?'Finished':phase==='expired'?'Invitation expired':'Cancelled'}</span></div>
    <h2>{round.name}</h2><Rules round={round}/>
    {joined&&phase!=='lobby'&&<div className="cg-harvest" aria-label="Your progress in this round"><div><Icon kind="leaf"/><strong>{mine?.xp||0}</strong><span>YOUR XP</span></div><div><Icon kind="check"/><strong>{mine?.tasks||0}</strong><span>TASKS DONE</span></div><div><Icon kind="cup"/><strong>{mine?.rank?`#${mine.rank}`:'—'}</strong><span>YOUR PLACE</span></div></div>}
    {!joined && open?<div className="cg-invite"><h3>You’re invited.</h3><p>Join {round.members.find(m=>m.id===round.creatorId)?.name||'your friend'} and grow a little further together.</p><Toggle checked={share} onChange={setShare} disabled={busy} title="Share my completed task names">Optional. Your XP and completion count are visible to participants.</Toggle><p className="cg-help">Joining accepts the rules{round.prize?' and winner’s treat':''} above.</p><div className="cg-actions"><button className="cg-button is-gold" disabled={busy} onClick={()=>onAction(()=>respondToContest(round.id,true,share),phase==='active'?'You joined the round. Your progress counts from now.':'You joined the lobby.')}>Accept invitation</button><button className="cg-button is-quiet" disabled={busy} onClick={()=>onAction(()=>respondToContest(round.id,false),'Invitation declined.')}>Decline</button></div></div>:<>
      {phase==='finished'&&accepted.length>1&&<div className="cg-result"><Icon kind="cup"/><div><strong>{leaders.length>1?'A shared victory!':`${leaders[0].name} wins!`}</strong><p>{leaders.length>1?leaders.map(m=>m.name).join(' & '):'Small steps added up.'}{round.prize&&leaders.length>1?' Share the treat together.':''}</p></div></div>}
      <div className="cg-board-label"><h3>{phase==='lobby'?'The gathering':'Leaderboard'}</h3><small>{accepted.length+pending.length} / {round.mode==='league'?10:2} travelers</small></div>
      <ol className="cg-leaderboard">{accepted.map(m=><li key={m.id} className={`${m.id===userId?'is-you':''} ${m.rank===1&&phase!=='lobby'?'is-leading':''}`}><span className="cg-rank">{phase==='lobby'?<Icon kind="check"/>:String(m.rank).padStart(2,'0')}</span><span className="cg-avatar">{m.name.slice(0,1).toUpperCase()}</span><div className="cg-member"><strong>{m.name}{m.id===userId&&<small> you</small>}</strong><span>{phase==='lobby'?'Ready to grow':`${m.tasks||0} ${m.tasks===1?'task completed':'tasks completed'}`}{m.id===round.creatorId?' · host':''}</span></div><strong className="cg-score">{phase==='lobby'?'Ready':`${m.xp||0}`}<small>{phase!=='lobby'?'XP':''}</small></strong></li>)}{pending.map(m=><li key={m.id} className="is-pending"><span className="cg-rank"><Icon kind="clock"/></span><span className="cg-avatar">{m.name.slice(0,1).toUpperCase()}</span><div className="cg-member"><strong>{m.name}</strong><span>Invitation sent</span></div><span>Waiting</span></li>)}</ol>
      {phase==='lobby'&&<div className="cg-lobby-note"><p>{accepted.length<2?'One more friend needs to join before the round can start.':host?'Ready when you are. Invited friends can join later.':'Ready to start. Your host can begin the round.'}</p>{host&&<button className="cg-button is-gold" disabled={busy||accepted.length<2} onClick={()=>onAction(()=>startContest(round.id),'The round has started. Good luck!')}><Icon kind="flag"/>Start the round</button>}</div>}
      {joined&&open&&round.mode==='league'&&<div className="cg-invite-action"><button type="button" className="cg-button is-gold" disabled={busy||accepted.length+pending.length>=10} onClick={()=>onInvite(round)}><Icon kind="friends"/>Invite friends</button><small>{accepted.length+pending.length>=10?'All 10 places are taken.':'Every member can invite · even mid-round'}</small></div>}
      {joined&&phase!=='cancelled'&&<details className="cg-sharing"><summary><Icon kind="lock"/>Your sharing · {round.shareTaskNames?'Task names visible':'Task names private'}</summary><Toggle checked={round.shareTaskNames} disabled={busy} title="Share my completed task names" onChange={v=>onAction(()=>setContestPrivacy(round.id,v),v?'Your task names are now shared.':'Your task names are now private.')}>Applies only to your names in this competition, including earlier activity. Phone notifications never include task names.</Toggle></details>}
      {joined&&phase!=='lobby'&&<div className="cg-feed"><div className="cg-board-label"><h3>Little victories</h3><span className="cg-live">{phase==='active'?'Updates while you’re here':'Round activity'}</span></div>{round.activity.length?<ul>{round.activity.map(e=><li key={e.id}><span className="cg-feed-icon"><Icon kind={e.source==='anchor'?'leaf':'check'}/></span><div><strong>{e.name}{e.userId===userId?' (you)':''}</strong><p>{activityLabel(e)}</p><small>{timeAgo(e.completedAt,now)}{!e.taskName?' · name private':''}</small></div><span className="cg-xp">+{e.xp} XP</span></li>)}</ul>:<div className="cg-feed-empty"><Icon kind="leaf"/><p>The first little victory is still growing.<br/>Completed tasks will appear here.</p></div>}</div>}
      {joined&&['lobby','active'].includes(phase)&&<div className="cg-footer"><small>{phase==='active'?round.includeAnchors?'Quest tasks + daily anchors completed after joining count.':'Quest tasks count after joining. Daily anchors are excluded from this round.':'The rules and prize lock when invitations are sent.'}</small><button className="cg-text-button" disabled={busy} onClick={()=>onLeave(round)}>Leave round</button></div>}
    </>}
    {!joined && !open && <p>This invitation is no longer open.</p>}
  </Panel>;
}
function LegacyRounds({ hub, userId, busy, onAction }) {
  if (!hub.current&&!hub.invites.length) return null;
  return <Panel className="cg-legacy"><details><summary>Earlier weekly challenge</summary><p>Your original weekly challenge is still saved.</p>{hub.current&&<><h3>Week of {hub.current.weekKey}</h3><ul>{hub.current.members.map(m=><li key={m.userId}>{m.displayName} <span>{m.status==='pending'?'Invited':`${m.scoreXP||0} XP`}</span></li>)}</ul><button className="cg-button is-quiet" disabled={busy} onClick={()=>{if(window.confirm('Leave this earlier weekly challenge?'))onAction(()=>hub.current.creatorId===userId?cancelWeeklyChallenge(hub.current.id):leaveWeeklyChallenge(hub.current.id),'Earlier challenge closed.');}}>Leave earlier challenge</button></>}{hub.invites.map(i=><div key={i.id}><p>{i.creatorDisplayName} invited you to an earlier weekly challenge.</p><div className="cg-actions"><button className="cg-button" disabled={busy} onClick={()=>onAction(()=>respondWeeklyChallenge(i.id,true),'Invitation accepted.')}>Accept</button><button className="cg-button is-quiet" disabled={busy} onClick={()=>onAction(()=>respondWeeklyChallenge(i.id,false),'Invitation declined.')}>Decline</button></div></div>)}</details></Panel>;
}
export default function CompetitionPage({ progression, weekKey, todayKey, userId, displayName='You', notifications }) {
  const stats=competitionWeekStats({progression,weekKey,todayKey});
  const [hub,setHub]=useState({contests:[]});const [friends,setFriends]=useState([]);const [legacy,setLegacy]=useState({current:null,invites:[]});
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [syncError,setSyncError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const [sync,setSync]=useState(getQuestSyncSnapshot); const [inviting,setInviting]=useState(null);
  useEffect(()=>subscribeQuestSync(setSync),[]);
  const [createMode,setCreateMode]=useState(null);const [selectedId,setSelectedId]=useState(null);const [tab,setTab]=useState('league');const [leaving,setLeaving]=useState(null);
  const [clock,setClock]=useState(()=>Date.now());const delta=useRef(0);const alive=useRef(false);const inFlight=useRef(null);const busyRef=useRef(false);
  const refresh=useCallback(async()=>{
    if(!userId)return;
    if(inFlight.current)return inFlight.current;
    const job=(async()=>{
      try {
        const [next,friendHub,old]=await Promise.all([loadContests(),loadFriendHub(userId),loadWeeklyChallenge(weekKey)]);
        if(!alive.current)return;
        delta.current=Date.parse(next.serverTime)-Date.now()||0;setHub(next);setLegacy(old);
        setFriends(friendHub.friends.map(f=>({id:otherFriendId(f,userId),name:f.profile?.display_name||f.profile?.username||'Traveler',username:f.profile?.username||''})));setSyncError('');
      }catch(e){if(alive.current)setSyncError(e.message||'Could not load competitions. Your saved tasks are safe.');}
      finally{if(alive.current)setLoading(false);}
    })();
    inFlight.current=job;
    try{await job;}finally{inFlight.current=null;}
  },[userId,weekKey]);
  useEffect(()=>{
    alive.current=true;
    void ensureQuestProfile({id:userId,user_metadata:{display_name:displayName}}).then(refresh).catch(e=>{if(alive.current){setError(e.message);setLoading(false);}});
    const tick=()=>{setClock(Date.now()+delta.current);if(document.visibilityState!=='hidden')void refresh();};
    const onSynced=event=>{if(event.detail?.state==='synced')void refresh();};
    window.addEventListener('quest-sync-status',onSynced);
    const id=setInterval(tick,10000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);
    return()=>{alive.current=false;window.removeEventListener('quest-sync-status',onSynced);clearInterval(id);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};
  },[refresh,userId,displayName]);
  const action=async(fn,message)=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setNotice('');
    try{const result=await fn();if(!alive.current)return;setCreateMode(null);setLeaving(null);setInviting(null);if(result?.ids?.[0])setSelectedId(result.ids[0]);setNotice(message);if(inFlight.current)await inFlight.current;await refresh();}
    catch(e){if(alive.current)setError(e.message||'That change could not be saved. Try again.');}
    finally{busyRef.current=false;if(alive.current)setBusy(false);}
  };
  const isPast=c=>['finished','expired','cancelled'].includes(roundPhase(c,clock));
  const invitations=hub.contests.filter(c=>c.myStatus==='pending'&&!isPast(c));
  const rounds=hub.contests.filter(c=>c.myStatus==='accepted'&&(tab==='past'?isPast(c):c.mode===tab&&!isPast(c)));
  const selected=rounds.find(c=>c.id===selectedId)||rounds[0];
  return <div className="cg-page" aria-label="Competition">
    <header className="cg-hero"><img src="/competition-v3/tournament-garden-v1.webp" alt="" className="cg-hero-art" fetchPriority="high"/><div className="cg-hero-copy"><span className="cg-eyebrow">THE VILLAGE GATHERING</span><h1>Grow together.<br/>Go further.</h1><p>A friendly race. A shared little victory.</p></div><a className="cg-friends-link" href="#friends"><Icon kind="friends"/>Friends<Icon kind="arrow"/></a></header>
    <div className="cg-welcome"><div><span className="cg-eyebrow">YOUR VILLAGE, YOUR PACE</span><h2>A little friendly rivalry</h2></div></div><div className="cg-week-harvest"><span><strong>{stats.scoreXP}</strong> XP this week</span><span><strong>{stats.completedTasks}</strong> {stats.completedTasks===1?'task':'tasks'} this week</span></div>
    <div className="cg-launch"><button type="button" className="cg-launch-card" onClick={()=>{setError('');setCreateMode('league');}}><Icon kind="cup"/><span><strong>Create a league</strong><small>One board. Up to 10 people.</small></span><Icon kind="arrow"/></button><button type="button" className="cg-launch-card" onClick={()=>{setError('');setCreateMode('duel');}}><Icon kind="flag"/><span><strong>Challenge friends</strong><small>Separate one-on-one rounds.</small></span><Icon kind="arrow"/></button></div>
    {notice&&<p role="status" className="cg-notice">{notice}</p>}{(syncError||(error&&!createMode))&&<p role="alert" className="cg-error">{syncError||error} <button type="button" className="cg-text-button" onClick={()=>void refresh()}>Retry</button></p>}
    {invitations.length>0&&<section className="cg-invitations" aria-label="Competition invitations"><h2>Your invitations <span>{invitations.length}</span></h2>{invitations.map(c=><RoundBoard key={c.id} round={c} userId={userId} now={clock} busy={busy} onAction={action}/>)}</section>}
    <ConnectionStatus sync={sync} notifications={notifications} busy={busy} onSync={()=>void action(flushQuestSync,'Sync checked.')}/>
    <div className="cg-tabs" role="tablist" aria-label="Competition type" onKeyDown={e=>{
      const values=['league','duel','past'];let index=values.indexOf(tab);
      if(e.key==='ArrowRight')index=(index+1)%3;else if(e.key==='ArrowLeft')index=(index+2)%3;else if(e.key==='Home')index=0;else if(e.key==='End')index=2;else return;
      e.preventDefault();setTab(values[index]);setSelectedId(null);e.currentTarget.querySelectorAll('[role="tab"]')[index].focus();
    }}>{[['league','Leagues'],['duel','One on one'],['past','Past rounds']].map(([value,title])=><button key={value} id={`cg-tab-${value}`} type="button" role="tab" aria-selected={tab===value} tabIndex={tab===value?0:-1} aria-controls="cg-rounds" onClick={()=>{setTab(value);setSelectedId(null);}}>{title}</button>)}</div>
    <div id="cg-rounds" role="tabpanel" aria-labelledby={`cg-tab-${tab}`} aria-busy={loading}>
      {loading?<Panel className="cg-empty"><Icon kind="leaf"/><p>Opening the village board…</p></Panel>:rounds.length?<>
        {rounds.length>1&&<div className="cg-round-picker" aria-label="Choose a competition">{rounds.map(c=><button type="button" key={c.id} aria-pressed={selected?.id===c.id} onClick={()=>setSelectedId(c.id)}><strong>{c.mode==='duel'?c.members.find(m=>m.id!==userId)?.name||c.name:c.name}</strong><small>{roundPhase(c,clock)==='active'?remainingTime(c.endsAt,clock):roundPhase(c,clock)}</small></button>)}</div>}
        <RoundBoard key={selected.id} round={selected} userId={userId} now={clock} busy={busy} onAction={action} onLeave={setLeaving} onInvite={setInviting}/>
      </>:<Panel className="cg-empty"><Icon kind={tab==='past'?'clock':tab==='league'?'cup':'flag'}/><span className="cg-eyebrow">{tab==='past'?'YOUR STORY IS STILL GROWING':'A LITTLE FRIENDLY MOTIVATION'}</span><h2>{tab==='past'?'Memories go here.':tab==='league'?'A place for your people.':'Side by side. One on one.'}</h2><p>{tab==='past'?'Finished rounds will stay here with their results.':tab==='league'?'Gather your friends, choose a week or a month, and turn small steps into a shared adventure.':'Choose your friends and give each rivalry its own little story. No shared league needed.'}</p>{tab!=='past'&&<button className="cg-button is-gold" type="button" onClick={()=>{setError('');setCreateMode(tab);}}>Start a {tab==='league'?'league':'challenge'}<Icon kind="arrow"/></button>}</Panel>}
    </div>
    <LegacyRounds hub={legacy} userId={userId} busy={busy} onAction={action}/>
    <p className="cg-page-note"><Icon kind="leaf"/>A little encouragement, at your own pace.<a href="#more">Friend notifications in More ›</a></p>
    {createMode&&<CreateRound key={createMode} initialMode={createMode} friends={friends} busy={busy} error={error} onClose={()=>{setCreateMode(null);setError('');}} onCreate={form=>{setTab(form.mode);void action(()=>createContests(form),'Invitations sent. Your round is waiting in the lobby.');}}/>}
    {inviting&&<InviteMembers round={hub.contests.find(c=>c.id===inviting.id)||inviting} friends={friends} busy={busy} error={error} onClose={()=>{setInviting(null);setError('');}} onInvite={ids=>void action(()=>inviteContestMembers(inviting.id,ids),'Invitations sent. Your friends can join whenever they are ready.')}/>}
    {leaving&&<Modal title="Leave this round?" onClose={()=>setLeaving(null)} busy={busy}><p>{leaving.mode==='duel'?'This ends your one-on-one round.':leaving.creatorId===userId?'Your league continues with the next member as host.':'You’ll leave the scoreboard and stop receiving this league’s updates.'} Your tasks and personal XP stay saved.</p>{error&&<p role="alert" className="cg-error">{error}</p>}<div className="cg-modal-actions"><button className="cg-button is-quiet" disabled={busy} onClick={()=>setLeaving(null)}>Keep playing</button><button className="cg-button" disabled={busy} onClick={()=>void action(()=>leaveContest(leaving.id),'You left the round.')}>Confirm</button></div></Modal>}
  </div>;
}
