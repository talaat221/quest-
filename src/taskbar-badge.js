export function countBadgeItems(items, includeAnchors = true) {
  return items.filter(item => !item.done && !item.paused && (includeAnchors || item.source !== 'anchor')).length;
}
