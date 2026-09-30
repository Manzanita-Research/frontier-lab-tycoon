import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";
import { disasterIcon } from "./disasterIcons";

/**
 * What is going wrong right now (FLT-32): each disaster under way with its stage, one line and the cleanup's progress, and
 * who it has pulled off their post. With nothing going wrong it is the quiet way into the Disasters menu.
 */
export function DisasterAlert({ disasters, actions }: SlotPropsMap["DisasterAlert"]) {
  const t = useT();
  if (disasters.running.length === 0 && disasters.understaffed.length === 0) {
    return (
      <button type="button" className="panel dz-open" onClick={() => actions.openDisasters()}>
        {disasterIcon("")}
        <span>{t("disasters.open")}</span>
      </button>
    );
  }
  return (
    <section className="panel dz-alert" role="status" aria-label={t("disasters.alert")}>
      <header className="dz-alert-head">
        <span>{t("disasters.alert")}</span>
        <button type="button" className="dz-more" onClick={() => actions.openDisasters()}>
          {t("disasters.more")}
        </button>
      </header>
      {disasters.running.map((r) => (
        <div key={r.id} className={`dz-run stage-${r.stage}`}>
          <span className="dz-icon">{disasterIcon(r.id)}</span>
          <span className="dz-text">
            <b>
              {r.name} <em>{r.phaseLabel}</em>
            </b>
            <span className="dz-line">{r.line}</span>
            {r.progress !== null && (
              <span className="dz-progress" aria-label={r.progressText ?? undefined}>
                <i style={{ width: `${Math.round(r.progress * 100)}%` }} />
                <small>{r.progressText}</small>
              </span>
            )}
          </span>
        </div>
      ))}
      {disasters.understaffed.map((u) => (
        <p key={u.job} className={`dz-short ${u.all ? "all" : ""}`}>
          <b>!</b> {u.text}
        </p>
      ))}
    </section>
  );
}
