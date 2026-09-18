# Today's Quests

Home now places a 510 × 470 panel in the left 510 / 795 of the reference layout, below Daily Anchors with a 20 / 795 vertical gap. The right-hand area remains available for the later Farm Status and Streak design. At a 390 px phone width with the existing gutters, the panel is about 233.5 × 215.2 px.

## Assets and live content

- `public/today-quests/panel-v1.webp`: generated navy frame, gold clipboard, title and View All lettering; 1306 × 1204 with transparency. Two SVG viewports crop transparent padding and set the header to 65 / 470 of the card height.
- `public/today-quests/row-v1.svg`: reusable vector row surface, matching the existing code-native pixel icon system.
- Checkboxes, task icons, names, progress and XP are live UI. The list shows five rows at the reference size and scrolls when there are more; no records are capped or discarded. View All opens an expanded list with Back to Home.
- Daily anchors and quest tasks share their existing saved state and completion handlers. Completing an anchor in either home section updates both. Quest tasks retain the actual-time completion dialog and timing history; this dialog is available outside the hidden legacy-overlay wrapper.
- The list uses the current quest date, not the hidden clock's selected date. Tasks scheduled today and tasks completed during the current quest day are included. Completion dates use local time and the configured daily reset. Paused and completed anchors remain represented consistently with Daily Anchors.
- No fabricated card counts, new database schema, or second store of completion/XP state.

## Generation

Mode: built-in image generation, using the user's full-screen reference and the approved Daily Anchors panel as style references. The generated image was encoded as WebP for delivery; layout cropping is performed by SVG in the component.

Final prompt:

```text
Use case: ui-mockup / game UI production asset.
Asset type: a single transparent-background pixel-art panel for an existing iPhone productivity game called Quest.
Input image 1 is the user's complete visual reference. Recreate ONLY the lower-left "Today's Quests" card (below Today's Anchors), using its exact pixel-game visual language. Image 2 is the APPROVED Today's Anchors artwork already installed on the website: match its blue beveled frame, navy inner texture, crisp pixel art, gold icon, and off-white lettering.
Create one isolated panel, front-facing and flat, with a width-to-height ratio of 510:470. Thin stepped/cut pixel corners, a layered dark navy and muted steel-blue outline, a very dark navy-blue body with subtle mottled texture. Small transparent margin around all four edges, genuine alpha transparency beyond the silhouette. Keep border thickness around 8 logical pixels at a 510px card width, no excessive dark outer shadow.
Header occupies the top 65 of 470 logical pixels. Golden clipboard quest icon at x30,y20, exact text "Today's Quests" at x80,y30, small muted blue text "View All" at x372,y33 and a right-facing pixel chevron at x478,y34. Title 24 logical pixels, View All 16 logical pixels. Thin horizontal blue separator at y65, inset 20px left and right.
The entire remaining body below the separator MUST be EMPTY navy texture, with NO task rows, NO checkboxes, NO other icons, NO task names, NO XP text, NO numbers, NO badges. Those will be live code added over this artwork.
Preserve the comfortable compact proportions of the reference card. Exact spelling: "Today's Quests" and "View All". Transparent outside, fully opaque navy inside. No surrounding scene, no plants, no mock phone, no perspective, no extra panels. Pixel edges stay sharp. Output about 1020x940 pixels.
```
