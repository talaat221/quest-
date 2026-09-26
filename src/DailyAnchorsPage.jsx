import { useEffect, useId, useRef, useState } from "react";
import { PixelAnchorSymbol, PixelTaskIcon } from "./DailyAnchors.jsx";
import {
  ANCHOR_WEEKDAYS, anchorDate, anchorDays, anchorDayState, anchorPageItems,
  anchorTimeLabel, anchorWeek, clockPoint, groupClockAnchors, shiftAnchorDate,
} from "./anchors-page.js";
import "./anchors-page.css";

const ART = "/anchors-page/";
const STATUS_COLORS = {
  done: "#8ade76", due: "#ffc264", pending: "#8db2ce",
  paused: "#819098", off: "#617585",
};
const dateLabel = (dateStr) => anchorDate(dateStr).toLocaleDateString("en-GB", {
  weekday: "short", day: "2-digit", month: "short",
});
const statusLabel = (item) => item.done ? "Completed" : item.paused ? "Paused"
  : item.off ? "Not scheduled" : item.status === "due" ? "Due now" : "";

function UiIcon({ kind, ...props }) {
  const paths = {
    left: <path d="m14 5-7 7 7 7" />,
    right: <path d="m10 5 7 7-7 7" />,
    edit: <><path d="m5 15 10-10 4 4-10 10-5 1zM13 7l4 4" /><path d="M4 21h16" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    more: <><path d="M4 11h2v2H4zM11 11h2v2h-2zM18 11h2v2h-2z" /></>,
    clock: <><path d="M9 2h6l5 5v10l-5 5H9l-5-5V7z" /><path d="M12 6v7h5" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    trash: <><path d="M4 6h16M9 6V3h6v3M7 6v15h10V6M10 10v7M14 10v7" /></>,
    check: <path d="m5 12 5 5 10-11" />,
    pause: <path d="M8 5v14M16 5v14" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" focusable="false" {...props}>
    {paths[kind] || paths.clock}
  </svg>;
}

function PanelArt({ bronze = false }) {
  return <span className={"dap-panel-art" + (bronze ? " dap-panel-art-bronze" : "")} aria-hidden="true" />;
}

function WoodArt() {
  // This viewport removes only the generator's transparent export margin.
  // The original image remains intact; its pixels provide the entire plaque.
  return <svg className="dap-wood-art" viewBox="40 108 2092 504" preserveAspectRatio="none"
    aria-hidden="true" focusable="false">
    <image href={ART + "wood-plaque.webp"} width="2172" height="724" />
  </svg>;
}

function AnchorPicture({ anchor }) {
  // Honor a selected icon even when the anchor's name suggests another one.
  const iconSource = anchor.emoji && anchor.emoji !== "⭐"
    ? { name: "", emoji: anchor.emoji } : anchor;
  return <span className="dap-picture"><PixelTaskIcon anchor={iconSource} /></span>;
}

function CheckArt({ done, paused }) {
  return <svg className={"dap-check-art" + (done ? " is-checked" : "")} viewBox="0 0 28 28"
    aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <path className="dap-check-face" d="M5 2h18v2h3v20h-3v2H5v-2H2V4h3z" />
    {done ? <path className="dap-check-mark" d="m7 13 4 4 10-11 3 3-13 14-7-7z" />
      : paused ? <path className="dap-check-pause" d="M9 8h3v12H9zm7 0h3v12h-3z" /> : null}
  </svg>;
}

function CompletionButton({ item, dateStr, onToggle, className = "", compact = false }) {
  return <button type="button" className={"dap-complete " + className}
    disabled={item.disabled}
    aria-pressed={item.done}
    aria-label={item.name + ", " + dateStr + ": " + (item.paused ? "Paused today"
      : item.off ? "Not scheduled" : item.done ? "Mark incomplete" : "Mark complete")}
    title={item.paused ? "Paused by Stop Day" : item.off ? "Not scheduled on this day" : undefined}
    onClick={() => onToggle(item.id, dateStr)}>
    <CheckArt done={item.done} paused={item.paused} />
    {!compact && <span className="dap-sr-only">{item.name}</span>}
  </button>;
}

function AnchorsClock({ items, dateStr, todayStr, now, resetHour, onDateChange, onToggle, harbor }) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const groups = groupClockAnchors(items);
  const group = groups.find((entry) => entry.key === selectedGroup);
  const scheduled = items.filter((item) => !item.off);
  const anytime = scheduled.filter((item) => item.minutes === null);
  const isToday = dateStr === todayStr;
  const due = scheduled.filter((item) => item.status === "due");
  const next = scheduled.find((item) => item.status === "pending" && item.minutes !== null);
  const done = scheduled.filter((item) => item.done).length;
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const hand = clockPoint(currentMinutes, 120);
  const minutesText = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  let caption = !scheduled.length ? "A little room to breathe"
    : done === scheduled.length ? "All anchors complete"
    : due.length === 1 ? due[0].name + " is due"
    : due.length > 1 ? due.length + " anchors are due"
    : next ? "Next · " + next.timeLabel + " " + next.name : "Go at your own pace";
  if (!isToday) caption = done + " of " + scheduled.length + " complete";
  const changeDay = (date) => { setSelectedGroup(null); onDateChange(date); };

  return <section className={"dap-clock-panel" + (harbor ? " is-harbor" : "")} aria-label="Daily anchor clock">
    <PanelArt />
    <header className="dap-clock-heading">
      <button type="button" className="dap-icon-button" aria-label="Previous day"
        onClick={() => changeDay(shiftAnchorDate(dateStr, -1))}><UiIcon kind="left" /></button>
      <div>
        <h2>{isToday ? "TODAY · " : ""}{dateLabel(dateStr).toUpperCase()}</h2>
        <p aria-live="polite">{done} of {scheduled.length} complete</p>
      </div>
      <button type="button" className="dap-icon-button" aria-label="Next day"
        onClick={() => changeDay(shiftAnchorDate(dateStr, 1))}><UiIcon kind="right" /></button>
    </header>
    <div className="dap-clock-face">
      <svg className="dap-clock-drawing" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
        <image className="dap-clock-scenery" href={ART + "clock-face.webp"} x="30" y="30" width="340" height="340" />
        <g className="dap-clock-ticks">
          {Array.from({ length: 96 }, (_, index) => {
            const outer = clockPoint(index * 15, 145);
            const inner = clockPoint(index * 15, index % 4 === 0 ? 137 : 142);
            return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
              stroke={index % 24 === 0 ? "#f0c785" : "#bdd0d5"} strokeWidth={index % 4 === 0 ? 1.8 : 1} />;
          })}
          {[0, 6, 12, 18].map((hour) => {
            const p = clockPoint(hour * 60, 122);
            return <text key={hour} x={p.x} y={p.y + 6} textAnchor="middle">{String(hour).padStart(2, "0")}</text>;
          })}
        </g>
        {isToday && <g className="dap-clock-hand">
          <line x1="200" y1="200" x2={hand.x} y2={hand.y} stroke="#071623" strokeWidth="7" />
          <line x1="200" y1="200" x2={hand.x} y2={hand.y} stroke="#ffcc70" strokeWidth="3" />
          <circle cx="200" cy="200" r="5" fill="#d99b42" stroke="#ffdf98" strokeWidth="2" />
        </g>}
        {scheduled.filter((item) => item.minutes !== null).map((item) => {
          const point = clockPoint(item.minutes);
          return <circle key={item.id} className={item.muted ? "dap-muted" : ""}
            cx={point.x} cy={point.y} r="4.2" fill={item.done || item.status === "due" ? STATUS_COLORS[item.status] : "#072138"}
            stroke={STATUS_COLORS[item.status]} strokeWidth="2.2" />;
        })}
      </svg>
      <div className="dap-clock-center">
        <strong>{isToday ? minutesText : anchorDate(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</strong>
        <span title={caption}>{caption}</span>
      </div>
      {groups.map((entry) => <button type="button"
        key={entry.key}
        className={"dap-clock-marker is-" + entry.status + (entry.muted ? " dap-muted" : "") + (selectedGroup === entry.key ? " is-selected" : "")}
        style={{ left: entry.position.x / 4 + "%", top: entry.position.y / 4 + "%" }}
        aria-label={entry.members.map((item) => item.name + " at " + item.timeLabel).join(", ") + ". Show tasks"}
        aria-expanded={selectedGroup === entry.key}
        onClick={() => setSelectedGroup(selectedGroup === entry.key ? null : entry.key)}>
        <AnchorPicture anchor={entry.featured} />
        {entry.members.length > 1 && <b className="dap-marker-count">{entry.members.length}</b>}
        <span>{entry.label}</span>
      </button>)}
    </div>
    <div className="dap-clock-legend" aria-label="Clock status legend">
      <span><i className="is-done" />Done</span><span><i className="is-due" />Due</span><span><i />Later</span>
      {!isToday && <button type="button" onClick={() => changeDay(null)}>Back to today</button>}
    </div>
    {group && <div className="dap-clock-selection">
      <div className="dap-selection-heading"><span>{group.label} · {group.members.length === 1 ? "Your anchor" : group.members.length + " anchors"}</span>
        <button type="button" className="dap-icon-button" aria-label="Close clock tasks"
          onClick={() => setSelectedGroup(null)}><UiIcon kind="close" /></button></div>
      {group.members.map((item) => <div key={item.id} className={"dap-quick-anchor is-" + item.status + (item.muted ? " dap-muted" : "")}>
        <AnchorPicture anchor={item} />
        <div><strong>{item.name}</strong><small>{item.timeLabel} · {statusLabel(item) || "Later today"}</small></div>
        <CompletionButton compact item={item} dateStr={dateStr} onToggle={onToggle} />
      </div>)}
    </div>}
    {anytime.length > 0 && <section className="dap-anytime" aria-label="Anytime anchors">
      <h3>ANYTIME</h3>
      {anytime.map((item) => <div key={item.id} className={"dap-quick-anchor is-" + item.status + (item.muted ? " dap-muted" : "")}>
        <AnchorPicture anchor={item} /><span>{item.name}</span>
        <CompletionButton compact item={item} dateStr={dateStr} onToggle={onToggle} />
      </div>)}
    </section>}
    {Number(resetHour) !== 0 && <p className="dap-reset-note">Your day resets at {anchorTimeLabel(resetHour)}</p>}
  </section>;
}

function AnchorRoutineCard({ item, dateStr, todayStr, days, adjustments, onToggle, onEdit, categoryColor }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuId = useId();
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [menuOpen]);
  const count = anchorDays(item).length;
  return <article className={"dap-routine is-" + item.status + (item.muted ? " dap-muted" : "") + (item.safeActive ? " is-safe-active" : "")}
    aria-label={item.name + " daily anchor"}>
    <PanelArt bronze={item.status === "due"} />
    <div className="dap-routine-heading">
      <CompletionButton compact item={item} dateStr={dateStr} onToggle={onToggle} />
      <AnchorPicture anchor={item} />
      <div className="dap-routine-name">
        <h3 title={item.name}>{item.name}</h3>
        <span className="dap-routine-time"><UiIcon kind="clock" />{item.timeLabel}{statusLabel(item) && <em> · {statusLabel(item)}</em>}</span>
      </div>
      <span className="dap-routine-xp">+{Number(item.xpPerDay) || 0} XP</span>
      <button type="button" className="dap-icon-button dap-edit-button" aria-label={"Edit " + item.name}
        onClick={() => onEdit(item)}><UiIcon kind="edit" /></button>
      <div className="dap-menu-wrap" ref={menuRef} onKeyDown={(event) => {
        if (event.key === "Escape") { setMenuOpen(false); menuRef.current?.querySelector("button")?.focus(); }
      }}>
        <button type="button" className="dap-icon-button" aria-label={"More options for " + item.name}
          aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(!menuOpen)}>
          <UiIcon kind="more" />
        </button>
        {menuOpen && <div className="dap-card-menu" id={menuId}>
          <button type="button" onClick={() => { setMenuOpen(false); onEdit(item); }}>Edit anchor</button>
          <button type="button" onClick={() => { setMenuOpen(false); onEdit(item, true); }}>Delete anchor…</button>
        </div>}
      </div>
    </div>
    <div className="dap-routine-meta">
      <span className="dap-category" style={{ "--dap-category": categoryColor?.(item.category) || "#92d1ef" }}>{item.category || "General"}</span>
      <span>{count === 7 ? "Every day" : count + " days/week"}</span>
      {item.protected && <strong className="dap-important">Important</strong>}
    </div>
    <div className="dap-week" role="group" aria-label={item.name + " weekly history"}>
      {days.map((date, index) => {
        const day = anchorDayState(item, date, adjustments[date]);
        return <button type="button" key={date} disabled={day.disabled} aria-pressed={day.done}
          aria-label={item.name + ", " + ANCHOR_WEEKDAYS[index].full + " " + date + ": "
            + (day.paused ? "Paused" : day.off ? "Not scheduled" : day.done ? "Mark incomplete" : "Mark complete")}
          title={date + (day.paused ? " · Paused by Stop Day" : day.off ? " · Not scheduled" : "")}
          aria-current={date === todayStr ? "date" : undefined}
          className={(date === dateStr ? "is-selected " : "") + (day.done ? "is-done " : "") + (day.disabled ? "is-disabled" : "")}
          onClick={() => onToggle(item.id, date)}>
          <span>{ANCHOR_WEEKDAYS[index].short}</span>
          <span className="dap-week-box">{day.done ? <UiIcon kind="check" /> : day.disabled ? "–" : ""}</span>
        </button>;
      })}
    </div>
  </article>;
}

