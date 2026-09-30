// Frontier 95's discourse (FLT-33): a megaphone in the tray (it shakes while anyone is marching) and "Discourse Monitor",
// a Task Mangler for opinions: every faction's approval as a process list, where the lab stands, who is allied or
// feuding, and the safety budget as a Control Panel radio group.
import { useState } from "react";
import { StanceTrack, useWidget } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Btn, Tabs, Win } from "./parts";

type Tab = "factions" | "stance" | "relations" | "safety";

export function Factions({ factions, layout, actions }: SlotPropsMap["Factions"]) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("factions");
  useWidget("discourse", () => setTab("factions"));
  const { open } = factions;
  const marching = factions.rows.some((r) => r.mood === "protesting");
  return (
    <>
      <button
        type="button"
        className={`f95-s disc ${open ? "on" : ""} ${marching ? "loud" : ""}`}
        onClick={() => actions.toggleFactions()}
        aria-pressed={open}
        aria-label={`${t("factions.title")}: ${factions.headline}`}
        title={`Discourse Monitor: ${factions.headline}`}
      >
        <Ico name="megaphone" size={18} />
        {factions.angry > 0 && <i className="f95-discn" aria-hidden>{factions.angry}</i>}
      </button>
      {open && (
        <Win
          className={`f95-disc ${layout.compact ? "compact" : ""}`}
          title="Discourse Monitor"
          icon="megaphone"
          label={t("factions.title")}
          buttons={[
            { g: "min", label: "Minimize", onClick: () => actions.toggleFactions() },
            { g: "close", label: "Close", onClick: () => actions.toggleFactions() },
          ]}
        >
          <Tabs<Tab>
            label={t("factions.title")}
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "factions", label: "Factions" },
              { id: "stance", label: "Stance" },
              { id: "relations", label: factions.relations.some((r) => r.schism) ? "Relations •" : "Relations" },
              { id: "safety", label: "Safety" },
            ]}
          />
          <div className="f95-page f95-discpage">
            {tab === "factions" && (
              <div className="f95-listwrap inset" role="table" aria-label="Factions">
                <div className="f95-lhead" role="row">
                  <span role="columnheader">Faction</span>
                  <span role="columnheader">Approval</span>
                  <span role="columnheader">Status</span>
                </div>
                {factions.rows.map((r) => (
                  <div key={r.id} className="f95-lrow" data-mood={r.mood} role="row" title={r.why ?? r.blurb}>
                    <span role="cell">
                      <i style={{ background: r.color }} aria-hidden />
                      {r.short}
                    </span>
                    <span role="cell" className="f95-approval">
                      <span className="f95-apbar inset" aria-hidden>
                        <b className={r.meter >= 0 ? "pos" : "neg"} style={{ [r.meter >= 0 ? "left" : "right"]: "50%", width: `${Math.min(50, Math.abs(r.meter) / 2)}%` }} />
                      </span>
                      {r.meterText}
                    </span>
                    <span role="cell">{r.moodLabel}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === "stance" && (
              <div className="f95-discstance">
                {factions.stance.map((s) => (
                  <div key={s.axis} className="f95-discaxis">
                    <span>{s.label}</span>
                    <StanceTrack stance={s} />
                  </div>
                ))}
              </div>
            )}
            {tab === "relations" &&
              (factions.relations.length === 0 ? (
                <p className="f95-discnone">{t("factions.none")}</p>
              ) : (
                <ul className="f95-discrel inset">
                  {factions.relations.slice(0, 6).map((r) => (
                    <li key={r.key} className={r.schism ? "schism" : r.state} title={r.text}>
                      <i style={{ background: r.a.color }} aria-hidden />
                      {r.a.short}
                      <b>{r.schism ? " ✂ " : r.state === "allied" ? " ⇄ " : " ✕ "}</b>
                      <i style={{ background: r.b.color }} aria-hidden />
                      {r.b.short}
                      <em>{r.schism ? "Schism" : r.state === "allied" ? "Allies" : "Feud"}</em>
                    </li>
                  ))}
                </ul>
              ))}
            {tab === "safety" && (
              <fieldset className="f95-discsafety">
                <legend>{t("factions.safety")}</legend>
                {factions.safety.options.map((o) => (
                  <label key={o.level}>
                    <input type="radio" name="f95-safety" checked={o.active} onChange={() => actions.setSafetySpend(o.level)} />
                    <span>{o.label}</span>
                    <small>{[o.costText, o.dragText].filter(Boolean).join(", ")}</small>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
          <div className="f95-status">{factions.gateText || factions.headline}</div>
        </Win>
      )}
    </>
  );
}

/**
 * Who is at the gate (FLT-56), pinned over it: "Who's Outside", a Details view of the crowds with a colour swatch each,
 * and a Statement… button per faction (Comms' one lever). The status bar says what it costs and who will write it.
 */
export function GateLegend({ factions, actions }: SlotPropsMap["GateLegend"]) {
  const t = useT();
  const st = factions.statement;
  return (
    <Win className="f95-gatelegend" title="Who's Outside" icon="megaphone" label={t("gate.title")}>
      <ul className="f95-gatelegend-in">
        {factions.gate.map((g) => (
          <li key={g.id || "water"}>
            <i style={{ background: g.color }} aria-hidden />
            <span className="nm">
              {g.count} {g.name}
            </span>
            {g.addressable && (
              <Btn disabled={!st.ready} onClick={() => actions.issueStatement(g.id)} title={`${st.costText} · ${st.writerText}`}>
                Statement…
              </Btn>
            )}
          </li>
        ))}
      </ul>
      <div className="f95-status">{st.ready ? `${st.costText} · ${st.writerText}` : st.waitText}</div>
    </Win>
  );
}
