# Quest normalized database — Stage 2

This branch switches Quest's online cloud reads to the normalized Supabase tables through `get_my_quest_state()` while keeping `quest_data` as a safety fallback and write journal.

## What changes

- Online reads request both the normalized state and the legacy `quest_data` row.
- Quest prefers the normalized state when quest IDs, task IDs, anchor IDs, and reward counts pass parity checks.
- If the normalized reader is unavailable or parity checks fail, Quest automatically uses the legacy row.
- Offline reads continue to use the local device cache exactly as before.
- Writes still go through `quest_data`; the database trigger mirrors the same committed state into normalized tables atomically.
- Conflict detection still uses the legacy row's hash while Stage 2 is being tested, so the already-tested cross-device protection remains unchanged.

## Test checklist

1. Open the preview online and confirm existing quests, tasks, anchors, XP, rewards, and settings appear normally.
2. Add/edit/complete a task and confirm the sync badge returns to `Synced`.
3. Refresh/reopen the preview and confirm the change remains.
4. Repeat the existing Airplane Mode offline test.
5. Verify the same change appears on a second device.

No production deletion or destructive cutover happens in this stage. `quest_data` remains available as a rollback source.
