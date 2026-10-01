import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildStatsModel, getStatsPeriod, getComparisonPeriod, summarizeStats, statsChartRows,
  periodLabel, metricOf, rateOf, graphScale } from "./stats-data.js";
import "./stats-page.css";

const ASSET = "/stats-page/";
const EMPTY_ITEMS = [];
const EMPTY_ADJUSTMENTS = {};
const number = value => Number(value).toLocaleString("en-GB", { maximumFractionDigits: 1 });
const valueLabel = (value, metric) => value === null || value === undefined ? "—"
  : metric === "rate" ? `${Math.round(value)}%` : number(value);
const metricName = { tasks: "Tasks completed", xp: "XP earned", rate: "Completion rate" };

function PanelArt({ bronze = false }) {
  return <span aria-hidden="true" className={`qsp-panel-art${bronze ? " qsp-bronze" : ""}`} />;
}
function Sprite({ type, className = "" }) {
  const index = { completed: 0, xp: 1, rate: 2, average: 3, streak: 4, best: 5 }[type] ?? 0;
  return <svg className={`qsp-sprite ${className}`} viewBox={`${index % 3 * 512 + 45} ${Math.floor(index / 3) * 512 + 45} 422 422`} aria-hidden="true" focusable="false">
    <image href={ASSET + "stat-icons.webp"} width="1536" height="1024" />
  </svg>;
}
function Icon({ name }) {
  const paths = {
    bars: <path d="M3 12h5v15H3zm9-8h5v23h-5zm9 5h5v18h-5z" fill="currentColor" />,
    line: <path d="m3 24 7-9 6 4L27 6m-7 0h7v7" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    left: <path d="m19 5-10 10 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    right: <path d="m10 5 10 10-10 10" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    close: <path d="m7 7 16 16M23 7 7 23" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    search: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m18 18 9 9" stroke="currentColor" strokeWidth="2.5" /></>,
  };
  return <svg viewBox="0 0 30 30" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
function Segments({ label, value, options, onChange }) {
  return <div className="qsp-segments" role="group" aria-label={label}>
    {options.map(([key, text]) => <button key={key} type="button" aria-pressed={key === value} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}
function StatCard({ type, label, value, detail }) {
  return <div className="qsp-stat"><PanelArt /><Sprite type={type} /><div><dt>{label}</dt><dd>{value}</dd><small>{detail}</small></div></div>;
}

function ChooseItems({ items, scope, selected, onApply, onClose }) {
  const dialog = useRef(null), title = useId(), searchId = useId();
  const [mode, setMode] = useState(scope);
  const [chosen, setChosen] = useState(() => new Set(scope === "all" ? items.map(item => item.key) : selected));
  const [search, setSearch] = useState("");
  useEffect(() => {
    const opener = document.activeElement, previousOverflow = document.body.style.overflow;
    dialog.current.showModal(); document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; if (opener?.isConnected) opener.focus(); };
  }, []);
  const visible = items.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase().trim()));
  const count = items.filter(item => chosen.has(item.key)).length;
  const toggle = key => setChosen(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  return <dialog className="qsp-picker" ref={dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="qsp-picker-content"><PanelArt bronze />
      <header className="qsp-picker-heading"><h2 id={title}>CHOOSE ITEMS</h2><button type="button" className="qsp-icon-button" aria-label="Close item selection" onClick={onClose}><Icon name="close" /></button></header>
      <p>Choose what appears in your graph.</p>
      <Segments label="Selection scope" value={mode} options={[["all", "All items"], ["specific", "Specific items"]]} onChange={value => { setMode(value); if (value === "all") setChosen(new Set(items.map(item => item.key))); }} />
      <label className="qsp-search" htmlFor={searchId}><Icon name="search" /><span className="qsp-sr-only">Find an anchor or quest</span><input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an anchor or quest" /></label>
      <div className="qsp-picker-count"><span>{mode === "all" ? `All ${items.length} items` : `${count} selected`}</span><button type="button" onClick={() => { setMode("specific"); setChosen(new Set()); }}>Clear</button></div>
      <div className="qsp-picker-list">
        {["anchor", "quest"].map(source => {
          const group = visible.filter(item => item.source === source);
          if (!group.length) return null;
          const allChecked = group.every(item => chosen.has(item.key));
          return <section key={source} aria-label={source === "anchor" ? "Daily anchors" : "Quests"}>
            <div className="qsp-picker-group-title"><h3>{source === "anchor" ? "⚓ DAILY ANCHORS" : "▤ QUESTS"}</h3><button type="button" onClick={() => {
              setMode("specific"); setChosen(previous => { const next = new Set(previous); group.forEach(item => allChecked ? next.delete(item.key) : next.add(item.key)); return next; });
            }}>{allChecked && mode === "specific" ? "Deselect" : search ? "Select shown" : "Select all"}</button></div>
            {group.map(item => <label key={item.key} className={`qsp-pick-row qsp-source-${source}`}>
              <span className="qsp-pick-emoji" aria-hidden="true">{item.emoji}</span><span className="qsp-pick-name">{item.name}<small>{item.category}</small></span>
              <input type="checkbox" aria-label={`Include ${item.name}`} checked={mode === "all" || chosen.has(item.key)} onChange={() => {
                if (mode === "all") setChosen(new Set(items.filter(candidate => candidate.key !== item.key).map(candidate => candidate.key)));
                else toggle(item.key);
                setMode("specific");
              }} />
            </label>)}
          </section>;
        })}
        {!visible.length && <p className="qsp-empty">{items.length ? "No matching anchors or quests." : "Your anchors and quests will appear here."}</p>}
      </div>
      <footer className="qsp-picker-footer"><p>Time range and metric stay the same.</p>
        <button type="button" className="qsp-wood-button" onClick={() => onApply(mode, mode === "all" ? [] : items.filter(item => chosen.has(item.key)).map(item => item.key))}>
          <svg className="qsp-wood-art" viewBox="40 108 2092 504" preserveAspectRatio="none" aria-hidden="true"><image href={ASSET + "wood-plaque.webp"} width="2172" height="724" /></svg>
          {mode === "all" ? "Show all items" : "Show selected"}
        </button><button type="button" className="qsp-cancel" onClick={onClose}>Cancel</button>
      </footer>
    </div>
  </dialog>;
}

function pathFor(rows, key, x, y) {
  let started = false;
  return rows.map((row, index) => {
    if (row.future || row[key] === null || row[key] === undefined) { started = false; return ""; }
    const command = started ? "L" : "M"; started = true;
    return `${command}${x(index)},${y(row[key])}`;
  }).join(" ");
}

function ProgressGraph({ rows, previous, metric, style, grouping, sources, compare }) {
  const titleId = useId(), descId = useId();
  const [selectedKey, setSelectedKey] = useState(null);
  const picked = rows.find(row => row.key === selectedKey && !row.future);
  const width = Math.max(660, rows.length * (grouping === "item" ? 94 : 54) + 64), height = 296;
  const left = 42, right = 16, top = 20, bottom = 57, floor = height - bottom;
  const step = (width - left - right) / Math.max(1, rows.length), barWidth = Math.min(54, step * .61);
  const scale = graphScale(rows, metric, style, compare ? previous : []);
  const x = index => left + step * (index + .5), y = value => floor - value / scale * (floor - top);
  const colors = { anchor: "#6bbf57", quest: "#58ade6" };
  const previousRows = rows.map((row, index) => grouping === "item"
    ? previous.find(point => point.key === row.key) || { combined: null }
    : previous[index] || { combined: null });
  const activate = row => { if (!row.future) setSelectedKey(current => current === row.key ? null : row.key); };
  return <>
    <div className="qsp-graph-scroll" tabIndex={0} role="region" aria-label="Scrollable progress graph">
      <svg className="qsp-graph" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: rows.length > 8 ? `${Math.min(width, rows.length * 51 + 40)}px` : undefined }} role="group" aria-labelledby={titleId} aria-describedby={descId}>
        <title id={titleId}>{metricName[metric]} {grouping === "item" ? "by anchor or quest" : "over time"}</title>
        <desc id={descId}>Green is daily anchors. Blue is quest tasks. Select a bar or point for exact values. Future dates have no values. A data table is available below.</desc>
        {Array.from({ length: 5 }, (_, index) => {
          const value = scale * index / 4;
          return <g key={index} className="qsp-gridline"><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text x={left - 7} y={y(value) + 5} textAnchor="end">{valueLabel(value, metric)}</text></g>;
        })}
        {rows.map((row, index) => <g key={row.key} className={row.future ? "qsp-future" : ""}>
          {style === "bars" && (row.future ? <rect x={x(index) - barWidth / 2} y={top + 22} width={barWidth} height={floor - top - 22} fill="none" stroke="#31506a" strokeDasharray="5 6" />
            : sources.map((source, s) => {
              const value = row[source]; if (value === null || value === undefined) return null;
              const rate = metric === "rate", w = rate ? barWidth / Math.max(sources.length, 1) : barWidth;
              const offset = !rate && source === "quest" ? row.anchor || 0 : 0;
              const h = value / scale * (floor - top), barX = x(index) - barWidth / 2 + (rate ? s * w : 0);
              return <g key={source}><rect x={barX} y={y(value + offset)} width={w - (rate && sources.length > 1 ? 2 : 0)} height={Math.max(0, h)} fill={colors[source]} />
                {value > 0 && <path d={`M${barX} ${y(value + offset) + 1}h${w - (rate && sources.length > 1 ? 2 : 0)}`} stroke={source === "anchor" ? "#c7ee95" : "#bce3ff"} strokeWidth="2" />}</g>;
            }))}
          <text className="qsp-axis-label" x={x(index)} y={floor + 24} textAnchor="middle">{row.label.length > 13 ? `${row.label.slice(0, 11)}…` : row.label}</text>
        </g>)}
        {style === "line" && sources.map(source => <g key={source}><path d={pathFor(rows, source, x, y)} fill="none" stroke={colors[source]} strokeWidth="3" />
          {rows.map((row, index) => !row.future && row[source] !== null && row[source] !== undefined && <rect key={row.key} x={x(index) - 3} y={y(row[source]) - 3} width="6" height="6" fill={colors[source]} />)}
        </g>)}
        {compare && <path className="qsp-previous-line" d={pathFor(previousRows, "combined", x, y)} fill="none" stroke="#e4be80" strokeWidth="2" strokeDasharray="6 5" />}
        {rows.map((row, index) => !row.future && <g key={row.key} role="button" tabIndex={0} aria-label={`${row.fullLabel}: ${valueLabel(row.combined, metric)} ${metric === "tasks" ? "tasks" : metric === "xp" ? "XP" : "completion"}. Show detail.`}
          aria-pressed={selectedKey === row.key} className="qsp-point-hit" onClick={() => activate(row)} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); activate(row); } }}>
          <rect x={x(index) - step / 2 + 2} y={top} width={Math.max(1, step - 4)} height={floor - top + 29} fill="transparent" stroke={selectedKey === row.key ? "#f5d28b" : "transparent"} />
        </g>)}
      </svg>
    </div>
    <div className="qsp-legend" aria-label="Graph legend">{sources.map(source => <span key={source}><i style={{ background: colors[source] }} />{source === "anchor" ? "Anchors" : "Quests"}</span>)}{compare && <span><i className="qsp-compare-key" />Previous total</span>}</div>
    {picked ? <div className="qsp-point-detail" role="status"><strong>{picked.fullLabel}</strong><span>{number(picked.counts.completed)} completed · {number(picked.counts.xp)} XP · {valueLabel(rateOf(picked.counts), "rate")}</span></div>
      : <p className="qsp-graph-hint">{rows.length > 8 ? "Swipe the graph · " : ""}Tap a {style === "bars" ? "bar" : "point"} for details.</p>}
    <details className="qsp-data-table"><summary>View numbers</summary><div tabIndex={0} role="region" aria-label="Graph data table"><table>
      <caption>{metricName[metric]}</caption><thead><tr><th scope="col">{grouping === "item" ? "Item" : "Date"}</th>{sources.map(source => <th scope="col" key={source}>{source === "anchor" ? "Anchors" : "Quests"}</th>)}<th scope="col">Total</th>{compare && <th scope="col">Previous</th>}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.key}><th scope="row">{row.fullLabel}</th>{sources.map(source => <td key={source}>{valueLabel(row[source], metric)}</td>)}<td>{valueLabel(row.combined, metric)}</td>{compare && <td>{valueLabel(previousRows[index]?.combined, metric)}</td>}</tr>)}</tbody>
    </table></div></details>
  </>;
}

