// Thought-bubble layout (FLT-10): at most MAX_BUBBLES on screen, the ones closest to the camera win, and bubbles whose
// screen rectangles would overlap are nudged up until they clear each other. Pure geometry: no three, no DOM.

/** How many thought bubbles may be on screen at once. */
export const MAX_BUBBLES = 3;
/** Air between two bubbles, in px. */
export const GAP = 6;
/** A bubble sits this far above its walker's head (the tail included; see .bubble in ui.css). */
export const LIFT = 10;

export interface BubbleIn<T> {
  item: T;
  /** Screen position of the walker's head, px. */
  x: number;
  y: number;
  /** Size of the bubble, px. */
  w: number;
  h: number;
  /** Distance from the camera: smaller is closer (the NDC z of an orthographic view). */
  depth: number;
}

export interface BubbleOut<T> {
  item: T;
  x: number;
  y: number;
}

interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}

const boxOf = (p: { x: number; w: number; h: number }, y: number): Box => ({ l: p.x - p.w / 2 - GAP / 2, r: p.x + p.w / 2 + GAP / 2, t: y - LIFT - p.h - GAP / 2, b: y - LIFT + GAP / 2 });

/** The bubbles to show, in order of depth, with `y` nudged up where two would overlap. Sorts `list` in place. */
export function layoutBubbles<I>(list: BubbleIn<I>[], limit = MAX_BUBBLES): BubbleOut<I>[] {
  list.sort((p, q) => p.depth - q.depth);
  const out: BubbleOut<I>[] = [];
  const taken: Box[] = [];
  for (const p of list.slice(0, limit)) {
    let y = p.y;
    for (let pass = 0; pass < 8; pass++) {
      const r = boxOf(p, y);
      const hit = taken.find((o) => r.l < o.r && o.l < r.r && r.t < o.b && o.t < r.b);
      if (!hit) break;
      // Just above the one in the way.
      y = hit.t + LIFT - GAP / 2;
    }
    taken.push(boxOf(p, y));
    out.push({ item: p.item, x: p.x, y });
  }
  return out;
}