function AnchorEditor({ anchor, onSave, onDelete, onClose, deleteIntent = false }) {
  const dialogRef = useRef(null);
  const deleteRef = useRef(null);
  const id = useId();
  const [draft, setDraft] = useState(() => ({
    emoji: anchor?.emoji || "⭐", name: anchor?.name || "",
    category: anchor?.category || "", xpPerDay: anchor?.xpPerDay ?? 10,
    activeWeekdays: anchorDays(anchor || {}),
    hour: anchor?.hour === null || anchor?.hour === undefined ? "8" : String(anchor.hour),
    timed: anchor?.hour !== null && anchor?.hour !== undefined,
  }));
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    if (deleteIntent) deleteRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = priorOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [deleteIntent]);
  const patch = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const toggleDay = (day) => setDraft((current) => {
    const days = current.activeWeekdays;
    return { ...current, activeWeekdays: days.includes(day)
      ? days.length === 1 ? days : days.filter((value) => value !== day)
      : [...days, day].sort((a, b) => a - b) };
  });
  const preview = { ...draft, hour: draft.timed ? Number(draft.hour) : null };
  return <dialog ref={dialogRef} className="dap-editor" aria-labelledby={id + "-title"}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <PanelArt bronze />
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!draft.name.trim()) { setError("Give your anchor a name."); return; }
      if (!Number.isFinite(Number(draft.xpPerDay)) || Number(draft.xpPerDay) < 1) {
        setError("Choose at least 1 XP per completion."); return;
      }
      onSave({
        name: draft.name.trim(), emoji: draft.emoji.trim() || "⭐",
        category: draft.category.trim() || "General",
        xpPerDay: Number(draft.xpPerDay), activeWeekdays: draft.activeWeekdays,
        hour: draft.timed ? Number(draft.hour) : null,
      });
    }}>
      <header className="dap-editor-heading">
        <PixelAnchorSymbol /><div><h2 id={id + "-title"}>{anchor ? "EDIT ANCHOR" : "NEW ANCHOR"}</h2>
          <p>Shape a routine that fits your day.</p></div>
        <button type="button" className="dap-icon-button" aria-label="Close anchor editor" onClick={onClose}><UiIcon kind="close" /></button>
      </header>
      <div className="dap-editor-identity">
        <label className="dap-emoji-field" htmlFor={id + "-emoji"}>
          <span>Icon</span>
          <input id={id + "-emoji"} value={draft.emoji} maxLength={24} onChange={(event) => patch("emoji", event.target.value)} />
        </label>
        <label htmlFor={id + "-name"}>Anchor name
          <input id={id + "-name"} value={draft.name} maxLength={160} required placeholder="e.g. Morning walk"
            onChange={(event) => patch("name", event.target.value)} />
        </label>
      </div>
      <div className="dap-emoji-choices" role="group" aria-label="Choose an anchor icon">
        {["🏋️", "🇫🇷", "💻", "📖", "🌙", "🪥", "🌱", "⭐"].map((emoji) =>
          <button type="button" key={emoji} aria-label={"Use " + emoji + " icon"} aria-pressed={draft.emoji === emoji}
            onClick={() => patch("emoji", emoji)}><AnchorPicture anchor={{ name: "", emoji }} /></button>)}
      </div>
      <div className="dap-editor-two">
        <label htmlFor={id + "-category"}>Category
          <input id={id + "-category"} value={draft.category} maxLength={80} placeholder="Write your own"
            onChange={(event) => patch("category", event.target.value)} />
        </label>
        <label htmlFor={id + "-xp"}>XP per completion
          <input id={id + "-xp"} type="number" inputMode="numeric" min="1" step="1" required value={draft.xpPerDay}
            onChange={(event) => patch("xpPerDay", event.target.value)} />
        </label>
      </div>
      <fieldset className="dap-editor-section">
        <legend>SCHEDULE</legend>
        <div className="dap-schedule-mode" role="group" aria-label="Schedule type">
          <button type="button" aria-pressed={draft.timed} onClick={() => patch("timed", true)}><UiIcon kind="clock" />At a time</button>
          <button type="button" aria-pressed={!draft.timed} onClick={() => patch("timed", false)}><span aria-hidden="true">☾</span>Anytime</button>
        </div>
        {draft.timed ? <label className="dap-time-select" htmlFor={id + "-hour"}>
          <span className="dap-sr-only">Anchor time</span>
          <select id={id + "-hour"} value={draft.hour} onChange={(event) => patch("hour", event.target.value)}>
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{anchorTimeLabel(hour)}</option>)}
          </select><small>Shown on your daily clock</small>
        </label> : <p className="dap-field-note">Complete it whenever it fits your day.</p>}
      </fieldset>
      <fieldset className="dap-editor-section">
        <legend>REPEAT ON</legend>
        <div className="dap-repeat-days">
          {ANCHOR_WEEKDAYS.map((day) => <button type="button" key={day.value} aria-label={day.full}
            aria-pressed={draft.activeWeekdays.includes(day.value)}
            onClick={() => toggleDay(day.value)}>
            <CheckArt done={draft.activeWeekdays.includes(day.value)} /><span>{day.label}</span>
          </button>)}
        </div>
        <p className="dap-field-note">{draft.activeWeekdays.length} {draft.activeWeekdays.length === 1 ? "day" : "days"} a week · choose at least one</p>
      </fieldset>
      <div className="dap-editor-preview">
        <PanelArt /><AnchorPicture anchor={preview} /><div><strong>{draft.name.trim() || "Your new anchor"}</strong>
          <small>{anchorTimeLabel(preview.hour)} · {draft.category.trim() || "General"}</small></div>
        <span>+{draft.xpPerDay || 0} XP</span>
      </div>
      {error && <p className="dap-form-error" role="alert">{error}</p>}
      <button className="dap-wood-button dap-save" type="submit"><WoodArt /><span>{anchor ? "Save changes" : "Add anchor"}</span></button>
      <button className="dap-cancel-button" type="button" onClick={onClose}>Cancel</button>
      {anchor && <button ref={deleteRef} className="dap-delete-button" type="button"
        onClick={() => onDelete(anchor.id)}><UiIcon kind="trash" />Delete anchor</button>}
    </form>
  </dialog>;
}

