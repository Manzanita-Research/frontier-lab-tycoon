// The intro's React root: the 3D stage (lazy), the DOM overlay on top of it (Skip, captions, the contents list, the
// manual's page buttons), and the handoff to the game in the same root when the machine reaches `game`.
import { RegistryContext, useAtomSuspense } from "@effect/atom-react";
import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import type { LoadGame } from "./boot";
import type { Intro } from "./actor";
import { beatOf } from "./machine";
import { CAPTIONS, ITEMS, SHELF, type ItemId } from "./content";
import { PAGES } from "./manual";
import "./intro.css";

const Stage = lazy(() => import("./stage/Stage"));
const Still = lazy(() => import("./Still"));

const TEAL = "#008080";
const TITLE = "SoftWarehouse '97: Frontier Lab Tycoon";

export function IntroRoot({ intro, loadGame }: { intro: Intro; loadGame: LoadGame }) {
  const [App, setApp] = useState<ComponentType | null>(null);
  const [gone, setGone] = useState(false);

  // Start the actor for as long as the intro is up.
  useEffect(() => intro.registry.mount(intro.atoms.actor), [intro]);

  // The game chunk downloads while the shelf is on screen, so Skip (or the dive into the CRT) is instant.
  useEffect(() => {
    const prefetch = () => void loadGame();
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(prefetch, { timeout: 2500 });
    else setTimeout(prefetch, 1200);
  }, [loadGame]);

  // At `game`: boot the skin, swap the shelf for the game, move the URL to the game's, and fade the curtain.
  const onGame = useRef(false);
  const toGame = () => {
    if (onGame.current) return;
    onGame.current = true;
    const g = loadGame();
    void Promise.all([g.skin.then((m) => m.bootSkin()), g.App]).then(([, Game]) => {
      const q = new URLSearchParams(window.location.search);
      for (const k of ["intro", "beat", "sheet", "tilt", "fx", "fps", "motion"]) q.delete(k);
      const search = q.toString();
      history.pushState({ flt: "game" }, "", `/${search ? `?${search}` : ""}`);
      // Back returns to the shelf: the game owns the page from here, so the simplest honest way back is a reload.
      window.addEventListener("popstate", () => window.location.reload(), { once: true });
      document.title = prevTitle.current;
      setApp(() => Game);
      window.setTimeout(() => setGone(true), 60);
    });
  };

  const prevTitle = useRef(document.title);
  useEffect(() => {
    const prev = prevTitle.current;
    document.title = TITLE;
    return () => void (document.title = prev);
  }, []);

  if (App)
    return (
      <>
        <App />
        <div className={`intro-curtain${gone ? " intro-curtain--gone" : ""}`} style={{ background: TEAL }} aria-hidden />
      </>
    );

  return (
    <RegistryContext.Provider value={intro.registry}>
      <Suspense fallback={<Curtain text="" />}>
        <Beats intro={intro} toGame={toGame} />
      </Suspense>
    </RegistryContext.Provider>
  );
}

function Curtain({ text }: { text: string }) {
  return (
    <div className="intro-curtain" style={{ background: TEAL }}>
      <span>{text}</span>
    </div>
  );
}

