import { FactionChip, FactionMeter, StanceTrack } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/**
 * The discourse (FLT-33): folded, one line and a dot per faction (filled in their colour, ringed when they are fans,
 * crossed when they are upset); open, every faction's meter and why, where the lab stands, who is allied or feuding,
 * the gate, the safety budget and the latest from the discourse. On a phone the stance and the log stay folded away.
 */
export function Factions({ factions, layout, actions }: SlotPropsMap["Factions"]) {
  const t = useT();
  const { open } = factions;
  return (
    <section className={`factions panel ${open ? "open" : ""}`} aria-label={t("factions.title")}>
      <button type="button" className="factions-head" onClick={() => actions.toggleFactions()} aria-expanded={open} title={factions.headline}>
        <b>{t("factions.title")}</b>
        <span className="factions-sub">{factions.headline}</span>
        <span className="factions-fold" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {!open && (
        <div className="factions-dots" aria-hidden>
          {factions.rows.map((r) => (
            <i key={r.id} data-mood={r.mood} style={{ background: r.color }} title={`${r.name}: ${r.moodLabel} (${r.meterText})`} />
          ))}
        </div>
      )}
      {!open && factions.gateText && <p className="factions-gate">{factions.gateText}</p>}
      {open && (
        <div className="factions-body">
          <ul className="factions-rows">
            {factions.rows.map((r) => (
              <li key={r.id} data-mood={r.mood} title={r.blurb}>
                <FactionChip faction={r} mood={false} />
                <FactionMeter row={r} />
                <span className="factions-mood">{r.moodLabel}</span>
                {r.why && r.mood !== "calm" && <small className="factions-why">{r.why}</small>}
              </li>
            ))}
          </ul>
          {factions.gateText && <p className="factions-gate">{factions.gateText}</p>}
          {!layout.compact && (
            <>
              <h4>{t("factions.stance")}</h4>
              <div className="factions-stance">
                {factions.stance.map((s) => (
                  <div key={s.axis} className="factions-axis">
                    <span>{s.label}</span>
                    <StanceTrack stance={s} />
                  </div>
                ))}
              </div>
            </>
          )}
          <h4>{t("factions.relations")}</h4>
          {factions.relations.length === 0 ? (
            <p className="factions-empty">{t("factions.none")}</p>
          ) : (
            <ul className="factions-rel">
              {factions.relations.slice(0, 4).map((r) => (
                <li key={r.key} className={r.schism ? "schism" : r.state} title={r.text}>
                  <FactionChip faction={r.a} mood={false} />
                  <span aria-hidden>{r.schism ? "💔" : r.state === "allied" ? "🤝" : "⚔"}</span>
                  <FactionChip faction={r.b} mood={false} />
                  <em>{r.schism ? "SCHISM" : r.state === "allied" ? "allies" : "feud"}</em>
                </li>
              ))}
            </ul>
          )}
          <h4>{t("factions.safety")}</h4>
          <div className="factions-safety" role="radiogroup" aria-label={t("factions.safety")}>
            {factions.safety.options.map((o) => (
              <button key={o.level} type="button" role="radio" aria-checked={o.active} className={o.active ? "on" : ""} onClick={() => actions.setSafetySpend(o.level)} title={[o.costText, o.dragText].filter(Boolean).join(", ")}>
                <b>{o.label}</b>
                <small>{o.costText}</small>
              </button>
            ))}
          </div>
          {!layout.compact && factions.log.length > 0 && (
            <>
              <h4>{t("factions.log")}</h4>
              <ul className="factions-log">
                {factions.log.slice(0, 4).map((l) => (
                  <li key={l.id} className={l.tone}>
                    {l.colors.map((c, i) => (
                      <i key={i} style={{ background: c }} aria-hidden />
                    ))}
                    {l.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
