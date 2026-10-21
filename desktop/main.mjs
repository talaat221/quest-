import { app, BrowserWindow, Menu, Tray, Notification, ipcMain, protocol, net, session, shell, screen, powerMonitor } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APP_URL, NOTICE_URL, isQuestURL, validateReminder, validUser, primaryAction, noticeBounds } from './contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
const icon = path.join(dist, 'icon-192.png');
const snoozable = new Set(['task','anchor','study','review','pomodoro','timer']);
protocol.registerSchemesAsPrivileged([{scheme:'quest',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
if (!app.isPackaged && process.env.QUEST_DESKTOP_TEST_DATA) app.setPath('userData', process.env.QUEST_DESKTOP_TEST_DATA);
app.setAppUserModelId('me.myquests.desktop');
const single = app.requestSingleInstanceLock();
if (!single) app.quit();

let main, notice, tray, quitting = false, noticeReady = false, locked = false, pausedUntil = 0;
let account = null, delivery = {enabled:false,popups:true,sound:false};
let active = null, queue = [], expireTimer, hardTimer, actionTimer;
const nativeNotices = new Map();
const recentlySeen = new Map();
let settings = {closeToTray:true,launchAtLogin:false};
const settingsFile = () => path.join(app.getPath('userData'), 'desktop-settings.json');
const send = (channel, value) => { if (main && !main.isDestroyed()) main.webContents.send(channel, value); };

function showMain() {
  if (!main || main.isDestroyed()) return;
  if (main.isMinimized()) main.restore();
  main.show(); main.focus();
}
function trusted(event, window, host) {
  return !!window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && isQuestURL(event.senderFrame.url, host);
}
function requireMain(event) { if (!trusted(event,main,'app')) throw new Error('Untrusted window.'); }
function removed(key) { send('quest:removed', {userId:account,key}); }
function clearActive() {
  clearTimeout(expireTimer); clearTimeout(hardTimer); clearTimeout(actionTimer);
  if (active) removed(active.event.key);
  active = null;
  if (notice && !notice.isDestroyed()) notice.hide();
}
function resetReminders() {
  queue.forEach(item => removed(item.event.key)); queue = [];
  for (const item of nativeNotices.values()) { clearTimeout(item.timer); item.notification.close(); removed(item.event.key); }
  nativeNotices.clear(); recentlySeen.clear(); clearActive();
}
function next() {
  if (active || !noticeReady || locked || pausedUntil > Date.now() || !delivery.enabled || !delivery.popups) return;
  while (queue.length) {
    const item = queue.shift();
    if (Date.now() - item.event.createdAt > 120000 || item.userId !== account) { removed(item.event.key); continue; }
    active = {...item,remaining:item.event.durationMs,busy:false};
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    notice.setBounds(noticeBounds(display.workArea));
    notice.webContents.send('notice:show',{...item.event,remainingMs:active.remaining,primary:primaryAction(item.event),snoozable:snoozable.has(item.event.kind),sound:delivery.sound});
    // Never steal keyboard focus from a meeting or another application.
    notice.showInactive();
    armExpiry(active.remaining);
    hardTimer = setTimeout(() => { clearActive(); next(); },120000);
    return;
  }
}
function armExpiry(ms) {
  clearTimeout(expireTimer);
  if (!active) return;
  active.remaining = ms; active.deadline = Date.now() + ms;
  expireTimer = setTimeout(() => { clearActive(); next(); },ms);
}
function handleAction(key, action) {
  if (!active || active.event.key !== key || active.busy || (active.completed && action !== 'dismiss')) return;
  const allowed = ['open','dismiss',...(primaryAction(active.event).id === 'start' ? ['start'] : []),...(snoozable.has(active.event.kind) ? ['snooze'] : [])];
  if (!allowed.includes(action)) return;
  if (action === 'dismiss') { clearActive(); next(); return; }
  clearTimeout(expireTimer); active.busy = true;
  send('quest:action',{userId:account,key,action});
  if (action === 'open') showMain();
  actionTimer = setTimeout(() => {
    if (!active || active.event.key !== key) return;
    active.busy = false;
    notice.webContents.send('notice:result',{key,ok:false,message:'Open Quest and try again.'});
    armExpiry(12000);
  },10000);
}
function addReminder(event) {
  if (!delivery.enabled || !account) return {accepted:false};
  if (recentlySeen.has(event.key)) return {accepted:true};
  if (locked || pausedUntil > Date.now()) return {accepted:true,muted:true};
  recentlySeen.set(event.key,Date.now());
  for (const [key,at] of recentlySeen) if (Date.now()-at > 86400000) recentlySeen.delete(key);
  if (recentlySeen.size > 4096) recentlySeen.delete(recentlySeen.keys().next().value);
  if (delivery.popups) {
    if (queue.length >= 20) { recentlySeen.delete(event.key); return {accepted:false}; }
    queue.push({userId:account,event}); next(); return {accepted:true};
  }
  if (!Notification.isSupported()) { recentlySeen.delete(event.key); return {accepted:false,error:'Windows notifications are unavailable.'}; }
  if (nativeNotices.size >= 20) { recentlySeen.delete(event.key); return {accepted:false}; }
  const owner = account;
  const notification = new Notification({title:event.title,body:event.body,icon,silent:!delivery.sound,timeoutType:'default'});
  const timer = setTimeout(() => { notification.close(); nativeNotices.delete(event.key); removed(event.key); },120000);
  nativeNotices.set(event.key,{notification,event,timer});
  notification.on('click', () => { if (owner === account) { send('quest:action',{userId:owner,key:event.key,action:'open'}); showMain(); } });
  notification.on('close', () => { clearTimeout(timer); nativeNotices.delete(event.key); setTimeout(() => { if (owner === account) removed(event.key); },1000); });
  notification.on('failed', () => { clearTimeout(timer); nativeNotices.delete(event.key); recentlySeen.delete(event.key); send('quest:removed',{userId:owner,key:event.key,error:'Windows could not show the alert. Check Windows notification settings.'}); });
  notification.show(); return {accepted:true};
}
function trayMenu() {
  if (!tray) return;
  const paused = pausedUntil > Date.now();
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Open Quest',click:showMain},
    {label:paused ? 'Resume reminders' : 'Pause reminders for 30 minutes',click:() => { pausedUntil = paused ? 0 : Date.now()+30*60000; resetReminders(); trayMenu(); send('quest:wake',{}); }},
    {type:'separator'},
    {label:'Quit Quest',click:() => { quitting = true; app.quit(); }},
  ]));
  tray.setToolTip(paused ? 'Quest · reminders paused' : 'Quest · reminders ready');
}
function protect(window, host) {
  window.webContents.on('will-navigate',(event,url) => { if (!isQuestURL(url,host)) event.preventDefault(); });
  window.webContents.on('will-redirect',(event,url) => { if (!isQuestURL(url,host)) event.preventDefault(); });
  window.webContents.on('will-attach-webview',event => event.preventDefault());
  window.webContents.setWindowOpenHandler(({url}) => {
    // Public account/email pages open in the browser; never execute shell URLs.
    try { const target = new URL(url); if (host === 'app' && target.protocol === 'https:' && ['myquests.me','www.myquests.me'].includes(target.hostname) && !target.username && !target.password) void shell.openExternal(target.href); } catch { /* Invalid URL. */ }
    return {action:'deny'};
  });
}
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: quest://app https://fonts.gstatic.com; img-src 'self' data: blob: quest://app https://nagxpuqdurdcogzudblo.supabase.co; connect-src 'self' https://nagxpuqdurdcogzudblo.supabase.co wss://nagxpuqdurdcogzudblo.supabase.co; media-src 'self' blob: data:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'";
async function serve(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || (!isQuestURL(request.url,'app') && !isQuestURL(request.url,'notice'))) return new Response('Not found',{status:404});
  const root = url.hostname === 'app' ? dist : here;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Invalid path',{status:400}); }
  if (pathname.includes('\0') || pathname.includes('\\')) return new Response('Invalid path',{status:400});
  if (url.hostname === 'notice' && !['/','/notice.css','/notice.js'].includes(pathname)) return new Response('Not found',{status:404});
  const asset = pathname === '/' ? (url.hostname === 'app' ? 'index.html' : 'notice.html') : pathname.slice(1);
  let file = path.resolve(root,asset);
  if (!file.startsWith(root+path.sep)) return new Response('Not found',{status:404});
  if (!fs.existsSync(file) && url.hostname === 'app' && !path.extname(file)) file = path.join(dist,'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Not found',{status:404});
  const result = await net.fetch(pathToFileURL(file).href);
  const headers = new Headers(result.headers); headers.set('Content-Security-Policy',csp); headers.set('X-Content-Type-Options','nosniff');
  if (request.headers.get('Origin') === 'quest://notice') headers.set('Access-Control-Allow-Origin','quest://notice');
  return new Response(result.body,{status:result.status,headers});
}
if (single) app.whenReady().then(async () => {
  try { const saved = JSON.parse(fs.readFileSync(settingsFile(),'utf8')); settings = {closeToTray:saved.closeToTray !== false,launchAtLogin:saved.launchAtLogin === true}; } catch { /* First launch. */ }
  protocol.handle('quest',serve);
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback) => callback(contents === main?.webContents && permission === 'clipboard-sanitized-write'));
  session.defaultSession.setPermissionCheckHandler((contents,permission) => contents === main?.webContents && permission === 'clipboard-sanitized-write');
  main = new BrowserWindow({width:1200,height:860,minWidth:700,minHeight:600,show:false,title:'Quest',backgroundColor:'#081726',icon,
    webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false,spellcheck:true}});
  protect(main,'app');
  main.on('close', event => { if (quitting) return; if (settings.closeToTray && tray) { event.preventDefault(); main.hide(); } else { quitting = true; app.quit(); } });
  main.webContents.on('render-process-gone', () => { resetReminders(); account = null; delivery.enabled = false; main.reload(); });
  main.webContents.on('did-start-navigation', (_event,_url,inPlace,isMainFrame) => { if (isMainFrame && !inPlace) { resetReminders(); account = null; delivery.enabled = false; } });
  main.once('ready-to-show', () => { if (!process.argv.includes('--background')) main.show(); });
  notice = new BrowserWindow({width:540,height:158,show:false,frame:false,transparent:true,resizable:false,movable:false,minimizable:false,maximizable:false,fullscreenable:false,skipTaskbar:true,alwaysOnTop:true,hasShadow:false,
    webPreferences:{preload:path.join(here,'notice-preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
  protect(notice,'notice'); notice.setAlwaysOnTop(true,'floating');
  notice.on('hide',() => { if (!notice.isDestroyed()) notice.webContents.send('notice:hidden'); });
  notice.on('close', event => { if (!quitting) { event.preventDefault(); clearActive(); next(); } });
  notice.webContents.on('render-process-gone', () => { noticeReady = false; clearActive(); notice.reload(); });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Quest',submenu:[{label:'Open Quest',click:showMain},{label:'Hide to tray',click:()=>main.hide()},{type:'separator'},{label:'Quit Quest',click:()=>{quitting=true;app.quit();}}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'},...(!app.isPackaged?[{role:'toggleDevTools'}]:[])]}]));
  try { tray = new Tray(icon); tray.on('double-click',showMain); tray.on('click',showMain); trayMenu(); } catch { settings.closeToTray = false; }

  ipcMain.handle('quest:settings',event => { requireMain(event); return {...settings,version:app.getVersion(),platform:process.platform}; });
  ipcMain.handle('quest:update-settings',(event,values) => {
    requireMain(event);
    if (!values || Object.keys(values).some(key=>!['closeToTray','launchAtLogin'].includes(key)) || Object.values(values).some(value=>typeof value !== 'boolean')) throw new Error('Invalid settings.');
    const nextSettings = {...settings,...values};
    if (Object.hasOwn(values,'launchAtLogin')) {
      if (!app.isPackaged || process.platform !== 'win32') { if (values.launchAtLogin) throw new Error('Available in the installed Windows app.'); }
      else app.setLoginItemSettings({openAtLogin:values.launchAtLogin,path:app.getPath('exe'),args:['--background']});
    }
    fs.mkdirSync(path.dirname(settingsFile()),{recursive:true});
    fs.writeFileSync(settingsFile()+'.tmp',JSON.stringify(nextSettings)); fs.renameSync(settingsFile()+'.tmp',settingsFile());
    settings = nextSettings; return {...settings,version:app.getVersion(),platform:process.platform};
  });
  ipcMain.handle('quest:configure',(event,value) => {
    requireMain(event);
    const userId = validUser(value?.userId) ? value.userId : null;
    if (account !== userId) { resetReminders(); account = userId; }
    const nextDelivery = {enabled:!!userId && value?.enabled === true,popups:value?.popups === true,sound:value?.sound === true};
    if (!nextDelivery.enabled || nextDelivery.popups !== delivery.popups) resetReminders();
    delivery = nextDelivery; return {enabled:delivery.enabled};
  });
  ipcMain.handle('quest:notify',(event,value) => {
    requireMain(event); if (!account || value?.userId !== account) return {accepted:false};
    const reminder = validateReminder(value?.event); if (!reminder) return {accepted:false};
    return addReminder(reminder);
  });
  ipcMain.handle('quest:cancel',(event,value) => {
    requireMain(event); if (value?.userId !== account || !Array.isArray(value?.keys) || value.keys.length > 100) return;
    const keys = new Set(value.keys);
    queue = queue.filter(item => { if (keys.has(item.event.key)) { removed(item.event.key); return false; } return true; });
    for (const key of keys) { const item = nativeNotices.get(key); if (item) { clearTimeout(item.timer); item.notification.close(); nativeNotices.delete(key); removed(key); } }
    if (active && !active.busy && !active.completed && keys.has(active.event.key)) { clearActive(); next(); }
  });
  ipcMain.handle('quest:action-result',(event,value) => {
    requireMain(event); if (value?.userId !== account || !active || active.event.key !== value?.key || !active.busy) return;
    clearTimeout(actionTimer); active.busy = false;
    const ok = value.ok === true;
    active.completed = ok;
    const message = typeof value.message === 'string' ? value.message.slice(0,120) : (ok ? 'Done.' : 'Open Quest and try again.');
    notice.webContents.send('notice:result',{key:active.event.key,ok,message}); armExpiry(ok ? 2400 : 12000);
  });
  ipcMain.on('notice:ready',event => { if (trusted(event,notice,'notice')) { noticeReady = true; next(); } });
  ipcMain.on('notice:action',(event,value) => { if (trusted(event,notice,'notice')) handleAction(value?.key,value?.action); });
  ipcMain.on('notice:hold',(event,value) => {
    if (!trusted(event,notice,'notice') || !active || active.busy || active.event.key !== value?.key || typeof value.value !== 'boolean') return;
    if (value.value) { active.remaining = Math.max(0,active.deadline-Date.now()); clearTimeout(expireTimer); }
    else armExpiry(active.remaining);
  });
  powerMonitor.on('lock-screen',() => { locked = true; resetReminders(); });
  powerMonitor.on('suspend',() => { locked = true; resetReminders(); });
  const wake = () => { locked = false; trayMenu(); send('quest:wake',{}); };
  powerMonitor.on('unlock-screen',wake); powerMonitor.on('resume',wake);
  app.on('second-instance',showMain); app.on('activate',showMain);
  await Promise.all([main.loadURL(APP_URL),notice.loadURL(NOTICE_URL)]);
});
app.on('before-quit',() => { quitting = true; resetReminders(); });
app.on('window-all-closed',() => { if (quitting) app.quit(); });
