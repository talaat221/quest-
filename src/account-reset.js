// The server returns this shape after clearing an account. Do not seed demo
// quests or anchors: a restart really begins with an empty journal.
export const isEmptyQuestAccount = (state) => !!state &&
  Array.isArray(state.domains) && state.domains.length === 0 &&
  Array.isArray(state.anchors) && state.anchors.length === 0 &&
  Array.isArray(state.rewards?.daily) && state.rewards.daily.length === 0 &&
  Array.isArray(state.rewards?.weekly) && state.rewards.weekly.length === 0 &&
  !!state.claimed?.daily && Object.keys(state.claimed.daily).length === 0 &&
  !!state.claimed?.weekly && Object.keys(state.claimed.weekly).length === 0 &&
  !!state.voyageAdjustments && Object.keys(state.voyageAdjustments).length === 0 &&
  state.settings?.dayThresholdPct === 70 &&
  state.settings?.weekThresholdPct === 70 &&
  state.settings?.dayResetHour === 0;
