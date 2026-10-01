// Read-only views of Quest's saved records. Nothing here writes task state.
import { getSafeHarborActiveAnchorIds, isSafeHarborTask } from "./day-pause.js";

const DAY = 86400000;
export function statsDayNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const n = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value
    ? Math.floor(n / DAY) : null;
}
export const statsDayKey = (number) => new Date(number * DAY).toISOString().slice(0, 10);
export const shiftStatsDay = (day, amount) => statsDayKey(statsDayNumber(day) + amount);
export function completionQuestDay(value, resetHour = 0) {
  if (!value) return null;
  // A date-only legacy record is already a quest-day key.
  if (statsDayNumber(value) !== null) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const reset = Math.min(23, Math.max(0, Number(resetHour) || 0));
  if (date.getHours() < reset) date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const positive = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const validPast = (day, today) => statsDayNumber(day) !== null && day <= today;
const weekdays = (anchor) => {
  const values = [...new Set((Array.isArray(anchor.activeWeekdays) ? anchor.activeWeekdays : []).map(Number))]
    .filter(value => Number.isInteger(value) && value >= 1 && value <= 7);
  return values.length ? values : [1, 2, 3, 4, 5, 6, 7];
};
const emptyCounts = () => ({ completed: 0, xp: 0, planned: 0 });
const emptyBucket = () => ({ anchor: emptyCounts(), quest: emptyCounts() });
const add = (a, b) => { a.completed += b.completed; a.xp += b.xp; a.planned += b.planned; };
export const rateOf = (counts) => counts.planned ? counts.completed / counts.planned * 100 : null;
export const metricOf = (counts, metric) => metric === "xp" ? counts.xp : metric === "rate" ? rateOf(counts) : counts.completed;

export function buildStatsModel({ anchors = [], domains = [], todayStr, resetHour = 0, voyageAdjustments = {} }) {
  const items = [], events = [], tasks = [], undated = [], starts = [todayStr];
  for (const anchor of anchors) {
    const history = Object.entries(anchor.history || {}).filter(([day, done]) => done && validPast(day, todayStr)).map(([day]) => day).sort();
    const stampedId = /^anchor-(\d{13})-/.exec(String(anchor.id));
    const created = completionQuestDay(anchor.createdAt || (stampedId ? Number(stampedId[1]) : null), resetHour);
    const start = [validPast(created, todayStr) ? created : null, history[0]].filter(Boolean).sort()[0] || todayStr;
    const key = `anchor:${anchor.id}`;
    items.push({ key, source: "anchor", id: anchor.id, name: anchor.name || "Untitled anchor", emoji: anchor.emoji || "⚓", category: anchor.category || "Daily anchor", start, inferredStart: !created, weekdays: weekdays(anchor), record: anchor });
    starts.push(start);
    for (const day of history) events.push({ key, source: "anchor", day, xp: positive(anchor.xpPerDay) });
  }
  for (const domain of domains) {
    const key = `quest:${domain.id}`;
    items.push({ key, source: "quest", id: domain.id, name: domain.name || "Untitled quest", emoji: domain.emoji || "📜", category: "Quest", record: domain });
    for (const task of domain.tasks || []) {
      const day = task.done ? completionQuestDay(task.doneAt, resetHour) : null;
      const record = { ...task, key, source: "quest", domainId: domain.id, completionDay: day, xp: positive(task.xp) };
      tasks.push(record);
      if (validPast(task.day, todayStr)) starts.push(task.day);
      if (task.done && validPast(day, todayStr)) { events.push({ key, source: "quest", day, xp: record.xp }); starts.push(day); }
      if (task.done && !day) undated.push({ key, source: "quest", xp: record.xp });
    }
  }
  const days = [...new Set(events.map(event => statsDayNumber(event.day)))].sort((a, b) => a - b);
  const active = new Set(days), today = statsDayNumber(todayStr);
  let currentStreak = 0, cursor = active.has(today) ? today : today - 1, bestStreak = 0, run = 0, last;
  while (active.has(cursor)) { currentStreak++; cursor--; }
  for (const day of days) { run = day === last + 1 ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); last = day; }
  return { items, events, tasks, undated, voyageAdjustments, anchors, todayStr, firstDay: starts.filter(day => validPast(day, todayStr)).sort()[0] || todayStr,
    currentStreak, bestStreak, lifetimeXP: [...events, ...undated].reduce((sum, event) => sum + event.xp, 0) };
}

