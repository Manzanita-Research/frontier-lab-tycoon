import { useState } from "react";
import { useT } from "../../context";
import { Dialog } from "../../kit";
import type { DisasterRowVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";
import { disasterIcon, TAG_ICONS } from "./disasterIcons";

/**
 * The Disasters menu (FLT-32), SimCity-style: how often random ones come, and a list you can start one from. Starting one
 * asks first (a second card, "Start a GPU Fire?"), and the safe answer is the default. Time is held while it is open.
 */
export function DisasterMenu({ disasters, actions }: SlotPropsMap["DisasterMenu"]) {
  const t = useT();
  const [asking, setAsking] = useState<DisasterRowVM | null>(null);
  const close = () => (asking ? setAsking(null) : actions.closeDisasters());
  return (
    <Dialog label={t("disasters.title")} close={close} layerClass="modal-backdrop" dialogClass="modal-card disaster-menu tone-bad">
      <div className="card-stripe">
        <span>{t("disasters.title")}</span>
        <span className="paused">{t("event.paused")}</span>
      </div>
      {asking ? (
        <div className="card-body dz-ask">
          <span className="dz-ask-icon">{disasterIcon(asking.id)}</span>
          <h2>{t("disasters.ask", { name: asking.name })}</h2>
          <p>{asking.blurb}</p>
          <div className="choices">
            <button type="button" className="choice" onClick={() => setAsking(null)}>
              <span className="choice-text">
                <b>{t("disasters.no")}</b>
              </span>
            </button>
            <button type="button" className="choice plain dz-yes" onClick={() => actions.triggerDisaster(asking.id)}>
              <span className="choice-text">
                <b>{t("disasters.yes")}</b>
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="card-body">
          <p className="dz-lede">{t("disasters.lede")}</p>
          <h3 className="dz-h">{t("disasters.risk")}</h3>
          <div className="dz-risk" role="radiogroup" aria-label={t("disasters.risk")}>
            {disasters.risks.map((r) => (
              <button key={r.key} type="button" role="radio" aria-checked={r.active} className={`dz-risk-opt risk-${r.key} ${r.active ? "on" : ""}`} onClick={() => actions.setRisk(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <p className="dz-risk-blurb">
            {disasters.risks.find((r) => r.active)?.blurb}
            {disasters.calm && <span className="dz-calm"> {disasters.calm}</span>}
          </p>
          <h3 className="dz-h">{t("disasters.menu")}</h3>
          <ul className="dz-list">
            {disasters.menu.map((m) => (
              <li key={m.id}>
                <button type="button" className={`dz-row ${m.active ? "active" : ""}`} disabled={!m.available} title={m.reason ?? m.blurb} onClick={() => setAsking(m)}>
                  <span className="dz-icon">{disasterIcon(m.id)}</span>
                  <span className="dz-text">
                    <b>
                      {m.name}
                      {m.active && <em className="dz-live">{t("disasters.active")}</em>}
                    </b>
                    <span className="dz-blurb">{m.available || m.active ? m.blurb : m.reason}</span>
                    <span className="dz-tags">
                      {m.tags.map((tag) => (
                        <span key={tag.key} className={`dz-tag tag-${tag.key}`}>
                          {TAG_ICONS[tag.key]}
                          {tag.label}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="dz-meters">
            <Meter label={t("disasters.trust")} kind="trust" value={disasters.trust.value} text={disasters.trust.text} />
            <Meter label={t("disasters.heat")} kind="heat" value={disasters.heat.value} text={disasters.heat.text} />
          </div>
          <button type="button" className="choice plain" onClick={() => actions.closeDisasters()}>
            <span className="choice-text">
              <b>{t("disasters.close")}</b>
            </span>
          </button>
        </div>
      )}
    </Dialog>
  );
}

function Meter({ label, kind, value, text }: { label: string; kind: string; value: number; text: string }) {
  return (
    <div className={`dz-meter ${kind}`}>
      <span className="dz-meter-label">{label}</span>
      <span className="dz-meter-bar">
        <i style={{ width: `${value}%` }} />
      </span>
      <span className="dz-meter-text">{text}</span>
    </div>
  );
}
