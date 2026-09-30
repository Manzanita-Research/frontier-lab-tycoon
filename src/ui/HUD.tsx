import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StaffPanel, StaffTool } from "./ops/Staff";
import { useCompact } from "./useCompact";
import { BUILDINGS, PATH_PRICE } from "../content/buildings";
import { formatDate, formatMoney } from "../sim/format";
import { appNow, atoms, send } from "../app/game";
import { RACE_TOOLS, SPEEDS, TOOLS, type Tool } from "../app/hud";
import { useApp } from "../app/hooks";
import { EventCard } from "./EventCard";
import { ICONS } from "./icons";
import { Inspector } from "./Inspector";
import { Objectives } from "./Objectives";
import { OutcomeCard } from "./OutcomeCard";
import { Odometer } from "./juice/Odometer";
import { Thoughts } from "./Thoughts";
import { Vibes } from "./Vibes";
import { RacePanel } from "./race/RacePanel";
import { RaceStats } from "./race/RaceStats";

const toolName = (t: Tool) => (t === "path" ? "Path" : t === "bulldoze" ? "Bulldoze" : BUILDINGS[t].name);
const SHORT: Record<Tool, string> = { path: "Path", cluster: "Cluster", hall: "Training Hall", gateway: "Gateway", kombucha: "Kombucha", nap: "Nap Pods", snack: "Snack Wall", demo: "Demo Stage", datacenter: "Datacenter", gas: "Gas Turbine", solar: "Solar Farm", bulldoze: "Bulldoze" };
const toolPrice = (t: Tool) => (t === "path" ? PATH_PRICE : t === "bulldoze" ? 0 : BUILDINGS[t].price);

function TopBar() {
  const s = useApp(atoms.snap);
  const compact = useCompact();
  // On a phone the bar is one row (Vibes, cash, runway); a tap on the caret opens the rest.
  const [expanded, setExpanded] = useState(false);
  const runwayLow = s.runway !== null && s.runway < 6;
  return (
    <div className={`topbar panel ${compact ? "compact" : ""} ${compact && expanded ? "expanded" : ""}`}>
      <div className="lab">
        <div className="lab-name">{s.labName}</div>
        <div className="lab-date">{formatDate(s.day)}</div>
      </div>
      <Vibes />
      <div className="stat cash">
        <span className="label">Cash</span>
        <Odometer className={`value ${s.cash < 0 ? "bad" : ""}`} value={s.cash} format={formatMoney} />
        <Odometer className={`sub ${s.net >= 0 ? "good" : "bad"}`} value={s.net} format={(n) => `${n >= 0 ? "+" : "-"}${formatMoney(Math.abs(n))}/day`} flash={false} />
      </div>
      <div className="stat runway">
        <span className="label">Runway</span>
        <span className={`value ${runwayLow ? "bad" : ""}`}>{s.runway === null ? "∞" : `${s.runway.toFixed(1)} mo`}</span>
      </div>
      <div className="stat">
        <span className="label">Capability</span>
        <Odometer className="value" value={s.capability} />
      </div>
      <div className="stat hype">
        <span className="label">Hype</span>
        <Odometer className="value" value={s.hype} />
        <span className="meter">
          <span style={{ width: `${s.hype}%` }} />
        </span>
      </div>
      <RaceStats />
      {compact && (
        <button className="topbar-toggle" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? "Fewer stats" : "More stats"}>
          <span className={`caret ${expanded ? "open" : ""}`} aria-hidden />
        </button>
      )}
    </div>
  );
}

function TrainingChip() {
  const s = useApp(atoms.snap);
  if (!s.hasHall) {
    return (
      <div className="chip panel">
        <div className="chip-title">No Training Hall. Research is on hold.</div>
      </div>
    );
  }
  const pct = Math.floor(s.training.pct * 100);
  return (
    <div className="chip panel">
      <div className="chip-title">
        Training <b>{s.training.name}</b> · {pct}%
      </div>
      <div className="bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="chip-sub">{s.computePerDay > 0 ? `+${s.computePerDay} compute/day` : "No compute! Build a Compute Cluster."}</div>
    </div>
  );
}

function SpeedControl() {
  const speed = useApp(atoms.speed);
  return (
    <div className="speed panel" role="group" aria-label="Game speed">
      {SPEEDS.map((v) => (
        <button key={v} className={speed === v ? "on" : ""} onClick={() => send({ type: "SET_SPEED", speed: v })} aria-label={v === 0 ? "Pause" : `${v}x speed`}>
          {v === 0 ? <span className="pause-icon"><i /><i /></span> : `${v}×`}
        </button>
      ))}
    </div>
  );
}

