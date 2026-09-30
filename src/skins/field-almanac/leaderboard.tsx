import { useState } from "react";
import { BenchTable, VoiceGraph, useT, useWidget } from "../kit";
import type { SlotPropsMap } from "../types";
import { Caret, TableIcon } from "./icons";

/**
 * The leaderboard as a comparative table. Folded it is a slim strip in the left column (how many records you hold; a dot
 * blinks when a record changes hands). Opened it is a paper drawer standing over the
 * campus above the shelf, like the payroll, with the game's table (SOTA badges, SOLVED stamps) dressed in serif and hairlines.
 */
export function Benchmarks({ leapfrog, layout }: SlotPropsMap["Benchmarks"]) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useWidget("benchmarks", () => setOpen(true));
  const lead = leapfrog.rows.find((r) => r.you);
  const flashing = leapfrog.rows.some((r) => r.flash || r.cells.some((c) => c.flash));
  const records = `${lead?.wins ?? 0} ${t("bench.sota")}`;
  return (
    <section className={`fa-bench ${open ? "open" : ""} ${flashing ? "flashing" : ""} ${layout.compact ? "compact" : ""}`} aria-label={t("bench.title")}>
      <button type="button" className="fa-bench-head fa-paper" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <TableIcon />
        <span className="fa-bench-title">{t("bench.title")}</span>
        <span className="fa-bench-sub" title={leapfrog.nextText}>
          {records}
        </span>
        <Caret open={open} />
      </button>
      {open && (
        <div className="fa-bench-drawer fa-paper" role="region" aria-label={t("bench.title")}>
          <div className="fa-bench-bar">
            <i>{t("bench.title")}</i>
            <span className="fa-sc">{leapfrog.nextText}</span>
            <button type="button" className="fa-x" onClick={() => setOpen(false)} aria-label={t("inspector.close")}>
              ×
            </button>
          </div>
          <BenchTable leapfrog={leapfrog} />
          {leapfrog.drop && <p className="fa-bench-drop">{leapfrog.drop.text}</p>}
        </div>
      )}
    </section>
  );
}

/** The news cycle as one hairline bar, everyone's share in their own colour, with the headline under it and a graph behind a tap. A phone leaves it out (the leaderboard strip carries the share instead). */
export function Voice({ leapfrog, layout }: SlotPropsMap["Voice"]) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useWidget("traffic", () => setOpen(true));
  const { voice } = leapfrog;
  if (layout.compact) return null;
  const arrow = { up: "↑", down: "↓", flat: "" }[voice.trend];
  return (
    <section className={`fa-voice fa-paper ${voice.youOwn ? "owned" : ""}`} aria-label={t("voice.title")}>
      <button type="button" className="fa-voice-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={voice.headline}>
        <i>{t("voice.title")}</i>
        <span className={`fa-voice-you ${voice.trend}`}>
          {t("voice.you")} {voice.yoursText} {arrow}
        </span>
      </button>
      <div className="fa-voice-bar" role="img" aria-label={voice.headline}>
        {voice.shares.map((s) => (
          <i key={s.id} className={s.you ? "you" : ""} style={{ width: `${Math.max(1, s.share * 100)}%`, background: s.color }} title={`${s.short} ${s.pctText}`} />
        ))}
      </div>
      <p className="fa-voice-line">{voice.headline}</p>
      {open && <VoiceGraph voice={voice} width={240} height={70} className="fa-voice-graph" />}
    </section>
  );
}
