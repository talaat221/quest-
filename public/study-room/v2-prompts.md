# Cottage v2 generation prompts

Built-in image generation. Four independent assets, generated in order.

## 1. room

Use case: stylized-concept.
Asset type: static background layer for a cozy pixel-art game study room, wide 16:9 landscape.
Primary request: A new 2.5D Stardew Valley-inspired cottage interior with genuine chunky 16-bit game pixels. Use an elevated three-quarter orthographic game camera, looking DOWN enough to see floorboards and furniture tops. This is an actual tiny farming-game room, not a front-facing anime illustration. No people or character.
Composition: a complete rectangular cottage interior, back wall and short side walls, front wall cut away. All main content contained within the frame. Back wall occupies upper 46 percent; richly warm wooden plank floor occupies lower 54 percent. Leave a calm sage-green back wall in the upper center for a live timer overlay. Leave the CENTER FLOOR EMPTY from x36%-65%, y49%-89% for a separate study desk and seated boy sprite.
Scene: left back window looks onto the blue moonlit farm and dark pine trees; a small curled ginger cat naps on its wide sill. A little potted fern and a mug on the sill. Short wood bookshelves with rust, cream and sage book spines against the right wall, small amber wall lantern at far right, tiny cast iron stove in right corner. Subtle climbing ivy and a few houseplants. A woven muted terracotta oval rug in the center floor beneath the future desk, no table or chair on it. No giant furniture: convincing small game-room proportions, depth from clean top planes and 3-tone shaded sides, soft pixel shadows.
Style: Stardew Valley-like original environment art. Consistent visible square pixels at a logical 480x270 resolution enlarged without smoothing. Limited warm honey/terracotta/olive palette with lavender and muted blue night shadows. Bold simple readable pixel clusters, no painterly brushstrokes, no gradients or rendered 3D, no high-resolution fine details, no anime rendering. Charming and cozy, tranquil candlelight.
Constraints: no desk, no central chair, no boy, no text, no numbers, no UI, no logos, no watermark. Crisp pixel art, not realistic or polished digital painting. Save as a wide opaque background.

## 2. desk

Use case: stylized-concept.
Asset type: independent transparent furniture sprite for the provided cottage room.
Input image 1 is a STYLE, CAMERA AND LIGHTING reference only; do not include any of its room.
Create ONE isolated small honey-brown wooden study desk, viewed from the SAME elevated three-quarter orthographic camera, front-facing with its tabletop clearly visible from above (Stardew Valley furniture perspective). We will place this desk in the center of the rug. Warm 16-bit farming game pixel art, chunky square pixel clusters, simple dark-brown outline, three-tone shaded wood. Not painterly, not anime, not photoreal or rendered 3D.
Desk has a rectangular top, two side legs and a small front drawer. An open cream notebook sits near center/back edge toward the person who will sit BEHIND it facing the viewer. Small sage-green tea mug sits on the viewer-left corner, two muted rust/blue books at viewer-right. Leave room either side of the notebook for a boy's forearms. No chair, no person, no hands, no pencil, no steam. Restrained details that match the scale of furniture in the supplied room.
Composition: landscape 3:2 canvas. Desk uses roughly 90 percent canvas width and 85 percent canvas height, centered with a small transparent margin on all sides. Complete legs visible, a subtle pixel contact shadow only directly under the legs. True transparent background everywhere else, no opaque floor or rug, no room. No lettering, no watermark.

## 3. idle

Use case: stylized-concept.
Asset type: transparent idle character sprite for an original Stardew Valley-inspired cozy cottage study game.
Input image 1: room camera, pixel style and lighting reference. Input image 2: desk he will sit behind, for scale and perspective only. Do NOT include room or desk in output.
One friendly young adult man with tan skin, short slightly tousled dark brown hair, a sage-green sweater with cream collar, brown trousers and small dark shoes. He is sitting normally on a small honey-brown wooden chair, relaxed shoulders, BOTH HANDS RESTING IN HIS LAP, looking ahead peacefully, tiny simple face with dark dot eyes, no elaborate anime face. We see him from the front and from above, with the SAME elevated three-quarter orthographic game camera as the cottage. The top of his hair, lap and chair seat are visible.
ART STYLE: actual chunky Stardew Valley-like game sprite, logical approximately 64x100 pixel figure enlarged with nearest-neighbor squares. Small compact 3-heads-tall adult proportions, restrained 3-tone shading, clean outlines, charming readable pixels. Not an illustrated portrait, not anime, not realistic, not smooth painted digital art.
Square canvas, full chair and entire seated figure visible from hair to shoes. Centered x50%, approximately 12%-90% canvas height and 24%-76% canvas width. Facing the viewer, slight natural three-quarter perspective matching front-facing desk. Warm amber light from his upper right with cool subtle night shadows. True transparent background with no floor rectangle, no room, no desk, no book, no glow border, no text or logo.
This sprite must work behind the separate desk: hands in lap will naturally be hidden by the tabletop. Keep a clean silhouette and plenty of transparent space at both sides.

## 4. working

Use case: identity-preserve.
Asset type: second animation state of the EXACT provided transparent pixel-game boy sprite.
Input image 1 is the EDIT TARGET. Input image 2 is furniture context ONLY, do not add it.
Change only the boy's posture from idle to quietly studying. Keep EXACT same square 1280x1280 canvas, sprite scale, pixel cluster size, center, head location, same face/hair/sage sweater/cream collar/brown trousers/shoes, wooden chair, warm illumination and real transparency. Keep chair and legs entirely unchanged and in the same pixels.
Tilt his head slightly down, eyes looking down at his work, relaxed focused expression. Bring his forearms forward, so they will lie on a separate desk that will be composited in front of him. Viewer-left hand holds a small golden pencil pointing diagonally DOWN AND RIGHT; the hand should be near x46%, y61% of the canvas and pencil tip near x50%,y67%. Other hand rests flat near x56%,y65% of canvas. Wrists and lower forearms need to be separate visible silhouettes. Keep upper arms attached naturally to his shoulders.
No table, no book, no background, no floor, no lettering or interface. True transparent background. Chunky crisp Stardew Valley-inspired 16-bit game sprite, NOT smooth anime or high resolution painting. Do not shift or resize the character.
