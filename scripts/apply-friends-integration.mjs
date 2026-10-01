import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index === -1) {
    if (source.includes(to)) return source;
    throw new Error(`Could not find ${label}`);
  }
  return source.slice(0, index) + to + source.slice(index + from.length);
}

function write(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(path, after);
}

write('src/home-finish.js', source => replaceOnce(
  source,
  '["home", "quests", "today-quests", "anchors", "stats", "more", "goals", "study", "rewards", "competition"]',
  '["home", "quests", "today-quests", "anchors", "stats", "more", "goals", "study", "rewards", "competition", "friends"]',
  'friends route list',
));

write('src/HomeFinish.jsx', source => {
  let next = replaceOnce(
    source,
    'page === "goals" || page === "rewards" || page === "competition" ? "more" : page',
    'page === "goals" || page === "rewards" || page === "competition" || page === "friends" ? "more" : page',
    'bottom nav friend mapping',
  );
  next = replaceOnce(
    next,
    '      <a className="qd-home-page-link gg-more-link cp-more-link" href="#competition"><img src="/competition/competition-icon-v1.svg" alt="" /><span><strong>Competition</strong><small>Compare balanced XP and challenge friends week by week.</small></span><span aria-hidden="true">›</span></a>\n',
    '      <a className="qd-home-page-link gg-more-link cp-more-link" href="#competition"><img src="/competition/competition-icon-v1.svg" alt="" /><span><strong>Competition</strong><small>Compare balanced XP and challenge friends week by week.</small></span><span aria-hidden="true">›</span></a>\n      <a className="qd-home-page-link gg-more-link cp-more-link" href="#friends"><img src="/competition/competition-icon-v1.svg" alt="" /><span><strong>Friends</strong><small>Find Quest users, accept requests, and build your crew.</small></span><span aria-hidden="true">›</span></a>\n',
    'Friends link in More',
  );
  return next;
});

write('src/quest-dashboard.jsx', source => {
  let next = replaceOnce(
    source,
    'import CompetitionPage from "./CompetitionPage.jsx";\n',
    'import CompetitionPage from "./CompetitionPage.jsx";\nimport FriendsPage from "./FriendsPage.jsx";\n',
    'FriendsPage import',
  );
  next = replaceOnce(
    next,
    '  const showCompetitionPage = page === "competition";\n  const showTodayQuestsPage = page === "today-quests";\n',
    '  const showCompetitionPage = page === "competition";\n  const showFriendsPage = page === "friends";\n  const showTodayQuestsPage = page === "today-quests";\n',
    'friends page flag',
  );
  next = replaceOnce(
    next,
    '["quests", "stats", "more", "goals", "study", "rewards", "competition"].includes(page)',
    '["quests", "stats", "more", "goals", "study", "rewards", "competition", "friends"].includes(page)',
    'friends preview subpage',
  );
  next = replaceOnce(
    next,
    '          ) : showCompetitionPage ? (\n            <CompetitionPage progression={progressionState} weekKey={weekKeyStr} todayKey={todayStr}\n              displayName={competitionName} focusMinutes={competitionFocusMinutes} level={level} />\n',
    '          ) : showFriendsPage ? (\n            <FriendsPage user={session.user} />\n          ) : showCompetitionPage ? (\n            <CompetitionPage progression={progressionState} weekKey={weekKeyStr} todayKey={todayStr}\n              displayName={competitionName} focusMinutes={competitionFocusMinutes} level={level} userId={session.user.id} />\n',
    'friends page render and competition user id',
  );
  return next;
});

console.log('Friends integration applied.');
