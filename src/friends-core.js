export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeFriendUsername(value = '') {
  return String(value)
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export function isValidFriendUsername(value = '') {
  return USERNAME_RE.test(normalizeFriendUsername(value));
}

export function fallbackFriendUsername(userId = '') {
  const safe = String(userId).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10);
  return `traveler_${safe || 'quest'}`.slice(0, 20);
}

export function friendDisplayName(user = {}) {
  const metadata = user.user_metadata || {};
  const candidate = metadata.display_name || metadata.full_name || metadata.name || '';
  if (String(candidate).trim()) return String(candidate).trim().slice(0, 40);
  const emailName = String(user.email || '').split('@')[0].trim();
  return (emailName || 'Traveler').slice(0, 40);
}

export function splitFriendships(rows = [], userId = '') {
  const incoming = [];
  const outgoing = [];
  const accepted = [];

  for (const row of rows || []) {
    if (!row) continue;
    if (row.status === 'accepted') {
      accepted.push(row);
    } else if (row.status === 'pending' && row.addressee_id === userId) {
      incoming.push(row);
    } else if (row.status === 'pending' && row.requester_id === userId) {
      outgoing.push(row);
    }
  }

  return { incoming, outgoing, accepted };
}

export function otherFriendId(friendship, userId) {
  if (!friendship) return null;
  return friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id;
}
