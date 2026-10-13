export const NAV_GROUPS = [
  { id: 'home', label: 'Home', route: 'home', pages: ['home', 'today-quests'], tabs: [] },
  { id: 'plan', label: 'Plan', route: 'quests', pages: ['quests', 'anchors', 'goals'], tabs: [['quests', 'Quests'], ['anchors', 'Anchors'], ['goals', 'Goals']] },
  { id: 'focus', label: 'Focus', route: 'study', pages: ['study'], tabs: [] },
  { id: 'garden', label: 'Garden', route: 'farm', pages: ['farm', 'rewards', 'stats'], tabs: [['farm', 'My farm'], ['rewards', 'Rewards'], ['stats', 'Stats']] },
  { id: 'you', icon: 'profile', label: 'You', route: 'profile', pages: ['profile', 'settings', 'competition', 'friends'], tabs: [['profile', 'Profile'], ['friends', 'Friends'], ['competition', 'Leagues']] },
];
export function navigationGroup(page, visitingFarm = false) {
  if (page === 'farm' && visitingFarm) return NAV_GROUPS.find(group => group.id === 'you');
  return NAV_GROUPS.find(group => group.pages.includes(page));
}
export const SETTINGS_SECTIONS = {
  account: ['Account', 'Your profile, email and sign out', 'profile'],
  notifications: ['Notifications', 'Tasks, timers and friends', 'bell'],
  routine: ['Daily rhythm', 'Day reset and weekly planning', 'clock'],
  sync: ['Sync & storage', 'Saved progress across your devices', 'sync'],
  data: ['Your data', 'Restart your progress', 'data'],
};
export function settingsSection(hash = '') {
  const section = hash.split('/')[1];
  return Object.hasOwn(SETTINGS_SECTIONS, section) ? section : '';
}
export const profileInitial = name => Array.from(String(name || 'Traveler').trim())[0]?.toLocaleUpperCase() || 'Q';