function Beats({ intro, toGame }: { intro: Intro; toGame: () => void }) {
  const snap = useAtomSuspense(intro.atoms.snapshot).value;
  const beat = beatOf(snap.value);
  const { context } = snap;
  const send = intro.send;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (beat === "game") toGame();
  }, [beat, toGame]);

  // The prefetched game module listens for clicks on window (its coach marks); the intro's clicks stay the intro's.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("click", stop);
    return () => el.removeEventListener("click", stop);
  }, []);

  // Keys: any key skips while the intro is playing itself; while you're reading, the arrows turn pages and Esc goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;
      const onButton = document.activeElement instanceof HTMLButtonElement && (e.key === "Enter" || e.key === " ");
      if (beat === "open" || beat === "focus" || beat === "still") {
        if (beat === "focus" && context.item === "manual" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) send({ type: "PAGE", delta: e.key === "ArrowRight" ? 1 : -1 });
        else if (e.key === "Escape" && beat === "focus") send({ type: "BACK" });
        return;
      }
      if (onButton) return;
      if (beat === "shelf" && context.peek && e.key === "Escape") return send({ type: "PEEK", id: null });
      if (beat !== "game") send({ type: "SKIP" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [beat, context.item, context.peek, send]);

  if (beat === "game") return <Curtain text="Starting Frontier 95..." />;

  const peek = context.peek ? SHELF.find((b) => b.id === context.peek) : null;
  const caption = (CAPTIONS as Record<string, string>)[beat] ?? "";
  const item = context.item ? ITEMS.find((i) => i.id === context.item) : null;

  return (
    <div ref={root} className={`intro intro--${beat}`}>
      {context.still ? (
        <Suspense fallback={<Curtain text="" />}>
          <Still intro={intro} manual={context.item === "manual"} />
        </Suspense>
      ) : (
        <Suspense fallback={<Curtain text="" />}>
          <Stage intro={intro} beat={beat} context={context} />
        </Suspense>
      )}

      <button className="intro-skip" onClick={() => send({ type: "SKIP" })}>
        Skip intro →
      </button>

      {!context.still && (
        <div className="intro-store" aria-hidden>
          SoftWarehouse <b>'97</b>
        </div>
      )}

      {beat === "shelf" && !peek && (
        <button className="intro-cta" onClick={() => send({ type: "PICK" })}>
          Take <b>Frontier Lab Tycoon</b> off the shelf
        </button>
      )}

      {peek && (
        <div className="intro-card intro-peek" role="dialog" aria-label={peek.title}>
          <h2>{peek.title}</h2>
          <p className="intro-peek-sub">{peek.sub}</p>
          <p>{peek.blurb}</p>
          <p className="intro-peek-nfs">Display copy. Not for sale.</p>
          <div className="intro-row">
            <button onClick={() => send({ type: "PEEK", id: null })}>Put it back</button>
            <button className="intro-primary" onClick={() => send({ type: "PICK" })}>
              Take the good one
            </button>
          </div>
        </div>
      )}

      {(beat === "open" || beat === "focus") && (
        <nav className="intro-contents" aria-label="What's in the box">
          <h2>In the box</h2>
          {ITEMS.map((i) => (
            <button key={i.id} aria-pressed={context.item === i.id} onClick={() => send({ type: "FOCUS", item: i.id as ItemId })}>
              {i.name}
            </button>
          ))}
          <button className="intro-primary" onClick={() => send({ type: "INSERT" })}>
            Insert disc ▶
          </button>
        </nav>
      )}

      {beat === "focus" && item && (
        <div className="intro-focus">
          <p>{item.caption}</p>
          {item.id === "manual" && (
            <div className="intro-row">
              <button disabled={context.page <= 0} onClick={() => send({ type: "PAGE", delta: -1 })} aria-label="Previous page">
                ‹
              </button>
              <span className="intro-folio">{pageLabel(context.page, context.sheets)}</span>
              <button disabled={context.page >= context.sheets} onClick={() => send({ type: "PAGE", delta: 1 })} aria-label="Next page">
                ›
              </button>
            </div>
          )}
          <button onClick={() => send({ type: "BACK" })}>Back to the box</button>
        </div>
      )}

      {caption && beat !== "focus" && !peek && <p className="intro-caption">{caption}</p>}
      {beat === "dive" && <div className="intro-dive" style={{ background: TEAL }} aria-hidden />}
    </div>
  );
}

/** "Cover", "Contents · p.1", ..., "Back cover": what the open spread shows. */
function pageLabel(page: number, sheets: number): string {
  if (page <= 0) return "Cover";
  if (page >= sheets) return "Back cover";
  const left = PAGES[page * 2 - 1];
  const right = PAGES[page * 2];
  const name = (p: (typeof PAGES)[number] | undefined) => (p && p.kind === "text" ? (p.title ?? "") : "");
  return [name(left), name(right)].filter(Boolean).join(" · ");
}
