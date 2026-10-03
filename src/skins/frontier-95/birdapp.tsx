// Frontier 95's Bird App (FLT-69): a bird in the tray (it flaps when a post of yours goes viral or Comms is drowning)
// and "Bird Reader 1.0", a newsreader crossed with a buddy list: the timeline as a message list over a preview pane,
// the posters as a contact list with a Posting Policy for whoever is selected, and the Comms desk as a queue.
// FLT-92: the rival labs' posts are in the same list, each From marked with its lab's colour, an Organization header in
// the preview and the quoted post as "> wrote:"; a View bar switches Everyone / Us / Them.
import { useState, type CSSProperties } from "react";
import { AuraSpark, BIRD_SIDES, BirdMeter, onSide, type BirdSide } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { BirdPostVM, BirdPosterVM } from "../../ui/hud/types";
import { Ico } from "./icons";
import { Blocks, Field, Sticker, Tabs, Win } from "./parts";

type Tab = "timeline" | "buddies" | "comms";

/** The flag in the message list's first column: unread (live), or how it landed. Plain ASCII: W95FA has no stars or hearts. */
const MARK = { live: "●", flop: "·", banger: "*", controversy: "!", ratioed: "R", cancelled: "X" } as const;
/** The contact list's groups, loudest first. */
const GROUPS: { tier: BirdPosterVM["tier"]; label: string }[] = [
  { tier: "big", label: "Big accounts" },
  { tier: "occasional", label: "Posts sometimes" },
  { tier: "break", label: "Away (posting break)" },
  { tier: "recluse", label: "Offline (never posts)" },
];

