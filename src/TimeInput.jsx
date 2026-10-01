import { useEffect, useId, useRef, useState } from "react";
import { formatScheduleTime, isTimeInputValid, parseTimeInput } from "./schedule-time.js";
import "./time-input.css";

export default function TimeInput({ value, onChange, label = "Task time", disabled = false, required = false }) {
  const id = useId();
  const input = useRef(null);
  const [touched, setTouched] = useState(false);
  const valid = isTimeInputValid(value, required);
  const error = !disabled && !valid && (touched || String(value).trim() !== "");
  const message = "Use a time from 00:00 to 23:59, like 10:20.";
  useEffect(() => {
    input.current?.setCustomValidity(disabled || valid ? "" : message);
  }, [disabled, valid]);

  return <div className="qt-time-field">
    <label htmlFor={id}>{label}{!required && <span> · optional</span>}</label>
    <input ref={input} id={id} type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
      placeholder="10:20" value={value} disabled={disabled} required={required} maxLength={5}
      aria-invalid={error || undefined} aria-describedby={id + "-hint"}
      onChange={event => onChange(event.target.value)}
      onBlur={() => {
        setTouched(true);
        if (valid) onChange(formatScheduleTime(parseTimeInput(value)));
      }} />
    <small id={id + "-hint"} className={error ? "qt-time-error" : ""} aria-live="polite">
      {disabled ? "Choose a date first." : error ? message : "24-hour time · type 1020 for 10:20."}
      {!disabled && !required && !error && " Leave empty for anytime."}
    </small>
  </div>;
}
