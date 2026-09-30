// The navigation: the build palette as the AI Labs WebRing (88×31 buttons, Prev/Next), the speed buttons as a grey web
// form, the news as a navy marquee with a badge you are not supposed to click, and the little utilities as form buttons.
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ALL_VISIBLE, DramaIcon, Marquee, reducedMotion, RunBox, useStartMenu, type StartView } from "../kit";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { BuildItemVM } from "../../ui/hud/types";
import { Gci, Spark } from "./icons";
import { Pop } from "./parts";

/** One background colour per tool, the way every button in a webring was a different one. All take white text. */
const RING: Record<string, string> = {
  path: "#006400",
  cluster: "#000080",
  hall: "#800080",
  gateway: "#b03c00",
  kombucha: "#806000",
  nap: "#006080",
  snack: "#a02060",
  demo: "#a00050",
  datacenter: "#404078",
  gas: "#5a4020",
  solar: "#0050a0",
  security: "#202080",
  bulldoze: "#404040",
  staff: "#007060",
  senate: "#303078",
};

/** The tool Prev (-1) or Next (1) lands on: round the ring, skipping the payroll and Senate tiles and anything you cannot afford. */
export function ringStep(items: readonly BuildItemVM[], dir: 1 | -1): string | null {
  const ring = items.filter((i) => !i.panel && (i.affordable || i.selected));
  if (ring.length === 0) return null;
  const at = ring.findIndex((i) => i.selected);
  const next = at === -1 ? (dir === 1 ? ring[0]! : ring[ring.length - 1]!) : ring[(at + dir + ring.length) % ring.length]!;
  return next.kind;
}

