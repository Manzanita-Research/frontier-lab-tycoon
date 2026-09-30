// Publish or Perish (FLT-45) and the Swarm's reveal (FLT-46): the papers window in the stack, the arXive moments as
// browser windows, and CrumbWiki in Internet Exploder.
import { CrumbWikiBody, Dialog, PaperMomentBody, useAutoPause } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Blocks, Btn, Field, Win } from "./parts";
import { useStackWindow } from "./stack";

/** "Publish or Perish": the policy as radio buttons, the reputation, the pressure bar and every paper, drafts first. */
export function Papers({ papers, actions }: SlotPropsMap["Papers"]) {
  const t = useT();
  useStackWindow("papers", !papers.open, (minimised) => {
    if (minimised === papers.open) actions.togglePapers();
  });
  const active = papers.policies.find((p) => p.active);
  const tail = papers.drafts > 0 ? t("papers.drafts", { n: papers.drafts }) : papers.summary;
  return (
    <Win
      className={`f95-papers ${papers.open ? "open" : ""} ${papers.drafts > 0 ? "alert" : ""}`}
      title={
        <>
          Publish or Perish<span className="f95-long"> — {tail}</span>
        </>
      }
      label="Publish or Perish"
      icon="doc"
      onTitleClick={() => actions.togglePapers()}
      buttons={[{ g: "min", label: papers.open ? "Minimize" : "Restore", onClick: () => actions.togglePapers() }]}
      attrs={{ "data-coach": "papers" }}
    >
      <div className="f95-papers-top">
        <fieldset>
          <legend>{t("papers.policy")}</legend>
          {papers.policies.map((p) => (
            <label key={p.id}>
              <input type="radio" name="f95-policy" checked={p.active} onChange={() => actions.setPublicationPolicy(p.id)} /> {p.label}
            </label>
          ))}
        </fieldset>
        <div className="f95-papers-facts">
          <Field label={t("papers.reputation")}>
            <span className="inset f95-papers-rep">{papers.reputation}</span>
          </Field>
          <Field label={t("papers.pressure")} sub={papers.pressureText} warn={papers.pressure >= 0.7}>
            <Blocks value={papers.pressure} label={papers.pressureText} tone="red" />
          </Field>
        </div>
      </div>
      {active && <p className="f95-papers-blurb">{active.blurb}</p>}
      <div className="f95-papers-list inset" role="list" aria-label={t("papers.title")}>
        {papers.papers.length === 0 && <p className="f95-papers-empty">{t("papers.empty")}</p>}
        {papers.papers.map((p) => (
          <div key={p.id} role="listitem" className={`f95-paper-row status-${p.status} tone-${p.tone}`}>
            <div className="f95-paper-top">
              <span className="id">{p.arxiveId}</span>
              <span className={`st tone-${p.tone}`}>{p.statusText}</span>
            </div>
            <b>{p.title}</b>
            <small>{p.byline}</small>
            {p.reviewPct !== null && <Blocks value={p.reviewPct} label={p.statusText} />}
            {p.canPublish ? (
              <div className="f95-row left">
                <Btn def onClick={() => actions.publishPaper(p.id, "preprint")}>
                  {t("papers.preprint")}
                </Btn>
                <Btn onClick={() => actions.publishPaper(p.id, "review")}>{t("papers.review")}</Btn>
              </div>
            ) : (
              <small className="cites">{p.citationsText}</small>
            )}
          </div>
        ))}
      </div>
      <div className="f95-status">{papers.recruitingText}</div>
    </Win>
  );
}

const MOMENT_ICON = { drop: "globe", scoop: "error", award: "info" } as const;

/** A paper moment in the browser: the arXive listing, the scoop as an error on top of it, or the certificate. */
export function PaperMoment({ moment, actions }: SlotPropsMap["PaperMoment"]) {
  const t = useT();
  useAutoPause(actions, "paper-moment", true);
  const close = () => actions.dismissPaperMoment(moment.key);
  const award = moment.kind === "award";
  return (
    <Dialog label={moment.headline} close={close} layerClass="f95-layer f95-dim" dialogClass="f95-dialogwrap">
      <Win
        className={`f95-moment moment-${moment.kind}`}
        title={award ? "certificate.bmp — Paintbrush" : "arXive — Internet Exploder 3.0"}
        icon={award ? "doc" : "globe"}
        buttons={[{ g: "close", label: "Close", onClick: close }]}
        role="alertdialog"
        label={moment.headline}
      >
        {!award && (
          <div className="f95-toolbar">
            <Btn disabled>Back</Btn>
            <Btn onClick={close}>Stop</Btn>
            <span className="f95-address inset">
              <small>Address:</small> http://arxive.example/list/{moment.kind === "scoop" ? "cs.LG/pastweek" : "cs.LG/new"}
            </span>
          </div>
        )}
        <div className="f95-msgbody">
          <Ico name={MOMENT_ICON[moment.kind]} size={36} />
          <div>
            <h2>{moment.headline}</h2>
            {moment.kind !== "drop" && <p>{t(`moment.${moment.kind}`)}</p>}
          </div>
        </div>
        <div className="f95-moment-page inset">
          <PaperMomentBody moment={moment} />
        </div>
        <div className="f95-row">
          {moment.buttons.map((label, i) => (
            <Btn key={label} def={i === 0} autoFocus={i === 0} onClick={close}>
              {label}
            </Btn>
          ))}
        </div>
        <div className="f95-status">{t("event.paused")}</div>
      </Win>
    </Dialog>
  );
}

/** The reveal: CrumbWiki, in the browser, at the address the sandbox swore was not the internet. */
export function CrumbWiki({ wiki, actions }: SlotPropsMap["CrumbWiki"]) {
  const t = useT();
  useAutoPause(actions, "crumbwiki", true);
  const close = () => actions.closeCrumbWiki(wiki.key);
  return (
    <Dialog label={wiki.site} close={close} layerClass="f95-layer f95-dim" dialogClass="f95-dialogwrap">
      <Win className={`f95-ie f95-wiki tone-${wiki.tone}`} title={`${wiki.title} — ${wiki.site} — Internet Exploder 3.0`} icon="globe" buttons={[{ g: "close", label: "Close", onClick: close }]} label={wiki.site}>
        <div className="f95-menubar" aria-hidden>
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Go</span>
          <span>Favorites</span>
          <span>Help</span>
        </div>
        <div className="f95-toolbar">
          <Btn disabled>Back</Btn>
          <Btn disabled>Forward</Btn>
          <Btn disabled>Stop</Btn>
          <Btn disabled>Refresh</Btn>
          <span className="f95-address inset">
            <small>Address:</small> {wiki.url}
          </span>
        </div>
        <div className="f95-wikipage inset">
          <CrumbWikiBody wiki={wiki} />
        </div>
        <div className="f95-row">
          <Btn def autoFocus onClick={close}>
            {wiki.closeLabel}
          </Btn>
        </div>
        <div className="f95-status">
          {t("event.paused")} · {t("wiki.pages")}: {wiki.pages.length}
        </div>
      </Win>
    </Dialog>
  );
}
