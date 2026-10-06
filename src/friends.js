import { supabase } from './supabaseClient';
import {
  fallbackFriendUsername,
  friendDisplayName,
  isValidFriendUsername,
  normalizeFriendUsername,
  otherFriendId,
  splitFriendships,
} from './friends-core.js';

function throwIf(error) {
  if (error) throw error;
}

export async function ensureQuestProfile(user) {
  if (!user?.id) return null;
  const { data: existing, error: readError } = await supabase
    .from('quest_profiles')
    .select('user_id, username, display_name')
    .eq('user_id', user.id)
    .maybeSingle();
  throwIf(readError);
  if (existing) return existing;

  const metadataUsername = normalizeFriendUsername(user?.user_metadata?.username || '');
  const profile = {
    user_id: user.id,
    username: isValidFriendUsername(metadataUsername)
      ? metadataUsername
      : fallbackFriendUsername(user.id),
    display_name: friendDisplayName(user),
  };

  let { data, error } = await supabase
    .from('quest_profiles')
    .insert(profile)
    .select('user_id, username, display_name')
    .single();

  // A very old/legacy client may reach this fallback after the requested
  // signup username has already been claimed. Keep the account usable with
  // its deterministic traveler name rather than breaking the Friends page.
  if (error?.code === '23505' && profile.username !== fallbackFriendUsername(user.id)) {
    ({ data, error } = await supabase
      .from('quest_profiles')
      .insert({
        ...profile,
        username: fallbackFriendUsername(user.id),
      })
      .select('user_id, username, display_name')
      .single());
  }

  throwIf(error);
  return data;
}

export async function updateQuestProfile(userId, { username, displayName }) {
  const cleanUsername = normalizeFriendUsername(username);
  const cleanName = String(displayName || '').trim().slice(0, 40);
  if (!isValidFriendUsername(cleanUsername)) {
    throw new Error('Username must be 3–20 characters using letters, numbers, or _.');
  }
  if (!cleanName) throw new Error('Display name cannot be empty.');

  const { data, error } = await supabase
    .from('quest_profiles')
    .update({ username: cleanUsername, display_name: cleanName, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id, username, display_name')
    .single();

  if (error?.code === '23505') throw new Error('That username is already taken.');
  throwIf(error);

  // Keep auth metadata aligned with the Friends profile so account creation,
  // future profile recovery, and the social system all refer to one username.
  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      username: cleanUsername,
      display_name: cleanName,
    },
  });
  if (metadataError) {
    console.warn('Quest profile metadata could not be synchronized:', metadataError);
  }

  window.dispatchEvent(new CustomEvent('quest-profile-changed', { detail: data }));
  return data;
}

export async function searchQuestProfiles(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('search_quest_profiles', { query_text: q });
  throwIf(error);
  return data || [];
}

async function readProfiles(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase
    .from('quest_profiles')
    .select('user_id, username, display_name')
    .in('user_id', unique);
  throwIf(error);
  return new Map((data || []).map(profile => [profile.user_id, profile]));
}

export async function loadFriendHub(userId) {
  if (!userId) return { friends: [], incoming: [], outgoing: [] };
  const { data: rows, error } = await supabase
    .from('quest_friendships')
    .select('id, requester_id, addressee_id, status, created_at, updated_at')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false });
  throwIf(error);

  const groups = splitFriendships(rows || [], userId);
  const ids = (rows || []).map(row => otherFriendId(row, userId)).filter(Boolean);
  const profiles = await readProfiles(ids);
  const attach = row => ({ ...row, profile: profiles.get(otherFriendId(row, userId)) || null });

  return {
    friends: groups.accepted.map(attach),
    incoming: groups.incoming.map(attach),
    outgoing: groups.outgoing.map(attach),
  };
}

export async function sendFriendRequest(userId, addresseeId) {
  if (!userId || !addresseeId || userId === addresseeId) throw new Error('Choose another Quest user.');
  const { data, error } = await supabase
    .from('quest_friendships')
    .insert({ requester_id: userId, addressee_id: addresseeId, status: 'pending' })
    .select('id, requester_id, addressee_id, status, created_at')
    .single();
  if (error?.code === '23505') throw new Error('You already have a request or friendship with this person.');
  throwIf(error);
  return data;
}

export async function respondToFriendRequest(requestId, accept) {
  const { data, error } = await supabase
    .from('quest_friendships')
    .update({ status: accept ? 'accepted' : 'declined', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id, requester_id, addressee_id, status')
    .single();
  throwIf(error);
  return data;
}

export async function removeFriendship(friendshipId) {
  const { error } = await supabase.from('quest_friendships').delete().eq('id', friendshipId);
  throwIf(error);
}

export async function publishCompetitionStats(userId, snapshot) {
  if (!userId || !snapshot?.weekKey || !snapshot?.todayKey) return;
  const payload = {
    user_id: userId,
    week_key: snapshot.weekKey,
    score_xp: Math.max(0, Math.round(Number(snapshot.scoreXP) || 0)),
    task_xp: Math.max(0, Math.round(Number(snapshot.taskXP) || 0)),
    consistency_xp: Math.max(0, Math.round(Number(snapshot.consistencyXP) || 0)),
    eligible_tasks: Math.max(0, Math.round(Number(snapshot.eligibleTasks) || 0)),
    today_key: snapshot.todayKey,
    today_xp: Math.max(0, Math.round(Number(snapshot.todayXP) || 0)),
    today_tasks: Math.max(0, Math.round(Number(snapshot.todayTasks) || 0)),
    focus_minutes: Math.max(0, Math.round(Number(snapshot.focusMinutes) || 0)),
    level: Math.max(1, Math.round(Number(snapshot.level) || 1)),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('quest_competition_stats').upsert(payload, { onConflict: 'user_id,week_key' });
  throwIf(error);
}

export async function loadAcceptedFriendsWithStats(userId, weekKey) {
  const hub = await loadFriendHub(userId);
  const friends = hub.friends;
  const ids = friends.map(friend => otherFriendId(friend, userId)).filter(Boolean);
  let statsMap = new Map();
  if (ids.length && weekKey) {
    const { data, error } = await supabase
      .from('quest_competition_stats')
      .select('user_id, week_key, score_xp, eligible_tasks, today_key, today_xp, today_tasks, focus_minutes, level, updated_at')
      .eq('week_key', weekKey)
      .in('user_id', ids);
    throwIf(error);
    statsMap = new Map((data || []).map(row => [row.user_id, row]));
  }

  return friends.map(friendship => {
    const id = otherFriendId(friendship, userId);
    const profile = friendship.profile || {};
    const stats = statsMap.get(id) || {};
    return {
      id,
      friendshipId: friendship.id,
      displayName: profile.display_name || profile.username || 'Friend',
      username: profile.username || '',
      scoreXP: stats.score_xp ?? null,
      tasks: stats.eligible_tasks ?? null,
      todayXP: stats.today_xp ?? null,
      todayTasks: stats.today_tasks ?? null,
      focusMinutes: stats.focus_minutes ?? null,
      level: stats.level ?? 1,
      updatedAt: stats.updated_at || null,
    };
  });
}
