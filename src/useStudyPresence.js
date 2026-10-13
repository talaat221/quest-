import { useEffect, useRef } from 'react';
import { elapsedTaskMs } from './task-timer.js';
import { studyPresence } from './study-together.js';

export default function useStudyPresence(controller, task, activity) {
  const me = controller.room?.members.find(m => m.userId === controller.userId);
  const latest = useRef(null);
  useEffect(() => { latest.current = { task, activity, shareTask: !!me?.shareTask }; }, [task, activity, me?.shareTask]);
  const roomId = controller.room?.id, command = controller.command;
  const publish = useRef(() => {});
  useEffect(() => { publish.current = () => {
    if (!roomId) return;
    const current = latest.current;
    void command('presence', { roomId, data: studyPresence({
      activity: document.visibilityState === 'hidden' ? 'away' : current.activity,
      elapsedMs: elapsedTaskMs(current.task), taskName: current.task?.name, shareTask: current.shareTask,
    }) }, true).catch(() => {});
  }; }, [roomId, command]);
  useEffect(() => {
    if (!roomId) return;
    publish.current();
    const heartbeat = setInterval(() => { if (document.visibilityState !== 'hidden') publish.current(); }, 20000);
    const wake = () => publish.current();
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
    return () => {
      clearInterval(heartbeat); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake);
      void command('presence', { roomId, data: studyPresence({ activity: 'away', elapsedMs: elapsedTaskMs(latest.current.task) }) }, 'departing').catch(() => {});
    };
  }, [roomId, command]);
  useEffect(() => { publish.current(); }, [task?.id, task?.name, activity, me?.shareTask, task?.workTimer?.startedAt, task?.workTimer?.elapsedMs]);
}