function BuildBar() {
  const tool = useApp(atoms.tool);
  const cash = useApp(atoms.cash);
  const race = useApp(atoms.race);
  const blurb = tool && tool !== "path" && tool !== "bulldoze" ? BUILDINGS[tool] : null;
  // The core tools, then whatever a compute auction has unlocked, then the bulldozer at the end as always.
  const palette: Tool[] = [...TOOLS.filter((t) => t !== "bulldoze"), ...RACE_TOOLS.filter((t) => t !== "bulldoze" && t !== "path" && race.unlocked.includes(t)), "bulldoze"];
  return (
    <div className="buildwrap">
      {(blurb || tool === "path" || tool === "bulldoze") && (
        <div className="tip panel">
          {blurb ? (
            <>
              <b>{blurb.name}</b> · {blurb.blurb} <span className="dim">Upkeep {formatMoney(blurb.upkeepPerDay)}/day. Needs a path beside it.</span>
            </>
          ) : tool === "path" ? (
            <>
              <b>Path</b> · Drag to lay paths. Buildings need one beside them or nobody visits. <span className="dim">Right-drag to pan.</span>
            </>
          ) : (
            <>
              <b>Bulldoze</b> · Click or drag over things to remove them. Refunds half.
            </>
          )}
        </div>
      )}
      <div className="buildbar panel">
        {palette.map((t) => {
          const isFree = t !== "path" && t !== "bulldoze" && race.free.includes(t);
          const price = isFree ? 0 : toolPrice(t);
          const broke = price > cash;
          const hotkey = TOOLS.indexOf(t) + 1;
          return (
            <button key={t} className={`tool ${RACE_TOOLS.includes(t) ? "race" : ""} ${tool === t ? "on" : ""} ${broke ? "broke" : ""}`} onClick={() => send({ type: "SET_TOOL", tool: t })} disabled={broke && tool !== t} aria-pressed={tool === t} title={toolName(t)}>
              <span className="hot">{hotkey > 0 ? hotkey : "·"}</span>
              <span className="icon">{ICONS[t]}</span>
              <span className="tname">{SHORT[t]}</span>
              <span className={`price ${isFree ? "free" : ""}`}>{t === "bulldoze" ? "refund 50%" : isFree ? "FREE" : formatMoney(price)}</span>
            </button>
          );
        })}
        <StaffTool />
      </div>
    </div>
  );
}

/** Endless marquee, driven by hand so new headlines join the tail without restarting it. */
function Ticker() {
  const track = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const history: { id: number; text: string; tone: string }[] = [];
    let seenId = 0;
    let cycle = 0;
    let offset = 0;
    let last = performance.now();
    let raf = 0;
    const add = (n: { text: string; tone: string }) => {
      const span = document.createElement("span");
      span.className = `tick ${n.tone}`;
      span.textContent = n.text;
      el.appendChild(span);
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const n of appNow()?.news ?? []) {
        if (n.id > seenId) {
          seenId = n.id;
          history.push(n);
          add(n);
        }
      }
      const viewport = el.parentElement!.clientWidth;
      // Never let the tape run dry: replay old headlines behind the new ones.
      let guard = 0;
      while (el.scrollWidth - offset < viewport * 1.5 && history.length > 0 && guard++ < 8) add(history[cycle++ % history.length]!);
      offset += dt * 70;
      let first = el.firstElementChild as HTMLElement | null;
      while (first && offset > first.offsetWidth) {
        offset -= first.offsetWidth;
        first.remove();
        first = el.firstElementChild as HTMLElement | null;
      }
      el.style.transform = `translateX(${-offset}px)`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="ticker" aria-label="News ticker">
      <div className="ticker-tag">NEWS</div>
      <div className="ticker-view">
        <div className="ticker-track" ref={track} />
      </div>
    </div>
  );
}

/** One toast at a time, the newest winning: a real toast beats a hint, and two hints never share the screen. */
function Toasts() {
  const toasts = useApp(atoms.toasts);
  // The app machine expires each toast after 5.2 s; a click dismisses it early.
  const dismiss = (id: number) => send({ type: "DISMISS_TOAST", id });
  const hasGateway = useApp(atoms.hasGateway);
  const selected = useApp(atoms.selected);
  // Nobody knows the people are tappable until they try: a hint until they do (or it has been up for a while).
  const [tapHint, setTapHint] = useState(true);
  useEffect(() => {
    if (selected !== null) setTapHint(false);
    const t = setTimeout(() => setTapHint(false), 22_000);
    return () => clearTimeout(t);
  }, [selected]);
  const newest = toasts.at(-1);
  // "Build an API Gateway..." twice is one hint too many: once any toast has said it, the standing hint is redundant.
  const toldAboutGateway = useRef(false);
  if (newest && /API Gateway/i.test(newest.text)) toldAboutGateway.current = true;
  const hint = newest ? null : !hasGateway && !toldAboutGateway.current ? "Build an API Gateway next to a path to start earning." : tapHint ? "Tap anyone to read their mind." : null;
  return (
    <div className="toasts">
      {newest ? (
        <button key={newest.id} className={`toast panel ${newest.tone}`} onClick={() => dismiss(newest.id)}>
          {newest.text}
        </button>
      ) : (
        hint && (
          <div key={hint} className="toast panel hint">
            {hint}
          </div>
        )
      )}
    </div>
  );
}

export function HUD() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const st = appNow();
      // A card is up: it owns the keyboard (1 to 3 choose), and nothing else should move.
      if (!st || st.event || (st.outcome !== "playing" && !st.outcomeDismissed)) return;
      if (e.key === " ") {
        e.preventDefault();
        // A focused button would also treat Space as a click.
        (document.activeElement as HTMLElement | null)?.blur?.();
        send({ type: "TOGGLE_PAUSE" });
      } else if (e.key === "Escape") send({ type: "SET_TOOL", tool: null });
      else if (/^[1-9]$/.test(e.key)) send({ type: "SET_TOOL", tool: TOOLS[Number(e.key) - 1]! });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="hud">
      <TopBar />
      <div className="hud-row">
        <div className="left-col">
          <TrainingChip />
          <Objectives />
        </div>
        <div className="right-col">
          <SpeedControl />
          <Thoughts />
          <Inspector />
          <RacePanel />
        </div>
      </div>
      <Toasts />
      <BuildBar />
      <Ticker />
      <StaffPanel />
      <EventCard />
      <OutcomeCard />
    </div>
  );
}
