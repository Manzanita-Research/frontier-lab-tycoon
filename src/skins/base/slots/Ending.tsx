import type { SlotPropsMap } from "../../types";

const SHARE_LABEL: Record<string, string> = { making: "Printing the card…", error: "The printer jammed. Try again?" };

/** How the lab ended: a Frontier Times front page, the run in numbers, and the card you send to friends (FLT-11). */
export function Ending({ ending, layout, actions }: SlotPropsMap["Ending"]) {
  const p = ending.paper;
  const share = ending.share;
  return (
    <div className="modal-backdrop ending-backdrop">
      <div className={`ending ending-${ending.id} tone-${ending.tone} ${layout.compact ? "compact" : ""}`} role="dialog" aria-modal="true" aria-label={`The end: ${ending.title}`}>
        <article className="front-page ending-page">
          <div className="paper-eyebrow">
            <span>Independent. Mostly.</span>
            <span>{p.issue}</span>
            <span>Final edition</span>
          </div>
          <h1 className="masthead">{p.masthead}</h1>
          <div className="paper-date">
            <span>{p.date}</span>
            <span>All the news that's fit to prompt</span>
          </div>
          <div className="paper-lead">
            <div>
              <span className="paper-section">{p.kicker}</span>
              <h2>{p.headline}</h2>
              <p className="paper-deck">{p.deck}</p>
              <div className="byline">By our extremely online correspondent</div>
            </div>
            <figure>
              {p.photo ? <img src={p.photo} alt={`The ${ending.lab} campus, the day the paper went to press`} /> : <div className="paper-no-photo">Developing the photo…</div>}
              <figcaption>{p.caption}</figcaption>
              <div className="ending-stamp" aria-hidden>{ending.title}</div>
            </figure>
          </div>
          <div className="paper-substories">
            {p.subs.map((s, i) => (
              <section key={i}>
                <span className="paper-section">{["Also", "Meanwhile", "Elsewhere"][i % 3]}</span>
                <h3>{s}</h3>
              </section>
            ))}
          </div>
          <div className="paper-bottom">
            <section>
              <span className="paper-section">Classifieds · No refunds</span>
              <p>{p.classified}</p>
            </section>
          </div>
          <p className="ending-signoff">{p.signoff}</p>
        </article>
        <aside className="ending-side">
          <span className="paper-section">{ending.daily ?? "The run"}</span>
          <b className="ending-lab">
            {ending.lab}
            {ending.labNumber > 1 && <small className="ending-labno">Lab #{ending.labNumber}</small>}
          </b>
          <div className="ending-strip" aria-label="The run by era, in squares">{ending.strip}</div>
          <dl className="ending-stats">
            {ending.stats.map((s) => (
              <div key={s.key}>
                <dt>
                  <span aria-hidden>{s.emoji}</span> {s.label}
                </dt>
                <dd>{s.text}</dd>
              </div>
            ))}
          </dl>
          {(ending.streak || ending.versus) && (
            <div className="ending-social">
              {ending.streak && <span className="ending-streak">🔥 {ending.streak.text}</span>}
              {ending.versus && (
                <p className={`ending-versus verdict-${ending.versus.verdict}`}>
                  <small>{ending.versus.line}</small>
                  <b>{ending.versus.text}</b>
                </p>
              )}
            </div>
          )}
          <section className="ending-next" aria-label="What now">
            <span className="paper-section">What now</span>
            <p>{ending.next.prompt}</p>
            {ending.refound ? (
              <>
                <b className="ending-next-name">{ending.refound.name}</b>
                <small className="ending-next-hint">{ending.next.label}, keeping one thing:</small>
                <div className="ending-perks">
                  {ending.refound.perks.map((perk, i) => (
                    <button key={perk.id} className={`choice plain ${i === 0 ? "primary" : ""}`} onClick={() => actions.foundLab?.(perk.id)}>
                      <b>{perk.label}</b>
                      <small>{perk.blurb}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              ending.keepPlaying && (
                <button className="choice plain primary" onClick={() => actions.keepPlaying()}>
                  <b>{ending.next.label}</b>
                </button>
              )
            )}
          </section>
          <div className="ending-buttons">
            <button className="choice plain" onClick={() => actions.shareEnding?.()} disabled={share.status === "making"}>
              <b>{share.native ? "📤 Share the front page" : "⬇ Save the share card"}</b>
            </button>
            <button className="choice plain" onClick={() => actions.copyLink?.()}>
              <b>{share.status === "linked" ? "✓ Link copied" : "🔗 Copy a challenge link"}</b>
            </button>
            <button className="choice plain" onClick={() => actions.copySummary?.()}>
              <b>{share.status === "copied" ? "✓ Copied" : "📋 Copy run summary"}</b>
            </button>
            <button className="choice plain" onClick={() => actions.newLab()}>
              <b>{ending.refound ? "Start from scratch" : "New lab"}</b>
            </button>
            <button className="choice plain" onClick={() => actions.playDaily?.()}>
              <b>Play today's lab</b>
            </button>
          </div>
          {(share.note || SHARE_LABEL[share.status]) && <p className="ending-note" role="status">{share.note ?? SHARE_LABEL[share.status]}</p>}
          {share.card && <img className="ending-card-preview" src={share.card} alt="The share card" />}
        </aside>
      </div>
    </div>
  );
}
