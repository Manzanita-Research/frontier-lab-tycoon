import type { CSSProperties } from "react";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/**
 * Who is at the gate (FLT-56): a legend pinned over it, one row per crowd in its colours, so a mixed protest sorts
 * itself out. Each faction's row has the Comms lever: a statement to that faction (`actions.issueStatement(id)`), at a
 * price and then a cooldown. The game pins it to the gate and only draws it while a faction marches there.
 */
export function GateLegend({ factions, actions }: SlotPropsMap["GateLegend"]) {
  const t = useT();
  const st = factions.statement;
  return (
    <div className="gate-legend" role="group" aria-label={t("gate.title")}>
      <span className="gate-legend-title">{t("gate.title")}</span>
      <ul>
        {factions.gate.map((g) => (
          <li key={g.id || "water"} style={{ "--faction": g.color } as CSSProperties}>
            <i aria-hidden />
            <span className="gate-legend-name">
              <b>{g.count}</b> {g.name}
            </span>
            {g.addressable && (
              <button disabled={!st.ready} onClick={() => actions.issueStatement(g.id)} title={`${st.costText} · ${st.writerText}`}>
                {t("gate.address")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <span className="gate-legend-foot">
        {st.ready ? `${t("gate.statement")} ${st.costText} · ${st.writerText}` : st.waitText}
      </span>
    </div>
  );
}
