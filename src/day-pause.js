// Keep the original Safe Harbor choices, including older saved days that only
// stored one protected anchor. A protected anchor always remains available.
export function getSafeHarborActiveAnchorIds(state, adjustment) {
  if (adjustment?.mode !== "harbor") return [];
  const ids = new Set(Array.isArray(adjustment.activeAnchorIds) ? adjustment.activeAnchorIds : []);
  const key = String(adjustment.protectedKey || "");
  if (key.startsWith("anchor:")) ids.add(key.slice("anchor:".length));
  return [...ids].filter(id => state?.anchors?.some(anchor => anchor.id === id));
}

export function isSafeHarborTask(task, domainId, adjustment, dateStr) {
  return adjustment?.mode === "harbor" && task.day === dateStr && (
    task.flexibility === "fixed" || adjustment.protectedKey === `task:${domainId}:${task.id}`
  );
}
