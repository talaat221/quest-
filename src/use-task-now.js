import { useEffect, useState } from 'react';

// Intervals repaint; saved timestamps remain the source of truth.
export function useTaskNow(task) {
  const [now, setNow] = useState(Date.now);
  const startedAt = task?.workTimer?.startedAt, runningSince = task?.workTimer?.pomodoro?.runningSince, done = task?.done;
  useEffect(() => {
    if (done || (!Number.isFinite(Date.parse(startedAt)) && !Number.isFinite(Date.parse(runningSince)))) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [done, startedAt, runningSince]);
  return now;
}
