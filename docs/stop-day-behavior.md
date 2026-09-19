# Stop Day in the illustrated preview

The illustrated button opens the retained `VoyageAdjustmentModal`, outside the hidden legacy overlays. Safe Harbor and pausing other anchors are the defaults for this entry point. The original Reduced Sail path remains available.

Before confirming, the user chooses a reason, an optional note, an optional protected task or anchor, and which other scheduled anchors to keep. The form shows the existing rescheduling plan. Cancel and Escape leave the saved day unchanged.

## Confirming a stopped day

- Reuses `applyVoyageAdjustment`, `buildVoyageAdjustmentPlan`, and `applyVoyageMovesToState`.
- Fixed and protected tasks keep their dates and times. Other unfinished flexible work moves to remaining active days in the week, or to the backlog if no day remains. Nothing is deleted or marked completed automatically.
- A protected anchor is included in the active anchor set even if the other anchors are paused. Other anchor choices preserve all/some/none behavior.
- Paused, unfinished anchors cannot be completed from either home card or the anchor editor. Their history does not turn into extra work tomorrow. Existing completions can still be undone.
- Earned XP and completed work remain. Daily treasure is paused by the existing Safe Harbor rules.
- The home artwork, navigation and ordinary tasks become grayscale. Fixed/protected tasks and explicitly retained anchors keep their color. The same exceptions apply in the separate task and anchor editors. Important work is placed first in the compact quest card.
- Garden motion pauses while Safe Harbor is active.

## Saving and resuming

Adjustment changes are staged immediately through the existing local-first Supabase adapter; routine edits retain the existing 500ms autosave delay. No schema, authentication or sync conflict policy changes are needed. The pause notice links to More when sync is pending, offline or conflicting, without claiming a cloud save succeeded.

Resume Day reuses `restoreNormalVoyage`. Completed work and manual changes to a moved task's date or time remain intact. Automatically moved, still-unfinished tasks return to their original date and time. The stored day adjustment is removed and normal colors return.

The adjustment is keyed by the local quest date. It survives reloads and remains active after midnight until the user's configured daily reset, then the next day opens normally.

## Validation

- Production build and targeted lint.
- Existing anchor, daily quest and streak unit checks, plus `tests/day-pause.test.mjs`.
- Isolated dashboard interaction checks with a mock save adapter: cancel/Escape, protected task and protected anchor, all/some/none anchor choices, immediate persistence, flexible/fixed task handling, per-element grayscale and unfiltered important-task ancestors, completion/XP/time logging, reload, resume confirmation, preservation of manual scheduling edits, Reduced Sail, the 04:00 reset boundary, and end-of-week backlog.
- No real user records were changed during validation. Live preview rendering requires the user's Vercel session.
