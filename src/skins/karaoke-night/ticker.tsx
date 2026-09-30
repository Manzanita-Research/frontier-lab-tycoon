// AI News Karaoke: the news tape, sung. One headline at a time is on the screen; a ball drops onto its first word, bounces
// twice to count you in, then hops from word to word while each one lights up as it is "sung". The line stays lit for a
// beat, then the next headline (fresh news first, then the old hits) takes the mic, and the one after that is teased at
// the right. Nothing here runs at frame rate in React: a headline change is one state update, and the ball and the
// highlight are Web Animations (transform and clip-path) started when the line appears.
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { reducedMotion } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { TickerItemVM } from "../../ui/hud/types";
import { Notes } from "./art";

/** How long a character takes to sing: about 14 a second, brisk but readable. */
const MS_PER_CHAR = 70;
const MIN_SING_MS = 3000;
const MAX_SING_MS = 13000;
/** The count-in: two bounces on the first word before the singing starts. */
const LEAD_MS = 560;
/** How long the finished line stays lit before the next one. */
const HOLD_MS = 1500;
/** How high the ball hops (px), and how far above the letters it lands. */
const ARC = 14;
const LAND = 5;
/** The biggest and smallest type of a line; a long headline shrinks to fit before it wraps. */
const FS_MAX = 21;
const FS_MIN = 15;

interface Timing {
  word: string;
  /** Milliseconds from the start of the whole line (count-in included) when the word starts and stops being sung. */
  from: number;
  to: number;
}

/** When each word is sung: every word takes as long as its letters plus the space after it. */
export function schedule(text: string): { words: Timing[]; sing: number; total: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const weight = words.reduce((n, w) => n + w.length + 1, 0);
  const sing = Math.min(MAX_SING_MS, Math.max(MIN_SING_MS, text.length * MS_PER_CHAR));
  let at = 0;
  const list = words.map((word): Timing => {
    const from = LEAD_MS + (at / weight) * sing;
    at += word.length + 1;
    return { word, from, to: LEAD_MS + ((at - 1) / weight) * sing };
  });
  return { words: list, sing, total: LEAD_MS + sing };
}

/** The headline after `curId`: the oldest one nobody has sung yet, else the next in the tape (wrapping round). */
export function pick(list: readonly TickerItemVM[], curId: number | null, seenMax: number): TickerItemVM | null {
  if (list.length === 0) return null;
  const fresh = list.find((i) => i.id > seenMax);
  if (fresh) return fresh;
  const at = list.findIndex((i) => i.id === curId);
  return list[(at + 1) % list.length] ?? list[0]!;
}

/** Fit the line to its stage: as big as it will go, then smaller, then (on a phone, or if it still won't fit) two lines. */
function fit(line: HTMLElement, stage: HTMLElement, wrapAlways: boolean) {
  line.dataset.wrap = wrapAlways ? "1" : "";
  line.style.setProperty("--kn-fs", `${wrapAlways ? FS_MIN : FS_MAX}px`);
  if (wrapAlways) return;
  const room = stage.clientWidth;
  const natural = line.scrollWidth || 1;
  if (natural <= room) return;
  const size = Math.floor((FS_MAX * room) / natural);
  if (size >= FS_MIN) line.style.setProperty("--kn-fs", `${size}px`);
  else {
    line.style.setProperty("--kn-fs", `${FS_MIN}px`);
    line.dataset.wrap = "1";
  }
}

