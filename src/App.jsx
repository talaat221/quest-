import { useEffect, useState } from 'react';
import QuestDashboard from './quest-dashboard';
import './design-preview.css';
import {
  flushQuestSync,
  getQuestSyncSnapshot,
  resolveQuestConflict,
  subscribeQuestSync,
  supabase,
} from './supabaseClient';

function SyncIndicator() {
  const [sync, setSync] = useState(getQuestSyncSnapshot());
  const [showConflict, setShowConflict] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => subscribeQuestSync(setSync), []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setHasSession(!!session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sync.state !== 'conflict') setShowConflict(false);
  }, [sync.state]);

  if (!hasSession) return null;

  const labels = {
    synced: '✓ Synced',
    syncing: '↻ Syncing',
    offline: sync.pending > 0 ? `Offline · ${sync.pending} waiting` : 'Offline · saved here',
    pending: sync.pending > 0 ? `☁ ${sync.pending} waiting` : '☁ Waiting to sync',
    conflict: '⚠ Sync needs attention',
  };

  const tones = {
    synced: { border: 'rgba(126,197,160,.34)', color: '#b7dfc7', bg: 'rgba(35,88,65,.78)' },
    syncing: { border: 'rgba(139,92,246,.45)', color: '#ddd1ff', bg: 'rgba(64,47,116,.88)' },
    offline: { border: 'rgba(203,166,106,.42)', color: '#efd29a', bg: 'rgba(79,61,31,.90)' },
    pending: { border: 'rgba(117,150,214,.42)', color: '#c9d9f6', bg: 'rgba(38,58,94,.90)' },
    conflict: { border: 'rgba(214,111,116,.55)', color: '#ffd1d4', bg: 'rgba(104,43,49,.94)' },
  };

  const tone = tones[sync.state] || tones.synced;

  const handleBadgeClick = () => {
    if (sync.state === 'conflict') {
      setShowConflict(true);
      return;
    }

    if (sync.state === 'pending' || sync.state === 'offline') {
      void flushQuestSync();
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={sync.message}
        title={sync.message}
        onClick={handleBadgeClick}
        style={{
          position: 'fixed',
          zIndex: 200000,
          right: 12,
          bottom: 'calc(88px + env(safe-area-inset-bottom))',
          minHeight: 34,
          padding: '7px 10px',
          borderRadius: 999,
          border: `1px solid ${tone.border}`,
          background: tone.bg,
          color: tone.color,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.01em',
          boxShadow: '0 10px 26px rgba(0,0,0,.30)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          cursor: sync.state === 'synced' || sync.state === 'syncing' ? 'default' : 'pointer',
          opacity: sync.state === 'synced' ? .72 : 1,
        }}
      >
        {labels[sync.state]}
      </button>

      {showConflict && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300000,
            background: 'rgba(3,7,16,.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 'min(100%, 560px)',
              padding: '22px 18px calc(18px + env(safe-area-inset-bottom))',
              background: 'linear-gradient(180deg,#0b1930,#06101d)',
              border: '1px solid rgba(203,166,106,.44)',
              borderBottom: 0,
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -20px 60px rgba(0,0,0,.42)',
              color: '#f2eadc',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#cba66a', fontWeight: 700 }}>
              SYNC NEEDS ATTENTION
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 25, marginTop: 7 }}>
              Two versions of the voyage exist.
            </div>
            <p style={{ color: '#a6b0c7', fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>
              Quest found offline changes on this device and newer cloud changes from another device. Nothing has been deleted or overwritten.
            </p>
            <p style={{ color: '#a6b0c7', fontSize: 12, lineHeight: 1.45, marginTop: 8 }}>
              “Use cloud copy” discards the unsynced changes on this device. “Keep this device” sends this device’s current Quest to the cloud.
            </p>

            <div style={{ display: 'grid', gap: 9, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Use the cloud copy and discard unsynced changes from this device?')) {
                    void resolveQuestConflict('cloud');
                  }
                }}
                style={{
                  minHeight: 48,
                  borderRadius: 11,
                  border: '1px solid rgba(126,145,178,.32)',
                  background: '#0a1729',
                  color: '#dfe5ef',
                  fontWeight: 700,
                }}
              >
                Use cloud copy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Keep this device and replace the cloud copy with it?')) {
                    void resolveQuestConflict('local');
                    setShowConflict(false);
                  }
                }}
                style={{
                  minHeight: 48,
                  borderRadius: 11,
                  border: '1px solid #a88cf1',
                  background: 'linear-gradient(180deg,#7e5bd8,#5b3eaa)',
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                Keep this device
              </button>
              <button
                type="button"
                onClick={() => setShowConflict(false)}
                style={{
                  minHeight: 42,
                  border: 0,
                  background: 'transparent',
                  color: '#9fa9bc',
                }}
              >
                Decide later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Temporary presentation-only switch while the new home screen is built.
// Set to false to reveal the retained dashboard and its controls again.
const DESIGN_PREVIEW = true;

function App() {
  return (
    <div className={`w-full min-h-screen${DESIGN_PREVIEW ? ' qd-design-preview' : ''}`}>
      <QuestDashboard designPreview={DESIGN_PREVIEW} />
      <div className="qd-sync-ui"><SyncIndicator /></div>
    </div>
  )
}

export default App;
