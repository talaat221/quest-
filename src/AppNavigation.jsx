import { NAV_GROUPS, navigationGroup, profileInitial } from './app-navigation.js';
import { FarmBadge } from './FarmPage.jsx';
import './app-navigation.css';

export function AppIcon({kind}) {
  const paths = {
    home: 'M2 11L12 3L22 11M5 9V21H19V9M10 21V14H14V21',
    plan: 'M8 5H4V22H20V5H16M8 3H16V7H8ZM8 12H16M8 17H14',
    focus: 'M9 2H15M12 2V5M18 5L20 7M12 10V15H16M4 8H7V5H17V8H20V19H17V22H7V19H4Z',
    garden: 'M12 22V11M12 14H8L3 9V4H7L12 9M12 11H17L21 7V2H17L12 7M5 22H19',
    community: 'M8 3H12V9H8ZM16 6H20V12H16ZM2 20V15L5 12H13L16 15V22H2ZM19 15H21L23 17V22H19',
    profile: 'M9 2H15V4H17V10H15V12H9V10H7V4H9ZM3 22V18L7 14H17L21 18V22Z',
    settings: 'M9 2H15V5H18V8H22V15H18V18H15V22H9V18H6V15H2V8H6V5H9ZM9 9H15V15H9Z',
    bell: 'M9 2H15V5H18V9H20V17H22V20H2V17H4V9H6V5H9ZM10 23H14',
    clock: 'M7 2H17V4H21V8H23V16H21V20H17V22H7V20H3V16H1V8H3V4H7ZM12 6V13H17',
    sync: 'M4 9V5H8M4 5L8 2H17L21 6V10M20 15V19H16M20 19L16 22H7L3 18V14',
    data: 'M3 3H21V8H3ZM5 8V22H19V8M9 12H15',
    stats: 'M3 13H7V22H3ZM10 3H14V22H10ZM17 8H21V22H17Z',
    rewards: 'M2 8H22V13H2ZM4 13V22H20V13M12 8V22M12 8H5V2H9L12 8L15 2H19V8Z',
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path d={paths[kind] || paths.plan} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter"/></svg>;
}

export function SectionNavigation({page, visitingFarm = false}) {
  const group = navigationGroup(page, visitingFarm);
  if (!group?.tabs.length || page === 'settings') return null;
  return <div className="qa-shell-header">
    <nav className="qa-section-tabs" aria-label={`${group.label} pages`}>{group.tabs.map(([route,label])=><a key={route} href={`#${route}`} aria-current={page===route&&!visitingFarm?'page':undefined}>{label}</a>)}</nav>
  </div>;
}

export function NavigationDock({page, visitingFarm = false}) {
  const group = navigationGroup(page, visitingFarm);
  const activeIndex = NAV_GROUPS.findIndex(tab => tab.id === group?.id);
  return <div className="qd-bottom-dock qa-dock"><nav className="qd-bottom-navigation" aria-label="Main navigation" style={{'--qa-tab-index': Math.max(0, activeIndex), '--qa-tab-count': NAV_GROUPS.length}}>
    <svg className="qd-home-art" viewBox="10 263 1963 262" preserveAspectRatio="none" aria-hidden="true" focusable="false"><image href="/home-finish/navigation-v1.webp" width="1983" height="793"/></svg>
    <span className="qa-dock-selector-track" aria-hidden="true"><span className="qa-dock-selector" data-visible={activeIndex >= 0}/></span>
    {NAV_GROUPS.map(tab=><a key={tab.id} href={`#${tab.route}`} aria-current={tab.id===group?.id?'page':undefined} className={tab.id===group?.id?'is-active':''}><span className="qa-dock-icon"><AppIcon kind={tab.icon || tab.id}/></span><span className="qa-dock-label">{tab.label}</span></a>)}
  </nav></div>;
}

export function NavigationRow({href, icon, title, detail, badge}) {
  return <a href={href} className="qa-row"><span className="qa-row-icon"><AppIcon kind={icon}/></span><span className="qa-row-copy"><strong>{title}</strong>{detail&&<small>{detail}</small>}</span>{badge&&<span className="qa-row-badge">{badge}</span>}<span className="qa-chevron" aria-hidden="true">›</span></a>;
}

export function ProfilePage({name, username, farm, level, xp, streak, readyRewards}) {
  return <div className="qa-profile qa-page">
    <header className="qa-profile-hero"><div className="qa-profile-landscape"/><span className="qa-profile-avatar" aria-hidden="true">{profileInitial(name)}</span><h1>{name}</h1>{username&&<p>@{username}</p>}<FarmBadge farm={farm}/><span className="qa-profile-level">LEVEL {level} · GROWING AT YOUR OWN PACE</span></header>
    <dl className="qa-profile-stats"><div><dt>Total XP</dt><dd>{Number(xp||0).toLocaleString()}</dd></div><div><dt>Day streak</dt><dd>{streak}</dd></div><div><dt>Plants</dt><dd>{farm?.plants?.length || 0}</dd></div></dl>
    <section className="qa-list-group qa-profile-account" aria-label="Your account"><h2>Make it yours</h2><NavigationRow href="#settings" icon="settings" title="Settings" detail="Account, notifications & daily rhythm"/></section>
    <section className="qa-list-group" aria-label="Your progress"><h2>Your journey</h2><NavigationRow href="#stats" icon="stats" title="Progress & stats" detail="See how your small steps add up"/><NavigationRow href="#farm" icon="garden" title={farm?.name || 'My farm'} detail="Your growing collection"/><NavigationRow href="#rewards" icon="rewards" title="Rewards" detail="The treats you’re working toward" badge={readyRewards ? `${readyRewards} ready` : null}/></section>
  </div>;
}
