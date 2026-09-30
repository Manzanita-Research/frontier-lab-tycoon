import { useState } from "react";
import { VoiceGraph, useWidget } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The share-of-voice meter: one stacked bar of the news cycle, you in the accent, and a small graph behind a tap. */
export function Voice({ leapfrog, layout }: SlotPropsMap["Voice"]) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useWidget("traffic", () => setOpen(true));
  const { voice } = leapfrog;
  // On a phone the campus needs the room: the Benchmarks strip carries the news-cycle share instead.
  if (layout.compact) return null;
  const arrow = { up: "▲", down: "▼", flat: "" }[voice.trend];
  return (
    <section className={`voice panel ${voice.youOwn ? "owned" : ""}`} aria-label={t("voice.title")}>
      <button type="button" className="voice-head" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={voice.headline}>
        <b>{t("voice.title")}</b>
        <span className={`voice-you ${voice.trend}`}>
          {t("voice.you")} {voice.yoursText} {arrow}
        </span>
      </button>
      <div className="voice-bar" role="img" aria-label={voice.headline}>
        {voice.shares.map((s) => (
          <i key={s.id} className={s.you ? "you" : ""} style={{ width: `${Math.max(1, s.share * 100)}%`, background: s.color }} title={`${s.short} ${s.pctText}`} />
        ))}
      </div>
      <p className="voice-line">{voice.headline}</p>
      {open && <VoiceGraph voice={voice} width={248} height={70} className="voice-graph" />}
    </section>
  );
}
