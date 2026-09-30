import { useState } from "react";
import { BenchTable } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The benchmark leaderboard, in the right-hand column under the Arena. Open on a desktop, folded (a header strip) on a phone. */
export function Benchmarks({ leapfrog, layout }: SlotPropsMap["Benchmarks"]) {
  const t = useT();
  const [open, setOpen] = useState(!layout.compact);
  const lead = leapfrog.rows.find((r) => r.you);
  const sub = `${lead ? `${lead.wins} SOTA · ` : ""}${layout.compact ? `${t("voice.title")} ${leapfrog.voice.yoursText}` : leapfrog.nextText}`;
  return (
    <section className={`bench panel ${open ? "open" : ""} ${leapfrog.rows.some((r) => r.flash) ? "flashing" : ""}`} aria-label={t("bench.title")}>
      <button type="button" className="bench-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <b>{t("bench.title")}</b>
        <span className="bench-sub">{sub}</span>
        <span className="bench-fold" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && <BenchTable leapfrog={leapfrog} />}
      {open && leapfrog.drop && <p className="bench-drop">{leapfrog.drop.text}</p>}
    </section>
  );
}
