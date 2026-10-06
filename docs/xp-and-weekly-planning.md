# XP and weekly planning

The preview builds on the existing task-award ledger and level curve. The old two-hour reward ceiling is removed. Existing completed rewards are not repriced.

## Rewards

Normal-effort examples:

| Estimated time | XP |
| --- | ---: |
| 30 minutes | 20 |
| 60 minutes | 35 |
| 120 minutes | 50 |
| 180 minutes | 60 |
| 240 minutes | 70 |
| 360 minutes | 82 |
| 480 minutes | 94 |
| 600 minutes | 100 |

Beyond two hours, the additional rate is 10 XP/hour up to four hours, 6 XP/hour up to eight hours, then 3 XP/hour. Final rewards round to integer XP. At two hours and above, high effort adds 15 and low effort subtracts 15. Short tasks keep the familiar effort tiers. Durations are limited to one day; longer projects should be divided into sessions.

Rewards use the planned estimate and selected effort. A running timer does not inflate XP simply by being left running; real recorded time teaches the next estimate. Task `effort`, `effortTier`, and `xpSource` now survive the normalized save/read path.

Quick routines (including demanding tasks under 15 minutes) and newly configured routine anchors share the existing 20-XP-per-quest-day cap. A capped completion still counts as completed. Existing anchors keep their stored reward until edited. Newly added/edited anchors use duration and effort instead of an arbitrary XP input.

Both task and anchor completions feed home level progress. Tapping the home XP frame shows the breakdown, this week's XP, the next-level requirement, and the rules. Task completion reports actual credited XP and a level-up if one occurs. Undo reverses the matching award; deletion does not erase earned level XP. Weekly consistency bonuses and the previous cumulative level curve are retained.

The v4 migration preserves legacy XP and completed task awards. The previous version only included anchor history present at its initial snapshot. Later recorded anchor days are recovered once. History has only day keys, so the original initialization day is conservatively kept in the legacy bucket; it is not credited a second time. No historical task rewards are invented or recomputed.

## Weekly planning

- Tasks can belong to a week while having no day/time. New task forms default to the current quest week and offer a week selector; choosing a date determines its week. Legacy undated tasks enter the current week's pool.
- On Quests, use **I'm done adding — plan my week**, set available hours for each weekday and the work window, then preview and apply. All quest cards start closed.
- The largest flexible tasks are placed first on the least-loaded feasible day, using saved or learned duration estimates. Missing task estimates fall back to 30 minutes; old anchors default to 15 minutes.
- Recurring anchors contribute to daily workload. Timed anchors reserve their exact intervals. Anytime anchors reduce the daily workload allowance without inventing a time. Previously dated tasks are preserved unless the user explicitly opts to rebalance flexible tasks.
- Fixed, completed and currently running work cannot be moved. Existing time collisions are reported. Past days, stopped days, reduced-capacity days, minute-precise starts, day-reset offsets, and overnight busy intervals are respected.
- Capacity defaults to the existing learned estimate (six hours while there is insufficient history), and can be changed down to zero per day. 15% remains free; timed activities have a ten-minute gap.
- Overflow is proposed for the following week's flexible pool. Nothing is moved until the user applies the preview. A heavy-week option bypasses the workload budget, but never forces tasks into overlapping or nonexistent time slots. Tasks that still cannot fit remain flexible with an explicit warning. Long tasks may need splitting; deferral alone is not described as a cure.
- Preview application checks for changed tasks and start times that have already passed. One state update flows through the existing offline/cloud sync adapter.
- Future-week tasks no longer inflate the current weekly reward target.

## Persistence and validation

Migration `20261006000314_effort_xp_and_weekly_planning.sql` adds task effort/source/week fields, anchor effort/source fields, and planning settings. Existing anchor duration storage is used. Both the incremental RPC and legacy full-state mirror retain fields omitted by old clients. Account restart clears the planning settings. Owner checks, sync revision lock, RLS/grants and PT409 conflict handling remain in place.

Validated:

- Production build succeeds (existing bundle-size warning remains).
- Reward tests cover growing long-task XP, actual credited amounts, undo, level rollover, anchor recovery, routine caps, weekly boundaries and no duplicate awards.
- Planning tests cover fixed/anchor conflicts, exact times, balancing, zero-capacity days, past days, reset hours, oversized work, next-week overflow, heavy-week choice, running tasks, stale previews and atomic application.
- Database fixtures verified the actual save/read RPC, new fields, old-client preservation, anchor awards and account reset, then rolled back.
- Browser checks use the real dashboard with isolated account fixtures: collapsed quests → add a 3-hour high-effort task → review/apply → reload → complete 4-hour high-effort task for 85 XP → home level-up → edit/complete a 60-minute anchor for 35 XP → updated home bar. Layout checked at 320, 393 and 430 pixels.

One pre-existing full-suite assertion remains in `goals-timer.test.mjs`: it expects a 2-minute learned prediction, while the existing intelligence module rounds learned predictions to 5 minutes. This change does not modify that rounding behavior. Live Vercel preview pages may require account access; deployment readiness is checked separately from the local browser fixture.
