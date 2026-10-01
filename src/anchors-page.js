import { getAnchorTime, getDailyAnchorTimeline } from "./daily-anchors.js";
import { getSafeHarborActiveAnchorIds } from "./day-pause.js";

export const ANCHOR_WEEKDAYS = [
  { value: 1, short: "M", label: "Mon", full: "Monday" },
  { value: 2, short: "T", label: "Tue", full: "Tuesday" },
  { value: 3, short: "W", label: "Wed", full: "Wednesday" },
  { value: 4, short: "T", label: "Thu", full: "Thursday" },
  { value: 5, short: "F", label: "Fri", full: "Friday" },
  { value: 6, short: "S", label: "Sat", full: "Saturday" },
  { value: 7, short: "S", label: "Sun", full: "Sunday" },
];

export function anchorDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Local noon avoids UTC date shifts and daylight-saving midnight edges.
  return new Date(year, month - 1, day, 12);
}

export function anchorDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}

export function shiftAnchorDate(dateStr, days) {
  const date = anchorDate(dateStr);
  date.setDate(date.getDate() + days);
  return anchorDateKey(date);
}

export function anchorWeek(dateStr) {
  const weekday = anchorDate(dateStr).getDay() || 7;
  return ANCHOR_WEEKDAYS.map((day) => shiftAnchorDate(dateStr, day.value - weekday));
}

export function anchorDays(anchor) {
  const days = Array.isArray(anchor.activeWeekdays)
    ? [...new Set(anchor.activeWeekdays.map(Number)
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7))]
    : [];
  return days.length ? days.sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7];
}

export function anchorDayState(anchor, dateStr, adjustment) {
  const done = !!anchor.history?.[dateStr];
  const scheduled = anchorDays(anchor).includes(anchorDate(dateStr).getDay() || 7);
  const safeActive = getSafeHarborActiveAnchorIds({ anchors: [anchor] }, adjustment).includes(anchor.id);
  const harbor = adjustment?.mode === "harbor";
  const paused = harbor && !safeActive && scheduled && !done;
  return {
    done, scheduled, paused, safeActive,
    protected: harbor && adjustment.protectedKey === "anchor:" + anchor.id,
    off: !scheduled && !done,
    disabled: !done && (!scheduled || paused),
    muted: harbor && !safeActive,
  };
}

export function anchorTimeLabel(hour) {
  const minutes = getAnchorTime(hour);
  return minutes === null ? "Anytime"
    : String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}

export function anchorPageItems(anchors, { dateStr, todayStr, now, resetHour = 0, adjustment }) {
  const states = anchors.map((anchor) => ({
    ...anchor, ...anchorDayState(anchor, dateStr, adjustment),
  }));
  // Reuse the home timeline's reset-hour-aware clock semantics.
  return getDailyAnchorTimeline(states, resetHour, now).map((anchor) => ({
    ...anchor,
    minutes: getAnchorTime(anchor.hour),
    timeLabel: anchorTimeLabel(anchor.hour),
    status: anchor.off ? "off"
      : anchor.status === "due" && dateStr !== todayStr ? "pending" : anchor.status,
  }));
}

export function clockPoint(minutes, radius = 153) {
  const radians = minutes / 1440 * Math.PI * 2 - Math.PI / 2;
  return { x: 200 + Math.cos(radians) * radius, y: 200 + Math.sin(radians) * radius };
}

export function groupClockAnchors(items) {
  // Nearby hours share a roomy tap target; exact dots still use each anchor's
  // actual minute. Same-time anchors are never hidden behind one another.
  const timed = items.filter((item) => item.minutes !== null && !item.off)
    .sort((a, b) => a.minutes - b.minutes);
  const buckets = [];
  for (const item of timed) {
    const last = buckets[buckets.length - 1];
    if (last && item.minutes - last[0].minutes < 120) last.push(item);
    else buckets.push([item]);
  }
  // 23:00 and 00:00 are neighbors on the dial too.
  if (buckets.length > 1) {
    const first = buckets[0];
    const last = buckets[buckets.length - 1];
    if (first[first.length - 1].minutes + 1440 - last[0].minutes < 120) {
      buckets[0] = [...last, ...first];
      buckets.pop();
    }
  }
  return buckets.map((members) => {
    const wraps = members[members.length - 1].minutes < members[0].minutes;
    const minutes = members.map((item) =>
      wraps && item.minutes < members[0].minutes ? item.minutes + 1440 : item.minutes);
    const first = Math.min(...minutes);
    const last = Math.max(...minutes);
    const featured = members.find((item) => item.status === "due")
      || members.find((item) => !item.done) || members[0];
    return {
      key: "time-" + members[0].minutes, members, featured,
      position: clockPoint((first + last) / 2, 174),
      label: first === last ? anchorTimeLabel(first / 60)
        : String(Math.floor(first / 60) % 24).padStart(2, "0") + "–"
          + String(Math.floor(last / 60) % 24).padStart(2, "0"),
      status: members.every((item) => item.done) ? "done"
        : members.some((item) => item.status === "due") ? "due"
        : members.every((item) => item.paused) ? "paused" : "pending",
      muted: members.every((item) => item.muted),
    };
  });
}
