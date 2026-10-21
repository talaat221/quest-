import {_electron as electron} from 'playwright';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=await fs.mkdtemp(path.join(os.tmpdir(),'quest-desktop-test-'));
const fixtureOutput=path.join(root,'dist','desktop-test');
let app, page, popup, checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;console.log(`PASS ${message}`);};
const poll=async(fn,message,timeout=12000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await fn()){checks++;console.log(`PASS ${message}`);return;}await new Promise(r=>setTimeout(r,100));}throw new Error(message);};
const visibility=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({url:w.webContents.getURL(),visible:w.isVisible(),focused:w.isFocused(),top:w.isAlwaysOnTop(),prefs:w.webContents.getLastWebPreferences(),throttled:w.webContents.getBackgroundThrottling()})));
async function direct(kind,key=kind) {
 return page.evaluate(async({kind,key})=>window.questDesktop.notify({userId:'desktop-test-user',event:{key:`direct:${key}`,kind,title:`${kind} reminder`,body:'A small step in your day',page:'#home',createdAt:Date.now(),durationMs:8000}}),{kind,key});
}
try {
  await build({configFile:false,root,plugins:[react()],base:'/desktop-test/',resolve:{alias:[{find:/^\.\/supabaseClient$/,replacement:path.join(root,'scripts/desktop-fixture-client.js')}]},build:{outDir:fixtureOutput,emptyOutDir:true,rolldownOptions:{input:path.join(root,'scripts/desktop-fixture.html')}},logLevel:'warn'});
  const env={...process.env,QUEST_DESKTOP_TEST_DATA:data,TZ:'UTC'};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({cwd:root,args:['.',...(process.platform==='linux' && process.getuid?.()===0?['--no-sandbox']:[])],env,timeout:30000});
  page=await app.firstWindow();
  await page.goto('quest://app/desktop-test/scripts/desktop-fixture.html');
  await page.waitForFunction(()=>window.fixture?.notifications.desktopSettings);
  await poll(async()=>app.windows().some(w=>w.url()==='quest://notice/'),'Transient reminder window initialized, hidden');
  popup=app.windows().find(w=>w.url()==='quest://notice/');
  check(!(await visibility()).find(w=>w.url==='quest://notice/').visible,'No idle bubble on screen');
  check(await page.evaluate(()=>typeof window.require==='undefined' && typeof window.process==='undefined' && typeof window.questDesktop.notify==='function'),'Sandboxed renderer exposes only the narrow desktop bridge');
  check(await popup.evaluate(()=>!window.questDesktop && !!window.questNotice),'Reminder renderer cannot use app settings or arbitrary IPC');
  const security=(await visibility()).find(w=>w.url.includes('desktop-fixture'));
  check(security.prefs.contextIsolation && security.prefs.sandbox && !security.prefs.nodeIntegration && security.prefs.webSecurity,'Isolation and renderer sandbox enabled');
  check(security.throttled===false,'Reminder clocks run when the main window is hidden');
  check((await page.evaluate(async()=>[await fetch('quest://notice/main.mjs').then(r=>r.status).catch(()=>404),await fetch('quest://app/..%2fpackage.json').then(r=>r.status).catch(()=>404)] )).every(s=>s===404),'Protocol refuses main-process files and path traversal');
  await page.evaluate(async()=>{const s=await window.questDesktop.getSettings();if(s.launchAtLogin)throw new Error('Startup was silently enabled');await window.questDesktop.updateSettings({closeToTray:true});});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('desktop-fixture')).close());
  check(!(await visibility()).find(w=>w.url.includes('desktop-fixture')).visible,'Closing the main window keeps the app alive in the tray');
  await page.evaluate(()=>{const now=new Date(),day=now.toISOString().slice(0,10);window.fixture.setState({settings:{},anchors:[],domains:[{id:'q',name:'Study',tasks:[{id:'first',name:'Read a chapter',day,hour:now.getUTCHours()+now.getUTCMinutes()/60,estimatedMinutes:30,xp:30}]}]});});
  await popup.getByText('Time for Read a chapter',{exact:true}).waitFor({state:'visible',timeout:12000});
  check((await visibility()).find(w=>w.url==='quest://notice/').top,'A due task appears in the always-on-top reminder');
  check(!(await visibility()).find(w=>w.url.includes('desktop-fixture')).visible,'A due reminder does not open the main window');
  await fs.mkdir(path.join(root,'release'),{recursive:true});await popup.screenshot({path:path.join(root,'release/test-reminder.png')});
  await popup.getByRole('button',{name:'Start session',exact:true}).click();
  await poll(()=>page.evaluate(()=>!!window.fixture.state.domains[0].tasks[0].workTimer?.startedAt),'Start session starts the existing task timer');
  check(await page.evaluate(()=>window.fixture.state.domains[0].tasks[0].xp===30 && !window.fixture.state.domains[0].tasks[0].done),'Starting never completes the task or awards XP');
  check(!(await visibility()).find(w=>w.url.includes('desktop-fixture')).visible,'Start session works without bringing Quest forward');
  await poll(async()=>!(await visibility()).find(w=>w.url==='quest://notice/').visible,'The popup disappears after its action');
  await page.evaluate(()=>{const next=structuredClone(window.fixture.state),now=new Date();next.domains[0].tasks.push({id:'second',name:'Practice drawing',day:now.toISOString().slice(0,10),hour:now.getUTCHours()+now.getUTCMinutes()/60});window.fixture.setState(next);});
  await popup.getByText('Time for Practice drawing',{exact:true}).waitFor({state:'visible'});
  await popup.getByRole('button',{name:'In 5 min',exact:true}).click();
  await poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('quest-reminder-snoozes:desktop-test-user')||'[]').length===1),'Snoozing stores a real reminder for five minutes later');
  check(await page.evaluate(()=>!window.fixture.state.domains[0].tasks[1].workTimer?.startedAt),'Snoozing does not start or complete a task');
  await page.evaluate(()=>{const key='quest-reminder-snoozes:desktop-test-user',items=JSON.parse(localStorage.getItem(key));items[0].due=Date.now()-500;localStorage.setItem(key,JSON.stringify(items));});
  await page.reload();await page.waitForFunction(()=>window.fixture?.notifications.desktopSettings);
  await popup.getByText('Time for Practice drawing',{exact:true}).waitFor({state:'visible'});
  await page.evaluate(()=>{const next=structuredClone(window.fixture.state);next.domains[0].tasks[1].done=true;window.fixture.setState(next);});
  await poll(async()=>!(await visibility()).find(w=>w.url==='quest://notice/').visible,'Completing a task removes its visible reminder');
  await page.evaluate(()=>window.fixture.notifications.update({tasks:false,anchors:false,timers:false,study:false,review:false,friends:false}));
  for(const kind of ['anchor','pomodoro','timer','study','review','competition','preview']) {
    check((await direct(kind)).accepted,`${kind} uses the desktop transport`);
    await popup.getByText(`${kind} reminder`,{exact:true}).waitFor({state:'visible'});
    await popup.getByRole('button',{name:'Dismiss reminder',exact:true}).click();
  }
  await direct('preview','auto-close');
  await popup.getByText('preview reminder',{exact:true}).waitFor({state:'visible'});
  await popup.mouse.move(0,0);await page.evaluate(()=>document.activeElement?.blur());
  // Give focus back to another app/window; the countdown must not be held by the previous click.
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='quest://notice/').blur());
  await poll(async()=>!(await visibility()).find(w=>w.url==='quest://notice/').visible,'An untouched popup dismisses automatically',12000);
  await direct('preview','queue-one');await direct('review','queue-two');
  await popup.getByText('preview reminder',{exact:true}).waitFor({state:'visible'});
  await popup.getByRole('button',{name:'Dismiss reminder'}).click();
  await popup.getByText('review reminder',{exact:true}).waitFor({state:'visible'});
  check(true,'Simultaneous notifications queue instead of overlapping');
  await page.evaluate(()=>window.fixture.notifications.disable());
  await poll(async()=>!(await visibility()).find(w=>w.url==='quest://notice/').visible,'Disabling reminders removes the active card');
  check(!(await direct('task','disabled')).accepted,'Disabled reminders cannot reappear');
  await page.evaluate(()=>window.fixture.notifications.enable());
  await direct('preview','logout');
  await popup.getByText('preview reminder',{exact:true}).waitFor({state:'visible'});
  await page.evaluate(()=>window.fixture.setUser(null));
  await poll(async()=>!(await visibility()).find(w=>w.url==='quest://notice/').visible,'Sign-out clears private reminder content');
  check(!(await direct('preview','old-user')).accepted,'The previous account cannot enqueue reminders after sign-out');
  console.log(`\n${checks} desktop checks passed.`);
} catch(error) {
  await fs.mkdir(path.join(root,'release'),{recursive:true});
  for(const [name,win] of [['main',page],['popup',popup]]) {try{await win?.screenshot({path:path.join(root,`release/test-failed-${name}.png`),timeout:3000});}catch{}}
  console.error(error);
  try { console.log("Fixture:",await page.evaluate(()=>({error:window.fixture?.notifications.error,body:document.body.innerText.slice(0,600)}))); console.log("Reminder:",await popup?.locator("body").innerText()); } catch {}
  process.exitCode=1;
} finally {
  if(app)await app.close();
  await fs.rm(fixtureOutput,{recursive:true,force:true});await fs.rm(data,{recursive:true,force:true,maxRetries:5,retryDelay:300});
}
