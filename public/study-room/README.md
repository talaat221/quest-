# Study Room artwork — cottage v2

The live room uses an original Stardew Valley-inspired, elevated three-quarter
pixel-game interior. The background, desk and character poses are independent
images. The live timer and controls use the existing shared Quest task timer.

## Current assets

All artwork was made with the built-in image-generation tool. The four v2 PNGs
were encoded as WebP with transparency preserved. No stock artwork is required.
The v1 files remain available as a fallback.

| File (relative to this folder) | Layer |
| --- | --- |
| `room-v2.webp` | 1672 × 941 opaque cottage, rug, shelves, window and cat |
| `desk-v2.webp` | 1536 × 1024 transparent desk, notebook, mug and books |
| `boy-idle-v2.webp` | 1254 × 1254 transparent seated boy and chair |
| `boy-studying-v2.webp` | Matching transparent studying pose, same canvas |
| `steam-v1.webp` | Reused transparent steam layer |

The hand layers sample the studying sprite using clip polygons. Breathing,
pencil movement, steam, fireflies and lantern light are separate animations.
The boy's pose follows the existing running/paused task. Reduced-motion
preferences and the Gentle motion control remain available.

## Layout

Every scene layer shares one 1672:941 coordinate plane, with no viewport-specific
sprite offsets. Landscape phones automatically fit the complete room beside
its controls, hide the main bottom dock, and keep the Quests back link.
The scene is contained, never stretched or cropped. Safe-area insets leave
room for notches and the home indicator. Portrait rotation restores navigation.
Room view remains available on portrait phones and larger screens.

The new-task form uses a native dialog so keyboard entry cannot squeeze the
scene. Closing the room does not stop or reset a running task.

## Generation prompts

The exact four v2 prompts are in [v2-prompts.md](./v2-prompts.md).
All used the built-in tool, not CLI/API fallback.

## Optional Pomodoro timer

Choose Pomodoro beside Timer after selecting a task. Defaults are 25 minutes of
focus, a 5-minute short break and a 15-minute long break after four focus rounds.
The menu button opens editable lengths. Each phase waits for an explicit start;
finishing a focus round does not complete the task. Pause works in either phase.
The boy studies only during active focus and rests during breaks.

The configuration, phase, remaining budget, round count and start timestamp live
inside the task's existing `workTimer.pomodoro` JSON object. Existing Supabase
sync preserves this object; no schema change or extra browser-only store is used.
Task time is capped at the focus deadline even if no JavaScript runs at that
moment. Breaks and waiting between phases contribute zero task time. Finishing
uses the same completion, XP and duration-learning logic. Switching to the normal
timer or changing lengths retains all previously recorded work.
