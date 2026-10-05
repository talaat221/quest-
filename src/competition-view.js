export function rankedMembers(members = []) {
  const sorted = members.filter(m => m.status === 'accepted').sort((a,b) => (b.xp || 0)-(a.xp || 0) || String(a.name).localeCompare(String(b.name)));
  let rank = 0;
  return sorted.map((member,index) => {
    if (!index || member.xp !== sorted[index-1].xp) rank = index+1;
    return { ...member, rank };
  });
}
export function roundPhase(round, now = Date.now()) {
  if (round.phase === 'active' && Date.parse(round.endsAt) <= now) return 'finished';
  if (round.phase === 'lobby' && Date.parse(round.createdAt)+14*86400000 <= now) return 'expired';
  return round.phase;
}
export function remainingTime(end, now = Date.now()) {
  const ms = Date.parse(end)-now;
  if (!Number.isFinite(ms) || ms<=0) return 'Round complete';
  const hours = Math.ceil(ms/3600000);
  return hours>=24 ? `${Math.floor(hours/24)}d ${hours%24}h left` : `${hours}h left`;
}
export function activityLabel(event) {
  return event.taskName || (event.source === 'anchor' ? 'A daily anchor' : 'A quest task');
}
export function timeAgo(stamp, now = Date.now()) {
  const minutes = Math.max(0,Math.floor((now-Date.parse(stamp))/60000));
  if (!Number.isFinite(minutes) || minutes<1) return 'just now';
  if (minutes<60) return `${minutes}m ago`;
  if (minutes<1440) return `${Math.floor(minutes/60)}h ago`;
  return `${Math.floor(minutes/1440)}d ago`;
}