export function getStatsPeriod(period, offset, todayStr, firstDay) {
  const today = statsDayNumber(todayStr), date = new Date(today * DAY);
  let start = today, end = today;
  if (period === "week") {
    start = today - ((date.getUTCDay() + 6) % 7) + offset * 7; end = start + 6;
  } else if (period === "month") {
    start = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1) / DAY);
    end = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset + 1, 0) / DAY);
  } else if (period === "all") { start = statsDayNumber(firstDay); }
  else { start += offset; end = start; }
  return { period, offset, start: statsDayKey(start), end: statsDayKey(end), cutoff: statsDayKey(Math.min(end, today)), days: end - start + 1 };
}

export function getComparisonPeriod(range, todayStr, firstDay) {
  if (range.period === "all") return null;
  const previous = getStatsPeriod(range.period, range.offset - 1, todayStr, firstDay);
  const elapsed = statsDayNumber(range.cutoff) - statsDayNumber(range.start) + 1;
  const comparableEnd = Math.min(statsDayNumber(previous.end), statsDayNumber(previous.start) + elapsed - 1);
  // Compare a partial current week/month with the same number of elapsed days.
  return { ...previous, cutoff: statsDayKey(comparableEnd), end: statsDayKey(comparableEnd), days: comparableEnd - statsDayNumber(previous.start) + 1 };
}

export function selectedStatsItems(model, { sources = ["anchor", "quest"], scope = "all", selected = [] } = {}) {
  const keys = new Set(selected);
  return model.items.filter(item => sources.includes(item.source) && (scope === "all" || keys.has(item.key)));
}

export function summarizeStats(model, range, filters = {}) {
  const items = selectedStatsItems(model, filters), keys = new Set(items.map(item => item.key));
  const days = new Map(), byItem = new Map(items.map(item => [item.key, { ...emptyCounts(), ...item }]));
  const bucket = day => { if (!days.has(day)) days.set(day, emptyBucket()); return days.get(day); };
  const included = day => day && day >= range.start && day <= range.cutoff;
  const anchorDone = new Set();
  for (const event of model.events) {
    if (!keys.has(event.key) || !included(event.day)) continue;
    const counts = { completed: 1, xp: event.xp, planned: 1 };
    add(bucket(event.day)[event.source], counts); add(byItem.get(event.key), counts);
    if (event.source === "anchor") anchorDone.add(`${event.key}@${event.day}`);
  }
  for (const item of items.filter(item => item.source === "anchor")) {
    const start = Math.max(statsDayNumber(range.start), statsDayNumber(item.start));
    const end = statsDayNumber(range.cutoff);
    for (let number = start; number <= end; number++) {
      const day = statsDayKey(number), weekday = new Date(number * DAY).getUTCDay() || 7;
      if (!item.weekdays.includes(weekday) || anchorDone.has(`${item.key}@${day}`)) continue;
      const adjustment = model.voyageAdjustments[day];
      if (adjustment?.mode === "harbor" && !getSafeHarborActiveAnchorIds({ anchors: model.anchors }, adjustment).includes(item.id)) continue;
      bucket(day).anchor.planned++; byItem.get(item.key).planned++;
    }
  }
  for (const task of model.tasks) {
    // A completed task belongs to its completion day once, not again on its planned date.
    if (!keys.has(task.key) || task.done || !included(task.day)) continue;
    const adjustment = model.voyageAdjustments[task.day];
    if (adjustment?.mode === "harbor" && !isSafeHarborTask(task, task.domainId, adjustment, task.day)) continue;
    bucket(task.day).quest.planned++; byItem.get(task.key).planned++;
  }
  const undated = emptyBucket();
  if (range.period === "all") {
    for (const event of model.undated.filter(event => keys.has(event.key))) {
      const counts = { completed: 1, xp: event.xp, planned: 1 };
      add(undated.quest, counts); add(byItem.get(event.key), counts);
    }
  }
  const total = emptyCounts(), sourceTotals = emptyBucket();
  for (const counts of [...days.values(), undated]) {
    for (const source of ["anchor", "quest"]) { add(total, counts[source]); add(sourceTotals[source], counts[source]); }
  }
  const measuredStart = Math.max(statsDayNumber(range.start), statsDayNumber(model.firstDay));
  const elapsedDays = Math.max(0, statsDayNumber(range.cutoff) - measuredStart + 1);
  const datedCompleted = total.completed - undated.quest.completed;
  return { items, days, byItem, total, sourceTotals, undated, elapsedDays,
    average: elapsedDays ? datedCompleted / elapsedDays : null,
    activeDays: [...days.values()].filter(day => day.anchor.completed + day.quest.completed > 0).length };
}

