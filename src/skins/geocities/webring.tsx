// The navigation: the build palette as the AI Labs WebRing (88×31 buttons, Prev/Next), the speed buttons as a grey web
// form, the news as a navy marquee with a badge you are not supposed to click, and the little utilities as form buttons.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Marquee, reducedMotion } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
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
  bulldoze: "#404040",
  staff: "#007060",
};

/** The build palette. Prev and Next walk the tool in your hand around the ring, and it never runs out. */
export function BuildBar({ items, tip, actions }: SlotPropsMap["BuildBar"]) {
  const t = useT();
  const strip = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.selected)?.kind;

  // Keep the tool in hand in view when the ring is wider than the screen (a phone).
  useEffect(() => {
    if (!selected) return;
    const el = strip.current?.querySelector<HTMLElement>(`[data-kind="${selected}"]`);
    el?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [selected]);

  const step = (dir: 1 | -1) => {
    const ring = items.filter((i) => i.kind !== "staff" && (i.affordable || i.selected));
    if (ring.length === 0) return;
    const at = ring.findIndex((i) => i.selected);
    const next = at === -1 ? (dir === 1 ? ring[0]! : ring[ring.length - 1]!) : ring[(at + dir + ring.length) % ring.length]!;
    actions.place(next.kind);
  };

  return (
    <div className="gc-ringwrap">
      {tip && (
        <div className="gc-tip">
          <b>{tip.name}</b> · {tip.text} {tip.upkeepText && <small>{tip.upkeepText}</small>}
        </div>
      )}
      <div className="gc-box gc-parch gc-ring">
        <div className="gc-nav">
          <span className="br">[ </span>
          <button type="button" className="gc-link prev" onClick={() => step(-1)} aria-label="Previous tool">
            <span>&lt;&lt; Prev</span>
          </button>
          <span className="mid">
            {" "}
            | <b className="gc-ringname"><Spark /> The AI Labs WebRing <Spark /></b>
            <span className="gc-build"> — {t("build.menuTitle").toLowerCase()} something!</span> |{" "}
          </span>
          <button type="button" className="gc-link v next" onClick={() => step(1)} aria-label="Next tool">
            <span>Next &gt;&gt;</span>
          </button>
          <span className="br"> ]</span>
        </div>
        <div className="gc-row" ref={strip}>
          {items.map((it) => (
            <button
              key={it.kind}
              type="button"
              data-kind={it.kind}
              className={`gc-b88 ${it.selected ? "on" : ""} ${it.affordable ? "" : "poor"} ${it.race ? "race" : ""}`}
              style={{ "--ring": RING[it.kind] ?? "#303030" } as CSSProperties}
              onClick={() => actions.place(it.kind)}
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
          ))}
        </div>
      </div>
    </div>
  );
}

const SPEED_WORDS: Record<number, string> = { 0: "Pause", 1: "Play", 3: "Fast", 10: "Faster!!" };

/** "Speed: [Pause] [Play] [Fast] [Faster!!]": grey form buttons, Play pressed in. */
export function Speed({ speed, actions }: SlotPropsMap["Speed"]) {
  const t = useT();
  return (
    <div className="gc-form gc-speed" role="group" aria-label={t("speed.label")}>
      <span className="gc-flabel">Speed:</span>
      {speed.options.map((o) => (
        <button key={o.value} type="button" className={`gc-fb ${o.active ? "on" : ""}`} onClick={() => actions.setSpeed(o.value)} aria-label={t(o.key)} aria-pressed={o.active}>
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
export function NewsControls({ newsroom, sound, skins, actions }: SlotPropsMap["NewsControls"]) {
  const t = useT();
  return (
    <div className="gc-form gc-menu">
      <button type="button" className="gc-fb" onClick={() => actions.openNews()} aria-label={t("news.open")}>
        <Gci name="note" size={18} />
        <span className="lbl">{t("news.button")}</span>
        {newsroom.unread > 0 && <b className="gc-unread">{newsroom.unread}</b>}
      </button>
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
