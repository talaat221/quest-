# Floating study companion, badges and reminders

Open **Focus → Float timer** after choosing a task. The same button is available
on the running timer strip elsewhere in Quest. Pause/resume controls operate the
original task timer. Closing the companion does not finish, pause or leave a room.
Use **Back to Quest** to return. Collapse hides the scene; expand restores it.

The companion reuses the existing cottage and character atlas. Shared rooms show
joined members only, with their chosen avatars and privacy-safe status/timers.
Hidden task names are never copied into the companion. It works for solo study.

## Platform behavior

| Feature | Desktop Chrome / Edge | iPhone / unsupported browsers |
| --- | --- | --- |
| Floating companion | Real Document Picture-in-Picture when available; user can move/resize its OS window | Draggable, collapsible panel inside Quest; cannot float above other apps |
| Task count | Installed PWA can show the numeric taskbar badge; a normal tab also gets a title count | Uses Badging API if supported; no promise of a numeric Android launcher badge |
| Countdown reminder | Cozy in-app banner or opt-in always-on-top reminder window, 8/10/12 seconds, dismiss, relevant task link and 5-minute snooze | Same banner while Quest is visible |
| Background reminder | Native browser/OS notification through existing Web Push | iPhone Home Screen installation and notification permission required; OS controls placement, sounds and actions |

