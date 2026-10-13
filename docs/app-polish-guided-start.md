# Room freedom and the guided start

This change merges `feature/completed-archive-split` into the study-character version. The source branch's task lifecycle, signup/profile, recovery, account deletion, privacy/terms and social-safety work is preserved. Its old More-page controls now live in Settings. The developer rollover lab remains in source but is not exposed as an application route. Main is not changed by this preview.

## Rooms

Focus has visible Leave room and New room controls. Replacing a room is one authenticated transaction. A stale browser tab cannot replace a newer room. A departing host passes hosting to the earliest remaining joined member. Pending invitations from the old host close; the new host invites their own friends. The last person leaving closes the room. Personal task timers are separate and keep their time. Ending the room for everyone remains a separate confirmed host action.

Migration `20261013154852_study_room_freedom.sql` is applied to the existing project. It preserves the six-seat limit, one joined room per account, privacy checks, blocks and owner-only realtime signals. The new private helper has no direct authenticated or anonymous execute grant. Room network requests now time out instead of indefinitely blocking the action queue.

## Tasks and onboarding

Open quests show unfinished tasks first, this week's completions below, and past completions under Archive. Nothing is deleted by sorting. Quests remain collapsed on a normal visit; only the guided first task opens its own quest.

New empty accounts see their actual Home behind a small character coach. The guide uses the real quest/task/anchor editors and moves on only after the corresponding data exists. It can be minimized, skipped, resumed after reload, or replayed under You → Settings → Meet your Quest companion. No example tasks or fake XP are inserted. The coach minimizes while typing; the anchor dialog includes its own short hint. Progress is stored in the account's existing settings snapshot.

## Desktop

At 1100px and taller than 650px, the navigation becomes a left rail. Home uses a scene/day split; Anchors uses clock/routines columns. Decorative headers, Stats cards and the study workspace have bounded widths. Short landscape phone study rooms retain their immersive layout. Local pixel fonts and existing artwork are reused.

## Notifications

The running scheduler and provider ledger were checked. Recent delivery records were accepted by push providers; that is not evidence that an OS displayed them. The deployed Edge Function health test passes database access and actual Web Push encryption without contacting a device.

The service worker no longer fails installation when a single optional decorative asset cannot be cached. Reopening or foregrounding the app checks its worker and saved device subscription. Existing opt-ins can be re-registered; a signing-key mismatch can be repaired by tapping Enable. The foreground reminder engine recovers events due in the two minutes before app load, with existing per-user deduplication. Permission remains opt-in per device and origin.

You → Settings → Notifications offers Check connection, Send test (server → push service), and Test browser display (worker → OS). It reports the last provider result for only the signed-in user's device. The test copy does not claim a delivery receipt. Real phone/laptop display must still be checked on those devices, including browser/OS permission and Focus/Do Not Disturb.

The notification Edge Function is deployed as version 6. JWT verification at the gateway remains disabled because user actions validate the Supabase JWT internally and scheduler actions validate a separate Vault secret, as before. No credentials or subscription endpoints are logged.

## Verification

- Production Vite build succeeds; pre-existing large-bundle warning remains.
- All 144 Node tests pass, including task ordering, reset-hour history, notification timing, worker installation despite an unavailable art asset, XP, timer and reset regressions. An old prediction test was corrected to the existing 5-minute planning minimum; exact recorded duration and timer implementation are unchanged.
- Authenticated database test transaction passes guest leave, host handoff, new room, stale-tab rejection, privacy, blocks, capacity, expiry and RLS, then rolls back all fixture users.
- Browser checks cover the real first quest/task/anchor flow, resume/replay/skip, room controls and avatar privacy, notification permission and both test buttons, and narrow phone through 1920px desktop widths.
- Supabase advisor review found no new study-table/function issue. Existing deliberately server-only tables and legacy security-definer functions are outside this change.
