import { supabase } from './supabaseClient';

function throwIf(error) {
  if (error) throw error;
}

export async function loadWeeklyChallenge(weekKey) {
  if (!weekKey) return { current: null, invites: [] };
  const { data, error } = await supabase.rpc('get_my_quest_weekly_challenge', {
    p_week_key: weekKey,
  });
  throwIf(error);
  return {
    current: data?.current || null,
    invites: Array.isArray(data?.invites) ? data.invites : [],
  };
}

export async function createWeeklyChallenge(weekKey, friendIds) {
  const invited = [...new Set((friendIds || []).filter(Boolean))].slice(0, 3);
  if (!weekKey) throw new Error('This week could not be identified.');
  if (!invited.length) throw new Error('Choose at least one friend.');

  const { data, error } = await supabase.rpc('create_quest_weekly_challenge', {
    p_week_key: weekKey,
    p_invited_user_ids: invited,
  });
  throwIf(error);
  return data;
}

export async function respondWeeklyChallenge(challengeId, accept) {
  const { error } = await supabase.rpc('respond_quest_weekly_challenge', {
    p_challenge_id: challengeId,
    p_accept: !!accept,
  });
  throwIf(error);
}

export async function cancelWeeklyChallenge(challengeId) {
  const { error } = await supabase.rpc('cancel_quest_weekly_challenge', {
    p_challenge_id: challengeId,
  });
  throwIf(error);
}

export function challengeMemberToFriend(member) {
  if (!member?.userId) return null;
  return {
    id: member.userId,
    displayName: member.displayName || member.username || 'Friend',
    username: member.username || '',
    scoreXP: member.scoreXP ?? null,
    tasks: member.eligibleTasks ?? null,
    todayXP: member.todayXP ?? null,
    todayTasks: member.todayTasks ?? null,
    focusMinutes: member.focusMinutes ?? null,
    level: member.level ?? 1,
    status: member.status || 'accepted',
    isCreator: !!member.isCreator,
  };
}
