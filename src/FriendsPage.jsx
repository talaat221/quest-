import { useEffect, useMemo, useState } from 'react';
import {
  ensureQuestProfile,
  loadFriendHub,
  removeFriendship,
  respondToFriendRequest,
  searchQuestProfiles,
  sendFriendRequest,
  updateQuestProfile,
} from './friends.js';
import { normalizeFriendUsername } from './friends-core.js';
import './friends.css';

function ProfileBadge({ profile }) {
  const label = profile?.display_name || profile?.username || '?';
  const initials = String(label).trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
  return <span className="fr-avatar" aria-hidden="true">{initials}</span>;
}

function FriendIdentity({ profile }) {
  return (
    <div className="fr-identity">
      <ProfileBadge profile={profile} />
      <span><strong>{profile?.display_name || 'Traveler'}</strong><small>@{profile?.username || 'unknown'}</small></span>
    </div>
  );
}

export default function FriendsPage({ user }) {
  const userId = user?.id;
  const [profile, setProfile] = useState(null);
  const [hub, setHub] = useState({ friends: [], incoming: [], outgoing: [] });
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const relatedIds = useMemo(() => new Set([
    ...hub.friends.map(item => item.profile?.user_id),
    ...hub.incoming.map(item => item.profile?.user_id),
    ...hub.outgoing.map(item => item.profile?.user_id),
  ].filter(Boolean)), [hub]);

  const reload = async () => {
    if (!userId) return;
    const nextHub = await loadFriendHub(userId);
    setHub(nextHub);
  };

  useEffect(() => {
    let cancelled = false;
    if (!userId) return undefined;
    void (async () => {
      setBusy(true); setError('');
      try {
        const nextProfile = await ensureQuestProfile(user);
        if (cancelled) return;
        setProfile(nextProfile);
        setUsername(nextProfile?.username || '');
        setDisplayName(nextProfile?.display_name || '');
        setHub(await loadFriendHub(userId));
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Friends could not be loaded.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchQuestProfiles(trimmed)
        .then(data => { if (!cancelled) setResults(data || []); })
        .catch(err => { if (!cancelled) setError(err?.message || 'Search failed.'); });
    }, 260);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const run = async (action, success = '') => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await action();
      await reload();
      if (success) setMessage(success);
    } catch (err) {
      setError(err?.message || 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = () => run(async () => {
    const saved = await updateQuestProfile(userId, { username, displayName });
    setProfile(saved);
    setUsername(saved.username);
    setDisplayName(saved.display_name);
  }, 'Profile saved.');

  const add = target => run(async () => {
    await sendFriendRequest(userId, target.user_id);
    setQuery(''); setResults([]);
  }, `Friend request sent to @${target.username}.`);

  return (
    <section className="fr-page" aria-labelledby="fr-title">
      <header className="fr-hero">
        <a href="#competition">‹ Competition</a>
        <p>SAIL WITH FRIENDS</p>
        <h1 id="fr-title">Friends</h1>
        <span>Add people you know, then bring them into weekly challenges.</span>
      </header>

      {error && <p className="fr-status is-error" role="alert">{error}</p>}
      {message && <p className="fr-status" role="status">{message}</p>}

      <section className="fr-panel" aria-labelledby="fr-profile-title">
        <div className="fr-panel-head"><h2 id="fr-profile-title">Your Quest profile</h2><span>Friends find you by username.</span></div>
        <div className="fr-profile-row">
          <ProfileBadge profile={profile} />
          <label><span>Display name</span><input value={displayName} maxLength={40} onChange={e => setDisplayName(e.target.value)} /></label>
        </div>
        <label className="fr-username"><span>Username</span><div><b>@</b><input value={username} maxLength={20} autoCapitalize="none" autoCorrect="off" onChange={e => setUsername(normalizeFriendUsername(e.target.value))} /></div></label>
        <button type="button" className="fr-primary" disabled={busy} onClick={saveProfile}>{busy ? 'Saving…' : 'Save profile'}</button>
      </section>

      <section className="fr-panel" aria-labelledby="fr-find-title">
        <div className="fr-panel-head"><h2 id="fr-find-title">Find a friend</h2><span>Search their username or display name.</span></div>
        <input className="fr-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search @username" autoCapitalize="none" autoCorrect="off" />
        <div className="fr-list">
          {results.map(result => {
            const alreadyRelated = relatedIds.has(result.user_id);
            return (
              <div className="fr-row" key={result.user_id}>
                <FriendIdentity profile={result} />
                <button type="button" disabled={busy || alreadyRelated} onClick={() => add(result)}>{alreadyRelated ? 'Added' : 'Add'}</button>
              </div>
            );
          })}
          {query.trim().length >= 2 && !results.length && <p className="fr-empty">No Quest users found yet.</p>}
        </div>
      </section>

      {!!hub.incoming.length && (
        <section className="fr-panel" aria-labelledby="fr-requests-title">
          <div className="fr-panel-head"><h2 id="fr-requests-title">Friend requests</h2><span>{hub.incoming.length} waiting</span></div>
          <div className="fr-list">
            {hub.incoming.map(request => (
              <div className="fr-row" key={request.id}>
                <FriendIdentity profile={request.profile} />
                <div className="fr-row-actions">
                  <button type="button" className="fr-accept" disabled={busy} onClick={() => run(() => respondToFriendRequest(request.id, true), 'Friend added.')}>Accept</button>
                  <button type="button" disabled={busy} onClick={() => run(() => respondToFriendRequest(request.id, false))}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="fr-panel" aria-labelledby="fr-friends-title">
        <div className="fr-panel-head"><h2 id="fr-friends-title">Your friends</h2><span>{hub.friends.length} connected</span></div>
        <div className="fr-list">
          {hub.friends.map(friend => (
            <div className="fr-row" key={friend.id}>
              <FriendIdentity profile={friend.profile} />
              <div className="fr-row-actions">
                <a className="fr-compete" href="#competition">Compete</a>
                <button type="button" disabled={busy} onClick={() => run(() => removeFriendship(friend.id), 'Friend removed.')}>Remove</button>
              </div>
            </div>
          ))}
          {!hub.friends.length && <p className="fr-empty">No friends yet. Search above and send your first request.</p>}
        </div>
      </section>

      {!!hub.outgoing.length && (
        <section className="fr-panel" aria-labelledby="fr-sent-title">
          <div className="fr-panel-head"><h2 id="fr-sent-title">Sent requests</h2><span>Waiting for them to accept.</span></div>
          <div className="fr-list">
            {hub.outgoing.map(request => (
              <div className="fr-row" key={request.id}>
                <FriendIdentity profile={request.profile} />
                <button type="button" disabled={busy} onClick={() => run(() => removeFriendship(request.id), 'Request cancelled.')}>Cancel</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
