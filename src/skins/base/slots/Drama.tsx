import { Dialog } from "../../kit";
import type { SlotPropsMap } from "../../types";
import type { DramaPackVM, DramaVM } from "../../../ui/hud/types";

/** What a pack brings, in a sentence a player can read before saying yes. */
export function dramaComing(p: DramaPackVM): string {
  const parts = [p.summary];
  if (p.event) parts.push(`the card "${p.event.title}" turns up${p.event.day !== null ? ` from day ${p.event.day}` : ""}`);
  return parts.filter(Boolean).join("; ");
}

/** The card for one pack: the story, the first headlines, what's in it, and the one button. */
function PackCard({ pack, drama, actions, lead }: { pack: DramaPackVM; drama: DramaVM; actions: SlotPropsMap["Drama"]["actions"]; lead: string }) {
  return (
    <article className={`drama-card${pack.on ? " on" : ""}`}>
      <div className="drama-kicker">
        <span>{lead}</span>
        <span>
          {pack.dateText} · {pack.ago}
        </span>
      </div>
      <h2>{pack.title}</h2>
      <p className="drama-dek">{pack.description}</p>
      {pack.teasers.length > 0 && (
        <ul className="drama-teasers">
          {pack.teasers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="drama-coming">{dramaComing(pack)}</p>
      {pack.on ? (
        <div className="drama-actions">
          <span className="drama-live">Playing in this lab.</span>
          <button className="drama-quiet" onClick={() => actions.removeMod(pack.id)}>
            Switch it off (new lab)
          </button>
        </div>
      ) : (
        <div className="drama-actions">
          <button className="drama-play" onClick={() => actions.playDrama(pack.id)}>
            {drama.on ? "Swap it in" : "Play it"}
          </button>
          <small>Starts a new lab: mods load before the first brick. Your current lab will be fine. Probably.</small>
        </div>
      )}
    </article>
  );
}

/** Today's Drama: the newest published pack, the ones before it, and the "now playing" card when one has just loaded. */
export function Drama({ drama, actions }: SlotPropsMap["Drama"]) {
  const on = drama.on;
  // A pack from a shared link may be older than anything in the feed: say it's playing anyway.
  const unlisted = on && ![drama.latest, ...drama.archive].some((p) => p?.on);
  return (
    <Dialog label="Today's Drama" close={actions.closeDrama} layerClass="news-backdrop mixer-backdrop drama-backdrop" dialogClass="news-dialog drama-dialog">
      <div className="drama-box">
        <div className="news-toolbar">
          <b>Today's Drama</b>
          <button onClick={() => actions.closeDrama()} aria-label="Close Today's Drama">
            ×
          </button>
        </div>
        {drama.intro && on ? (
          <div className="drama-intro">
            <div className="drama-stamp">ON AIR</div>
            <h2>{on.title}</h2>
            <p className="drama-dek">{on.description}</p>
            <p className="drama-coming">
              Coming up in this lab: {dramaComing(on) || "whatever the industry did today"}. The rivals have read the news too.
            </p>
            <div className="drama-actions">
              <button className="drama-play" onClick={() => actions.closeDrama()}>
                Let's go
              </button>
              <button className="drama-quiet" onClick={() => actions.removeMod(on.id)}>
                Switch it off (new lab)
              </button>
            </div>
          </div>
        ) : (
          <>
            {unlisted && (
              <p className="drama-note">
                Playing <b>{on.title}</b>. <button onClick={() => actions.removeMod(on.id)}>Switch it off</button>
              </p>
            )}
            {drama.status === "loading" && !drama.latest && <p className="drama-note">Checking the group chats…</p>}
            {drama.status === "error" && !drama.latest && <p className="drama-note">The drama wire is down. Somewhere, a lab is getting away with something.</p>}
            {drama.status === "ready" && !drama.latest && <p className="drama-note">No drama published yet. The labs are behaving. Suspicious.</p>}
            {drama.latest && <PackCard pack={drama.latest} drama={drama} actions={actions} lead={drama.latest.ago === "today" ? "Today" : "Latest"} />}
            {drama.archive.length > 0 && (
              <section className="drama-archive">
                <h3>Previously</h3>
                <ol>
                  {drama.archive.map((p) => (
                    <li key={p.id} className={p.on ? "on" : ""}>
                      <span>
                        <b>{p.title}</b>
                        <small>
                          {p.dateText} · {p.summary}
                        </small>
                      </span>
                      {p.on ? (
                        <em>Playing</em>
                      ) : (
                        <button onClick={() => actions.playDrama(p.id)} aria-label={`Play ${p.title}`}>
                          Play
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
        <small className="drama-foot">
          A small mod, written each morning from the day's AI news and checked by a human before it lands here. Parody names only.{" "}
          <button
            onClick={() => {
              actions.closeDrama();
              actions.openMods();
            }}
          >
            Manage mods…
          </button>
        </small>
      </div>
    </Dialog>
  );
}
