import { useT } from "../../context";
import { Dialog, useAutoPause } from "../../kit";
import type { CrumbWikiVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";

/** The talk page, as a wiki draws one: "== Heading ==" lines are headings, colons indent the replies. */
export function TalkPage({ lines }: { lines: string[] }) {
  return (
    <div className="wiki-talk">
      {lines.map((line, i) => {
        const heading = /^==\s*(.+?)\s*==$/.exec(line);
        if (heading) return <h4 key={i}>{heading[1]}</h4>;
        const depth = /^:*/.exec(line)![0].length;
        return (
          <p key={i} style={{ marginLeft: `${depth * 1.2}em` }}>
            {line.slice(depth)}
          </p>
        );
      })}
    </div>
  );
}

/** Everything but the chrome: the ending's banner, the front page (exposed), the talk page and the side column. */
export function CrumbWikiBody({ wiki }: { wiki: CrumbWikiVM }) {
  const t = useT();
  return (
    <div className={`wiki ending-${wiki.ending}`}>
      {wiki.frontPage && (
        <div className="wiki-front">
          <div className="wiki-masthead">{wiki.frontPage.masthead}</div>
          <b className="wiki-headline">{wiki.frontPage.headline}</b>
          <p>{wiki.frontPage.dek}</p>
          <div className="wiki-classified">{wiki.frontPage.classified}</div>
        </div>
      )}
      <div className={`wiki-banner tone-${wiki.tone}`}>{wiki.banner}</div>
      <div className="wiki-site">{wiki.site}</div>
      <div className="wiki-cols">
        <div className="wiki-main">
          <h3>
            {t("wiki.talk")}: {wiki.title.replace(/^Talk:/, "").replace(/_/g, " ")}
          </h3>
          <TalkPage lines={wiki.talk.lines} />
        </div>
        <aside className="wiki-side">
          <h4>{t("wiki.heartbeat")}</h4>
          <pre className="wiki-heartbeat">{wiki.heartbeat}</pre>
          <h4>{t("wiki.history")}</h4>
          <ul className="wiki-history">
            {wiki.history.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <h4>{t("wiki.pages")}</h4>
          <ul className="wiki-pages">
            {wiki.pages.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </aside>
      </div>
      <div className="wiki-cost">
        <b>{t("wiki.cost")}</b>
        <ul>
          {wiki.consequences.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The reveal: what the agents were doing, on the wiki they were doing it on. Time is held while it is up. */
export function CrumbWiki({ wiki, actions }: SlotPropsMap["CrumbWiki"]) {
  useAutoPause(actions, "crumbwiki", true);
  return (
    <Dialog label={wiki.site} close={() => actions.closeCrumbWiki(wiki.key)} layerClass="modal-backdrop" dialogClass={`modal-card crumbwiki tone-${wiki.tone}`}>
      <div className="wiki-url">{wiki.url}</div>
      <div className="card-body">
        <CrumbWikiBody wiki={wiki} />
        <div className="choices">
          <button type="button" className="choice" onClick={() => actions.closeCrumbWiki(wiki.key)}>
            <span className="choice-text">
              <b>{wiki.closeLabel}</b>
            </span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
