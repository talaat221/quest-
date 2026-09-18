# Main page finishing artwork

Mode: built-in image generation, guided by the user's original dashboard reference.

## Assets

- `public/home-finish/farm-streak-v1.webp` — 959 × 1640, with alpha.
  Farm viewport: `14 100 931 1028`, displayed at 275 × 317.
  Streak viewport: `14 1140 931 470`, displayed at 275 × 139.
  The column is 275 × 470, including the 14 px gap.
- `public/home-finish/stop-day-v1.webp` — 2125 × 740, with alpha.
  Viewport: `14 175 2096 396`, displayed at 650 × 107.
- `public/home-finish/navigation-v1.webp` — 1983 × 793, with alpha.
  Viewport: `10 263 1963 262`, displayed at 853 × 130.
  Native SVG icons and live labels provide all five selected/unselected states.

The original generation outputs are retained separately. WebP encoding is format optimization only; source artwork is cropped by SVG viewports at display time.

## Behavior

- Farm Status is a static illustration, without a pretend watering or growth action.
- Streak is derived from distinct quest days with a completed anchor or task, using the configured local reset hour. A streak ending yesterday remains active during today. Missing a day breaks it.
- Stop Day stages the current progress immediately through the existing local-first save adapter and requests a sync. It reports success only when the sync snapshot says synced with no pending changes. Pending, conflict and error states do not masquerade as a completed cloud save. It does not mark unfinished work complete or move the daily reset. Further edits return the button to Stop Day.
- Navigation opens Home, the retained quest editor, the retained anchor manager, real Stats, and More (reset hour, existing sync/conflict controls, and logout).
- Safe-area padding reserves the dock height on every destination.
- The legacy dashboard and its functions remain in source. This presentation is behind the existing design preview flag.

## Farm and Streak prompt

Create ONE production-ready transparent PNG UI artwork asset for the attached Quest mobile dashboard. The reference image is the design to match precisely, not a mood board. Isolate and faithfully recreate ONLY its right-hand stacked Farm Status and Streak cards, removing all other page elements. Vertical canvas aspect ratio 275:470. Both cards fill the canvas width edge to edge, align perfectly, with no outer margin. Top Farm Status card height 317/470 of canvas. A fully transparent gap of 14/470. Bottom Streak card height139/470. Dark midnight navy interiors, subtle deep-blue texture, fine stepped pixel corners, charcoal outer edge and double muted steel-blue pixel border exactly like the reference, NOT rounded modern cards, NOT thick frames, NOT bright neon. Crisp authentic detailed pixel art.

Farm top card: a little bright green pixel sprout in upper left; next to it exact heading 'Farm Status' in white friendly pixel lettering, fitted into ONE line. Thin blue divider below header at about20%of farm height. A richly illustrated small rectangular night garden at x8% to92%, y24%to69%of farm card: rustic warm wood fence, 3 rows of dark tilled-soil squares with little lime seedlings and lush greenery, a small blue watering-can badge at lower right. Faithful to the reference. Leave the entire area below garden BLANK navy for live code caption. No caption text in asset.
Streak bottom card: small golden orange red pixel flame upper left, exact title 'Streak' in white pixel lettering, divider at40%of this card. Everything below this divider must be BLANK navy: NO number, NO days, NO caption, NO chevron because dynamic code is inserted later.
Outside stepped card silhouettes and between the two cards, TRUE alpha transparency. Cards should occupy the entire supplied canvas, no white or checkerboard background baked in. These will be placed beside the existing Today's Quests card. Do not include that card, other dashboard sections, house, phone, sky, buttons, or additional objects. Keep all three intended areas (farm title, garden, streak title) clean and legible even at small iPhone scale.

## Stop Day prompt

Create a production-ready transparent PNG UI asset matching the attached pixel-art Quest mobile dashboard. Only ONE wide, shallow terracotta/rust wooden STOP DAY button background, isolated. Copy the warm red-brown button appearance in the reference near the bottom: pixel-stepped beveled corners, tiny hand-painted nicks and copper flecks on the rim, layered dark brown underside shadow, slim warm peach top highlight, subdued terracotta center with very subtle pixel wood texture. Aspect ratio exactly650:107, nearly six times wider than tall. The silhouette should fill the canvas, minimal transparent padding. True alpha outside the silhouette. The entire center must be EMPTY and uniform enough for legible code-rendered white heading and subtitle; NO text, letters, words, symbols, icons, numbers, fake labels or dividers baked into the artwork. No garden, fence, nav, phone, background scenery or additional objects. Detailed but restrained authentic crisp pixel art, night-time lighting. It should look like the reference's real art button, not a modern glossy web button, and not a thick ornate fantasy plaque. No white background, no checkerboard pixels baked in.

## Navigation prompt

Produce a single production-ready transparent PNG navigation-bar BACKGROUND for the attached Quest pixel-art mobile dashboard. Faithfully recreate ONLY the very bottom dark navy navigation container in the reference. Long shallow horizontal panel, exact intended proportions853:130, roughly6.56times wider than tall. It fills the canvas edge to edge with minimal transparent outer padding. Five identical equally wide EMPTY tab areas. Four thin vertical subdued blue separators at precisely20%,40%,60%,80% of total width, inset about12%from top and bottom. Midnight navy interiors with very subtle variation, stepped clipped pixel corners, thin charcoal outer edge, double fine desaturated steel-blue outline like the reference, minimal shadow. Detailed tasteful pixel art. ALL tabs must be visually inactive and blank: NO text, NO icons, NO labels, NO symbols, NO numbers, NO green highlight, NO selected state because the code will supply those. Border must be thin like reference, not chunky ornate armor. True alpha outside the navigation silhouette, NOT a white or checkerboard background. No phone hardware, scenery, other cards, buttons, Home icon, logo or home indicator. Only one flat navy pixel navigation tray.

