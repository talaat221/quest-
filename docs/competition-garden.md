# Competition garden

Built on `feature/quest-redesign-canvas` at `153834fc6bc6e4fc1c27704c80d7a6e03ff5473d` (October 1). No personal XP logic, task timing, or workload calculations were replaced.

## Latest code review

Since the earlier September 27 version the app gained XP progression v3 (5/10/20/35/50 XP tiers, effort adjustment, routine daily cap, consistency bonuses), learned timing patterns that survive renames correctly, a learned workload forecast and home status, friend profiles/requests, weekly challenges, and completion alerts. The previous competition UI only offered weekly group challenges, allowed 20 members, and exposed no notification opt-out. Its art was mostly SVG shells.

## New behavior

- A league has at most 10 people including its host. Individual mode creates separate two-person rounds with up to 10 accepted friends; each person has at most 10 open individual rounds. Opponents cannot inspect other individual rounds.
- Create a one-week or calendar-month round, optional agreed winner's treat, and one shared rule for counting anchors. Invitees see these rules before accepting. Rules lock when invitations are sent.
- Invitations wait in a lobby. Only the host can start, with at least two accepted people; other invitations can be answered later. Lobbies expire after 14 days. Declined invitations never score.
- Scores begin at zero. Saved task-award XP counts only when completed during the round, after joining. Optional anchors use XP recorded on completion. Personal level/XP, legacy XP, and weekly consistency bonuses are unchanged; bonuses do not add points to new rounds.
- New completion events are generated inside the same database transaction as the task/anchor save. Undo removes live points; redo restores the same entry and notification identity. Finished rounds freeze their scores. Equal XP gives a shared rank and victory, without rewarding splitting tasks for a tiebreak.
- Each participant chooses sharing for their own task names, default private. Server RPCs redact titles unless their owner opted in for that specific competition. Raw entry tables have RLS, no browser grants, and no public read policies. Private helper functions cannot be called by authenticated or anonymous clients.
- Leaving revokes task-name sharing. The host can leave; a league transfers to its earliest remaining accepted member. Duels and empty leagues close. Earlier weekly challenges remain available in a collapsed section without migration or deletion.
- Notifications → Friends' task completions controls both in-app and per-device background alerts, default off. Lock-screen alerts are generic even when names are shared in the feed. A completion shared across new rounds generates one alert per recipient/device. iPhone delivery still follows the existing Web Push installation and permission flow.
- The page refreshes while visible every 10 seconds and on focus. It displays sync errors instead of pretending invitations were saved.

## Artwork

`public/competition-v3/tournament-garden-v1.webp`: generated with the built-in image-generation skill, using the existing anchors harbor art as a palette/style reference. Prompt: panoramic moonlit village tournament garden; midnight navy mountains/lake; warm lanterns, bunting, golden trophy on a mossy pedestal and a cream cat on the right; quiet dark space on the left for live text; detailed crisp 16-bit cozy farm pixel art; no baked text or controls. The original generated PNG was converted to WebP for delivery. Existing painted blue/bronze panel images supply nine-slice frames; CSS handles layout, accessible controls and live typography.

## Validation

`tests/contest-rounds.sql` creates isolated synthetic accounts and rolls the complete transaction back. It exercises access, invitation acceptance, start permission, player caps, duration, per-round title consent, XP/anchor capture, undo/redo, notification deduplication, individual isolation, leaving and end boundaries. It does not send messages or pushes.

`tests/competition-view.test.mjs` covers ties, expiry, private feed labels and preference normalization. Existing competition, friends, reminder scheduling and service-worker tests remain in use.

Existing baseline issue: `tests/goals-timer.test.mjs` expects a 2-minute learned estimate, while the latest unchanged task-intelligence code rounds to 5 minutes. That test already fails on the base commit; this redesign does not change that behavior.

Mobile browser checks passed at 320, 393, 430 and 1024 CSS pixels with the existing dashboard styles present. Checked header bounds, artwork load, privacy changes, nine-friend league selection, ten individual invitations, monthly/anchor/prize payloads, and disabling Start until an opponent accepts. `npm run build` succeeds with the existing large-chunk warning. The 20 targeted competition/friend/reminder tests pass.

## October 5 follow-up: live membership and sync

- Fixed the async `onAuthStateChange` listener: database work now runs after the auth callback returns, and token refreshes no longer reload/overwrite the active dashboard. The signed-in Quest profile supplies the home username, including profile edits during the session.
- Live diagnostics found no post-start task data or push subscriptions for either participant. The scheduler was returning HTTP 200. A separate repeated `QUEST_SYNC_CONFLICT`/40001 stream was also present. The application conflict now returns HTTP 409 (`PT409`) so the gateway does not treat it as a retryable database serialization error. Conflicts remain user-resolved; no device or cloud copy is silently overwritten.
- The competition page displays sync status, links to conflict resolution, and refreshes its score after successful saves. Global pending/conflict status is no longer hidden by the design-preview stylesheet.
- Accepted league members can invite their own accepted friends at any time before the round ends. Pending invites reserve one of 10 places. Invitees need to be friends with their inviter, not necessarily the host. Only completions after joining the active round qualify.
- Completion counts include zero-XP capped routine tasks without increasing their XP. The existing immutable event identity prevents duplicate XP/alerts on redo. Active rounds reconcile qualifying saved awards; no extra personal XP is added.
- Device setup now shows connection failures and supports retry. Previously opted-in, still-valid browser subscriptions can repair an expired server registration. Friend alerts remain opt-in. A persisted event cursor catches alerts after a reload without repeat banners.
- MagicPath project `457986645459890176`, component `457986811516559360`, built successfully using the real competition component with isolated demo data. The deployed page uses the same artwork-backed layout and progress tiles.

Verification: `tests/auth-session.test.mjs`, the existing account-reset/competition/reminder/worker tests, and a production build. `tests/competition-live.sql` verifies the real save RPC through score/count/feed/push-event RPCs, non-host live invitations, membership limits, leaving/host transfer, private names and the HTTP conflict SQLSTATE. Both SQL suites roll back all fixtures and send no messages. Browser checks cover 320/393/430/1024px layouts, active invitations and leaving, privacy, sync conflict visibility, notification errors/reconnect/enable/preferences/test action, in-app events and deduplication. Actual lock-screen delivery still requires a user's permission and device test.
