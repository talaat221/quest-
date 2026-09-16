# Quest Offline-First Test Plan

Use this only on the `feature/offline-first` preview until the feature is approved.

## Test A — Seed the local cache
1. Open Quest online on the iPhone.
2. Wait until the sync badge says `✓ Synced`.
3. Close and reopen the installed PWA once.

## Test B — Work completely offline
1. Turn on Airplane Mode.
2. Open Quest from the Home Screen icon.
3. Confirm your existing quests, tasks, anchors, XP and rewards still appear.
4. Add a new task called `OFFLINE TEST`.
5. Edit its date/time or XP.
6. Complete one daily anchor.
7. Complete the test task and enter an actual duration.
8. Confirm the sync badge says Offline and shows waiting changes.
9. Close Quest completely and reopen it while still in Airplane Mode.
10. Confirm all offline changes are still there.

## Test C — Reconnect and sync
1. Turn Airplane Mode off.
2. Return to Quest.
3. The badge should change through waiting/syncing to `✓ Synced`.
4. Open Quest on the laptop and confirm the offline-created task/completions appear there too.

## Test D — Basic cross-device conflict safety
1. Open Quest on iPhone and laptop while both are online. Wait for `✓ Synced`.
2. Put the iPhone in Airplane Mode.
3. On iPhone, add a task called `IPHONE OFFLINE CHANGE`.
4. On the online laptop, add a different task called `LAPTOP CLOUD CHANGE` and wait for it to save.
5. Reconnect the iPhone.
6. Quest should NOT silently erase either side. The iPhone should show `Sync needs attention`.
7. Open the sync dialog and choose which full copy to keep. For this early architecture, Quest deliberately asks instead of guessing when both devices edited the same JSON document.

## Expected behavior
- Local work survives app closes and restarts.
- Offline work never depends on Supabase being reachable.
- Reconnection sync is automatic when the server has not changed elsewhere.
- If another device changed the cloud while this device was offline, Quest stops before overwriting either copy and asks the user which copy to keep.
