# Study circle characters

`characters-v1.png` is the original transparent generated artwork (1086 × 1448).
Six adult looks in the existing cottage's warm 2.5D pixel style; each has a
resting pose and a writing pose. No skin recoloring or character CSS drawing.

Rows: Moss / Maple / Cedar idle, then studying; Willow / Olive / Ash idle,
then studying. `characterFrame` in `src/study-together.js` defines individual
SVG view windows because painted atlas frames are not perfectly uniform.

Prompt: match boy-studying-v2.webp and room-v2.webp; transparent 3 × 4 atlas,
same wooden chair and camera angle, full seated figures with boots, no desks,
no text. Moss wears sage with brown waves; Maple terracotta with a dark bob;
Cedar mustard with black curls; Willow blue with a long braid; Olive cream
with an olive hijab; Ash plum with silver hair. Idle hands rest in lap;
studying hands hold a pencil forward. Keep consistent pose scale and position.

The room and desks reuse `public/study-room/room-v2.webp` and `desk-v2.webp`.
Characters, hands, desks and room remain separate layers. Artwork is decorative;
the participant list supplies accessible names, task visibility and timer status.
