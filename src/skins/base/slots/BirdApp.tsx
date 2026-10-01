import { useState } from "react";
import { AuraSpark, BirdMeter, BirdPostCard } from "../../kit";
import { useT } from "../../context";
import type { SlotPropsMap } from "../../types";

type Tab = "timeline" | "posters" | "comms";

/**
 * The Bird App (FLT-69): folded, the headline and an Aura bar (and the latest banger or cancel, if it is fresh); open,
 * the Aura with what it is doing for the lab, today's moments, and three tabs: the timeline (live posts climbing, then
 * the landed log), the posters (a banger↔cancel meter and three levers each, the trade-off on the button) and the Comms
 * desk's queue. Every label is a string, so a skin can make it a guestbook without touching the markup.
 */
export function BirdApp({ birdapp, layout, actions }: SlotPropsMap["BirdApp"]) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("timeline");
  const { open, comms } = birdapp;
  const tabs: { id: Tab; label: string }[] = [
    { id: "timeline", label: t("birdapp.timeline") },
    { id: "posters", label: t("birdapp.posters") },
    { id: "comms", label: comms.queue.length > 0 ? `${t("birdapp.comms")} (${comms.queue.length})` : t("birdapp.comms") },
  ];
  const spot = birdapp.spotlight;
  return (
    <section className={`birdapp panel ${open ? "open" : ""}`} data-desk={comms.desk} aria-label={t("birdapp.title")}>
      <button type="button" className="birdapp-head" onClick={() => actions.toggleBirdApp()} aria-expanded={open} title={birdapp.headline}>
        <BirdLogo />
        <b>{t("birdapp.title")}</b>
        <span className="birdapp-sub">{birdapp.headline}</span>
        {!open && (birdapp.unread ?? 0) > 0 && <b className="birdapp-unread" title={`${birdapp.unread} new`}>{birdapp.unread}</b>}
        <span className="birdapp-fold" aria-hidden>
          {open ? "▼" : "▲"}
        </span>
      </button>
      <div className="birdapp-aura" title={birdapp.auraEffects}>
        <span className="birdapp-auralabel">{t("birdapp.aura")}</span>
        <span className="birdapp-aurabar" role="meter" aria-label={birdapp.auraText} aria-valuemin={0} aria-valuemax={100} aria-valuenow={birdapp.aura}>
          <i style={{ width: `${birdapp.aura}%` }} />
        </span>
        <b>{birdapp.aura}</b>
        {open && <AuraSpark values={birdapp.auraHistory} />}
      </div>
      {!open && spot && (
        <p className={`birdapp-spot tone-${spot.tone}`}>
          {spot.handle}: {spot.outcome === "live" ? "" : t(`birdapp.outcome.${spot.outcome}`)}
          {spot.viral && <span className="bird-viral">{t("birdapp.viral")}</span>}
        </p>
      )}
      {open && (
        <div className="birdapp-body">
          <p className="birdapp-effects">{birdapp.auraEffects}</p>
          {birdapp.moments.length > 0 && (
            <div className="birdapp-moments">
              {birdapp.moments.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          )}
          <div className="birdapp-tabs" role="tablist" aria-label={t("birdapp.title")}>
            {tabs.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? "on" : ""} onClick={() => setTab(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          {tab === "timeline" && (
            <div className="birdapp-feed" role="tabpanel">
              {birdapp.typing && <p className="birdapp-typing">{birdapp.typing}</p>}
              {birdapp.live.length === 0 && birdapp.log.length === 0 && <p className="birdapp-empty">{t("birdapp.empty")}</p>}
              {birdapp.live.length > 0 && <h4>{t("birdapp.live")}</h4>}
              {birdapp.live.map((p) => (
                <BirdPostCard key={p.id} post={p} />
              ))}
              {birdapp.log.length > 0 && <h4>{t("birdapp.log")}</h4>}
              {birdapp.log.slice(0, layout.compact ? 4 : 8).map((p) => (
                <BirdPostCard key={p.id} post={p} compact />
              ))}
            </div>
          )}
          {tab === "posters" && (
            <ul className="birdapp-posters" role="tabpanel">
              {birdapp.posters.map((p) => (
                <li key={p.id} className={`tier-${p.tier} ${p.hot ? "hot" : ""}`}>
                  <div className="birdapp-who">
                    <span className="bird-av" aria-hidden>
                      {p.glyph}
                    </span>
                    <span>
                      <b>{p.name}</b> <span className="bird-handle">{p.handle}</span>
                      <small>
                        {p.archetypeName} · {p.tierText} · {p.followersText}
                      </small>
                    </span>
                  </div>
                  <div className="birdapp-meterrow">
                    <BirdMeter poster={p} />
                    <small>{p.meterText}</small>
                  </div>
                  <div className="birdapp-levers" role="radiogroup" aria-label={p.name}>
                    {p.levers.map((l) => (
                      <button key={l.id} type="button" role="radio" aria-checked={l.active} className={l.active ? "on" : ""} onClick={() => actions.setBirdLever(p.id, l.id)} title={l.tradeoff}>
                        <b>{t(`birdapp.lever.${l.id}`)}</b>
                        <small>{l.tradeoff}</small>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
              <li className="birdapp-count">{birdapp.postersText}</li>
            </ul>
          )}
          {tab === "comms" && (
            <div className="birdapp-comms" role="tabpanel">
              <p className="birdapp-desk">{comms.deskText}</p>
              <span className="birdapp-load" role="meter" aria-label={comms.deskText} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(comms.load * 100)}>
                <i style={{ width: `${Math.round(comms.load * 100)}%` }} />
              </span>
              <small>{comms.capacityText}</small>
              {comms.queue.length === 0 ? (
                <p className="birdapp-empty">{t("birdapp.quiet")}</p>
              ) : (
                <ul className="birdapp-queue">
                  {comms.queue.map((q) => (
                    <li key={q.id} className={q.kind}>
                      <b>{q.handle}</b> {q.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="birdapp-tally">{birdapp.tally}</p>
        </div>
      )}
    </section>
  );
}

/** A small bird, drawn (no emoji font needed). */
export function BirdLogo({ size = 16 }: { size?: number }) {
  return (
    <svg className="bird-logo" width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d="M2 9c2 3 6 4 9 2l3-4-2 .3C11 5 9 4.5 7.5 5.5 6 6.5 6 8 6.5 9 5 9 3.5 8.6 2 9z" fill="currentColor" />
      <circle cx="11" cy="6.3" r=".7" fill="var(--flt-color-panel, #fff)" />
    </svg>
  );
}
