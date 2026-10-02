// Message boxes and the paperclip: bubbles, toasts, event cards, the era blue screen, the outcome card, the assistant.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog, Evidence, factionAttrs, placeBalloon, SnagCopy } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Btn, Win } from "./parts";
import { Ico } from "./icons";
import { Gauges } from "./leapfrog";
import tipsFile from "./tips.json";

const TIPS_KEY = "flt.f95.tips";
const readTipsOff = () => {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(TIPS_KEY) === "off";
  } catch {
    return false;
  }
};

/** A yellow tooltip with a 1px black border and a bold speaker line. The root keeps the `bubble` class so photo mode can copy it. */
export function Bubble({ bubble }: SlotPropsMap["Bubble"]) {
  return (
    <div className={`bubble f95-tip bubble-${bubble.kind}${bubble.speech ? " speech" : ""}`} {...factionAttrs(bubble.faction)}>
      <b>
        {bubble.speaker || bubble.kind}
        {bubble.faction && <em className="f95-tipfaction"> ({bubble.faction.short})</em>}
      </b>
      {bubble.text}
    </div>
  );
}

const TONE_ICON = { bad: "warn", good: "info", joke: "info", neutral: "info", hint: "info", warn: "warn" } as const;

export function Toast({ toast, actions }: SlotPropsMap["Toast"]) {
  if (toast.snag) return <SnagBox toast={toast} actions={actions} />;
  if (toast.tone === "hint" || toast.tone === "warn") {
    return (
      <div className={`f95-toast ${toast.tone}`} role={toast.tone === "warn" ? "status" : undefined}>
        <Ico name={TONE_ICON[toast.tone]} size={18} />
        <span>{toast.text}</span>
      </div>
    );
  }
  if (toast.batch) {
    // The pile (FLT-51), in the paperclip's own words; the worst of it first, the rest on the ticker.
    const worst = toast.batch.filter((b) => b.tone === "bad");
    const lines = [...worst, ...toast.batch.filter((b) => b.tone !== "bad")];
    const more = lines.length - BATCH_LINES;
    return (
      <button type="button" className={`f95-toast f95-batch ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)} title="Click to dismiss">
        <Ico name={TONE_ICON[toast.tone]} size={18} />
        <span>
          <b>It looks like {toast.batch.length} things happened while you were busy.</b>
          <ul>
            {lines.slice(0, BATCH_LINES).map((b) => (
              <li key={b.text} className={b.tone}>
                {b.text}
              </li>
            ))}
          </ul>
          {more > 0 && <i>...and {more} more on the ticker. Would you like help with that?</i>}
        </span>
      </button>
    );
  }
  return (
    <button type="button" className={`f95-toast ${toast.tone}`} onClick={() => actions.dismissToast(toast.id)} title="Click to dismiss">
      <Ico name={TONE_ICON[toast.tone]} size={18} />
      <span>{toast.text}</span>
    </button>
  );
}

/**
 * Why the game just dropped to 1× (FLT-76) is not a balloon you might miss at 10×: it is a message box of its own, coach or
 * no coach, and it stays until it is read. "Pretend it didn't happen" goes back to top speed (which also closes it).
 */
function SlowBox({ toast, actions }: SlotPropsMap["Toast"]) {
  const ok = () => actions.dismissToast(toast.id);
  return (
    <div className="f95-slowbox" role="alert">
      <Win className="f95-msgbox" title="Speed Governor" icon="warn" buttons={[{ g: "close", label: "OK", onClick: ok }]}>
        <div className="f95-msgbody">
          <Ico name="warn" size={36} />
          <div>
            <p className="f95-slowtext">{toast.text}</p>
            <p className="f95-slowwhy">Frontier 95 has slowed your lab down so you can look at it. Looking is optional.</p>
          </div>
        </div>
        <div className="f95-row">
          <Btn onClick={() => actions.setSpeed(10)}>Pretend it didn't happen</Btn>
          <Btn def onClick={ok}>
            OK
          </Btn>
        </div>
      </Win>
    </div>
  );
}

/**
 * The recovery toast (FLT-84) as the error box everyone remembers, except this program is not being shut down: it caught the
 * error and kept going. Its own little window, not the paperclip's balloon, so it shows while the coach is talking too.
 */
function SnagBox({ toast, actions }: SlotPropsMap["Toast"]) {
  const t = useT();
  const ok = () => actions.dismissToast(toast.id);
  return (
    <div className="f95-snag" role="alert">
      <Win className="f95-msgbox" title={t("snag.title")} icon="error" buttons={[{ g: "close", label: t("snag.ok"), onClick: ok }]}>
        <div className="f95-msgbody">
          <Ico name="error" size={36} />
          <p>{t("snag.text")}</p>
        </div>
        <div className="f95-row">
          <SnagCopy id={toast.id} actions={actions} className="f95-btn" />
          <Btn def onClick={ok}>
            {t("snag.ok")}
          </Btn>
        </div>
      </Win>
    </div>
  );
}

/** A batch lists this many; the rest are on the ticker. */
const BATCH_LINES = 4;

const REPLIES: Record<string, string> = {
  align: "Alignment: loading. Estimated time remaining: unknown. Would you like to speed this up? (See: the button with three arrows.)",
  ship: "Shipping faster! Have you tried the button with three arrows? It's the last of the four speeds.",
};

/**
 * The paperclip. It hosts toasts, hints and standing warnings in one yellow balloon (they queue there, so nothing speaks over
 * anything else), and offers a tip when the lab is quiet.
 */
export function Assistant({ vm, actions }: SlotPropsMap["Assistant"]) {
  const t = useT();
  const [tipsOff, setTipsOff] = useState(readTipsOff);
  const [tip, setTip] = useState<number | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  // Today's Drama: the pack the clip has been told "no thanks" about (it asks again when a newer one lands).
  const [dramaNo, setDramaNo] = useState<string | null>(null);
  const phone = vm.layout.compact;
  // One at a time, the newest toast winning; the game only sends a hint while nobody is talking.
  const hints = vm.hints;
  const toasts = vm.toasts.filter((t) => !t.snag && !t.pinned).slice(-1);
  // A caught error (FLT-84) gets its own error box, coach or no coach; so does the bad news that slowed the game (FLT-76).
  const snag = vm.toasts.find((t) => t.snag);
  const slow = vm.toasts.filter((t) => t.pinned).at(-1);
  const snagBox = (snag || slow) && (
    <>
      {slow && <SlowBox toast={slow} actions={actions} />}
      {snag && <SnagBox toast={snag} actions={actions} />}
    </>
  );
  // Standing warnings ("your entrance isn't connected") stay in the balloon until they are fixed.
  const warnings = vm.warnings;
  const busy = warnings.length > 0 || toasts.length > 0 || hints.length > 0;

  // When it is quiet, the clip offers a tip every so often (never on a phone, where the campus needs the room).
  useEffect(() => {
    if (tipsOff || phone || busy) return;
    const show = window.setInterval(() => setTip((i) => (i === null ? Math.floor(vm.stats.date.length + vm.training.run) % tipsFile.tips.length : i)), 40_000);
    return () => window.clearInterval(show);
  }, [tipsOff, phone, busy, vm.stats.date.length, vm.training.run]);
  useEffect(() => {
    if (tip === null || reply) return;
    const id = window.setTimeout(() => setTip(null), 16_000);
    return () => window.clearTimeout(id);
  }, [tip, reply]);

  const closeTip = () => {
    setTip(null);
    setReply(null);
  };
  const dismissForever = () => {
    try {
      localStorage.setItem(TIPS_KEY, "off");
    } catch {
      /* private mode: off for this visit */
    }
    setTipsOff(true);
    closeTip();
  };
  const next = () => setTip((i) => ((i ?? 0) + 1) % tipsFile.tips.length);

  // While a coach mark is up the paperclip is in the coach's balloon; there is only one of it.
  if (vm.coach) return snagBox ?? null;
  return (
    <div className="f95-assistant" aria-live="polite">
      {snagBox}
      {busy && (
        <div className="f95-balloon" role="status">
          {warnings.map((w) => (
            <div key={w} className="f95-toast warn" role="status">
              <Ico name="warn" size={18} />
              <span>{w}</span>
            </div>
          ))}
          {hints.map((h) => (
            <div key={h} className="f95-toast hint">
              <Ico name="info" size={18} />
              <span>{t(`hint.${h}`)}</span>
            </div>
          ))}
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} actions={actions} />
          ))}
        </div>
      )}
      {!busy && tip === null && !phone && vm.drama.fresh && vm.drama.latest && dramaNo !== vm.drama.latest.id && (
        <div className="f95-balloon tipballoon" role="status">
          <b>It looks like the AI industry is fighting again!</b> Would you like to see Today's Drama? ({vm.drama.latest.title})
          <div className="f95-options">
            <button type="button" className="a" onClick={() => actions.openDrama()}>
              Show me the drama
            </button>
            <button type="button" onClick={() => setDramaNo(vm.drama.latest?.id ?? null)}>
              No, I'm trying to run a lab
            </button>
          </div>
        </div>
      )}
      {!busy && tip !== null && (
        <div className="f95-balloon tipballoon" role="status">
          <b>{tipsFile.lead}</b> {tipsFile.tips[tip]}
          {reply ? (
            <>
              <p>{reply}</p>
              <Btn onClick={closeTip}>Got it!</Btn>
            </>
          ) : (
            <div className="f95-options">
              <button type="button" className="a" onClick={() => setReply(REPLIES.align!)}>
                Get help with alignment
              </button>
              <button type="button" onClick={() => setReply(REPLIES.ship!)}>
                Just ship it faster
              </button>
              <button type="button" onClick={dismissForever}>
                Don't show me this tip again
              </button>
              <button type="button" className="more" onClick={next}>
                Next tip ▸
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className={`f95-clip ${vm.toasts.length > 0 ? "wiggle" : ""}`}
        aria-label={t("assistant.title")}
        title={t("assistant.title")}
        onClick={() => (tip === null ? setTip(tip ?? 0) : closeTip())}
      >
        <svg viewBox="0 0 29 32" shapeRendering="crispEdges" aria-hidden>
          <path d="M10 30V8a5 5 0 0 1 10 0v18a3 3 0 0 1-6 0V10" fill="none" stroke="#606060" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="3" fill="#fff" stroke="#000" />
          <circle cx="19" cy="12" r="3" fill="#fff" stroke="#000" />
          <rect x="12" y="11" width="2" height="2" fill="#000" />
          <rect x="19" y="11" width="2" height="2" fill="#000" />
          <path d="M9 7l4-2M22 7l-4-2" stroke="#000" />
        </svg>
      </button>
    </div>
  );
}

const ICON_BY_TONE = { bad: "error", joke: "warn", good: "info", neutral: "info" } as const;

/**
 * "This leaves 1.8 months of runway": a Win95 warning box. OK does it; Cancel (the default, and Escape, and the close box, and a
 * click outside) keeps the runway. Time is held while it is up.
 */
export function Confirm({ confirm, actions }: SlotPropsMap["Confirm"]) {
  const t = useT();
  const no = () => actions.cancelSpend();
  return (
    <Dialog label="Lab Manager" close={no} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-msgbox tone-bad" title="Lab Manager" icon="warn" buttons={[{ g: "close", label: "Cancel", onClick: no }]} role="alertdialog" label="Lab Manager: are you sure?">
        <div className="f95-msgbody">
          <Ico name="warn" size={36} />
          <div>
            <p>{confirm.message}</p>
            <p className="f95-confirm-facts">
              {t("confirm.cost")}: {confirm.costText} · {t("confirm.runway")}: {confirm.runwayText}
              <br />
              Are you sure you want to do this?
            </p>
          </div>
        </div>
        <div className="f95-row">
          <Btn onClick={() => actions.confirmSpend()}>OK</Btn>
          <Btn def autoFocus onClick={no}>
            Cancel
          </Btn>
        </div>
        <div className="f95-status">{t("event.paused")}</div>
      </Win>
    </Dialog>
  );
}

/** The paperclip's Paperclip SVG, shared by the assistant and the coach. */
function Clip() {
  return (
    <svg viewBox="0 0 29 32" shapeRendering="crispEdges" aria-hidden>
      <path d="M10 30V8a5 5 0 0 1 10 0v18a3 3 0 0 1-6 0V10" fill="none" stroke="#606060" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="3" fill="#fff" stroke="#000" />
      <circle cx="19" cy="12" r="3" fill="#fff" stroke="#000" />
      <rect x="12" y="11" width="2" height="2" fill="#000" />
      <rect x="19" y="11" width="2" height="2" fill="#000" />
      <path d="M9 7l4-2M22 7l-4-2" stroke="#000" />
    </svg>
  );
}

/**
 * A coach mark: the paperclip steps out beside whatever the host has lit and says one line ("Click Start."), with "3 of 7" and a
 * Skip tutorial that never goes away. It waits for you to do the thing (no Next), and it never pauses the game. On a phone it docks to
 * the top or the bottom, whichever is away from the target.
 */
export function Coach({ coach, anchor, panel, avoid, layout, actions }: SlotPropsMap["Coach"]) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 120 });
  useLayoutEffect(() => {
    const b = ref.current?.getBoundingClientRect();
    if (b && (Math.abs(b.width - size.w) > 1 || Math.abs(b.height - size.h) > 1)) setSize({ w: b.width, h: b.height });
  }, [coach.id, layout.width, layout.height, size.w, size.h]);
  // The taskbar is 42px, and the news strip and the top windows are not to be covered either.
  const view = { w: layout.width, h: layout.height };
  // On a phone it spans the screen, straight above the target (or below it, for something at the top).
  const place = layout.compact ? placeBalloon(anchor, size, view, { gap: 12, panel, avoid, prefer: ["top", "bottom"], margin: { top: 52, bottom: 8, left: 4, right: 4 } }) : placeBalloon(anchor, size, view, { gap: 18, panel, avoid, margin: { top: 12, bottom: 52, left: 10, right: 10 } });
  return (
    <div key={coach.id} ref={ref} className={`f95-coach ${layout.compact ? "docked" : ""}`} style={layout.compact ? { top: place.y } : { left: place.x, top: place.y }} role="status" aria-live="polite" aria-label={t("assistant.title")}>
      <div className="f95-balloon">
        {coach.guide && coach.ask && <p className="f95-asking">{t("coach.ask", { ask: coach.ask })}</p>}
        <p className="f95-saying">{coach.text}</p>
        <div className="f95-coachfoot">
          {coach.guide ? (
            <button type="button" className="f95-skip" onClick={() => actions.endShowMe()}>
              {t("coach.gotIt")}
            </button>
          ) : (
            <small>{t("coach.step", { n: coach.step, total: coach.of })}</small>
          )}
          {coach.canSkip && (
            <button type="button" className="f95-skip" onClick={() => actions.coachSkip()}>
              {t("coach.skip")}
            </button>
          )}
        </div>
      </div>
      <span className="f95-clip wiggle" aria-hidden>
        <Clip />
      </span>
    </div>
  );
}

type UnlockGroupVM = NonNullable<SlotPropsMap["UnlockCard"]["unlock"]["groups"]>[number];
/** Two columns on a desktop (Jem): what you place (Build, Hire) on the left, what the rung switches on on the right. */
const placed = (g: UnlockGroupVM) => g.id === "build" || g.id === "hire";
const twoColumns = (groups: readonly UnlockGroupVM[] | undefined) => !!groups?.some(placed) && groups.some((g) => !placed(g));

/**
 * FLT-93: what a rung brings, by kind (Build, Hire, New systems, New apps), one line each on what it is for, and a Show me
 * that puts the card away and has the paperclip walk you to it.
 */
function UnlockGroups({ groups, actions }: { groups: NonNullable<SlotPropsMap["UnlockCard"]["unlock"]["groups"]>; actions: SlotPropsMap["UnlockCard"]["actions"] }) {
  const t = useT();
  const column = (side: readonly UnlockGroupVM[]) => (
    <div className="f95-unlockcol">
      {side.map((g) => (
        <fieldset key={g.id} className={`f95-unlockgroup ${g.id}`}>
          <legend>{g.title}</legend>
          <ul>
            {g.entries.map((e) => (
              <li key={e.name}>
                <span className="f95-unlockwhat">
                  <b>{e.name}</b>
                  {e.line}
                </span>
                {e.anchor && (
                  <Btn className="f95-showme" data-showme={e.anchor} onClick={() => actions.showMe(e.anchor!)}>
                    {t("showMe")}
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  );
  return (
    <div className={`f95-unlockgroups${twoColumns(groups) ? " two" : ""}`}>
      {groups.some(placed) && column(groups.filter(placed))}
      {groups.some((g) => !placed(g)) && column(groups.filter((g) => !placed(g)))}
    </div>
  );
}

/** "New items available!": a Win95 message box, RCT-news style. It does not stop the game or dim it; OK puts it away. */
export function UnlockCard({ unlock, actions }: SlotPropsMap["UnlockCard"]) {
  const t = useT();
  return (
    <div className={`f95-unlock${twoColumns(unlock.groups) ? " wide" : ""}`} role="status">
      <Win className="f95-msgbox" title="Frontier 95" icon="info" buttons={[{ g: "close", label: t("unlock.ok"), onClick: () => actions.dismissUnlock() }]} label={unlock.title}>
        <div className="f95-msgbody">
          <Ico name="info" size={36} />
          <div>
            <h2>{unlock.title}</h2>
            <p>{unlock.body}</p>
            {unlock.groups?.length ? (
              <UnlockGroups groups={unlock.groups} actions={actions} />
            ) : (
              unlock.items.length > 0 && (
                <ul className="f95-unlockitems">
                  {unlock.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )
            )}
            {unlock.quip && <p className="f95-quip">{unlock.quip}</p>}
          </div>
        </div>
        <div className="f95-row">
          <Btn def autoFocus onClick={() => actions.dismissUnlock()}>
            OK
          </Btn>
        </div>
      </Win>
    </div>
  );
}

/** Help ▸ How to play, as a Win95 Help window: three topics on one page, and a button to replay the tutorial. */
export function HowToPlay({ help, actions }: SlotPropsMap["HowToPlay"]) {
  const t = useT();
  return (
    <Dialog label={help.title} close={() => actions.closeHelp()} layerClass="f95-layer" dialogClass="f95-dialogbox">
      <Win className="f95-help" title={`Frontier 95 Help: ${help.title}`} icon="help" buttons={[{ g: "close", label: t("help.close"), onClick: () => actions.closeHelp() }]} role="dialog" label={help.title}>
        <div className="f95-helpbody inset">
          <h3>{t("help.loop")}</h3>
          <ol>
            {help.loop.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <h3>{t("help.buildings")}</h3>
          <ul>
            {help.buildings.map((b) => (
              <li key={b.kind}>{b.line}</li>
            ))}
          </ul>
          <h3>{t("help.numbers")}</h3>
          <dl>
            {help.numbers.map((n) => (
              <div key={n.name}>
                <dt>{n.name}</dt>
                <dd>{n.line}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="f95-row">
          <Btn onClick={() => actions.coachReplay()}>{t("help.replay")}</Btn>
          <Btn onClick={() => actions.openBox()}>{t("help.box")}</Btn>
          <Btn def autoFocus onClick={() => actions.closeHelp()}>
            {t("help.close")}
          </Btn>
        </div>
      </Win>
    </Dialog>
  );
}

/** A Win95 message box: an icon, the news, and the choices as buttons, the first one being the default. */
export function EventCard({ event, actions }: SlotPropsMap["EventCard"]) {
  const t = useT();
  return (
    <div className="f95-layer f95-dim">
      <Win className={`f95-msgbox tone-${event.tone}`} title={event.stripe} icon="info" role="alertdialog" label={event.title}>
        <div className="f95-msgbody">
          <Ico name={ICON_BY_TONE[event.tone]} size={36} />
          <div>
            <h2>{event.title}</h2>
            <p>{event.body}</p>
          </div>
        </div>
        {event.kind === "auction" && (
          <div className="f95-paddles" aria-hidden>
            {event.paddles.map((p) => (
              <div key={p.id}>
                <span style={{ background: p.color }}>{p.number}</span>
                <small>{p.name}</small>
              </div>
            ))}
          </div>
        )}
        {event.response && <Gauges response={event.response} />}
        {event.investigation && <Evidence investigation={event.investigation} />}
        <div className="f95-choices">
          {event.choices.map((c, i) => (
            <Btn key={c.label} def={i === 0} disabled={!!c.disabled} title={c.disabled} onClick={() => actions.choose(event.id, i)} autoFocus={i === 0}>
              <span className="k">{c.key}</span>
              <span className="tx">
                <b>{c.label}</b>
                <small>{c.hint}</small>
              </span>
            </Btn>
          ))}
        </div>
        <div className="f95-status">{t("event.paused")}</div>
      </Win>
    </div>
  );
}

/** The era title card as a friendly blue screen. Any key (or a tap) continues; the game handles the keys. */
export function EraCard({ era, actions }: SlotPropsMap["EraCard"]) {
  return (
    <div className={`f95-bsod era-${era.n}`} role="alertdialog" aria-label={era.name} onClick={() => actions.continueEra()}>
      <div className="f95-bsod-in">
        <span className="f95-bsod-title">Frontier 95</span>
        <p>A fatal exception 0E has occurred at CAPABILITY:∞. The current era has been terminated. This is fine.</p>
        <p>
          * {era.kicker}: {era.line}
        </p>
        <ul>
          {era.changes.map((c) => (
            <li key={c}>* {c}</li>
          ))}
        </ul>
        <p>
          Press any key to continue to ERA {era.n}: {era.name.toUpperCase()} <span className="f95-cursor" aria-hidden />
        </p>
        <button type="button" className="f95-bsod-go" onClick={(e) => { e.stopPropagation(); actions.continueEra(); }}>
          {era.continueLabel} »
        </button>
      </div>
    </div>
  );
}

export function Outcome({ outcome, actions }: SlotPropsMap["Outcome"]) {
  const t = useT();
  return (
    <div className="f95-layer f95-dim">
      <Win className="f95-msgbox" title={outcome.stripe} icon={outcome.won ? "info" : "error"} role="alertdialog" label={outcome.won ? "You won" : "Game over"}>
        <div className="f95-msgbody">
          <Ico name={outcome.won ? "info" : "error"} size={36} />
          <div>
            <h2>{outcome.headline}</h2>
            <p>{outcome.note}</p>
          </div>
        </div>
        <dl className="f95-facts small">
          {outcome.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd className={`inset ${s.bad ? "bad" : ""}`}>{s.text}</dd>
            </div>
          ))}
        </dl>
        <div className="f95-row">
          {outcome.won && <Btn onClick={() => actions.keepPlaying()}>{t("outcome.keepPlaying")}</Btn>}
          <Btn def onClick={() => actions.newLab()} autoFocus>
            {t("outcome.newLab")}
          </Btn>
        </div>
        <div className="f95-status">{outcome.date}</div>
      </Win>
    </div>
  );
}

export function NewsArrival({ arrival, actions }: SlotPropsMap["NewsArrival"]) {
  const t = useT();
  return (
    <div className="f95-tooltip arrival" role="status">
      <Ico name="news" size={20} />
      <span>{arrival.text}</span>
      <Btn onClick={() => actions.viewNews(arrival.id)}>{t("news.read")}</Btn>
      <Btn onClick={() => actions.skipNews()}>{t("news.skip")}</Btn>
    </div>
  );
}
