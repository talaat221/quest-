import { useId } from "react";
import { getAnchorIcon, getDailyAnchorTimeline } from "./daily-anchors";
import "./daily-anchors.css";

export function PixelAnchorSymbol({ className }) {
  return (
    <svg className={className} viewBox="0 0 28 32" fill="none" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d="M11 1H17V3H19V9H17V11H16V15H21V18H16V27H19V25H22V22H20V20H27V27H25V25H24V28H20V30H16V32H12V30H8V28H4V25H3V27H1V20H8V22H6V25H9V27H12V18H7V15H12V11H11V9H9V3H11Z" fill="#8b4c2b" />
      <path d="M12 1H16V3H18V8H16V10H15V16H21V18H15V28H18V26H21V24H23V22H21V20H27V26H25V24H24V27H20V29H16V31H12V29H8V27H4V24H3V26H1V20H7V22H5V24H7V26H10V28H13V18H7V16H13V10H11V8H10V3H12Z" fill="#ffbb61" />
      <path d="M12 4H16V7H12Z" fill="#0a2134" />
      <path d="M12 2H16V3H12ZM13 11H14V16H13ZM8 16H12V17H8ZM3 21H5V22H3Z" fill="#ffe2a0" />
    </svg>
  );
}

function PixelTaskIcon({ anchor }) {
  const kind = getAnchorIcon(anchor);
  let artwork;

  if (kind === "gym") {
    artwork = <>
      <path d="M2 12H5V7H10V13H22V7H27V12H30V21H27V26H22V20H10V26H5V21H2Z" fill="#051b20" />
      <path d="M10 15H22V18H10Z" fill="#88ad7a" />
      <path d="M10 15H22V16H10Z" fill="#d1e8aa" />
      <path d="M5 8H9V24H5ZM23 8H27V24H23ZM2 13H5V20H2ZM27 13H30V20H27Z" fill="#528d35" />
      <path d="M6 8H8V21H6ZM24 8H26V21H24ZM2 13H3V18H2ZM28 13H29V18H28Z" fill="#a1d756" />
      <path d="M6 7H8V10H6ZM24 7H26V10H24ZM4 14H5V19H4ZM27 14H28V19H27Z" fill="#c9ef81" />
      <path d="M8 22H10V25H8ZM25 22H27V25H25Z" fill="#35633c" />
    </>;
  } else if (kind === "purple-book" || kind === "blue-book") {
    const purple = kind === "purple-book";
    artwork = <>
      <path d="M3 8H5V6H13V7H19V6H27V8H29V26H18V28H14V26H3Z" fill="#061528" />
      <path d="M4 10H6V8H14L16 10L18 8H26V10H28V25H18L16 27L14 25H4Z" fill={purple ? "#766797" : "#4f719f"} />
      <path d="M6 7H13V8H15V23H13V22H6ZM18 8H20V7H26V22H19V23H17V9H18Z" fill={purple ? "#c6a4cf" : "#a1c5e5"} />
      <path d="M7 8H12V9H7ZM20 8H25V9H20Z" fill={purple ? "#ead0e4" : "#d0e9f3"} />
      <path d="M8 12H12V14H8ZM8 16H12V18H8ZM20 12H24V14H20ZM20 16H24V18H20Z" fill={purple ? "#78648d" : "#5a7da5"} />
      <path d="M15 10H17V25H15ZM5 24H13V25H5ZM19 24H27V25H19Z" fill={purple ? "#574c77" : "#345176"} />
    </>;
  } else if (kind === "laptop") {
    artwork = <>
      <path d="M5 3H27V25H30V29H2V25H5Z" fill="#04101f" />
      <path d="M6 4H26V24H6Z" fill="#507eb1" />
      <path d="M7 5H25V6H7ZM7 6H8V22H7Z" fill="#c6e7ff" />
      <path d="M9 7H24V21H9Z" fill="#020e20" />
      <path d="M10 8H23V10H10Z" fill="#102c4a" />
      <path d="M6 24H26V26H29V28H3V26H6Z" fill="#6185b0" />
      <path d="M7 24H25V25H7ZM4 26H11V27H4ZM20 26H28V27H20Z" fill="#b0d3ef" />
      <path d="M12 25H20V27H12ZM6 28H27V29H6Z" fill="#2c4d78" />
    </>;
  } else if (kind === "camera") {
    artwork = <>
      <path d="M4 11H7V8H12V10H18V7H26V11H29V26H3V11Z" fill="#071523" />
      <path d="M4 12H28V25H4Z" fill="#626579" />
      <path d="M7 8H11V11H7ZM19 8H25V12H19Z" fill="#9397a5" />
      <path d="M8 9H10V10H8ZM20 9H24V11H20Z" fill="#222e44" />
      <path d="M5 13H8V24H5ZM10 12H13V24H10Z" fill="#b2afbb" />
      <path d="M16 12H23V14H26V22H23V24H16V22H13V15H16Z" fill="#152335" />
      <path d="M17 14H22V15H24V21H22V22H17V21H15V16H17Z" fill="#909cad" />
      <path d="M18 15H21V16H23V20H21V21H18V20H17V17H18Z" fill="#203954" />
      <path d="M18 16H20V18H18ZM25 13H27V15H25Z" fill="#badbe8" />
      <path d="M5 25H28V27H5Z" fill="#30364c" />
    </>;
  } else if (kind === "moon") {
    artwork = <>
      <path d="M16 3H20V6H17V10H16V15H18V19H22V21H27V24H24V27H19V29H12V27H8V24H5V19H4V13H6V9H9V6H13V4H16Z" fill="#9e7953" />
      <path d="M16 3H19V5H16V10H15V16H18V20H22V22H27V24H23V26H18V27H12V25H8V22H6V18H5V13H7V9H10V6H14V4H16Z" fill="#e8bd7d" />
      <path d="M14 5H16V8H13V12H11V18H9V14H10V10H12V7H14Z" fill="#f9dca0" />
      <path d="M8 20H10V23H13V25H18V26H12V24H9V22H8Z" fill="#cba16e" />
      <path d="M24 5H25V7H24ZM28 10H29V12H28ZM23 14H24V15H23Z" fill="#e4b876" />
    </>;
  } else if (kind === "toothbrush") {
    artwork = <>
      <path d="M5 25H8V21H11V18H14V14H17V11H20V7H24V4H29V10H26V13H22V16H19V20H15V24H12V28H8V30H5Z" fill="#07192c" />
      <path d="M6 25H9V21H12V18H15V14H18V11H21V8H24V11H22V14H19V18H16V22H13V26H10V29H6Z" fill="#469cbd" />
      <path d="M6 26H8V23H11V20H14V16H17V13H20V10H22V12H20V15H18V18H15V22H12V25H9V28H6Z" fill="#8adddf" />
      <path d="M21 7H24V4H28V9H25V12H22Z" fill="#c4e7e6" />
      <path d="M24 5H25V9H24ZM27 4H28V7H27Z" fill="#f4f4d7" />
      <path d="M25 9H28V10H25ZM22 11H25V12H22Z" fill="#649caf" />
    </>;
  } else {
    return <span className="qd-daily-anchor-custom-icon" aria-hidden="true">{anchor.emoji || "🌱"}</span>;
  }

  return <svg className="qd-daily-anchor-art" viewBox="0 0 32 32" aria-hidden="true" focusable="false" shapeRendering="crispEdges">{artwork}</svg>;
}