/** Start the line: light each word as the ball reaches it, and send the ball hopping over the letters. Returns a cancel. */
function sing(line: HTMLElement, ball: HTMLElement, hop: HTMLElement, timing: ReturnType<typeof schedule>): () => void {
  const anims: Animation[] = [];
  const nodes = [...line.querySelectorAll<HTMLElement>(".kn-w")];
  if (nodes.length !== timing.words.length || typeof line.animate !== "function") return () => undefined;
  const { total } = timing;

  // The highlight: each word's lit copy is wiped in from the left over the time the word takes. The wipe is two
  // transforms (the window slides in while the text slides back), so it runs off the main thread like the ball.
  nodes.forEach((node, i) => {
    const lit = node.querySelector<HTMLElement>(".kn-lit");
    const text = lit?.firstElementChild as HTMLElement | null;
    const w = timing.words[i]!;
    const opts: KeyframeAnimationOptions = { delay: w.from, duration: Math.max(60, w.to - w.from), easing: "linear", fill: "both" };
    anims.push(lit!.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], opts));
    anims.push(text!.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], opts));
  });

  // The ball: it slides along the words at the pace of the highlight (x, y follow the word), while the inner disc hops.
  const at = (i: number, side: "left" | "right") => {
    const n = nodes[i]!;
    return { x: n.offsetLeft + (side === "right" ? n.offsetWidth : 0), y: n.offsetTop - LAND };
  };
  const track: Keyframe[] = [];
  const push = (ms: number, p: { x: number; y: number }) => track.push({ transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`, offset: Math.min(1, ms / total) });
  push(0, at(0, "left"));
  timing.words.forEach((w, i) => {
    push(w.from, at(i, "left"));
    push(w.to, at(i, "right"));
  });
  push(total, at(nodes.length - 1, "right"));
  anims.push(ball.animate(track, { duration: total, easing: "linear", fill: "both" }));

  const beats: number[] = [0, LEAD_MS / 2, LEAD_MS, ...timing.words.slice(1).map((w) => w.from), total];
  const hops: Keyframe[] = [];
  const up = "cubic-bezier(0.2, 0.7, 0.4, 1)";
  const down = "cubic-bezier(0.6, 0, 0.8, 0.4)";
  const squash = "translateY(0) scale(1.35, 0.7)";
  const rest = "translateY(0) scale(1, 1)";
  const air = `translateY(${-ARC}px) scale(0.88, 1.12)`;
  beats.forEach((b, i) => {
    hops.push({ transform: i === beats.length - 1 ? rest : squash, offset: Math.min(1, b / total), easing: up });
    const next = beats[i + 1];
    if (next !== undefined) hops.push({ transform: air, offset: Math.min(1, (b + next) / 2 / total), easing: down });
  });
  // The beats are where the ball lands: twice on the first word to count in (0 and LEAD/2), then at the start of every word.
  anims.push(hop.animate(hops, { duration: total, easing: "linear", fill: "both" }));
  return () => anims.forEach((a) => a.cancel());
}

export function Ticker({ items }: SlotPropsMap["Ticker"]) {
  const t = useT();
  const latest = useRef(items);
  latest.current = items;
  // What is on the mic (n makes the same headline sing again when it is the only one), and the newest id already sung.
  const seenMax = useRef(items.at(-1)?.id ?? 0);
  const [cur, setCur] = useState<{ item: TickerItemVM | null; n: number }>(() => ({ item: items.at(-1) ?? null, n: 0 }));
  const stage = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const ball = useRef<HTMLSpanElement>(null);
  const hop = useRef<HTMLElement>(null);
  const item = cur.item;

  // The tape was empty when it mounted: the first headline to arrive takes the mic.
  useEffect(() => {
    if (cur.item === null && items.length > 0) {
      seenMax.current = items.at(-1)!.id;
      setCur({ item: items.at(-1)!, n: 1 });
    }
  }, [cur.item, items]);

  // Each time a headline takes the mic: fit it, start the ball and the highlight, and line up the next one.
  const width = useRef(0);
  const [redo, setRedo] = useState(0);
  useLayoutEffect(() => {
    const el = line.current;
    const box = stage.current;
    if (!item || !el || !box) return;
    let cancelSong = () => undefined as void;
    let timer = 0;
    let dead = false;
    const timing = schedule(item.text);
    const advance = () => {
      const next = pick(latest.current, item.id, seenMax.current);
      if (!next) return;
      seenMax.current = Math.max(seenMax.current, next.id);
      setCur((c) => ({ item: next, n: c.n + 1 }));
    };
    const start = () => {
      if (dead) return;
      const compact = box.clientWidth < 520;
      fit(el, box, compact);
      width.current = box.clientWidth;
      if (reducedMotion()) {
        el.dataset.still = "1";
        timer = window.setTimeout(advance, 5500 + item.text.length * 40);
        return;
      }
      delete el.dataset.still;
      cancelSong = sing(el, ball.current!, hop.current!, timing);
      timer = window.setTimeout(advance, timing.total + HOLD_MS);
    };
    // Fit and measure once the type is in (the skin's fonts load after the first render).
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts?.load) void fonts.load(`900 ${FS_MAX}px Nunito`).then(start, start);
    else start();
    return () => {
      dead = true;
      window.clearTimeout(timer);
      cancelSong();
    };
  }, [item, cur.n, redo]);

  // A different window size moves every word: sing the line again from the top (once the resize settles).
  useEffect(() => {
    const box = stage.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    let timer = 0;
    const watch = new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - width.current) < 8) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRedo((r) => r + 1), 250);
    });
    watch.observe(box);
    return () => {
      watch.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const next = pick(items, item?.id ?? null, seenMax.current);
  const words = item ? item.text.trim().split(/\s+/).filter(Boolean) : [];
  return (
    <div className="kn-ticker" role="marquee" aria-label={t("ticker.aria")}>
      <span className="kn-label">
        <Notes /> {t("ticker.label")}
      </span>
      <div className="kn-stage" ref={stage}>
        {item ? (
          <p key={`${item.id}-${cur.n}`} className={`kn-line tone-${item.tone}`} ref={line}>
            {words.map((w, i) => (
              <Fragment key={i}>
                <span className="kn-w">
                  {w}
                  <span className="kn-lit" aria-hidden>
                    <span>{w}</span>
                  </span>
                </span>{" "}
              </Fragment>
            ))}
            <span className="kn-ball" ref={ball} aria-hidden>
              <i ref={hop} />
            </span>
          </p>
        ) : (
          <p className="kn-line idle">Tuning in for the first headline…</p>
        )}
      </div>
      {next && next.id !== item?.id && (
        <span className="kn-next" aria-hidden>
          <Notes />
          <span className="kn-next-t">{next.text}</span>
        </span>
      )}
    </div>
  );
}
