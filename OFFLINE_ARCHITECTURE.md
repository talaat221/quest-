# Quest Offline-First Architecture

## What this branch changes

Quest still stores its canonical account data in the existing Supabase `quest_data` row, but the app now keeps a device-local mirror of that row in `localStorage`.

The local mirror is the immediate write target. This means task, anchor, reward, XP, voyage and timing changes can be made while Supabase is unreachable.

## Normal online flow

1. Quest loads the server row.
2. The row is mirrored locally together with its server `updated_at` and a hash of the server data.
3. React state changes are saved to the local mirror first.
4. Quest compares the current server row with the server version that the local mirror was based on.
5. If the server has not changed elsewhere, the local snapshot is uploaded and marked synced.

## Offline flow

1. Quest loads the last local mirror.
2. Changes write to the local mirror immediately.
3. The sync badge shows that changes are waiting.
4. When the browser fires the `online` event, Quest automatically attempts to sync.

## Conflict safety

The current backend is one JSON document per user. Because of that, silently merging two independently edited devices is unsafe.

If another device changed the cloud row after the offline device's last known server version, Quest does not overwrite either side. It stores both copies and shows `Sync needs attention`.

The user can then intentionally choose:

- **Use cloud copy** — discard this device's unsynced copy and reload the newer cloud version.
- **Keep this device** — explicitly replace the cloud version with the current device copy.

This conservative behavior is temporary until the later database-normalization phase introduces task/anchor-level rows that can be merged independently.

## UI states

- `✓ Synced`
- `↻ Syncing`
- `Offline · N waiting`
- `☁ N waiting`
- `⚠ Sync needs attention`

## Storage key

Local records use a per-user key beginning with:

`quest-offline-v1:`

The local copy includes sync metadata, but the React app's Quest state remains unchanged.