const statusLabels = { done: "Completed", paused: "Paused today", next: "Next up", pending: "Not completed" };

// Two viewports place the generated artwork at the reference's exact card
// proportions. The header ends at 65/287; the body remains free for live data.
function AnchorsPanelArtwork() {
  const picture = <image href="/daily-anchors/panel-v1.webp" width="2089" height="753" />;
  return (
    <svg className="qd-daily-anchors-frame" viewBox="0 0 795 287" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <svg width="795" height="65" viewBox="20 63 2050 173" preserveAspectRatio="none" overflow="hidden">{picture}</svg>
      <svg y="65" width="795" height="222" viewBox="20 236 2050 433" preserveAspectRatio="none" overflow="hidden">{picture}</svg>
    </svg>
  );
}

export default function DailyAnchors({ anchors, resetHour = 0 }) {
  const headingId = useId();
  const items = getDailyAnchorTimeline(anchors, resetHour);
  return (
    <section className="qd-daily-anchors" aria-labelledby={headingId}>
      <AnchorsPanelArtwork />
      <h2 className="qd-anchor-sr-only" id={headingId}>Today’s Anchors</h2>
      <a className="qd-daily-anchors-view-all" href="#anchors" aria-label="View all daily anchors">
        <span className="qd-anchor-sr-only">View All</span>
      </a>
      {items.length ? (
        <div className="qd-daily-anchors-scroll" tabIndex={items.length > 6 ? 0 : undefined} role={items.length > 6 ? "region" : undefined} aria-label={items.length > 6 ? "Today's anchors, scroll horizontally for more" : undefined}>
          <ol className="qd-daily-anchors-timeline" style={{ "--visible-anchors": Math.min(items.length, 6) }}>
            {items.map((anchor) => (
              <li className={`qd-daily-anchor is-${anchor.status}`} key={anchor.id}>
                <span className="qd-daily-anchor-time">{anchor.timeLabel}</span>
                <PixelTaskIcon anchor={anchor} />
                <span className="qd-daily-anchor-line" aria-hidden="true"><span className="qd-daily-anchor-node" /></span>
                <span className="qd-daily-anchor-name" title={anchor.name}>{anchor.name}</span>
                <span className="qd-daily-anchor-status" role="img" aria-label={statusLabels[anchor.status]} title={statusLabels[anchor.status]}>
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <circle cx="10" cy="10" r="8" />
                    {anchor.status === "done" && <path d="M5.5 10L8.5 13L14.5 6.5" />}
                    {anchor.status === "paused" && <path d="M7.5 6.5V13.5M12.5 6.5V13.5" />}
                  </svg>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="qd-daily-anchors-empty">No anchors scheduled today.<br /><span>A little room to breathe.</span></p>
      )}
    </section>
  );
}
