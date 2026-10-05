// Auth callbacks must return synchronously: Supabase holds its session lock
// while notifying listeners. Schedule any database work after that lock exits.
export function observeQuestSession(client, { onSession, onUser }) {
  let alive = true, userId, events = 0, pending;
  const accept = session => {
    if (!alive) return;
    onSession(session);
    const nextId = session?.user?.id || null;
    if (nextId === userId) return;
    userId = nextId;
    clearTimeout(pending);
    if (session?.user) pending = setTimeout(() => {
      if (alive && userId === nextId) onUser(session.user);
    }, 0);
  };
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    events += 1;
    accept(session);
  });
  void client.auth.getSession().then(({ data }) => {
    if (!events) accept(data.session);
  });
  return () => { alive = false; clearTimeout(pending); subscription.unsubscribe(); };
}

export function questGreeting(profile, user) {
  return String(profile?.username || user?.user_metadata?.username ||
    profile?.display_name || user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Traveler').trim();
}
