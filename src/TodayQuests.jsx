import { useId } from "react";
import { PixelTaskIcon } from "./DailyAnchors";
import "./today-quests.css";

function QuestPanelArtwork() {
  const picture = <image href="/today-quests/panel-v1.webp" width="1306" height="1204" />;
  return (
    <svg className="qd-today-quests-frame" viewBox="0 0 510 470" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <svg width="510" height="65" viewBox="30 61 1248 195" preserveAspectRatio="none" overflow="hidden">{picture}</svg>
      <svg y="65" width="510" height="405" viewBox="30 256 1248 890" preserveAspectRatio="none" overflow="hidden">{picture}</svg>
    </svg>
  );
}

export default function TodayQuests({ items, onToggle, expanded = false }) {
  const headingId = useId();
  return (
    <section className={`qd-today-quests${expanded ? " is-expanded" : ""}`} aria-labelledby={headingId}>
      {!expanded && <QuestPanelArtwork />}
      <h2 className="qd-anchor-sr-only" id={headingId}>Today’s Quests</h2>
      {!expanded && (
        <a className="qd-today-quests-view-all" href="#today-quests" aria-label="View all today's quests">
          <span className="qd-anchor-sr-only">View All</span>
        </a>
      )}
      <div className="qd-today-quests-body" tabIndex={!expanded && items.length > 5 ? 0 : undefined} role={!expanded && items.length > 5 ? "region" : undefined} aria-label={!expanded && items.length > 5 ? "Today's tasks, scroll for more" : undefined}>
        {items.length ? (
          <ul className="qd-today-quests-list">
            {items.map((item) => (
              <li className={`qd-quest-row${item.done ? " is-complete" : ""}${item.paused && !item.done ? " is-paused" : ""}`} key={item.key}>
                <button
                  className="qd-quest-row-toggle"
                  type="button"
                  aria-pressed={!!item.done}
                  aria-label={`${item.name}, ${item.detail}, ${item.xp} XP. ${item.done ? "Mark incomplete" : "Mark complete"}`}
                  title={`${item.name} · ${item.detail} · +${item.xp} XP`}
                  onClick={() => onToggle(item)}
                >
                  <svg className="qd-quest-row-check" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
                    <path className="qd-quest-check-box" d="M3 1H27L29 3V27L27 29H3L1 27V3Z" />
                    {item.done && <path className="qd-quest-check-tick" d="M7 15L12 20L23 8" />}
                  </svg>
                  <PixelTaskIcon anchor={item} variant="quest" />
                  <span className="qd-quest-row-copy">
                    <span className="qd-quest-row-name">{item.name}</span>
                    <span className="qd-quest-row-detail">{item.detail}</span>
                  </span>
                  <span className="qd-quest-row-xp" style={{ "--xp-fit": Math.min(1, 7 / (String(item.xp).length + 4)) }}>+{item.xp} XP</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="qd-today-quests-empty">A little room to breathe.<span>No tasks scheduled today.</span></p>
        )}
      </div>
    </section>
  );
}
