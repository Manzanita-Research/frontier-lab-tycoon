import { useT } from "../../context";
import { Dialog, useAutoPause } from "../../kit";
import type { HudActions, PaperMomentVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";

/** The moment's own page: the arXive listing, the two timestamps, or the certificate. Shared with skins that compose it. */
export function PaperMomentBody({ moment }: { moment: PaperMomentVM }) {
  const t = useT();
  if (moment.kind === "drop")
    return (
      <div className="arxive">
        {moment.note && <div className="arxive-load">{moment.note}</div>}
        <div className="arxive-kicker">{t("moment.drop")}</div>
        <ol className="arxive-list">
          {moment.listing.map((l) => (
            <li key={l.arxiveId} className={l.you ? "you" : ""}>
              <span className="arxive-id">{l.arxiveId}</span>
              <b>{l.title}</b>
              <span className="arxive-by">{l.byline}</span>
              {l.you && <em className="arxive-you">{t("moment.you")}</em>}
            </li>
          ))}
        </ol>
      </div>
    );
  if (moment.kind === "scoop")
    return (
      <div className="scoop">
        <div className="scoop-col theirs">
          <span className="scoop-label">
            {t("moment.theirs")} · {moment.rival}
          </span>
          <b>{moment.theirTitle}</b>
          <span className="scoop-stamp">{moment.theirStamp}</span>
        </div>
        <div className="scoop-gap">
          <span>{t("moment.gap")}</span>
          <b>{moment.gapText}</b>
        </div>
        <div className="scoop-col yours">
          <span className="scoop-label">{t("moment.yours")}</span>
          <b>{moment.paper.title}</b>
          <span className="scoop-stamp">{moment.yourStamp}</span>
        </div>
      </div>
    );
  return (
    <div className="certificate">
      <div className="cert-kicker">{t("moment.award")}</div>
      <span className="cert-small">{t("moment.certifies")}</span>
      <b className="cert-title">{moment.paper.title}</b>
      <span className="cert-by">{moment.paper.byline}</span>
      <span className="cert-small">{t("moment.awarded")}</span>
      <b className="cert-award">{moment.award}</b>
      <span className="cert-venue">{moment.paper.venue}</span>
      {moment.note && <small className="cert-foot">{moment.note}</small>}
    </div>
  );
}

export function MomentButtons({ moment, actions, className = "choice" }: { moment: PaperMomentVM; actions: HudActions; className?: string }) {
  return (
    <div className="moment-buttons">
      {moment.buttons.map((label, i) => (
        <button key={label} type="button" className={`${className} ${i === moment.buttons.length - 1 ? "plain" : ""}`} onClick={() => actions.dismissPaperMoment(moment.key)}>
          <span className="choice-text">
            <b>{label}</b>
          </span>
        </button>
      ))}
    </div>
  );
}

/** A paper moment: the arXive drop, getting scooped, or a Best Paper. Time is held while it is up; every button just closes it. */
export function PaperMoment({ moment, actions }: SlotPropsMap["PaperMoment"]) {
  const t = useT();
  useAutoPause(actions, "paper-moment", true);
  return (
    <Dialog label={moment.headline} close={() => actions.dismissPaperMoment(moment.key)} layerClass="modal-backdrop" dialogClass={`modal-card event-card paper-moment moment-${moment.kind} tone-${moment.kind === "scoop" ? "bad" : "good"}`}>
      <div className="card-stripe">
        <span>{t(`moment.${moment.kind}`)}</span>
      </div>
      <div className="card-body">
        <h2>{moment.headline}</h2>
        <PaperMomentBody moment={moment} />
        <MomentButtons moment={moment} actions={actions} />
      </div>
    </Dialog>
  );
}
