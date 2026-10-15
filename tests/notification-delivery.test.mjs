import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as reminders from '../supabase/functions/_shared/reminders.js';

async function harness() {
  let now=Date.parse('2026-10-15T12:00:00Z');
  class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
  const state={settings:{dayResetHour:0},anchors:[],domains:[{id:'q',name:'Study',tasks:[{id:'t',name:'Read',day:'2026-10-15',hour:12,done:false}]}]};
  const sub={id:'device-a',user_id:'alice',endpoint:'https://fcm.googleapis.com/fixture',origin:'https://myquests.me',timezone:'UTC',enabled_at:'2026-10-01T00:00:00Z',last_seen_at:'2026-10-15T12:00:00Z',preferences:{},subscription:{}};
  const tables={quest_push_subscriptions:[sub],quest_push_deliveries:[],quest_reminder_snoozes:[]};
  const rows=tables.quest_push_deliveries;
  const friendEvents=[];
  const admin={auth:{getUser:async token=>({data:{user:token==='alice-token'?{id:'alice'}:null},error:null})},
    rpc:async(name,args)=>{
      if(name==='get_quest_push_state')return{data:state,error:null};
      if(name==='get_quest_competition_push_events')return{data:friendEvents,error:null};
      if(name==='get_quest_push_secrets')return{data:{vapid:{},scheduler:'fixture-only'},error:null};
      if(name==='claim_quest_push'){
        const found=rows.find(r=>r.subscription_id===args.p_subscription&&r.event_key===args.p_key);
        if(found)return{data:false,error:null};
        rows.push({subscription_id:args.p_subscription,event_key:args.p_key,state:'sending'});return{data:true,error:null};
      }
      throw new Error(name);
    },
    from(name){const filters=[];let op='select',values,one=false,start=0,end=1000;
      const query={select(){return query},eq(k,v){filters.push(r=>r[k]===v);return query},lte(k,v){filters.push(r=>r[k]<=v);return query},gt(k,v){filters.push(r=>r[k]>v);return query},order(){return query},range(a,b){start=a;end=b+1;return query},limit(n){end=n;return query},maybeSingle(){one=true;return query},update(v){op='update';values=v;return query},delete(){op='delete';return query},upsert(v){op='upsert';values=v;return query},then(resolve){let matched=tables[name].filter(r=>filters.every(f=>f(r))).slice(start,end);
       if(op==='update')matched.forEach(r=>Object.assign(r,values));
       if(op==='delete')tables[name]=tables[name].filter(r=>!matched.includes(r));
       if(op==='upsert'){const old=tables[name].find(r=>r.subscription_id===values.subscription_id&&r.original_key===values.original_key);if(old)Object.assign(old,values);else tables[name].push(values);}
       return Promise.resolve({data:one?matched[0]||null:matched,error:null}).then(resolve);
      }};return query;}
  };
  let handler;const sends=[];
  const context=vm.createContext({console,Date:Clock,JSON,Map,Set,Number,String,Object,Array,Error,URL,Request,Response,Headers,TextEncoder,Uint8Array,AbortSignal,crypto,atob,btoa,fetch:async(url,options)=>{sends.push({url,options});return new Response('',{status:201})},Deno:{env:{get:()=>''},serve:fn=>handler=fn}});
  const module=new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/quest-notifications/index.ts',import.meta.url),'utf8')),{context});
  await module.link(async name=>{
    const exports=name.startsWith('npm:@supabase')?{createClient:()=>admin}:name.startsWith('npm:web-push')?{default:{generateRequestDetails:()=>({endpoint:sub.endpoint,method:'POST',headers:{},body:'encrypted-fixture'})}}:{...reminders,dueReminders:(state,options)=>reminders.dueReminders(state,{...options,now}),reminderStillRelevant:(state,event,options)=>reminders.reminderStillRelevant(state,event,{...options,now})};
    return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context});
  });await module.evaluate();
  const call=async(body,{token='alice-token',origin='https://myquests.me',scheduler}={})=>{
    const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin,authorization:`Bearer ${token}`,'content-type':'application/json',...(scheduler?{'x-quest-scheduler':scheduler}:{})},body:JSON.stringify(body)}));return{status:response.status,data:await response.json()};
  };
  const event=reminders.dueReminders(state,{timezone:'UTC',now})[0];
  return{call,state,sub,tables,sends,event,friendEvents,setNow:value=>{now=value;}};
}
test('foreground claims canonical events once, with authentication and device ownership',async()=>{
 const h=await harness();assert.ok(h.event);
 assert.equal((await h.call({action:'foreground',endpoint:h.sub.endpoint,keys:[h.event.key]},{token:'bad'})).status,401);
 assert.equal((await h.call({action:'foreground',endpoint:'someone-else',keys:[h.event.key]})).data.enabled,false);
 assert.equal((await h.call({action:'foreground',endpoint:h.sub.endpoint,keys:['invented-event']})).data.events.length,0);
 const first=await h.call({action:'foreground',endpoint:h.sub.endpoint,keys:[h.event.key]});assert.equal(first.data.events.length,1);
 assert.equal((await h.call({action:'foreground',endpoint:h.sub.endpoint,keys:[h.event.key]})).data.events.length,0);
 await h.call({action:'dispatch'},{scheduler:'fixture-only'});assert.equal(h.sends.length,0,'The scheduler does not send the foreground event again');
});
test('snooze stores canonical server content and rejects finished tasks',async()=>{
 const h=await harness();await h.call({action:'foreground',endpoint:h.sub.endpoint,keys:[h.event.key]});
 const fields={action:'snooze',endpoint:h.sub.endpoint,eventKey:h.event.key,title:'Cannot inject this'};
 assert.equal((await h.call(fields)).status,200);assert.equal(h.tables.quest_reminder_snoozes[0].event_payload.title,h.event.title);
 h.state.domains[0].tasks[0].done=true;assert.equal((await h.call(fields)).status,409);
 assert.equal((await h.call({...fields,eventKey:'unknown'})).status,400);
});

