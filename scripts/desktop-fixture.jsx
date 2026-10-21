// Only built by test-desktop.mjs, then removed. Never packaged or deployed.
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useDesktopReminders} from '../src/desktop-notifications.js';
import {startTaskTimer} from '../src/task-timer.js';
import NotificationSettings from '../src/NotificationSettings.jsx';
function Fixture() {
  const [user,setUser]=useState('desktop-test-user'),[state,setState]=useState(()=>JSON.parse(localStorage.getItem('fixture-state')||'null')||{domains:[{id:'q',name:'A small step',tasks:[]}],anchors:[],settings:{}});
  const n=useDesktopReminders({state,userId:user,onStartReminder:event=>{
    const next=structuredClone(state),started=startTaskTimer(next.domains,event.target.domainId,event.target.taskId);
    if(started)setState(next);return started;
  }});
  useEffect(()=>{
    localStorage.setItem('fixture-state',JSON.stringify(state));
    window.fixture={state,notifications:n,setState,setUser};
  },[state,n]);
  return <main><h1>Quest desktop test</h1><NotificationSettings notifications={n}/></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
