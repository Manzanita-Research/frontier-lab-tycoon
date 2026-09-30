// Where a coach balloon goes: beside the thing it points at, never on it, always on screen and clear of the taskbar. Pure, so it
// is tested without a DOM.
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Side = "right" | "left" | "top" | "bottom";

export interface Placement {
  x: number;
  y: number;
  /** Which side of the target the balloon sits on, so a skin can point its tail back at it. */
  side: Side | "none";
}

export interface PlaceOptions {
  /** Space kept between the balloon and its target. */
  gap?: number;
  /** Space kept clear at each edge of the screen (the taskbar, the top bar). A number is all four. */
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  /** Sides to try, in order. The default faces the middle of the screen: a target in the bottom row gets its balloon above it. */
  prefer?: readonly Side[];
  /** The popup the target sits in (a build menu): the balloon keeps off all of it, still level with the target. */
  panel?: Rect | null;
  /** Open windows to keep off: a side whose balloon would cover one only counts if no other side is clear of them all. */
  avoid?: readonly Rect[];
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Put a balloon of `size` next to `anchor` on the first side that fits inside `view` (less the margins), `gap` away from it. If no
 * side is clear of the open windows, it takes the nearest clear spot on the screen instead (FLT-54: never on a window); if it
 * fits nowhere it is clamped onto the screen on the side with the most room. With no anchor it sits in the bottom-right corner.
 */
export function placeBalloon(anchor: Rect | null, size: { w: number; h: number }, view: { w: number; h: number }, opts: PlaceOptions = {}): Placement {
  const gap = opts.gap ?? 16;
  const m = typeof opts.margin === "number" ? { top: opts.margin, right: opts.margin, bottom: opts.margin, left: opts.margin } : { top: 12, right: 12, bottom: 12, left: 12, ...opts.margin };
  const x0 = m.left;
  const y0 = m.top;
  const x1 = view.w - m.right;
  const y1 = view.h - m.bottom;
  const inX = (x: number) => clamp(x, x0, Math.max(x0, x1 - size.w));
  const inY = (y: number) => clamp(y, y0, Math.max(y0, y1 - size.h));
  if (!anchor) {
    // No target: the bottom-right corner, or the first other corner clear of the open windows.
    const corners = [[x1 - size.w, y1 - size.h], [x0, y1 - size.h], [x1 - size.w, y0], [x0, y0]].map(([x, y]) => ({ x: inX(x!), y: inY(y!) }));
    const corner = corners.find((c) => !opts.avoid?.some((r) => overlaps({ ...c, ...size }, r))) ?? nearestClear(corners[0]!, size, [x0, y0, x1, y1], opts.avoid ?? []) ?? corners[0]!;
    return { ...corner, side: "none" };
  }
  const cx = anchor.x + anchor.w / 2;
  const cy = anchor.y + anchor.h / 2;
  // The balloon clears the whole popup when the target is in one, but stays level with the target itself.
  const box = opts.panel ?? anchor;
  const at: Record<Side, { x: number; y: number; room: number }> = {
    right: { x: box.x + box.w + gap, y: cy - size.h / 2, room: x1 - (box.x + box.w + gap) - size.w },
    left: { x: box.x - gap - size.w, y: cy - size.h / 2, room: box.x - gap - size.w - x0 },
    top: { x: cx - size.w / 2, y: box.y - gap - size.h, room: box.y - gap - size.h - y0 },
    bottom: { x: cx - size.w / 2, y: box.y + box.h + gap, room: y1 - (box.y + box.h + gap) - size.h },
  };
  // Beside a target on the side that faces the middle of the screen; above it when it (or its popup) sits low on the screen.
  const low = box.y + box.h / 2 > view.h * 0.7;
  const order: readonly Side[] = opts.prefer ?? (low ? ["top", cx < view.w / 2 ? "right" : "left", "left", "right", "bottom"] : cx < view.w * 0.5 ? ["right", "bottom", "top", "left"] : ["left", "bottom", "top", "right"]);
  const clear = (s: Side) => !opts.avoid?.some((r) => overlaps({ x: inX(at[s].x), y: inY(at[s].y), w: size.w, h: size.h }, r));
  const fit = order.find((s) => at[s].room >= 0 && clear(s));
  if (fit) return { x: inX(at[fit].x), y: inY(at[fit].y), side: fit };
  // Every side is on a window (or off the screen): the nearest spot that is clear of them all and of the target's box.
  const spot = nearestClear({ x: cx - size.w / 2, y: cy - size.h / 2 }, size, [x0, y0, x1, y1], [...(opts.avoid ?? []), box]);
  if (spot) return { ...spot, side: sideOf(spot, size, box) };
  const side = order.find((s) => at[s].room >= 0) ?? (Object.keys(at) as Side[]).sort((a, b) => at[b].room - at[a].room)[0]!;
  return { x: inX(at[side].x), y: inY(at[side].y), side };
}

/** The balloon's position on a grid over the screen that covers none of `avoid`, nearest `from`; null when there is none. */
function nearestClear(from: { x: number; y: number }, size: { w: number; h: number }, [x0, y0, x1, y1]: number[], avoid: readonly Rect[]) {
  const STEP = 16;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = y0!; y <= y1! - size.h; y += STEP) for (let x = x0!; x <= x1! - size.w; x += STEP) {
    const d = (x - from.x) ** 2 + (y - from.y) ** 2;
    if (d >= bestD || avoid.some((r) => overlaps({ x, y, ...size }, r))) continue;
    best = { x, y };
    bestD = d;
  }
  return best;
}

/** Which side of the target a balloon ended up on, for the tail; "none" when it is off at an angle. */
function sideOf(p: { x: number; y: number }, size: { w: number; h: number }, box: Rect): Side | "none" {
  const level = p.y < box.y + box.h && p.y + size.h > box.y;
  const inline = p.x < box.x + box.w && p.x + size.w > box.x;
  if (level) return p.x >= box.x + box.w ? "right" : "left";
  if (inline) return p.y >= box.y + box.h ? "bottom" : "top";
  return "none";
}
