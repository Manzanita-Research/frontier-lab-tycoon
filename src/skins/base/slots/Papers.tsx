import { useT } from "../../context";
import type { HudActions, PaperRowVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";

/** One paper: its arXive number, title and byline, where it is, and (a draft) the two ways out the door. */
export function PaperRow({ paper, actions }: { paper: PaperRowVM; actions: HudActions }) {
  const t = useT();
  return (
    <li className={`paper-row status-${paper.status} tone-${paper.tone}`}>
      <div className="paper-top">
        <span className="paper-id">{paper.arxiveId}</span>
        <span className={`paper-status tone-${paper.tone}`}>{paper.statusText}</span>
      </div>
      <b className="paper-title">{paper.title}</b>
      <span className="paper-byline">{paper.byline}</span>
      {paper.reviewPct !== null && (
        <span className="paper-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(paper.reviewPct * 100)}>
          <i style={{ width: `${Math.round(paper.reviewPct * 100)}%` }} />
        </span>
      )}
      {paper.canPublish ? (
        <div className="paper-actions">
          <button type="button" className="paper-go" onClick={() => actions.publishPaper(paper.id, "preprint")}>
            {t("papers.preprint")}
          </button>
          <button type="button" className="paper-go plain" onClick={() => actions.publishPaper(paper.id, "review")}>
            {t("papers.review")}
          </button>
        </div>
      ) : (
        <span className="paper-cites">{paper.citationsText}</span>
      )}
    </li>
  );
}

/** Publish or perish: a chip until opened, then the policy, the lab's reputation and every paper. */
export function Papers({ papers, actions }: SlotPropsMap["Papers"]) {
  const t = useT();
  if (!papers.open)
    return (
      <button type="button" className={`papers-chip panel ${papers.drafts > 0 ? "has-drafts" : ""}`} data-coach="papers" onClick={() => actions.togglePapers()}>
        <b>{t("papers.chip")}</b>
        <span>{papers.drafts > 0 ? t("papers.drafts", { n: papers.drafts }) : papers.summary}</span>
      </button>
    );
  const active = papers.policies.find((p) => p.active);
  return (
    <section className="papers panel" aria-label={t("papers.title")} data-coach="papers">
      <header className="papers-head">
        <b>{t("papers.title")}</b>
        <span className="papers-summary">{papers.summary}</span>
        <button type="button" className="papers-x" aria-label={t("papers.close")} onClick={() => actions.togglePapers()}>
          ×
        </button>
      </header>
      <div className="papers-policy" role="radiogroup" aria-label={t("papers.policy")}>
        {papers.policies.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.active} className={p.active ? "on" : ""} onClick={() => actions.setPublicationPolicy(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {active && <p className="papers-blurb">{active.blurb}</p>}
      <div className="papers-facts">
        <span>
          {t("papers.reputation")} <b>{papers.reputation}</b>
        </span>
        <span>{papers.recruitingText}</span>
      </div>
      <div className="papers-pressure" title={papers.pressureText}>
        <span>{t("papers.pressure")}</span>
        <span className="paper-meter hot">
          <i style={{ width: `${Math.round(papers.pressure * 100)}%` }} />
        </span>
        <small>{papers.pressureText}</small>
      </div>
      {papers.papers.length === 0 ? (
        <p className="papers-empty">{t("papers.empty")}</p>
      ) : (
        <ul className="papers-list">
          {papers.papers.map((p) => (
            <PaperRow key={p.id} paper={p} actions={actions} />
          ))}
        </ul>
      )}
    </section>
  );
}
