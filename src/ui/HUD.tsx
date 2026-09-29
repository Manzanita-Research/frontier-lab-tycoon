import { useEffect, useLayoutEffect, useRef } from "react";
import { BUILDINGS, PATH_PRICE } from "../content/buildings";
import { formatDate, formatMoney } from "../sim/format";
import { SPEEDS, TOOLS, useStore, type Tool } from "../store";
import { ICONS } from "./icons";

const toolName = (t: Tool) => (t === "path" ? "Path" : t === "bulldoze" ? "Bulldoze" : BUILDINGS[t].name);
const SHORT: Record<Tool, string> = { path: "Path", cluster: "Cluster", hall: "Training Hall", gateway: "Gateway", kombucha: "Kombucha", bulldoze: "Bulldoze" };
const toolPrice = (t: Tool) => (t === "path" ? PATH_PRICE : t === "bulldoze" ? 0 : BUILDINGS[t].price);

function TopBar() {
  const s = useStore((st) => st.snap);
  const runwayLow = s.runway !== null && s.runway < 6;
  return (
    <div className="topbar panel">
      <div className="lab">
        <div className="lab-name">{s.labName}</div>
        <div className="lab-date">{formatDate(s.day)}</div>
      </div>
      <div className="stat cash">
        <span className="label">Cash</span>
        <span className={`value ${s.cash < 0 ? "bad" : ""}`}>{formatMoney(s.cash)}</span>
        <span className={`sub ${s.net >= 0 ? "good" : "bad"}`}>
          {s.net >= 0 ? "+" : "-"}
          {formatMoney(Math.abs(s.net))}/day
        </span>
      </div>
      <div className="stat">
        <span className="label">Runway</span>
        <span className={`value ${runwayLow ? "bad" : ""}`}>{s.runway === null ? "∞" : `${s.runway.toFixed(1)} mo`}</span>
      </div>
      <div className="stat">
        <span className="label">Capability</span>
        <span className="value">{Math.round(s.capability)}</span>
      </div>
      <div className="stat hype">
        <span className="label">Hype</span>
        <span className="value">{Math.round(s.hype)}</span>
        <span className="meter">
          <span style={{ width: `${s.hype}%` }} />
        </span>
      </div>
    </div>
  );
}

function TrainingChip() {
  const s = useStore((st) => st.snap);
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
  const speed = useStore((st) => st.speed);
  const setSpeed = useStore((st) => st.setSpeed);
  return (
    <div className="speed panel" role="group" aria-label="Game speed">
      {SPEEDS.map((v) => (
        <button key={v} className={speed === v ? "on" : ""} onClick={() => setSpeed(v)} aria-label={v === 0 ? "Pause" : `${v}x speed`}>
          {v === 0 ? <span className="pause-icon"><i /><i /></span> : `${v}×`}
        </button>
      ))}
    </div>
  );
}

function BuildBar() {
  const tool = useStore((st) => st.tool);
  const setTool = useStore((st) => st.setTool);
  const cash = useStore((st) => st.snap.cash);
  const blurb = tool && tool !== "path" && tool !== "bulldoze" ? BUILDINGS[tool] : null;
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
        {TOOLS.map((t, i) => {
          const price = toolPrice(t);
          const broke = price > cash;
          return (
            <button key={t} className={`tool ${tool === t ? "on" : ""} ${broke ? "broke" : ""}`} onClick={() => setTool(t)} disabled={broke && tool !== t} aria-pressed={tool === t} title={toolName(t)}>
              <span className="hot">{i + 1}</span>
              <span className="icon">{ICONS[t]}</span>
              <span className="tname">{SHORT[t]}</span>
              <span className="price">{t === "bulldoze" ? "refund 50%" : formatMoney(price)}</span>
            </button>
          );
        })}
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
      for (const n of useStore.getState().news) {
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

function Toasts() {
  const toasts = useStore((st) => st.toasts);
  const dismiss = useStore((st) => st.dismissToast);
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 5200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <button key={t.id} className={`toast panel ${t.tone}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  );
}

export function HUD() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const st = useStore.getState();
      if (e.key === " ") {
        e.preventDefault();
        st.togglePause();
      } else if (e.key === "Escape") st.setTool(null);
      else if (/^[1-6]$/.test(e.key)) st.setTool(TOOLS[Number(e.key) - 1]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="hud">
      <TopBar />
      <div className="hud-row">
        <TrainingChip />
        <SpeedControl />
      </div>
      <Toasts />
      <BuildBar />
      <Ticker />
    </div>
  );
}
