import { useCallback, useEffect, useRef, useState } from 'react';
import { farmCommand } from './farm-api.js';
import { flushQuestSync, getQuestSyncSnapshot, subscribeQuestSync, subscribeQuestAccountReset } from './supabaseClient';

export default function useFarm(userId, enabled, revision) {
  const [farm,setFarm]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const request=useRef(0), activeUser=useRef(userId), inFlight=useRef(null);
  activeUser.current=userId;
  const refresh=useCallback(async()=>{
    if(!enabled||!userId)return;
    if(inFlight.current)return inFlight.current;
    const id=++request.current;
    const job=(async()=>{
      try {
        await flushQuestSync();
        const sync=getQuestSyncSnapshot();
        if(sync.state!=='synced'||sync.pending)throw new Error('Your tasks are still saving. The farm will catch up when synced.');
        const data=await farmCommand();
        if(id===request.current&&activeUser.current===userId){setFarm(data);setError('');}
        return data;
      }catch(e){if(id===request.current)setError(e.message);return null;}
      finally{if(id===request.current)inFlight.current=null;}
    })();
    inFlight.current=job;return job;
  },[enabled,userId]);
  useEffect(()=>{request.current++;inFlight.current=null;setFarm(null);setError('');setBusy(false);},[userId]);
  useEffect(()=>{
    if(!enabled||!userId)return;
    const timer=setTimeout(refresh,600);
    return ()=>clearTimeout(timer);
  },[refresh,revision,userId,enabled]);
  useEffect(()=>{
    if(!enabled||!userId)return;
    let timer;
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,600);};
    // A read-only flush also emits “synced”; only real sync transitions should
    // trigger another read, otherwise the farm would poll every 600 ms.
    let previousSync='';
    const stop=subscribeQuestSync(s=>{
      const key=`${s.state}:${s.pending}:${s.lastSyncedAt||''}`;
      if(key!==previousSync&&s.state==='synced'&&!s.pending)schedule();
      previousSync=key;
    });
    const reset=subscribeQuestAccountReset(e=>{if(e.userId===userId){request.current++;inFlight.current=null;setFarm(null);schedule();}});
    const interval=setInterval(schedule,60000);
    window.addEventListener('focus',schedule);
    return ()=>{clearTimeout(timer);clearInterval(interval);stop();reset();window.removeEventListener('focus',schedule);};
  },[enabled,userId,refresh]);
  const action=useCallback(async(type,args)=>{
    setBusy(true);setError('');const account=userId;
    try {
      await flushQuestSync();
      const sync=getQuestSyncSnapshot();
      if(sync.state!=='synced'||sync.pending)throw new Error('Let your tasks finish saving before changing the farm.');
      const data=await farmCommand(type,args);
      if(activeUser.current===account){request.current++;inFlight.current=null;setFarm(data);}
      return data;
    }catch(e){if(activeUser.current===account)setError(e.message);throw e;}
    finally{if(activeUser.current===account)setBusy(false);}
  },[userId]);
  return {farm,error,busy,refresh,rename:name=>action('rename',{p_name:name}),openChest:()=>action('open',{p_chest:(farm?.openedChests||0)+1})};
}
