# App navigation and settings

This change builds on `9287d1f` on `feature/living-farm-quest-ai`. It preserves the existing pixel artwork and activity implementations while giving them consistent places in the app.

| Bottom destination | Pages |
| --- | --- |
| Home | Dashboard and today's tasks |
| Plan | Quests, anchors, goals |
| Focus | Study room and task timers |
| Garden | Farm, rewards, stats |
| Community | Leagues, friends, visits to friends' farms |

The top avatar opens the profile and the gear opens Settings. Settings has Account, Notifications, Daily rhythm, Sync & storage, and Your data. The old `#more` URL remains a profile alias. Existing page URLs and nested planner links still work.

The former More actions retain their existing data paths: notification preferences, day reset, sync/conflict resolution, sign out and account restart. Sign out first checks that pending progress has synced. Restart retains the explicit confirmation dialog. No database or authentication configuration changes are needed.

## Home spacing

The quest card's `cqw` top padding was attached to the container itself, so it used the outer viewport instead of the narrow card width. An inner content wrapper now measures against the card. Quest AI and today's task rows keep the artwork header spacing without a large empty gap. The expanded task page keeps its natural height.

## Validation

- Production Vite build passes; the existing large bundle warning remains.
- 30 focused Node tests cover route coverage, old URL compatibility, home behavior, task advice and account reset.
- Browser flows at 320px, 393px and 1024px cover every navigation group, profile, Settings, preference changes surviving reload, sync, and cancelling account restart.
- Browser geometry checks verify compact spacing around Quest AI; no horizontal page overflow or JavaScript errors occurred.
- Browser flows use an authenticated local fixture with simulated persistence. They do not send real notifications, reset a real account, or claim to verify live Supabase delivery.

Publish this branch as a separate preview. Do not replace a newer unshared local checkout or promote production as part of this change.
