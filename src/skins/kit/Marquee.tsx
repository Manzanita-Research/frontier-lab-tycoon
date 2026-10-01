import { useLayoutEffect, useRef } from "react";
import type { TickerItemVM } from "../../ui/hud/types";

/** How many just-arrived headlines may wait their turn past the right edge; a rush keeps only the newest. */
export const MAX_QUEUED = 3;

export interface TapeItem {
  /** Left edge on the track, in px. */
  left: number;
  /** Old news replayed to keep the tape full (as opposed to a headline that has not been shown yet). */
  replay: boolean;
}

/**
 * Where a fresh headline goes: just past the right edge of what is on screen, ahead of the old filler that would
 * otherwise make it wait a whole tape's length. Returns the indexes to drop from the tape first: replayed filler beyond
 * the edge, and (in a rush, say at 10x) the oldest unshown headlines beyond `MAX_QUEUED`, so it never falls minutes behind.
 */
export function makeRoom(items: readonly TapeItem[], offset: number, viewport: number, incoming = 1): number[] {
  const cut = items.findIndex((i) => i.left >= offset + viewport);
  if (cut < 0) return [];
  const beyond = items.map((item, index) => ({ item, index })).filter((x) => x.index >= cut);
  const drop = beyond.filter((x) => x.item.replay).map((x) => x.index);
  const queued = beyond.filter((x) => !x.item.replay);
  const surplus = Math.max(0, queued.length + incoming - MAX_QUEUED);
  return [...drop, ...queued.slice(0, surplus).map((x) => x.index)].sort((a, b) => a - b);
}

/** The tape speeds up a little while headlines are waiting, so a burst of news still reads as news. */
export const catchUp = (waiting: number): number => 1 + Math.min(1, waiting * 0.4);

/**
 * What the tape has taken in, and what is new in the latest items. Another lab's news (a new lab, a loaded save) starts
 * the tape over (FLT-82): its ids restart lower, so its headlines would wait behind the old lab's last id while the old
 * lab's replayed forever. A lab's tape always shares a headline with what came before (the ticker carries the newest
 * two dozen); another lab's shares none, or reuses an id for a different line.
 */
export class Tape {
  /** Every headline taken in, oldest first: the filler that keeps the tape full. */
  history: TickerItemVM[] = [];
  private seen = new Map<number, string>();
  private seenId = 0;

  take(items: readonly TickerItemVM[]): { reset: boolean; fresh: TickerItemVM[] } {
    const reset = this.seen.size > 0 && !this.continues(items);
    if (reset) {
      this.history = [];
      this.seen.clear();
      this.seenId = 0;
    }
    const fresh = items.filter((n) => n.id > this.seenId);
    for (const n of fresh) {
      this.seenId = Math.max(this.seenId, n.id);
      this.seen.set(n.id, n.text);
      this.history.push(n);
    }
    return { reset, fresh };
  }

  private continues(items: readonly TickerItemVM[]): boolean {
    let shared = false;
    for (const n of items) {
      const said = this.seen.get(n.id);
      if (said === undefined) continue;
      if (said !== n.text) return false;
      shared = true;
    }
    return shared;
  }
}

/**
 * An endless news tape, driven by hand so new headlines join without restarting it. Put it inside a box with
 * `overflow: hidden` (the "view"); the track it draws is `position: relative; display: flex` and moves with a
 * transform, one `<span class="tick {tone}">` per headline. Style `.tick` in your skin.css.
 *
 * A headline that has just arrived joins right after what is on screen (see `makeRoom`), so the tape shows what just
 * happened within a few seconds instead of after the old filler has scrolled by.
 */
export function Marquee({ items, pxPerSecond = 70, className = "marquee-track" }: { items: readonly TickerItemVM[]; pxPerSecond?: number; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const latest = useRef(items);
  latest.current = items;
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const tape = new Tape();
    let taken: readonly TickerItemVM[] | null = null;
    let cycle = 0;
    let offset = 0;
    let last = performance.now();
    let raf = 0;
    let started = false;
    const add = (n: TickerItemVM, replay: boolean) => {
      const span = document.createElement("span");
      span.className = `tick ${n.tone}`;
      span.textContent = n.text;
      if (replay) span.dataset.replay = "1";
      el.appendChild(span);
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const viewport = el.parentElement!.clientWidth;
      const { reset, fresh } = taken === latest.current ? { reset: false, fresh: [] } : tape.take(latest.current);
      taken = latest.current;
      if (reset) {
        // Another lab: its news starts on a clean tape, as it did when the tape mounted.
        el.replaceChildren();
        offset = 0;
        cycle = 0;
        started = false;
      }
      if (fresh.length > 0) {
        // The first frame's headlines are old news (whatever the game had said before the tape mounted): filler, not fresh.
        if (started) {
          const kids = Array.from(el.children) as HTMLElement[];
          const drop = makeRoom(kids.map((k) => ({ left: k.offsetLeft, replay: k.dataset.replay === "1" })), offset, viewport, fresh.length);
          for (const i of drop) kids[i]!.remove();
        }
        for (const n of fresh) add(n, !started);
      }
      started = true;
      // Never let the tape run dry: replay old headlines behind the new ones.
      let guard = 0;
      while (el.scrollWidth - offset < viewport * 1.5 && tape.history.length > 0 && guard++ < 8) add(tape.history[cycle++ % tape.history.length]!, true);
      const waiting = Array.from(el.children).filter((k) => (k as HTMLElement).dataset.replay !== "1" && (k as HTMLElement).offsetLeft >= offset + viewport).length;
      offset += dt * pxPerSecond * catchUp(waiting);
      let first = el.firstElementChild as HTMLElement | null;
      while (first && offset > first.offsetWidth) {
        offset -= first.offsetWidth;
        first.remove();
        first = el.firstElementChild as HTMLElement | null;
      }
      el.style.transform = `translateX(${-offset}px)`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pxPerSecond]);
  return <div className={className} ref={track} />;
}
