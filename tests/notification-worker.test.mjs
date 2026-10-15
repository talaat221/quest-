import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const harness=()=>{
 const handlers={},shown=[],messages=[],opened=[],badges=[];
 const self={navigator:{setAppBadge:async n=>badges.push(n),clearAppBadge:async()=>badges.push(0)},skipWaiting(){},location:{origin:'https://quest-alpha-fawn.vercel.app'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[{url:'https://quest-alpha-fawn.vercel.app/#home',postMessage:message=>messages.push(message),navigate:async url=>{opened.push(url);return {focus:async()=>{}}}}],openWindow:async url=>opened.push(url)}};
 const attempted=[];const caches={open:async()=>({add:async url=>{attempted.push(url);if(url.includes('pixel-garden'))throw new Error('Optional art unavailable');}})};
 vm.runInNewContext(source,{self,URL,caches});
 return {handlers,shown,messages,opened,attempted,badges};
};
test('background push always displays and passes the event key to open clients',async()=>{
 const h=harness();let pending;
 h.handlers.push({data:{json:()=>({title:'Focus done',body:'Take a break',tag:'unique',data:{eventKey:'focus1',url:'https://quest-alpha-fawn.vercel.app/#study'}})},waitUntil:promise=>pending=promise});await pending;
 assert.equal(h.shown.length,1);assert.equal(h.shown[0][1].tag,'unique');assert.equal(h.messages[0].payload.data.eventKey,'focus1');
});
test('notification click opens the relevant page and rejects external navigation',async()=>{
 const h=harness();let pending;const notification={close(){},data:{url:'https://quest-alpha-fawn.vercel.app/#study'}};
 h.handlers.notificationclick({notification,waitUntil:promise=>pending=promise});await pending;assert.equal(h.opened[0],'https://quest-alpha-fawn.vercel.app/#study');
 notification.data.url='https://untrusted.example/login';h.handlers.notificationclick({notification,waitUntil:promise=>pending=promise});await pending;assert.equal(h.opened[1],'https://quest-alpha-fawn.vercel.app/#home');
});

test('one missing decorative asset cannot prevent the notification worker installing',async()=>{
 const h=harness();let pending;h.handlers.install({waitUntil:promise=>pending=promise});
 await pending;assert.ok(h.attempted.includes('/'));assert.ok(h.attempted.some(url=>url.includes('pixel-garden')));
});

test('native reminders carry current counts and supported snooze actions without skipping visible push',async()=>{
 const h=harness();let pending;
 const data={eventKey:'task:one',kind:'task',remaining:4,sound:false,url:'https://quest-alpha-fawn.vercel.app/#study'};
 h.handlers.push({data:{json:()=>({title:'Read',data})},waitUntil:p=>pending=p});await pending;
 assert.deepEqual(h.badges,[4]);assert.equal(h.shown[0][1].silent,true);assert.equal(h.shown[0][1].actions[1].action,'snooze');
 data.remaining=0;h.handlers.push({data:{json:()=>({title:'Read',data})},waitUntil:p=>pending=p});await pending;assert.deepEqual(h.badges,[4,0]);
 h.handlers.notificationclick({action:'snooze',notification:{close(){},data},waitUntil:p=>pending=p});await pending;
 const target=new URL(h.opened[0]);assert.equal(target.searchParams.get('questSnooze'),'task:one');assert.equal(target.hash,'#settings/notifications');
});
