import { Portrait } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The card that opens when you tap a walker. */
export function Inspector({ inspector: who, actions }: SlotPropsMap["Inspector"]) {
  const t = useT();
  return (
    <aside className="inspector panel" aria-label={`${who.name}, ${who.role}`}>
      <div className="insp-head">
        <Portrait who={who.portrait} className="portrait" />
        <div className="insp-title">
          <div className="insp-name">{who.name}</div>
          <div className="insp-role">{who.role}</div>
          <div className="insp-tags">
            <span className={`tag mood-${who.mood}`}>{who.moodLabel}</span>
            <span className="tag kind">{who.kindLabel}</span>
          </div>
        </div>
        <button className="insp-x" onClick={() => actions.closeInspector()} aria-label={t("inspector.close")}>
          ×
        </button>
      </div>
      <div className="insp-status">{who.status}</div>
      {who.needs.length > 0 && (
        <div className="insp-needs">
          {who.needs.map((n) => (
            <div key={n.key} className="need">
              <span className="need-label">{n.label}</span>
              <span className={`need-bar ${n.tone}`}>
                <span style={{ width: `${n.pct}%` }} />
              </span>
              <span className="need-pct">{n.pct}%</span>
            </div>
          ))}
        </div>
      )}
      <div className="insp-thought">
        <span className="insp-thought-label">{t("inspector.thinking")}</span> <q>{who.thought}</q>
      </div>
      <ul className="insp-history">
        {who.history.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <button className={`follow ${who.following ? "on" : ""}`} onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following}>
        {who.following ? t("inspector.following") : t("inspector.follow")}
      </button>
    </aside>
  );
}
