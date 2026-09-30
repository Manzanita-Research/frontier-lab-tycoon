import { Dialog } from "../../kit";
import { useSlots, useT } from "../../context";
import type { SlotPropsMap } from "../../types";

/** The News Room: the archive of weekly papers and monthly chats, and whichever one is open. The game is paused meanwhile. */
export function NewsRoom({ newsroom, actions }: SlotPropsMap["NewsRoom"]) {
  const t = useT();
  const { FrontPage, GroupChat } = useSlots();
  const view = newsroom.view;
  if (!view) return null;
  const label = view === "archive" ? "News Room archive" : view === "paper" ? "The Frontier Times" : "Monthly group chat";
  return (
    <Dialog label={label} close={actions.closeNews} layerClass="news-backdrop" dialogClass="news-dialog">
      <div className="news-toolbar">
        <button onClick={() => (view === "archive" ? actions.closeNews() : actions.viewNews("archive"))}>{view === "archive" ? t("news.backCampus") : t("news.backArchive")}</button>
        <span>{t("news.paused")}</span>
        <button onClick={() => actions.closeNews()} aria-label={t("news.skipBack")}>
          {t("news.close")}
        </button>
      </div>
      {view === "archive" ? (
        <div className="news-archive">
          <span className="paper-section">Your lab, in the public record</span>
          <h1>News Room</h1>
          <p>A weekly paper. A monthly group chat. A permanent record of your temporary confidence.</p>
          {!newsroom.storage && <p className="archive-note">Storage is unavailable. Editions are kept for this visit.</p>}
          {newsroom.archive.length === 0 ? (
            <div className="archive-empty">
              <b>The presses are warming up.</b>
              <p>Your first front page arrives after day 7. The chat checks in after day 30.</p>
            </div>
          ) : (
            <div className="archive-list">
              {newsroom.archive.map((e) => (
                <button key={e.id} onClick={() => actions.viewNews(e.id)}>
                  <span className={`edition-icon ${e.type}`}>{e.type === "paper" ? "▤" : "···"}</span>
                  <span>
                    <small>
                      {e.kicker} · {e.date}
                    </small>
                    <b>{e.headline}</b>
                  </span>
                  {e.unread && <em>NEW</em>}
                  <span>↗</span>
                </button>
              ))}
            </div>
          )}
          <footer>Latest 30 editions · saved on this device · rival ticker is a fictional sentiment index</footer>
        </div>
      ) : view === "paper" && newsroom.paper ? (
        <FrontPage paper={newsroom.paper} actions={actions} />
      ) : newsroom.chat ? (
        <GroupChat chat={newsroom.chat} actions={actions} />
      ) : null}
    </Dialog>
  );
}