export default function StatsPage({ anchors = EMPTY_ITEMS, domains = EMPTY_ITEMS, todayStr, resetHour = 0, voyageAdjustments = EMPTY_ADJUSTMENTS }) {
  const headingId = useId(), progressId = useId();
  const [period, setPeriod] = useState("week"), [offset, setOffset] = useState(0);
  const [metric, setMetric] = useState("tasks"), [style, setStyle] = useState("bars"), [grouping, setGrouping] = useState("day");
  const [sources, setSources] = useState(["anchor", "quest"]), [scope, setScope] = useState("all"), [selected, setSelected] = useState([]);
  const [compare, setCompare] = useState(false), [pickerOpen, setPickerOpen] = useState(false);
  const model = useMemo(() => buildStatsModel({ anchors, domains, todayStr, resetHour, voyageAdjustments }), [anchors, domains, todayStr, resetHour, voyageAdjustments]);
  const range = useMemo(() => getStatsPeriod(period, offset, todayStr, model.firstDay), [period, offset, todayStr, model.firstDay]);
  const filters = useMemo(() => ({ sources, scope, selected }), [sources, scope, selected]);
  const summary = useMemo(() => summarizeStats(model, range, filters), [model, range, filters]);
  const previousRange = useMemo(() => getComparisonPeriod(range, todayStr, model.firstDay), [range, todayStr, model.firstDay]);
  const previous = useMemo(() => previousRange ? summarizeStats(model, previousRange, filters) : null, [model, previousRange, filters]);
  const rows = useMemo(() => statsChartRows(summary, range, metric, grouping), [summary, range, metric, grouping]);
  const previousRows = useMemo(() => previous ? statsChartRows(previous, previousRange, metric, grouping) : [], [previous, previousRange, metric, grouping]);
  const compareActive = compare && period !== "all";
  const ratio = rateOf(summary.total), currentValue = metricOf(summary.total, metric), previousValue = previous ? metricOf(previous.total, metric) : null;
  const difference = currentValue !== null && previousValue !== null ? currentValue - previousValue : null;
  const updatePeriod = value => { setPeriod(value); setOffset(0); };
  const toggleSource = source => setSources(current => current.includes(source) ? current.filter(value => value !== source) : [...current, source]);
  const noItems = !summary.items.length;
  const hasHistory = model.events.length || model.undated.length;
  return <div className="qsp-page" aria-labelledby={headingId}>
    <header className="qsp-hero"><img src={ASSET + "observatory-hero.webp"} width="2172" height="724" alt="" fetchPriority="high" />
      <div className="qsp-hero-copy"><Icon name="bars" /><div><h1 id={headingId}>STATS</h1><p>See how far you’ve come.</p></div></div>
    </header>
    <div className="qsp-content">
      <section className="qsp-period" aria-label="Statistics time range"><PanelArt />
        <Segments label="Time range" value={period} options={[["today", "Today"], ["week", "Week"], ["month", "Month"], ["all", "All time"]]} onChange={updatePeriod} />
        <div className="qsp-period-nav"><button type="button" className="qsp-icon-button" aria-label="Previous period" disabled={period === "all"} onClick={() => setOffset(value => value - 1)}><Icon name="left" /></button>
          <span aria-live="polite">{periodLabel(range)}</span><button type="button" className="qsp-icon-button" aria-label="Next period" disabled={period === "all" || offset >= 0} onClick={() => setOffset(value => Math.min(0, value + 1))}><Icon name="right" /></button></div>
        {offset !== 0 && period !== "all" && <button type="button" className="qsp-back-current" onClick={() => setOffset(0)}>Back to {period === "today" ? "today" : `this ${period}`}</button>}
      </section>
      <dl className="qsp-summary" aria-label="Selected period statistics">
        <StatCard type="completed" label="Completed" value={`${number(summary.total.completed)} tasks`} detail={`of ${number(summary.total.planned)} available`} />
        <StatCard type="xp" label="XP earned" value={`+${number(summary.total.xp)}`} detail="Selected period" />
        <StatCard type="rate" label="Completion" value={valueLabel(ratio, "rate")} detail={summary.total.planned ? "Of available tasks" : "No tasks scheduled"} />
        <StatCard type="average" label="Daily average" value={summary.average === null ? "—" : number(summary.average)} detail="per elapsed day" />
      </dl>
      <section className="qsp-progress" aria-labelledby={progressId}><PanelArt />
        <header className="qsp-progress-heading"><h2 id={progressId}>YOUR PROGRESS</h2><div className="qsp-style-switch" role="group" aria-label="Chart style">
          {[["bars", "Bar chart"], ["line", "Line chart"]].map(([key, label]) => <button type="button" key={key} className="qsp-icon-button" aria-label={label} aria-pressed={style === key} onClick={() => setStyle(key)}><Icon name={key} /></button>)}
        </div></header>
        <Segments label="Graph metric" value={metric} options={[["tasks", "Tasks"], ["xp", "XP"], ["rate", "Rate"]]} onChange={setMetric} />
        <div className="qsp-source-controls">{["anchor", "quest"].map(source => <label key={source} className={`qsp-source-${source}`}><input type="checkbox" checked={sources.includes(source)} onChange={() => toggleSource(source)} />{source === "anchor" ? "Anchors" : "Quests"}</label>)}</div>
        <div className="qsp-scope"><span>{scope === "all" ? "All items" : `${summary.items.length} selected`}</span><button type="button" onClick={() => setPickerOpen(true)}>Choose items <Icon name="right" /></button></div>
        <div className="qsp-grouping"><Segments label="Group graph" value={grouping} options={[["day", "By day"], ["item", "By item"]]} onChange={setGrouping} /></div>
        {noItems ? <div className="qsp-empty"><Sprite type="average" /><strong>{model.items.length ? "Choose something to explore" : "Your progress starts here"}</strong><p>{model.items.length ? "Select Anchors, Quests, or specific items above." : "Add an anchor or a quest, then complete your first task."}</p>{!model.items.length && <a href="#anchors">Go to Daily Anchors ›</a>}</div>
          : <ProgressGraph key={`${period}:${offset}:${grouping}:${metric}:${sources.join()}:${selected.join()}:${scope}`} rows={rows} previous={previousRows} metric={metric} style={style} grouping={grouping} sources={sources} compare={compareActive} />}
        <label className="qsp-compare-control"><input type="checkbox" checked={compareActive} disabled={period === "all" || noItems} onChange={event => setCompare(event.target.checked)} />Compare with previous {period === "today" ? "day" : period === "all" ? "period" : period}</label>
        {period === "all" && <p className="qsp-graph-hint">Choose a day, week or month to compare periods.</p>}
        {compareActive && !noItems && <p className="qsp-comparison" role="status">{difference === null ? "Not enough scheduled data to compare." : `${difference > 0 ? "+" : ""}${valueLabel(difference, metric === "rate" ? "tasks" : metric)}${metric === "rate" ? " percentage points" : metric === "xp" ? " XP" : " tasks"} vs ${periodLabel(previousRange)}`}{range.cutoff < range.end && <small>Compared over the same number of elapsed days.</small>}</p>}
        {period === "all" && range.days > 62 && grouping === "day" && <p className="qsp-graph-hint">Long histories are grouped by month.</p>}
      </section>
      <section className="qsp-consistency" aria-label="Overall consistency"><h2>YOUR CONSISTENCY</h2><p>Overall · independent of filters</p>
        <dl className="qsp-summary"><StatCard type="streak" label="Current streak" value={`${model.currentStreak} days`} detail="Keep your rhythm" /><StatCard type="best" label="Best streak" value={`${model.bestStreak} days`} detail="Your longest run" /></dl>
      </section>
      <details className="qsp-about"><summary>How your stats are counted</summary><p>Completed tasks count once on the day you finished them. Anchor check-offs count once per saved day. Your day starts at {String(resetHour).padStart(2, "0")}:00.</p>
        <p>Available tasks include completed work and unfinished work scheduled in the elapsed part of the period. Paused anchors and unprotected flexible tasks on stopped days are excluded. Future days are not counted.</p>
        <p>Past completion rates are estimates: older schedules and deleted records aren’t saved. Anchor history begins at the earliest known creation or check-off. XP uses each saved task’s current reward. No older history is invented.</p>
        <p>A streak is consecutive days with at least one completion. Yesterday’s streak stays open until today ends. Paused days without completions do not add to a streak.</p>
        <p>{hasHistory ? `Available records start ${model.firstDay}.` : "There are no saved completions yet."} {model.undated.length > 0 && `${model.undated.length} completions without a date appear only in All time, under No date.`}</p>
      </details>
      <footer className="qsp-note"><PanelArt /><Sprite type="xp" /><p>Small steps. Lasting progress.</p><Sprite type="average" /></footer>
    </div>
    {pickerOpen && <ChooseItems items={model.items} scope={scope} selected={selected} onClose={() => setPickerOpen(false)} onApply={(nextScope, keys) => {
      setScope(nextScope); setSelected(keys);
      setSources(nextScope === "all" ? ["anchor", "quest"] : [...new Set(model.items.filter(item => keys.includes(item.key)).map(item => item.source))]);
      setPickerOpen(false);
    }} />}
  </div>;
}