Reference: [Document PiP](https://developer.chrome.com/docs/web-platform/document-picture-in-picture),
[Badging API](https://developer.chrome.com/docs/capabilities/web-apis/badging-api),
[WebKit Home Screen Web Push and badges](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
A wrapped Capacitor iOS build does not gain native notification or floating-window
capabilities from this web update; those require native plugins and device testing.

## Presence and timing

A global presence hook survives navigation. Visibility changes trigger a heartbeat
without changing studying into away. Heartbeats use a three-minute lease (showing
reconnection after 75 seconds) to tolerate background batching. A genuinely stale
connection becomes away; prolonged OS suspension is not treated as connected.
All work and Pomodoro time is derived from persisted timestamps, never counted
interval ticks. Reopening, pausing and resuming therefore use the same saved timer.
The companion does not create another task, XP award or completion path.

## Badges and safe refresh

The page uses the same today's-task records as Home. Daily Anchors are optional
under **You → Settings → Notifications**. Zero clears the badge, as do sign-out,
offline status and unresolved sync. Counts refresh after local edits, completion,
reopening, rescheduling and the configured Quest day reset. Clean copies check for
other-device changes every 30 seconds while visible, on focus, and on reconnect.
A pending local edit, changed revision or sync lock prevents cloud refresh from
overwriting the local state.

While the app is fully closed, a push can refresh the badge from the server's
current saved state. An arbitrary remote change or midnight does not reliably wake
a closed PWA; its badge may remain until the next push or app launch. The web
platform provides no guaranteed background midnight alarm or silent iOS push.

## Reminder delivery

Under **You → Settings → Notifications**, **Show popup reminders** controls all
custom countdown banners on this device. **Floating popups over other apps** is
an additional desktop opt-in. Click **Open floating popups** once per Quest launch;
the browser requires a real user gesture. Keep Quest open in the background.
The window can stay above other applications and shares the existing study
companion, because a document can only own one Document PiP window. These display
preferences save locally and work even if push registration fails.

All enabled categories use the same window: tasks, anchors, Pomodoro, planned task
timers, paused-study nudges, daily reviews, and friend completions. Multiple
reminders queue; the next receives its full countdown when displayed. Notification
links focus the original Quest page. Turning popups off clears the banners and
closes an alerts-only window without stopping a task or study timer.

On iPhone, the custom design is available inside Quest. Outside Quest, notification
appearance is controlled by iOS; a website cannot overlay a custom window on other
apps. Closing Quest also closes its desktop floating window.

Desktop setup distinguishes permission from push registration, shows the current
setup stage, and bounds provider registration to 20 seconds. In Brave, enable
**Use Google services for push messaging** in Settings → Privacy and security;
restart Brave and enable the device again. Browser display and server push tests
are separate. Registrations are specific to browser, device, and Quest origin.
See [Brave's privacy settings](https://support.brave.com/hc/en-us/articles/360017989132-How-do-I-change-my-Privacy-Settings).

Settings include lead time (0/5/10 minutes), banner duration, a soft optional chime,
daily/repeating check-ins and an optional nudge after pausing study. Banner timers
pause on hover or keyboard focus. Reduced motion removes entry/exit animation.
Snoozes recheck the task before displaying: completion, deletion, rescheduling or
resuming a timer invalidates the obsolete reminder.

Foreground and scheduled push share the existing atomic per-device delivery
ledger. A visible Quest page or opted-in floating window renews a 30-second display
lease every 10 seconds, fetching canonical events for every enabled category.
Closing/hiding releases it; a crash or frozen browser expires automatically so
the scheduler resumes native delivery. Lease release is scoped to its window ID
so an old window cannot clear a newer lease. A native push is always displayed
when received (required by iOS). With no push registration, in-app reminders and snoozes use local storage.
They require Quest open; they are not a substitute for background push.

Native actions depend on OS support. The snooze action opens Quest and schedules
the authenticated five-minute snooze; it does not pretend a background page timer
will run. Native notifications cannot use our custom top-banner position or
animated countdown. Focus/Do Not Disturb, permissions, connectivity and OS delivery
policy still apply. Changes must sync to cancel a previously scheduled server alert.

## Backend and verification

The `20261015151528_study_companion_reminders.sql` migration extends presence leases and adds the
server-only snooze table and canonical delivery payload. No existing task/XP rows
are rewritten. Client roles have no access to snooze records; the Edge Function
validates the signed-in user and owns device filtering. The notification function
keeps its custom JWT and scheduler-secret authentication. Its version 8 health
check passed with payload encryption and database access, without sending a real
message. The new table's [RLS-without-policy informational notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
is intentional: only the service role has grants.

The `20261015163552_notification_popup_delivery.sql` migration adds nullable lease fields to existing device rows.
Only the Edge Function can update these fields; existing native delivery and older
clients remain compatible. It does not alter tasks, XP, accounts, or opt-ins.

Verified locally on 15 October 2026:

- Production build; 167 automated tests, including actual-duration XP regressions,
  all reminder categories, lease expiry/release/ownership and Brave setup timeouts.
- 15 browser checks for companion, countdown, keyboard hold and mobile fit.
- 39 browser checks for shared-room operations, hidden-tab heartbeat, privacy,
  navigation, leave/new room and responsive layouts.
- 15 browser checks including real Chromium Document PiP pause/resume, a five-to-four
  badge transition, other-device refresh, offline clearing, due reminders, snooze
  timing and completion cancellation. Badge calls use an OS API stub.
- Live database transaction verifies presence expiry, privacy, server-only snoozes,
  duplicate delivery rejection and unsubscribe cleanup using rolled-back fixtures.
- 23 browser checks for actual Document PiP while the main document is hidden,
  all seven categories, a four-reminder queue, task links, persisted opt-outs and
  phone layout. API calls are mocked; browser PiP is real.
- 10 browser checks for allowed-but-unregistered permission, a hung Brave push
  connection, actionable error, successful retry, separate browser display test
  and popup settings remaining usable without push. Provider APIs are mocked.

Still requires physical-device acceptance: Windows taskbar badge visibility and
outside-app window behavior; an installed iPhone Home Screen app receiving a timed
push with the screen locked. Use the preview's own notification settings to opt in,
then **Send test**. Preview and production origins need separate registration.

Run `node --experimental-vm-modules --test tests/*.test.mjs` and `npm run build`.
Database checks: `tests/study-companion-database.sql` (always rolls back).
