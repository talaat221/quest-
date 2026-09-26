// Keep the existing fractional-hour data format; convert only at the UI boundary.
export function parseTimeInput(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  let hours, minutes;
  const clock = /^(\d{1,2})(?::(\d{2}))?$/.exec(text);
  if (clock) {
    hours = Number(clock[1]);
    minutes = Number(clock[2] || 0);
  } else if (/^\d{3,4}$/.test(text)) {
    hours = Number(text.slice(0, -2));
    minutes = Number(text.slice(-2));
  } else {
    return NaN;
  }
  return hours < 24 && minutes < 60 ? (hours * 60 + minutes) / 60 : NaN;
}

export function isTimeInputValid(value, required = false) {
  const hour = parseTimeInput(value);
  return hour === null ? !required : Number.isFinite(hour);
}

export function formatScheduleTime(hour) {
  if (hour === null || hour === undefined || String(hour).trim() === "") return "";
  const value = Number(hour);
  if (!Number.isFinite(value) || value < 0 || value >= 24) return "";
  const minutes = Math.min(1439, Math.round(value * 60));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
