import { useT } from "../context";
import type { PaperMomentVM } from "../../ui/hud/types";

/** The moment's own page: the arXive listing, the two timestamps, or the certificate. Plain semantic classes (`arxive-*`, `scoop-*`, `cert-*`) so a skin dresses it from its own CSS; the base and Frontier 95 both use it. */
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
