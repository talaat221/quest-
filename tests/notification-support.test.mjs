import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationSetupMessage, popupCanDisplay, withNotificationDeadline } from '../src/notification-support.js';

test('hidden Quest can display popups only when a supported floating window is open and opted in',()=>{
 const settings={inApp:true,desktopPopups:true};
 assert.equal(popupCanDisplay(settings,false,true),true);
 assert.equal(popupCanDisplay(settings,false,false),false);
 assert.equal(popupCanDisplay({...settings,desktopPopups:false},false,true),false);
 assert.equal(popupCanDisplay({...settings,inApp:false},true,true),false);
 assert.equal(popupCanDisplay({inApp:true,desktopPopups:false},true,false),true,'Phone/desktop in-app banner');
});

test('push registration has a deadline rather than leaving Enable stuck forever',async()=>{
 await assert.rejects(withNotificationDeadline(new Promise(()=>{}),10,'Push timed out'),/Push timed out/);
 assert.equal(await withNotificationDeadline(Promise.resolve('connected'),1000,'timeout'),'connected');
 await assert.rejects(withNotificationDeadline(Promise.reject(new Error('blocked')),1000,'timeout'),/blocked/);
});

test('Brave registration errors explain the separate push transport setting',()=>{
 assert.match(notificationSetupMessage(new Error('Registration failed'), 'push', true),/Use Google services for push messaging/);
 assert.match(notificationSetupMessage(new Error('Timeout'), 'push', false),/push service/);
 assert.match(notificationSetupMessage(new Error('Network'), 'worker'),/notification worker/);
 assert.equal(notificationSetupMessage(new Error('Sign in again'), 'config'),'Sign in again');
});
