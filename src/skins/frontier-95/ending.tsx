// How the lab ended (FLT-11), in 1995: the last Frontier Times in Internet Exploder, the run in a Notepad window beside
// it, and The Takeover as a title bar that is no longer yours.
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Btn, Win } from "./parts";

const SHARE_NOTE: Record<string, string> = { making: "Printing the card… (do not turn off your computer)", error: "General protection fault in PRINTER.DRV. Try again?" };

export function Ending({ ending, layout, actions }: SlotPropsMap["Ending"]) {
  const p = ending.paper;
  const share = ending.share;
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
        <Win className="f95-end-run" title={`${ending.daily ? "TODAYS_LAB" : "RUN"}.TXT - Notepad`} icon="doc">
          <div className="f95-end-body">
            {ending.daily && <div className="f95-end-daily">{ending.daily}</div>}
            <b className="f95-end-lab">{ending.lab}</b>
            <div className="f95-end-strip" aria-label="The run by era, in squares">
              {ending.strip}
            </div>
            <dl className="f95-facts small">
              {ending.stats.map((s) => (
                <div key={s.key}>
                  <dt>
                    <span aria-hidden>{s.emoji}</span> {s.label}
                  </dt>
                  <dd className="inset">{s.text}</dd>
                </div>
              ))}
            </dl>
            <div className="f95-end-buttons">
              <Btn def onClick={() => actions.shareEnding?.()} disabled={share.status === "making"} autoFocus>
                {share.native ? "Share the front page..." : "Save share card..."}
              </Btn>
              <Btn onClick={() => actions.copySummary?.()}>{share.status === "copied" ? "Copied!" : "Copy run summary"}</Btn>
              {ending.keepPlaying && <Btn onClick={() => actions.keepPlaying()}>Keep watching</Btn>}
              <Btn onClick={() => actions.newLab()}>New lab</Btn>
              <Btn onClick={() => actions.playDaily?.()}>Play today's lab</Btn>
            </div>
            {share.card && <img className="f95-end-card inset" src={share.card} alt="The share card" />}
          </div>
          <div className="f95-status">{share.note ?? SHARE_NOTE[share.status] ?? "Ready"}</div>
        </Win>
      </div>
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
