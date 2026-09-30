// The two Release Leapfrog panels: the benchmark leaderboard as the machine's HIGH SCORES board, and the news cycle as an
// audience-applause meter (who is getting the big cheer this week).
import { useState } from "react";
import { BenchTable, VoiceGraph, useWidget } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Notes, Trend } from "./art";

export function Benchmarks({ leapfrog, layout }: SlotPropsMap["Benchmarks"]) {
  const t = useT();
  // Open on a desktop; a phone folds it to a badge that opens the board over the map.
  const [open, setOpen] = useState(() => !layout.compact);
  useWidget("benchmarks", () => setOpen(true));
  const lead = leapfrog.rows.find((r) => r.you);
  const wins = lead?.wins ?? 0;
  const sub = `${wins} ${t("bench.sota")} · ${leapfrog.nextText}`;
  return (
    <section className={`kn-plastic kn-bench ${open ? "open" : ""} ${layout.compact ? "compact" : ""} ${leapfrog.rows.some((r) => r.flash) ? "flashing" : ""}`} aria-label={t("bench.title")}>
      <div className="kn-screen">
        <button
          type="button"
          className="kn-np kn-bench-head"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${t("bench.title")}, ${wins} ${t("bench.sota")}, ${leapfrog.nextText}`}
        >
          <Notes /> <span className="kn-bench-title">{t("bench.title")}</span>
          <span className="kn-bench-sub">{sub}</span>
          <span className="kn-bench-wins">{wins}</span>
          <Trend trend={open ? "down" : "up"} />
        </button>
        {open && <BenchTable leapfrog={leapfrog} />}
        {open && leapfrog.drop && <p className="kn-bench-drop">{leapfrog.drop.text}</p>}
      </div>
    </section>
  );
}

export function Voice({ leapfrog, layout }: SlotPropsMap["Voice"]) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useWidget("traffic", () => setOpen(true));
  const { voice } = leapfrog;
  // On a phone the campus needs the room: the board's strip carries the news-cycle share instead.
  if (layout.compact) return null;
  return (
    <section className={`kn-plastic kn-voice ${voice.youOwn ? "owned" : ""}`} aria-label={t("voice.title")}>
      <div className="kn-screen">
        <button type="button" className="kn-np kn-voice-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={voice.headline}>
          <Notes /> <span className="kn-voice-title">{t("voice.title")}</span>
          <span className={`kn-voice-you ${voice.trend}`}>
            {t("voice.you")} {voice.yoursText} <Trend trend={voice.trend} />
          </span>
        </button>
        <div className="kn-voice-bar" role="img" aria-label={voice.headline}>
          {voice.shares.map((s) => (
            <i key={s.id} className={s.you ? "you" : ""} style={{ width: `${Math.max(1, s.share * 100)}%`, background: s.color }} title={`${s.short} ${s.pctText}`} />
          ))}
        </div>
        <p className="kn-voice-line">{voice.headline}</p>
        {open && <VoiceGraph voice={voice} width={264} height={70} className="kn-vg" />}
      </div>
    </section>
  );
}