const formatDay = (day, options) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
export function periodLabel(range) {
  if (range.period === "all") return "All saved history";
  if (range.period === "month") return formatDay(range.start, { month: "long", year: "numeric" });
  if (range.period === "today") return formatDay(range.start, { day: "numeric", month: "short", year: "numeric" });
  return `${formatDay(range.start, { day: "numeric", month: "short" })} – ${formatDay(range.end, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function statsChartRows(summary, range, metric, grouping = "day") {
  if (grouping === "item") return summary.items.map(item => {
    const counts = summary.byItem.get(item.key), value = metricOf(counts, metric);
    return { key: item.key, label: item.name, fullLabel: item.name, source: item.source,
      anchor: item.source === "anchor" ? value : null, quest: item.source === "quest" ? value : null,
      combined: value, counts, future: false };
  });
  const monthly = range.period === "all" && range.days > 62;
  const buckets = new Map();
  for (let n = statsDayNumber(range.start); n <= statsDayNumber(range.end); n++) {
    const day = statsDayKey(n), key = monthly ? day.slice(0, 7) : day;
    if (!buckets.has(key)) buckets.set(key, { key, start: day, ...emptyBucket(), future: day > range.cutoff });
    const values = summary.days.get(day);
    if (values) { add(buckets.get(key).anchor, values.anchor); add(buckets.get(key).quest, values.quest); }
  }
  const rows = [...buckets.values()].map(row => {
    const counts = emptyCounts(); add(counts, row.anchor); add(counts, row.quest);
    return { key: row.key, future: row.future,
      label: monthly ? formatDay(row.start, { month: "short", year: "2-digit" })
        : range.period === "week" ? formatDay(row.start, { weekday: "short" })
        : range.period === "today" ? range.offset === 0 ? "Today" : formatDay(row.start, { day: "numeric", month: "short" }) : formatDay(row.start, { day: "numeric" }),
      fullLabel: monthly ? formatDay(row.start, { month: "long", year: "numeric" })
        : formatDay(row.start, { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
      anchor: row.future ? null : metricOf(row.anchor, metric), quest: row.future ? null : metricOf(row.quest, metric),
      combined: row.future ? null : metricOf(counts, metric), counts };
  });
  if (summary.undated.quest.completed) rows.push({ key: "undated", label: "No date", fullLabel: "Saved completions without a date", anchor: null,
    quest: metricOf(summary.undated.quest, metric), combined: metricOf(summary.undated.quest, metric), counts: summary.undated.quest, future: false });
  return rows;
}

export function graphScale(rows, metric, style = "bars", previous = []) {
  if (metric === "rate") return 100;
  const numbers = [...rows, ...previous].flatMap(row => metric === "rate" || style === "line"
    ? [row.anchor || 0, row.quest || 0, row.combined || 0] : [row.combined || 0]);
  const peak = Math.max(metric === "tasks" ? 4 : 20, ...numbers);
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / magnitude / .5) * magnitude * .5;
}
