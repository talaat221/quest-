import { useEffect, useRef, useState } from 'react';
import { supabase, flushQuestSync, getQuestSyncSnapshot, subscribeQuestSync, resolveQuestConflict } from './supabaseClient';
import { disconnectNotifications } from './notifications.js';
import AccountDeleteCard from './AccountDeleteCard.jsx';
import AccountResetCard from './AccountResetCard.jsx';
import NotificationSettings from './NotificationSettings.jsx';
import { NavigationRow } from './AppNavigation.jsx';
import { SETTINGS_SECTIONS, settingsSection } from './app-navigation.js';

export default function SettingsPage({user, name, username, resetHour, onResetHour, onResetAccount, notifications, onOpenGuide}) {
  const [section,setSection] = useState(()=>settingsSection(window.location.hash));
  const [sync,setSync] = useState(getQuestSyncSnapshot);
  const [busy,setBusy] = useState(false), [resetting,setResetting] = useState(false), [deleting,setDeleting] = useState(false);
  const [error,setError] = useState(''), [message,setMessage] = useState('');
  const running = useRef(false), heading = useRef(null);
  const locked = busy || resetting || deleting;
  useEffect(()=>subscribeQuestSync(setSync),[]);
  useEffect(()=>{
    const change=()=>{setSection(settingsSection(window.location.hash));setError('');setMessage('');};
    window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);
  },[]);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});heading.current?.focus({preventScroll:true});},[section]);
  const run=async(action,success='')=>{
    if(running.current||resetting||deleting)return;
    running.current=true;setBusy(true);setError('');setMessage('');
    try{await action();setMessage(success);}catch(e){setError(e?.message||'That didn’t finish. Please try again.');}
    finally{running.current=false;setBusy(false);}
  };
  const resolve=strategy=>{
    const question=strategy==='cloud'?'Use the cloud copy and discard unsynced changes from this device?':'Keep this device and replace the cloud copy with it?';
    if(window.confirm(question))void run(()=>resolveQuestConflict(strategy));
  };
  const signOut=()=>run(async()=>{
    await flushQuestSync();const saved=getQuestSyncSnapshot();
    if(saved.state!=='synced'||saved.pending)throw new Error('Your latest changes are not synced yet. Open Sync & storage before signing out.');
    await disconnectNotifications();const result=await supabase.auth.signOut();if(result.error)throw result.error;
  });
  const row=key=>{const [title,detail,icon]=SETTINGS_SECTIONS[key];return <NavigationRow key={key} href={`#settings/${key}`} icon={icon} title={title} detail={detail}/>;};
  return <div className="qa-settings qa-page">
    <header className="qa-page-heading"><a className="qa-back" href={section?'#settings':'#profile'}>‹ {section?'Settings':'Your profile'}</a><h1 ref={heading} tabIndex={-1}>{section?SETTINGS_SECTIONS[section][0]:'Settings'}</h1><p>{section?SETTINGS_SECTIONS[section][1]:'Make Quest fit your life.'}</p></header>
    {!section&&<>
      <section className="qa-list-group" aria-label="Preferences"><h2>Preferences</h2>{row('notifications')}{row('routine')}</section>
      <section className="qa-list-group" aria-label="Account and data"><h2>Account & data</h2>{row('account')}{row('sync')}{row('data')}{row('delete-account')}</section>
      <section className="qa-list-group" aria-label="Help and information"><h2>Help & information</h2><button type="button" className="qa-guide-replay" onClick={onOpenGuide}>Meet your Quest companion <span>Take a tiny adventure through the app ›</span></button><NavigationRow href="/privacy?lang=en" icon="you" title="Privacy Notice" detail="Your data and your choices"/><NavigationRow href="/terms?lang=en" icon="plan" title="Terms of Service" detail="The rules for using Quest"/></section><p className="qa-save-note" role="status">{sync.state==='synced'&&!sync.pending?'Your changes are saved.':sync.message}</p>
    </>}
    {section==='account'&&<>
      <section className="qd-home-settings-card qa-account-card"><h2>Signed in as</h2><dl><div><dt>Name</dt><dd>{name}</dd></div>{username&&<div><dt>Username</dt><dd>@{username}</dd></div>}<div><dt>Email</dt><dd>{user?.email || 'Not available'}</dd></div></dl><a className="qa-inline-link" href="#profile">View your profile ›</a></section>
      <NavigationRow href="#settings/delete-account" icon="data" title="Delete account" detail="Permanently remove your account and personal data"/><section className="qd-home-settings-card"><h2>This device</h2><p>Sign out after your latest progress has finished saving.</p><button type="button" disabled={locked} onClick={signOut}>{busy?'Saving before sign out…':'Sign out'}</button></section>
    </>}
    {section==='delete-account'&&<AccountDeleteCard disabled={busy || resetting} onBusyChange={setDeleting}/>}
    {section==='notifications'&&<NotificationSettings notifications={notifications}/>}
    {section==='routine'&&<>
      <section className="qd-home-settings-card"><h2>Your Quest day</h2><p>Use a later reset if you often finish your day after midnight.</p><label className="qa-setting-field">Day reset time<select aria-label="Day reset time" value={resetHour} disabled={locked} onChange={e=>onResetHour(e.target.value)}>{Array.from({length:24},(_,hour)=><option key={hour} value={hour}>{`${hour%12||12}:00 ${hour<12?'AM':'PM'}`}</option>)}</select></label><p className="qa-save-note" role="status">{sync.state==='synced'&&!sync.pending?'Saved automatically.':sync.message}</p></section>
      <section className="qa-list-group" aria-label="Planning preferences"><h2>Plan your time</h2><NavigationRow href="#quests/planner" icon="plan" title="Weekly capacity" detail="Available hours, work window and flexible tasks"/><NavigationRow href="#rewards" icon="rewards" title="Reward rules" detail="Choose treats and completion targets"/></section>
    </>}
    {section==='sync'&&<section className="qd-home-settings-card"><h2>Your progress</h2><p role="status">{sync.message}</p>{sync.state==='conflict'?<><p>This device and the cloud have different saved changes. Choose the copy you want to keep.</p><div className="qa-button-group"><button type="button" disabled={locked} onClick={()=>resolve('cloud')}>Use cloud copy</button><button type="button" disabled={locked} onClick={()=>resolve('local')}>Keep this device</button></div></>:<button type="button" disabled={locked||sync.state==='syncing'} onClick={()=>void run(flushQuestSync,'Sync checked.')}>{busy?'Checking…':'Sync now'}</button>}<p className="qa-sync-help">Offline changes stay on this device until they sync. Keep Quest open while reconnecting.</p></section>}
    {section==='data'&&<><AccountResetCard onReset={onResetAccount} disabled={busy || deleting} onBusyChange={setResetting}/><NavigationRow href="#settings/delete-account" icon="data" title="Delete account" detail="Permanently remove your account and personal data"/></>}
    {message&&<p className="qa-feedback" role="status">{message}</p>}{error&&<p className="qa-feedback is-error" role="alert">{error}</p>}
    {section==='account'&&error&&<a href="#settings/sync" className="qa-inline-link">Open Sync & storage ›</a>}
  </div>;
}