export function BirdApp({ birdapp, layout, actions }: SlotPropsMap["BirdApp"]) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("timeline");
  const [picked, setPicked] = useState<string | null>(null);
  const [buddy, setBuddy] = useState<number | null>(null);
  const [side, setSide] = useState<BirdSide>("all");
  const { open, comms } = birdapp;
  const rivals = birdapp.rivals?.on ? birdapp.rivals : null;
  const posts = [...birdapp.live, ...birdapp.log].filter(onSide(rivals ? side : "all"));
  const sel = posts.find((p) => p.id === picked) ?? (birdapp.spotlight && onSide(side)(birdapp.spotlight) ? birdapp.spotlight : null) ?? posts[0] ?? null;
  const who = birdapp.posters.find((p) => p.id === buddy) ?? birdapp.posters[0] ?? null;
  const drowning = comms.desk === "drowning";
  const loud = drowning || !!birdapp.spotlight;
  // Folded, the bird counts headlines you haven't read (FLT-54); otherwise the posts still live.
  const unread = open ? 0 : (birdapp.unread ?? 0);
  return (
    <>
      <button
        type="button"
        className={`f95-s bird ${open ? "on" : ""} ${loud ? "loud" : ""}`}
        data-anchor="app:bird"
        onClick={() => actions.toggleBirdApp()}
        aria-pressed={open}
        aria-label={`${t("birdapp.title")}: ${birdapp.headline}`}
        title={unread > 0 ? `Bird Reader: ${unread} new` : `Bird Reader: ${birdapp.headline}`}
      >
        <Ico name="bird" size={18} />
        {unread > 0 ? (
          <i className="f95-birdn unread" aria-hidden>
            {unread}
          </i>
        ) : (
          birdapp.live.length > 0 && (
            <i className="f95-birdn" aria-hidden>
              {birdapp.live.length}
            </i>
          )
        )}
      </button>
      {open && (
        <Win
          className={`f95-bird ${layout.compact ? "compact" : ""} ${drowning ? "drowning" : ""}`}
          title={
            <>
              Bird Reader 1.0<span className="f95-long"> — {birdapp.headline}</span>
            </>
          }
          icon="bird"
          label={t("birdapp.title")}
          buttons={[
            { g: "min", label: "Minimize", onClick: () => actions.toggleBirdApp() },
            { g: "close", label: "Close", onClick: () => actions.toggleBirdApp() },
          ]}
        >
          <div className="f95-menubar" aria-hidden>
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Post</span>
            <span>Help</span>
          </div>
          <div className="f95-bird-aura" title={birdapp.auraEffects}>
            <Field label={`${t("birdapp.aura")}: ${birdapp.aura}`} sub={birdapp.auraEffects}>
              <span className="f95-bird-aurarow">
                <Blocks value={birdapp.aura / 100} label={birdapp.auraText} />
                <span className="f95-bird-spark inset">
                  <AuraSpark values={birdapp.auraHistory} />
                </span>
              </span>
            </Field>
            {birdapp.moments.length > 0 && (
              <div className="f95-bird-moments">
                {birdapp.moments.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            )}
          </div>
          <Tabs<Tab>
            label={t("birdapp.title")}
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "timeline", label: birdapp.live.length > 0 ? `Timeline (${birdapp.live.length})` : "Timeline" },
              { id: "buddies", label: "Contact List" },
              { id: "comms", label: comms.queue.length > 0 ? `Comms Desk (${comms.queue.length})` : "Comms Desk" },
            ]}
          />
          <div className="f95-page f95-birdpage">
            {tab === "timeline" && (
              <>
                {rivals && (
                  <div className="f95-bird-view" role="radiogroup" aria-label={t("birdapp.filter")}>
                    <span aria-hidden>View:</span>
                    {BIRD_SIDES.map((id) => (
                      <button key={id} type="button" role="radio" aria-checked={side === id} className={`f95-btn ${side === id ? "on" : ""}`} onClick={() => setSide(id)}>
                        {t(`birdapp.filter.${id}`)}
                      </button>
                    ))}
                    {side !== "us" && rivals.quiet.length > 0 && <small className="f95-bird-away">{rivals.quiet.join(" · ")}</small>}
                  </div>
                )}
                <div className="f95-listwrap inset f95-bird-list" role="listbox" aria-label="Timeline">
                  <div className="f95-lhead" aria-hidden>
                    <span />
                    <span>Subject</span>
                    <span>From</span>
                    <span className="num">Likes</span>
                    <span className="num">Re</span>
                  </div>
                  {posts.length === 0 && <p className="f95-bird-empty">{t("birdapp.empty")}</p>}
                  {posts.map((p) => (
                    <div
                      key={p.id}
                      role="option"
                      aria-selected={sel?.id === p.id}
                      tabIndex={0}
                      className={`f95-lrow outcome-${p.outcome} ${sel?.id === p.id ? "you" : ""} ${p.ratioing ? "ratioing" : ""} ${p.lab ? "them" : ""}`}
                      onClick={() => setPicked(p.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPicked(p.id)}
                    >
                      <span className="mark">{MARK[p.outcome]}</span>
                      <span>{p.replyTo ? `Re: ${p.text}` : p.quote ? `Fwd: ${p.text}` : p.text}</span>
                      <span>
                        {p.lab && <i className="f95-labsq" style={{ "--bird-lab": p.lab.color } as CSSProperties} title={p.lab.name} aria-label={p.lab.name} />}
                        {birdapp.face && <span className="f95-bird-face" aria-hidden>{birdapp.face}</span>}
                        {p.handle}
                      </span>
                      <span className="num">{p.likesText}</span>
                      <span className="num replies">{p.repliesText}</span>
                    </div>
                  ))}
                </div>
                {sel && <Preview post={sel} face={birdapp.face} />}
                {birdapp.typing && <p className="f95-bird-typing">{birdapp.typing}</p>}
              </>
            )}
            {tab === "buddies" && (
              <>
                <div className="f95-listwrap inset f95-bird-buddies" role="listbox" aria-label="Contact List">
                  {GROUPS.map((g) => {
                    const members = birdapp.posters.filter((p) => p.tier === g.tier);
                    if (members.length === 0) return null;
                    return (
                      <div key={g.tier} role="group" aria-label={g.label}>
                        <b className="f95-bird-group">
                          {g.label} ({members.length})
                        </b>
                        {members.map((p) => (
                          <div
                            key={p.id}
                            role="option"
                            aria-selected={who?.id === p.id}
                            tabIndex={0}
                            className={`f95-bird-buddy tier-${p.tier} ${p.hot ? "hot" : ""} ${who?.id === p.id ? "you" : ""}`}
                            onClick={() => setBuddy(p.id)}
                            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setBuddy(p.id)}
                          >
                            <i className="flower" aria-hidden />
                            <span className="nm">{p.handle}</span>
                            <small>{p.followersText.replace(" followers", "")}</small>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {who && (
                  <fieldset className="f95-bird-policy">
                    <legend>
                      Posting Policy: {who.name} ({who.handle})
                    </legend>
                    <p className="f95-bird-who">
                      {who.archetypeName} · {who.tierText} · {who.record}
                      {who.hot && <b className="bad"> · every recruiter has the name</b>}
                    </p>
                    <div className="f95-bird-meter">
                      <span>Banger</span>
                      <BirdMeter poster={who} />
                      <span>Cancel</span>
                    </div>
                    <small className="f95-bird-metertext">{who.meterText}</small>
                    {who.levers.map((l) => (
                      <label key={l.id}>
                        <input type="radio" name={`f95-bird-${who.id}`} checked={l.active} onChange={() => actions.setBirdLever(who.id, l.id)} />
                        <span>{t(`birdapp.lever.${l.id}`)}</span>
                        <small>{l.tradeoff}</small>
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}
            {tab === "comms" && (
              <div className="f95-bird-comms">
                {drowning && (
                  <div className="f95-msgbody f95-bird-drown">
                    <Ico name="error" size={32} />
                    <p>
                      <b>The PR team is underwater.</b> Fires Comms can't reach in time stick. Hire another Comms Rep, or tell someone to log off.
                    </p>
                  </div>
                )}
                <Field label="Desk" sub={comms.capacityText} warn={drowning}>
                  <span className="inset f95-bird-desk">{comms.deskText}</span>
                </Field>
                <Field label="Queue">
                  <Blocks value={comms.load} label={comms.deskText} tone="red" />
                </Field>
                <div className="f95-listwrap inset f95-bird-queue" role="list" aria-label="Queue">
                  {comms.queue.length === 0 && <p className="f95-bird-empty">{t("birdapp.quiet")}</p>}
                  {comms.queue.map((q) => (
                    <div key={q.id} role="listitem" className={`f95-bird-fire ${q.kind}`}>
                      <Ico name={q.kind === "cancelled" ? "error" : "warn"} size={16} />
                      <b>{q.handle}</b>
                      <span>{q.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="f95-status">
            {birdapp.tally}
            {rivals && ` · ${rivals.tally}`}
          </div>
        </Win>
      )}
    </>
  );
}

/** The preview pane: the post as a newsgroup article, its counts, how it landed, and the top reply quoted. */
function Preview({ post, face }: { post: BirdPostVM; face?: string }) {
  const t = useT();
  return (
    <article className={`f95-bird-preview inset outcome-${post.outcome}`} aria-label={`${post.handle}: ${post.text}`}>
      <div className="f95-bird-hdr">
        <span>
          <b>From:</b> {face && <span className="f95-bird-face" aria-hidden>{face}</span>}
          {post.name} &lt;{post.handle}&gt;
        </span>
        {post.lab && (
          <span>
            <b>Organization:</b> <i className="f95-labsq" style={{ "--bird-lab": post.lab.color } as CSSProperties} aria-hidden /> {post.lab.name}
          </span>
        )}
        <span>
          <b>Date:</b> {post.time}
          {post.momentText && ` (${post.momentText})`}
        </span>
        {post.replyTo && (
          <span>
            <b>In-Reply-To:</b> {post.replyTo}
          </span>
        )}
        {post.beatText && (
          <span>
            <b>Keywords:</b> {post.beatText}
          </span>
        )}
      </div>
      <p className="f95-bird-text">{post.text}</p>
      {post.quote && (
        <blockquote className="f95-bird-quote">
          {post.quote.handle} wrote:
          <br />
          &gt; {post.quote.text}
        </blockquote>
      )}
      <div className="f95-bird-counts">
        <span>{post.likesText} likes</span>
        <span>{post.repostsText} reposts</span>
        <span className={post.ratioing ? "bad" : ""}>{post.repliesText} replies</span>
        {post.outcome !== "live" && <b className={`f95-bird-outcome tone-${post.tone}`}>{t(`birdapp.outcome.${post.outcome}`)}</b>}
        {post.outcome === "live" && post.ratioing && <b className="f95-bird-outcome tone-joke">{t("birdapp.ratio")}</b>}
        {post.reviewed && <small>{t("birdapp.reviewed")}</small>}
        {post.handledText && <small>{post.handledText}</small>}
        {post.quote && post.tone === "bad" && <b className="f95-bird-outcome tone-bad">{post.outcomeText}</b>}
      </div>
      {post.reply && <blockquote>&gt; {post.reply}</blockquote>}
      {post.viral && <Sticker kind="burst">{t("birdapp.viral")}!</Sticker>}
    </article>
  );
}
