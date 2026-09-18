export function getAnchorTime(hour) {
  if (hour === null || hour === undefined || hour === "") return null;
  const value = Number(hour);
  return Number.isFinite(value) && value >= 0 && value < 24
    ? Math.min(1439, Math.round(value * 60))
    : null;
}

export function getDailyAnchorTimeline(anchors, resetHour = 0) {
  const resetMinutes = Math.min(23, Math.max(0, Number(resetHour) || 0)) * 60;
  const order = (anchor) => {
    const minutes = getAnchorTime(anchor.hour);
    return minutes === null ? Infinity : (minutes - resetMinutes + 1440) % 1440;
  };
  const sorted = [...anchors].sort((a, b) => order(a) - order(b));
  const next = sorted.find((anchor) => !anchor.done && !anchor.paused);

  return sorted.map((anchor) => {
    const minutes = getAnchorTime(anchor.hour);
    return {
      ...anchor,
      timeLabel: minutes === null
        ? "Anytime"
        : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`,
      status: anchor.done ? "done" : anchor.paused ? "paused" : anchor === next ? "next" : "pending",
    };
  });
}

export function getAnchorIcon(anchor) {
  const name = String(anchor.name || "").toLowerCase();
  const emoji = anchor.emoji || "";
  if (/brush|teeth|tooth|dental/.test(name) || /🪥|🦷/.test(emoji)) return "toothbrush";
  if (/gym|workout|exercise|fitness|lift/.test(name) || /💪|🏋|🏃/.test(emoji)) return "gym";
  if (/french|anki|language|flashcard/.test(name) || /🇫🇷/.test(emoji)) return "purple-book";
  if (/sleep|bed|rest/.test(name) || /🌙|😴|🛌/.test(emoji)) return "moon";
  if (/read|book/.test(name) || /📖|📚/.test(emoji)) return "blue-book";
  if (/edit|film|photo|camera|video/.test(name) || /🎬|📷|🎥/.test(emoji)) return "camera";
  if (/study|uni\b|college|school|histology|learn|code|program/.test(name) || /💻|🎓/.test(emoji)) return "laptop";
  return "custom";
}
