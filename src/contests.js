import { supabase } from './supabaseClient';

export const MAX_LEAGUE_PEOPLE = 10;
export const MAX_INDIVIDUAL_FRIENDS = 10;
export const friendLimit = mode => mode === 'league' ? MAX_LEAGUE_PEOPLE - 1 : MAX_INDIVIDUAL_FRIENDS;

async function call(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const message = String(error.message || '');
    if (message.includes('QUEST_RATE_LIMIT:social_invite_')) {
      throw new Error('You’ve sent a lot of competition invitations. Wait a little before inviting more people.');
    }
    throw new Error(message || 'Competition could not connect. Try again.');
  }
  return data;
}
export async function loadContests() {
  const data = await call('get_my_quest_contests');
  return { contests: Array.isArray(data?.contests) ? data.contests : [], serverTime: data?.serverTime };
}
export function createContests(form) {
  const ids = [...new Set(form.friendIds || [])];
  if (!ids.length || ids.length > friendLimit(form.mode)) throw new Error('Check the number of selected friends.');
  return call('create_quest_contests', { p_name: form.name.trim(), p_mode: form.mode, p_duration: form.duration,
    p_friend_ids: ids, p_prize: form.prize.trim(), p_include_anchors: form.includeAnchors, p_share_task_names: form.shareTaskNames });
}
export const respondToContest = (id, accept, shareTaskNames = false) => call('respond_quest_contest', { p_contest_id: id, p_accept: accept, p_share_task_names: shareTaskNames });
export const startContest = id => call('start_quest_contest', { p_contest_id: id });
export const leaveContest = id => call('leave_quest_contest', { p_contest_id: id });
export const inviteContestMembers = (id, friendIds) => call('invite_quest_contest_members', { p_contest_id: id, p_friend_ids: [...new Set(friendIds)] });
export const setContestPrivacy = (id, shareTaskNames) => call('set_quest_contest_privacy', { p_contest_id: id, p_share_task_names: shareTaskNames });