/** The build palette. Prev and Next walk the tool in your hand around the ring, and it never runs out. */
export function BuildBar({ items, tip, teasers = [], widgets = [], actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const coach = useCoach();
  const [open, setOpen] = useState(false);
  const toggle = (next: boolean) => {
    setOpen(next);
    actions.buildPanel(next);
  };
  // While the coach points at a button and the ring is shut, the "Build something" link stands in for it.
  const inside = coach.intoPanel(items);
  const strip = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.selected)?.kind;

  // Keep the tool in hand in view when the ring is wider than the screen (a phone).
  useEffect(() => {
    if (!selected) return;
    const el = strip.current?.querySelector<HTMLElement>(`[data-kind="${selected}"]`);
    el?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [selected]);

  const step = (dir: 1 | -1) => {
    const kind = ringStep(items, dir);
    if (kind) actions.place(kind);
  };

  return (
    <div className="gc-ringwrap">
      {tip && (
        <div className="gc-tip">
          <b>{tip.name}</b> · {tip.text} {tip.upkeepText && <small>{tip.upkeepText}</small>}
        </div>
      )}
      <div className="gc-box gc-parch gc-ring" data-coach-panel={open ? "" : undefined}>
        <div className="gc-nav">
          <span className="br">[ </span>
          <button type="button" className="gc-link prev" onClick={() => step(-1)} aria-label="Previous tool">
            <span>&lt;&lt; Prev</span>
          </button>
          <span className="mid">
            {" "}
            | <b className="gc-ringname"><Spark /> The AI Labs WebRing <Spark /></b>
            <button type="button" className="gc-link gc-build" aria-expanded={open} onClick={() => toggle(!open)} {...coach.attrs("start", !open && inside)}>
              {" "}
              — {t("build.menuTitle").toLowerCase()} something!
            </button>{" "}
            |{" "}
          </span>
          <button type="button" className="gc-link v next" onClick={() => step(1)} aria-label="Next tool">
            <span>Next &gt;&gt;</span>
          </button>
          <span className="br"> ]</span>
        </div>
        {open && <Ring items={items} teasers={teasers} widgets={widgets} actions={actions} done={() => toggle(false)} strip={strip} />}
      </div>
    </div>
  );
}

/**
 * The open ring. The top row is the tools (Path, Bulldoze), Facilities (the buildings, a heading per
 * section like any good homepage) and Run… (the widgets, in an address bar), then Help.
 */
export function Ring({ items, teasers = [], widgets = [], actions, done, strip, view }: Pick<SlotPropsMap["BuildBar"], "items" | "teasers" | "actions" | "widgets"> & { done: () => void; strip?: RefObject<HTMLDivElement | null>; view?: StartView }) {
  const t = useT();
  const coach = useCoach();
  const menu = useStartMenu(items, view);
  const button = (it: BuildItemVM) => (
    <button
      key={it.kind}
      type="button"
      data-kind={it.kind}
      {...coach.attrs(`build:${it.kind}`)}
      className={`gc-b88 ${it.selected ? "on" : ""} ${it.affordable ? "" : "poor"} ${it.race ? "race" : ""}`}
      style={{ "--ring": RING[it.kind] ?? "#303030" } as CSSProperties}
      onClick={() => {
        actions.place(it.kind);
        done();
      }}
      disabled={!it.affordable && !it.selected}
      aria-pressed={it.selected}
      title={it.name}
    >
      {it.hotkey !== null && <span className="hk" aria-hidden>{it.hotkey}</span>}
      <Gci name={it.kind} size={30} />
      <span className="tx">
        <span className="nm">{it.short}</span>
        <small>{it.isBulldoze ? "50% back" : it.free ? t("build.free") : it.priceText}</small>
      </span>
    </button>
  );
  const back = (
    <button type="button" className="gc-link gc-back" onClick={() => menu.setView("top")}>
      &lt;&lt; {t("run.back")}
    </button>
  );
  return (
    <div className={`gc-row view-${menu.view}`} ref={strip}>
      {menu.view === "top" && (
        <>
          {menu.tools.map(button)}
          <button type="button" className="gc-b88 gc-folder" data-testid="start-facilities" style={{ "--ring": "#8b4513" } as CSSProperties} onClick={() => menu.setView("facilities")} {...menu.facilities}>
            <span className="tx">
              <span className="nm">{t("build.facilities")}</span>
              <small>{t("build.facilitiesCount", { n: menu.count })}</small>
            </span>
          </button>
          <button
            type="button"
            className="gc-b88 gc-folder"
            data-testid="start-run"
            style={{ "--ring": "#000060" } as CSSProperties}
            onClick={() => {
              if (items.some((it) => it.selected && !it.panel)) actions.place(null);
              menu.setView("run");
            }}
          >
            <span className="tx">
              <span className="nm">{t("build.run")}</span>
              <small>{t("build.runCount", { n: widgets.length })}</small>
            </span>
          </button>
          <button
            type="button"
            className="gc-b88 help"
            onClick={() => {
              actions.openHelp();
              done();
            }}
          >
            <span className="tx">
              <span className="nm">{t("build.help")}</span>
              <small>{t("help.title")}</small>
            </span>
          </button>
        </>
      )}
      {menu.view === "facilities" && (
        <>
          {back}
          {menu.groups.map((g) => (
            <section key={g.id} className="gc-section" aria-label={t(`build.group.${g.id}`)}>
              <h4>{t(`build.group.${g.id}`)}</h4>
              <div className="gc-section-row">{g.items.map(button)}</div>
            </section>
          ))}
          {/* Not yet: the buttons you do not have, and what earns them. */}
          {teasers.length > 0 && (
            <section className="gc-section" aria-label={t("build.locked")}>
              <h4>{t("build.locked")}</h4>
              <div className="gc-section-row">
                {teasers.map((teaser, i) => (
                  <div key={`${teaser.label}-${i}`} className="gc-b88 locked" aria-disabled title={`${t("build.locked")}: ${teaser.hint}`}>
                    <span className="tx">
                      <span className="nm">{teaser.label}</span>
                      <small>{teaser.hint}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {menu.view === "run" && (
        <>
          {back}
          <RunBox
            className="gc-run"
            placeholder="http://thoughts.txt"
            widgets={widgets}
            onRun={(id) => {
              done();
              actions.openWidget(id);
            }}
          />
        </>
      )}
    </div>
  );
}

const SPEED_WORDS: Record<number, string> = { 0: "Pause", 1: "Play", 3: "Fast", 10: "Faster!!" };

/** "Speed: [Pause] [Play] [Fast] [Faster!!]": grey form buttons, Play pressed in. */
export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  const coach = useCoach();
  return (
    <div className="gc-form gc-speed" role="group" aria-label={t("speed.label")}>
      <span className="gc-flabel">Speed:</span>
      {speed.options.map((o) => (
        <button key={o.value} type="button" className={`gc-fb ${o.active ? "on" : ""}`} {...(o.value === 3 ? coach.attrs("speed") : {})} onClick={() => actions.setSpeed(o.value)} aria-label={t(o.key)} aria-pressed={o.active}>
          {SPEED_WORDS[o.value] ?? t(`speed.short.${o.value}`)}
        </button>
      ))}
    </div>
  );
}

/** The news, as a marquee. At the end of the bar: the badge everyone's home page had. */
export function Ticker({ items }: SlotPropsMap["Ticker"]) {
  const t = useT();
  const [egg, setEgg] = useState(false);
  return (
    <div className="gc-marquee" aria-label={t("ticker.aria")}>
      <div className="gc-mtag">{t("ticker.label")}</div>
      <div className="gc-mview">
        <Marquee items={items} className="gc-mtrack" />
      </div>
      <button type="button" className="gc-badge" onClick={() => setEgg((e) => !e)} aria-expanded={egg} title="Best viewed in Netscrape Navigator 3.0">
        <span className="gc-badge-logo" aria-hidden>N</span>
        <span className="gc-badge-tx">
          Best viewed in
          <b>Netscrape Navigator 3.0</b>
        </span>
      </button>
      {egg && (
        <Pop title="Netscrape Navigator 3.0" className="gc-egg" role="status" onClose={() => setEgg(false)}>
          <b>Netscrape Navigator 3.0 not found.</b>
          <p>You are using a browser from the future. It has better fonts, no scrollbar of shame and no idea what a &quot;visitor counter&quot; is.</p>
          <p>
            <small>Please enjoy this page responsibly. Sorry about the frames.</small>
          </p>
          <button type="button" className="gc-fb" onClick={() => setEgg(false)}>
            OK
          </button>
        </Pop>
      )}
    </div>
  );
}

/** News Room, sound, mixer and the skin picker: the "site menu" row of form buttons. */
export function NewsControls({ newsroom, sound, skins, visible = ALL_VISIBLE, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="gc-form gc-menu">
      {visible.news && (
        <button type="button" className="gc-fb" onClick={() => actions.openNews()} aria-label={t("news.open")}>
          <Gci name="note" size={18} />
          <span className="lbl">{t("news.button")}</span>
          {newsroom.unread > 0 && <b className="gc-unread">{newsroom.unread}</b>}
        </button>
      )}
      <button type="button" className="gc-fb" onClick={() => actions.setMuted(!sound.muted)} aria-label={sound.muted ? t("sound.unmute") : t("sound.mute")} aria-pressed={sound.muted}>
        <Gci name={sound.muted ? "muted" : "speaker"} size={18} />
      </button>
      <button type="button" className="gc-fb" onClick={() => actions.openMixer()} aria-label={t("sound.openMixer")}>
        <Gci name="mixer" size={18} />
      </button>
      {skins.list.length > 1 && (
        <button type="button" className="gc-fb" onClick={() => actions.openSkinPicker()} aria-label={t("skin.open")} title={t("skin.open")}>
          <Gci name="palette" size={18} />
        </button>
      )}
    </div>
  );
}

/** The camera button. (P toggles photo mode from the keyboard; the game handles that.) */
export function PhotoButton({ photo, actions }: SlotPropsMap["PhotoButton"]) {
  const t = useT();
  if (photo.on) return null;
  return (
    <button type="button" className="gc-fb gc-photobtn" onClick={() => actions.setPhoto(true)} aria-label={t("photo.open")} title={t("photo.open")}>
      <Gci name="camera" size={18} />
    </button>
  );
}

/** Today's Drama: a form button that shouts (the page has a NEW! gif for it, naturally). */
export function DramaButton({ drama, actions }: SlotPropsMap["DramaButton"]) {
  const t = useT();
  return (
    <div className="gc-form gc-menu gc-drama">
      <button type="button" className="gc-fb" onClick={() => actions.openDrama()} aria-label={t("drama.open")}>
        <DramaIcon size={18} />
        <span className="lbl">{t("drama.button")}</span>
        {drama.on ? <b className="gc-unread">{t("drama.on")}</b> : drama.fresh && <b className="gc-unread">{t("drama.new")}</b>}
      </button>
    </div>
  );
}
