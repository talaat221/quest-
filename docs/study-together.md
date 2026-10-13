# Characters and shared study rooms

Open **You → Your character** or **Focus → Your character** to choose one of
six painted looks. Preview resting and studying poses before saving. The
character is saved against the authenticated account, separate from task data.

In **Focus → Study together**, open a room and invite accepted Quest friends.
The host plus five guests fit in one room. Invitations reserve seats; friends
must accept before appearing in the room. Incoming invitations appear on the
Focus navigation badge and in the study dialog, including while another room
is active. Guests can leave; the host can cancel invitations, remove a guest,
or end the room. Rooms expire after 24 hours.

Each participant keeps their own existing task timer and Pomodoro controls.
Starting work changes that character to a writing pose; pauses and breaks
restore the resting pose. Leaving a shared room never pauses or finishes a
task. The same timer continues to work when the social connection is offline.
When a participant switches away from Focus or hides the app, they appear away.
Abrupt disconnects become away after 65 seconds rather than extrapolating time
forever. On returning, saved task timestamps recover the actual elapsed time.

**Share my task name** starts off for every new room membership. Only study
status and elapsed time are shared by default. Private task names are omitted
from network payloads. Hiding a task clears its stored title; the server also
rejects names sent by delayed heartbeats while sharing is off. Shared titles
are shown in the participant cards and room dialog, including in landscape.

## Backend

- `quest_study_avatars`: account look selection, 0–5.
- `quest_study_rooms`: host, expiry and end state.
- `quest_study_members`: invitations, stable seats, presence and explicit privacy.
- `quest_study_updates`: owner-readable revision signal only.
- `quest_study`: authenticated RPC with narrow, validated commands. All actual
  mutations pass through a private function with a fixed search path and
  explicit `auth.uid()` checks. Tables have RLS; clients cannot read or mutate
  raw room/member rows. No service key is shipped in the browser.

Room row locks serialize seat reservations. A per-account transaction lock and
partial unique index prevent joining two rooms concurrently. Room admission
checks accepted friendship and blocks. Creating a block separates shared rooms.
Only revision signals enter the Realtime publication, so task titles are never
broadcast or retained in change events. Clients refetch an authorized snapshot
and poll every 15 seconds as a connection fallback. Presence updates every 20
seconds while the study screen is visible.

Apply `20261013002321_study_together_avatars.sql` before deploying to another
Supabase project. The filename matches the version actually applied to the
connected Quest project. Its initial scaffold was created with the Supabase CLI.
The change is additive; existing timer, XP, task and competition tables are not
rewritten. The existing account-deletion cascades remove avatars and rooms.

## Artwork and verification

The original transparent character atlas and its frame notes live in
`public/study-together/`. The cottage, desk, characters and writing hands remain
separate layers. Six stable seats reuse the room's 1672:941 coordinate plane.
The room stays proportional in portrait, landscape and immersive mode.
Animations respect reduced-motion preferences and stop when the app is hidden.

Run `node --test tests/study-together.test.mjs tests/study-room.test.mjs
tests/pomodoro.test.mjs tests/app-navigation.test.mjs` and `npm run build`.
`tests/study-together-database.sql` verifies the real authenticated RPC, RLS,
invitations, capacity, privacy races, blocking, leave/end and expiry in a rolled
back transaction with generated test accounts; it sends no real invitations.

Browser verification uses a mocked social transport against the actual React
app: character selection, profile rendering, invitation acceptance, both poses,
privacy payloads, pause/leave time preservation, error recovery and invite badge.
Layouts were checked at 320, 393, 430, 852-landscape and 1366 pixels. A real
two-phone invitation is still the final device-level acceptance check.