const popupId='ab111111-1111-4111-8111-111111111111';
test('popup delivery includes every enabled reminder category without client event keys',async()=>{
 const h=await harness();
 h.sub.preferences={friends:true,study:true,review:true,reviewHour:12};
 h.state.anchors.push({id:'a',name:'Walk',hour:12});
 h.state.domains[0].tasks.push(
  {id:'paused',name:'Pause fixture',day:'2026-10-15',workTimer:{pausedAt:'2026-10-15T11:30:00Z'}},
  {id:'timer',name:'Timer fixture',estimatedMinutes:30,workTimer:{startedAt:'2026-10-15T11:30:00Z'}},
  {id:'pomo',name:'Pomodoro fixture',workTimer:{pomodoro:{phase:'focus',runningSince:'2026-10-15T11:35:00Z',remainingMs:1500000}}}
 );
 h.friendEvents.push({event_id:'friend-task',actor_display_name:'Mira',xp:20,created_at:'2026-10-15T12:00:00Z'});
 const result=await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId});
 assert.equal(result.status,200);
 assert.deepEqual(result.data.events.map(e=>e.kind).sort(),['anchor','competition','pomodoro','study','task','timer']);
 assert.equal(h.sub.popup_active_until,'2026-10-15T12:00:30.000Z');
 await h.call({action:'dispatch'},{scheduler:'fixture-only'});assert.equal(h.sends.length,0);
 assert.equal((await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId})).data.events.length,0);
 // Check-ins deliberately wait until active study ends.
 h.state.domains[0].tasks=h.state.domains[0].tasks.filter(task=>!['timer','pomo'].includes(task.id));
 assert.deepEqual((await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId})).data.events.map(e=>e.kind),['review']);
});

test('closed/frozen popup automatically falls back to native delivery after the lease expires',async()=>{
 const h=await harness();
 h.setNow(Date.parse('2026-10-15T11:59:50Z'));
 assert.equal((await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId})).data.events.length,0);
 h.setNow(Date.parse('2026-10-15T12:00:01Z'));
 await h.call({action:'dispatch'},{scheduler:'fixture-only'});assert.equal(h.sends.length,0);
 h.setNow(Date.parse('2026-10-15T12:00:21Z'));
 await h.call({action:'dispatch'},{scheduler:'fixture-only'});assert.equal(h.sends.length,1);
 await h.call({action:'dispatch'},{scheduler:'fixture-only'});assert.equal(h.sends.length,1,'No duplicate fallback');
});

test('popup release is authenticated, scoped to the device and cannot close a newer window lease',async()=>{
 const h=await harness(), newer='ab222222-2222-4222-8222-222222222222';
 await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId});
 await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId:newer});
 assert.equal((await h.call({action:'foreground-release',endpoint:h.sub.endpoint,popupId:newer},{token:'bad'})).status,401);
 await h.call({action:'foreground-release',endpoint:'someone-else',popupId:newer});assert.equal(h.sub.popup_owner,newer);
 await h.call({action:'foreground-release',endpoint:h.sub.endpoint,popupId});assert.equal(h.sub.popup_owner,newer);
 await h.call({action:'foreground-release',endpoint:h.sub.endpoint,popupId:newer});assert.equal(h.sub.popup_active_until,null);
});

test('popup claims respect category opt-outs and reject an invalid lease token',async()=>{
 const h=await harness();
 assert.equal((await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId:'invalid'})).data.events.length,0);
 assert.equal(h.sub.popup_active_until,undefined);
 h.sub.preferences={tasks:false,anchors:false,timers:false,friends:false,study:false,review:false};
 h.friendEvents.push({event_id:'private',actor_display_name:'Mira',xp:30,created_at:'2026-10-15T12:00:00Z'});
 assert.equal((await h.call({action:'foreground',endpoint:h.sub.endpoint,popup:true,popupId})).data.events.length,0);
});
