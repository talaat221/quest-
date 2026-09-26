# Study Room artwork

The room is assembled in `src/StudyRoom.jsx` with placement and motion in
`src/study-room.css`. The live timer and controls are HTML, never painted into
the artwork. The scene keeps the room's 1672 × 941 landscape coordinate space.

All five original assets were made with the built-in image-generation tool,
then encoded as WebP while preserving transparency. Original generated PNGs
were retained in the working session. No external stock assets are required.

| Asset | Layer | Use |
| --- | --- | --- |
| `room-v1.webp` | Background | Cottage, moonlit window, shelves, plants, lanterns |
| `boy-idle-v1.webp` | Character | Seated, relaxed pose when no task is running |
| `boy-studying-v1.webp` | Character | Focused pose while the shared timer runs |
| `desk-v1.webp` | Foreground | Desk, notebook, mug, books |
| `steam-v1.webp` | Above mug | Slow drifting steam |

The writing hand and resting hand are separate DOM layers sampling the study
sprite through explicit clip polygons. This keeps their pixels aligned with
the body and notebook while letting only the writing hand move. The remaining
motion is gentle breathing, steam, small window fireflies and lantern warmth.
All movement can be disabled. Reduced-motion preferences are respected.

## Prompt set

1. **Room:** a wide 16:9 front-facing, slightly elevated view into a cozy pixel
   farm cottage at night. Moonlit lake and forest through a left wooden window;
   bookshelves, trailing plants and a lantern on the right. Walnut floorboards,
   navy/teal shadows and amber highlights. Empty dark teal central wall for a
   live timer and clear central floor for separate furniture and character.
   No people, central desk, chair, text or interface. Crisp detailed 16-bit art.
2. **Desk:** use the room as lighting, perspective and pixel-style reference.
   Isolated walnut desk seen from the front and slightly above, with cream
   open notebook at its center, teal mug at left and olive/rust books at right.
   True transparent background; no person, chair, scene, lettering or steam.
3. **Idle boy:** match the room and desk. A friendly tan-skinned young adult
   with short dark brown hair, muted sage sweater and dark trousers, seated
   upright in a low walnut chair facing the viewer. Relaxed expression, hands
   in his lap; head through upper thighs. Transparent square sprite, no desk,
   book or background, warm rim lighting and blue shadows.
4. **Studying boy:** edit the exact idle boy, keeping identity, hair, clothes,
   chair, placement, lighting and transparency. Slight forward head tilt,
   downward gaze, relaxed concentration. Forearms forward at desk level;
   viewer-left hand holds a golden pencil and other hand rests flat. No desk
   or paper in this layer. Preserve the original canvas alignment.
5. **Steam:** three slender cream and blue-grey translucent steam wisps with
   stepped pixel edges and sparse broken clusters near the top. Transparent
   background with no mug, fire, sparks, glow rectangle, scene or lettering.

Task and timing data use the existing Quest task model and persistence path.
There is no separate study-session database or parallel timer.
