# Quest normalized writes — Stage 3 test

This branch changes cloud persistence so the app no longer sends the whole Quest state into `quest_data` as its primary write path.

## What changed

- The local/offline cache still stores a complete local state so Quest works without internet.
- When syncing online, the client compares the last cloud baseline with the new local state and creates entity-level changes.
- Changed quests, tasks, anchors, anchor history, rewards, claims, and voyage adjustments are committed into their normalized tables.
- A revision number protects a sync transaction from overwriting a newer cloud version.
- `quest_data` is now only maintained by the database as a compatibility backup after a successful normalized commit.
- The old mirror trigger ignores that backup write so it does not rebuild the normalized tables.

## iPhone smoke test

1. Open the Stage 3 Vercel preview online and wait for `✓ Synced`.
2. Add a task named `NORMALIZED WRITE TEST`.
3. Change its XP, estimated duration, day, and time.
4. Refresh. Confirm every value survives.
5. Complete the task and enter an actual duration. Refresh again.
6. Add or edit an anchor and complete it. Refresh again.
7. Edit one reward and refresh.
8. Enter Reduced Sail or Safe Harbor, then refresh.
9. Turn Airplane Mode on, make another task/anchor change, close and reopen Quest, then reconnect and verify it syncs.
10. Open Quest on the laptop and verify the changes appear.

## Conflict safety test

1. Let both devices reach `✓ Synced`.
2. Put the phone offline and change a task.
3. Change something on the laptop while it stays online.
4. Reconnect the phone.
5. Quest should show `⚠ Sync needs attention` rather than silently overwriting the newer cloud revision.

Do not merge Stage 3 until the normal online flow, offline flow, and conflict flow all pass.