export default function DailyAnchorsPage({
  anchors, todayStr, now, resetHour = 0, voyageAdjustments = {},
  onToggle, onAdd, onUpdate, onDelete, categoryColor,
}) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [editor, setEditor] = useState(null);
  const dateStr = selectedDate || todayStr;
  const days = anchorWeek(dateStr);
  const adjustment = voyageAdjustments[dateStr];
  const harbor = adjustment?.mode === "harbor";
  const items = anchorPageItems(anchors, { dateStr, todayStr, now, resetHour, adjustment });
  const editorVisible = editor && (!editor.anchor || anchors.some((anchor) => anchor.id === editor.anchor.id));
  const openEditor = (anchor, deleteIntent = false) => setEditor({ anchor, deleteIntent });
  const weekLabel = anchorDate(days[0]).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    + " – " + anchorDate(days[6]).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return <div className={"dap-page" + (harbor ? " is-harbor" : "")}>
    <header className="dap-hero">
      <img className="dap-hero-art" src={ART + "harbor-hero.webp"} width="1942" height="809" alt="" fetchPriority="high" />
      <div className="dap-date-plaque"><WoodArt /><time dateTime={todayStr}>{dateLabel(todayStr).toUpperCase()}</time></div>
      <div className="dap-hero-copy">
        <PixelAnchorSymbol />
        <div><h1>DAILY ANCHORS</h1><p>Your routines, your rhythm.</p></div>
      </div>
    </header>
    <div className="dap-body">
      {harbor && <p className="dap-harbor-note"><UiIcon kind="pause" />Day stopped. Your kept anchors remain available.</p>}
      <AnchorsClock items={items} dateStr={dateStr} todayStr={todayStr} now={now} resetHour={resetHour}
        onDateChange={setSelectedDate} onToggle={onToggle} harbor={harbor} />
      <section className="dap-routines" aria-labelledby="dap-routines-title">
        <header className="dap-list-heading">
          <div><h2 id="dap-routines-title">YOUR ANCHORS</h2><p>{weekLabel}</p></div>
          <button className="dap-wood-button" type="button" onClick={() => openEditor(null)}>
            <WoodArt /><span><UiIcon kind="plus" />New Anchor</span>
          </button>
        </header>
        <div className="dap-routine-list">
          {items.map((item) => <AnchorRoutineCard key={item.id} item={item} dateStr={dateStr} todayStr={todayStr}
            days={days} adjustments={voyageAdjustments} onToggle={onToggle} onEdit={openEditor}
            categoryColor={categoryColor} />)}
          {!items.length && <div className="dap-empty">
            <PanelArt /><PixelAnchorSymbol /><h3>Start with one small anchor.</h3>
            <p>A routine you can return to, one day at a time.</p>
            <button type="button" className="dap-wood-button" onClick={() => openEditor(null)}>
              <WoodArt /><span><UiIcon kind="plus" />Create your first anchor</span>
            </button>
          </div>}
        </div>
      </section>
      <footer className="dap-quote"><PanelArt /><span aria-hidden="true">✦</span><p>Small steps. Steady roots.</p><span aria-hidden="true">🌱</span></footer>
    </div>
    {editorVisible && <AnchorEditor key={editor.anchor?.id || "new"} anchor={editor.anchor}
      deleteIntent={editor.deleteIntent} onClose={() => setEditor(null)} onDelete={onDelete}
      onSave={(changes) => {
        if (editor.anchor) onUpdate(editor.anchor.id, changes); else onAdd(changes);
        setEditor(null);
      }} />}
  </div>;
}
