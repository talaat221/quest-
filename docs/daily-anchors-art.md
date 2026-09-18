# Daily Anchors artwork

The home panel uses generated raster artwork for the frame, navy texture, gold anchor, heading and View All lettering. Actual task names, times, icons and status indicators remain React elements.

- Built-in image generation tool used with the user's supplied design as the reference.
- Web asset: `public/daily-anchors/panel-v1.webp` (2089 × 753, optimized WebP with transparency).
- Original generated PNG retained in the generating conversation.
- The component crops the transparent outer margins with nested SVG image viewports. These put the header in the first 65 units of the 795 × 287 reference card; the rest is the live timeline.
- At a 390 px phone width, existing 13 px page gutters give a 364 × 131.4 px panel. The panel's top sits 2 px below the garden section.
- The artwork contains no task data or completion state. All anchors share the same panel width, so adding or removing one automatically resizes the columns. Above six anchors, icons and text scale down to fit.
- Tap an anchor to toggle today's completion using the existing XP and persistence flow. Dots stay unfilled before the scheduled local time, become orange when due, and turn green on completion. Untimed anchors stay unfilled until completed. Timing respects the configured daily reset.
- View All opens the retained anchors manager; the rest of the old home interface stays hidden.
- No Supabase schema or stored data changes.

## Generation prompt

Use case: background-extraction.
Asset type: production-ready pixel-art UI panel background for an iPhone website.
Input image 1 is the user's exact visual reference. Reproduce ONLY the wide navy "Today's Anchors" card directly below the XP bar. In the 853x1844 reference it occupies approximately x=29..824 and y=697..984. Extract/rebuild that single card as a clean standalone artwork. No other part of the screenshot.
Output canvas 1600x576 pixels, landscape ratio 25:9. The panel must fill the canvas, with just its pixel-stepped corner cutouts genuinely transparent; no exterior margin, no white or checkerboard backdrop.
Preserve the reference's thin, stepped blue-gray double border and darkest outer edge, the dark navy subtly textured interior, and the fine horizontal header separator approximately 22% down the card. Match the quiet colors and restrained pixel shading exactly, no extra flourishes.
Keep the gold pixel-art anchor icon at the left of the header, and reproduce the white pixel title exactly "Today's Anchors". At the right keep the smaller pale blue "View All" label and its right chevron. Header occupies the upper 23% of the panel; align elements as in the reference. No other text.
REMOVE all six times, task illustrations, task names, circles, checkmarks, timeline dots, horizontal timeline, and vertical dividers from the body. In their place continue the same uninterrupted navy texture. The large lower 77% must be entirely blank and uncluttered so working website text and task icons can be placed over it later.
Style: authentic restrained 16-bit pixel art, crisp pixel-stepped shapes, subtle blue highlights, flat front-facing UI, no perspective, no modern rounded card, no ornate frame, no wood, no scenery, no additional objects. This is an actual image asset, not a screenshot of a phone or a mockup.
