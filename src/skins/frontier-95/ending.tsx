// How the lab ended (FLT-11), in 1995: the last Frontier Times in Internet Exploder, the run in a NoteBad window beside
// it, and The Takeover as a title bar that is no longer yours.
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Blocks, Btn, Win } from "./parts";
import { useAutoPause, useJumpTo } from "../kit";

const SHARE_NOTE: Record<string, string> = { making: "Printing the card… (do not turn off your computer)", error: "General protection fault in PRINTER.DRV. Try again?" };

export function Ending({ ending, layout, actions }: SlotPropsMap["Ending"]) {
  const p = ending.paper;
  const share = ending.share;
  const next = useJumpTo<HTMLFieldSetElement>(layout.compact);
  return (
    <div className="f95-layer f95-dim">
      <div className={`f95-end ${layout.compact ? "compact" : ""}`} role="dialog" aria-modal="true" aria-label={`The end: ${ending.title}`}>
        <Win className="f95-ie f95-end-paper" title="The Frontier Times — FINAL EDITION — Internet Exploder 3.0" icon="globe" buttons={[{ g: "close", label: "Close", disabled: true }]}>
          <div className="f95-toolbar">
            <span className="f95-address inset">
              <small>Address:</small> http://www.frontier-times.example/the-end/{ending.id}
            </span>
          </div>
          <article className="f95-paper inset">
            <div className="eyebrow">
              <span>Independent. Mostly.</span>
              <span>{p.issue}</span>
              <span>Final edition</span>
            </div>
            <h1>{p.masthead}</h1>
            <div className="eyebrow">
              <span>{p.date}</span>
              <span>All the news that's fit to prompt</span>
            </div>
            <hr />
            <div className="lead">
              <div>
                <span className="sec">{p.kicker}</span>
                <h2>{p.headline}</h2>
                <p>{p.deck}</p>
                <small>By our extremely online correspondent</small>
              </div>
              <figure>
                {p.photo ? <img src={p.photo} alt={`The ${ending.lab} campus, the day the paper went to press`} /> : <div className="nophoto">Developing the photo…</div>}
                <figcaption>{p.caption}</figcaption>
                <div className={`f95-end-stamp tone-${ending.tone}`} aria-hidden>
                  {ending.title}
                </div>
              </figure>
            </div>
            <hr />
            <div className="subs">
              {p.subs.map((s, i) => (
                <section key={i}>
                  <span className="sec">{["Also", "Meanwhile", "Elsewhere"][i % 3]}</span>
                  <h3>{s}</h3>
                </section>
              ))}
            </div>
            <hr />
            <div className="bottom single">
              <section>
                <span className="sec">Classifieds · No refunds</span>
                <p>{p.classified}</p>
              </section>
            </div>
            <footer className="f95-end-signoff">{p.signoff}</footer>
          </article>
          <div className="f95-status">Done</div>
        </Win>
        <Win className="f95-end-run" title={`${ending.daily ? "TODAYS_LAB" : "RUN"}.TXT - NoteBad`} icon="doc">
          <div className="f95-end-body">
            {ending.daily && <div className="f95-end-daily">{ending.daily}</div>}
            <b className="f95-end-lab">
              {ending.lab}
              {ending.labNumber > 1 && <small className="f95-end-labno"> · Lab #{ending.labNumber}</small>}
            </b>
            <div className="f95-end-strip" aria-label="The run by era, in squares">
              {ending.strip}
            </div>
            <dl className="f95-facts f95-end-facts">
              {ending.stats.map((s) => (
                <div key={s.key}>
                  <dt>
                    <span aria-hidden>{s.emoji}</span> {s.label}
                  </dt>
                  <dd className="inset">{s.text}</dd>
                </div>
              ))}
            </dl>
            {ending.streak && <div className="f95-end-streak">🔥 {ending.streak.text}</div>}
            {ending.versus && (
              <div className={`f95-end-versus inset verdict-${ending.versus.verdict}`}>
                <small>{ending.versus.line}</small>
                <b>{ending.versus.text}</b>
              </div>
            )}
            <fieldset className="f95-end-next" ref={next.ref}>
              <legend>What now?</legend>
              <p>{ending.next.prompt}</p>
              {ending.refound ? (
                <>
                  <p className="f95-end-nextname">
                    <Ico name="folder" size={18} /> C:\LABS\{ending.refound.name}
                  </p>
                  <div className="f95-choices f95-end-perks" role="group" aria-label={`${ending.next.label}: keep one thing`}>
                    {ending.refound.perks.map((perk, i) => (
                      <Btn key={perk.id} def={i === 0} onClick={() => actions.foundLab?.(perk.id)} autoFocus={i === 0 && !layout.compact}>
                        <span className="k">{i + 1}</span>
                        <span className="tx">
                          <b>{perk.label}</b>
                          <small>{perk.blurb}</small>
                        </span>
                      </Btn>
                    ))}
                  </div>
                </>
              ) : (
                ending.keepPlaying && (
                  <Btn def onClick={() => actions.keepPlaying()} autoFocus={!layout.compact}>
                    {ending.next.label}
                  </Btn>
                )
              )}
            </fieldset>
            <div className="f95-end-buttons">
              <Btn onClick={() => actions.shareEnding?.()} disabled={share.status === "making"}>
                {share.native ? "Share the front page..." : "Save share card..."}
              </Btn>
              <Btn onClick={() => actions.copyLink?.()}>{share.status === "linked" ? "Link copied!" : "Copy challenge link"}</Btn>
              <Btn onClick={() => actions.copySummary?.()}>{share.status === "copied" ? "Copied!" : "Copy run summary"}</Btn>
              <Btn onClick={() => actions.newLab()}>{ending.refound ? "Start from scratch" : "New lab"}</Btn>
              <Btn onClick={() => actions.playDaily?.()}>Play today's lab</Btn>
            </div>
            {share.card && <img className="f95-end-card inset" src={share.card} alt="The share card" />}
          </div>
          <div className="f95-status">{share.note ?? SHARE_NOTE[share.status] ?? "Ready"}</div>
        </Win>
      </div>
      {next.show && (
        <Btn def className="f95-end-jump" onClick={next.jump}>
          What now? ↓
        </Btn>
      )}
    </div>
  );
}

export function Takeover({ takeover }: SlotPropsMap["Takeover"]) {
  return (
    <>
      <div className="f95-takeover" role="status">
        <div className="f95-tb">
          <Ico name="net" size={18} />
          <span className="f95-tt">{takeover.title}</span>
        </div>
        <small>
          {takeover.placed === 1 ? "1 building placed" : `${takeover.placed} buildings placed`} · Please do not touch the mouse
        </small>
      </div>
      {takeover.thanks && (
        <div className="f95-layer f95-takeover-thanks">
          <Win className="f95-msgbox" title={takeover.manager} icon="info" role="alertdialog" label={takeover.thanks}>
            <div className="f95-msgbody">
              <Ico name="info" size={36} />
              <div>
                <h2>{takeover.thanks}</h2>
              </div>
            </div>
            <div className="f95-row">
              <Btn def disabled>
                OK
              </Btn>
            </div>
            <div className="f95-status">{takeover.manager} will click it for you.</div>
          </Win>
        </div>
      )}
    </>
  );
}

/** The Memo (FLT-57), in 1995: a file copy that takes five days, then a late edition in Internet Exploder. */
export function Memo({ memo, layout, actions }: SlotPropsMap["Memo"]) {
  const extra = memo.phase === "extra" ? memo.extra : null;
  useAutoPause(actions, "memo-extra", !!extra);
  if (!extra) {
    return (
      <Win className={`f95-memo-copy ${memo.daysLeft <= 1 ? "soon" : ""}`} title="Copying..." icon="doc" role="status" label={`${memo.title}. ${memo.line}`}>
        <div className="f95-memo-body">
          <div className="f95-memo-fly" aria-hidden>
            <Ico name="folder" size={24} />
            <span className="f95-memo-paper">
              <Ico name="doc" size={18} />
            </span>
            <Ico name="folder" size={24} />
          </div>
          <p>
            MEMO.DOC <small>From 'Leadership' to 'Your desk'</small>
          </p>
          <Blocks value={memo.progress} label={memo.title} tone={memo.daysLeft <= 1 ? "red" : "navy"} />
          <p className="f95-memo-line">{memo.line}</p>
          <small className="f95-memo-left">{memo.daysLeft === 0 ? "0 days remaining. It's here." : `${memo.title.replace("The Memo · ", "")} remaining`}</small>
        </div>
      </Win>
    );
  }
  return (
    <div className="f95-layer f95-dim">
      <Win className={`f95-ie f95-memo-extra ${layout.compact ? "compact" : ""}`} title="The Frontier Times — LATE EDITION — Internet Exploder 3.0" icon="globe" role="dialog" label={extra.headline} buttons={[{ g: "close", label: "Close", onClick: () => actions.dismissMemo?.(memo.key) }]}>
        <article className="f95-paper inset">
          <div className="eyebrow">
            <span>{extra.kicker}</span>
            <span>The box marked {extra.choice.toUpperCase()}</span>
            <span>Late edition</span>
          </div>
          <h1>{extra.masthead}</h1>
          <hr />
          <span className="sec">{extra.kicker}</span>
          <h2>{extra.headline}</h2>
          <p>{extra.deck}</p>
          {extra.reactions.length > 0 && (
            <>
              <hr />
              <span className="sec">Reactions from campus</span>
              <div className="f95-memo-quotes">
                {extra.reactions.map((r) => (
                  <blockquote key={r.name}>
                    <p>“{r.text}”</p>
                    <cite>
                      {r.name}, {r.role}
                    </cite>
                  </blockquote>
                ))}
              </div>
            </>
          )}
          <hr />
          <span className="sec">From now on</span>
          <ul className="f95-memo-effects">
            {extra.effects.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </article>
        <div className="f95-row">
          <Btn def onClick={() => actions.dismissMemo?.(memo.key)} autoFocus>
            Back to work
          </Btn>
        </div>
      </Win>
    </div>
  );
}

/** A friend's challenge (FLT-57): a message box, the way 1995 delivered bad news about your friends. */
export function Challenge({ challenge, layout, actions }: SlotPropsMap["Challenge"]) {
  useAutoPause(actions, "challenge", true);
  return (
    <div className="f95-layer f95-dim">
      <Win className={`f95-msgbox f95-challenge ${layout.compact ? "compact" : ""}`} title={challenge.daily ? `Challenge - ${challenge.daily}` : "Challenge from a friend"} icon="info" role="dialog" label={`${challenge.line} ${challenge.ask}`}>
        <div className="f95-msgbody">
          <Ico name="info" size={36} />
          <div>
            <p>{challenge.line}</p>
            <h2>{challenge.ask}</h2>
            <div className={`f95-challenge-result tone-${challenge.tone}`}>
              <span className="f95-end-stamp static">{challenge.ending}</span>
              <small>{challenge.stats}</small>
            </div>
            <small className="f95-challenge-note">Same seed, same campus. Nobody's name in the link.</small>
          </div>
        </div>
        <div className="f95-row">
          <Btn def onClick={() => actions.dismissChallenge?.()} autoFocus>
            {challenge.cta}
          </Btn>
        </div>
      </Win>
    </div>
  );
}
