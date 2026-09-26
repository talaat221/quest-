# Quest reminders

Enable under **More → Notifications** on each browser/device. iPhone users must
first add Quest to the Home Screen, launch that icon, then tap Enable and Allow.
No permission dialog appears automatically. “Send test” exercises the push path;
it is limited to once per minute per device.

## Events

- Daily anchors at their scheduled time on active weekdays, unless completed or
  paused by Safe Harbor. Protected/selected anchors still notify.
- Quest tasks at their date and time, unless completed, already being worked on,
  or paused. Fixed/protected tasks remain available during Stop Day.
- Pomodoro focus endings and short/long break endings. Pausing, switching tasks,
  completing, or changing timer settings invalidates old deadlines.
- A regular work timer reaching its estimate (accumulated work is included).
  This reminder does not automatically stop or complete the task.
- Optional daily check-in at a chosen hour when work remains. Off by default.

The same pure engine in `supabase/functions/_shared/reminders.js` runs in the
browser and on the server. Dates respect the device's IANA timezone, DST, and
Quest's daily reset hour. Repeated DST hours notify once; nonexistent spring
hours are skipped. The server uses the most recently synced account data.

## Background delivery

Supabase Cron wakes `quest-notifications` every 15 seconds when at least one
active device is subscribed. The Edge Function loads authoritative normalized
state, derives due events, atomically claims a delivery, encrypts it with Web
Push/VAPID, and sends it to the device's push provider. This works without an
open Quest page. No background page timers are used.

Late arrivals are limited: events more than two minutes old are not newly sent,
and provider TTLs are two minutes for scheduled work / five for timer endings.
Delivery depends on network connectivity and OS notification/Focus settings;
this is a reminder system, not an exact native alarm. In-app banners update at
the deadline while Quest is visible. Offline changes must sync before they can
cancel or reschedule a server reminder.

Subscriptions are origin-specific. A new Vercel preview URL or switching to the
production domain requires enabling that installation again. Use one stable
URL for day-to-day testing. Logging out unsubscribes the browser and removes its
server registration. Expired provider endpoints are deleted on 404/410. Device
registrations unused for 30 days expire; delivery records expire after seven.

## Security and deployment

Migration: `20260926184734_scheduled_notifications.sql`.
Function: `supabase/functions/quest-notifications/index.ts`.

- User endpoints validate the Supabase JWT with `auth.getUser()` and scope all
  device queries to that verified user. No client-supplied user ID is trusted.
- The scheduler uses a separate random secret stored in Vault. The signing key
  pair is generated once inside the function and saved to Vault atomically.
- `verify_jwt=false` is intentional: custom auth is mandatory for every action,
  including scheduler and health requests. No public push-sending endpoint.
- Secret/snapshot/claim RPCs are executable only by `service_role`. The privileged
  Vault helper lives in the private schema with a fixed search path.
- Device rows use RLS with owner-only reads. Writes and the delivery ledger are
  server-only; the ledger intentionally has no client RLS policy or grants.
- Push endpoints are restricted to known HTTPS push providers to prevent SSRF.
  Notification links stay on the installation's own origin.
- No JWTs, endpoints, signing keys, subscription keys, or task text are logged.
- Existing sync/auth behavior is retained. Pre-existing database-advisor warnings
  on the sync functions and auth password policy are outside this feature.
  See https://supabase.com/docs/guides/database/database-linter and
  https://supabase.com/docs/guides/auth/password-security.

Apply the migration, deploy the function with the provided config, then deploy
the frontend. Built-in Supabase server environment variables supply backend
credentials. Never add the service key or VAPID private key to Vite variables.
For a different Supabase project, change the scheduler URL in the migration.

## Verification

Run `node --experimental-vm-modules --test tests/*.test.mjs` and `npm run build`.
Tests cover timezone/day reset/DST, suppression, paused/resumed timers, both
Pomodoro phases, optional check-ins, worker display, and safe click navigation.
Browser fixtures verify permission gestures, deny/enable/disable, preferences,
mobile layout, in-app alerts, deduplication, and reloads without real-user edits.
The deployed health endpoint checks storage and payload encryption without
sending to a device. An actual iPhone delivery still requires the owner to
install the preview, grant permission, and press Send test.
