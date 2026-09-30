// FLT-56: a walk-out as a conga line. The people who just quit are lined up nose to tail on the first one's route to
// the gate, `gap` tiles apart, and each follows the rest of that route. They all walk at WALK_SPEED, so the line
// holds on its own: no per-tick cost, no new walker state. Called once, the tick the card is answered.
import type { GameState, Point, Walker } from "./types";

export const CONGA_GAP = 0.55;

const leaving = (w: Walker | undefined): w is Walker => !!w && (w.machine.value === "quitting" || w.machine.value === "leaving");

/** Line `ids` up behind `ids[0]` on its way out. Anyone not on their way out is left alone. */
export function congaLine(state: GameState, ids: readonly number[], gap = CONGA_GAP) {
  const line = ids.map((id) => state.walkers.find((w) => w.id === id)).filter(leaving);
  const lead = line[0];
  if (!lead || line.length < 2 || lead.route.length === 0) return;
  // The route starts at the middle of the tile they are on, which can be a step behind them: the line starts there.
  const pts: Point[] = lead.route.map((p): Point => [p[0], p[1]]);
  if (pts.length < 2) pts.unshift([lead.x, lead.z]);
  const at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = at[at.length - 1]!;
  // The leader steps ahead to make room, but never through the gate: they all still have somewhere to walk.
  const front = Math.min((line.length - 1) * gap, Math.max(0, total - gap));
  line.forEach((w, k) => {
    const d = Math.max(0, front - k * gap);
    let i = 0;
    while (i < pts.length - 2 && at[i + 1]! <= d) i++;
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const len = at[i + 1]! - at[i]!;
    const t = len > 1e-9 ? Math.min(1, (d - at[i]!) / len) : 1;
    w.x = w.px = ax + (bx - ax) * t;
    w.z = w.pz = az + (bz - az) * t;
    w.route = pts.slice(i + 1).map((p): Point => [p[0], p[1]]);
    if (Math.hypot(bx - w.x, bz - w.z) > 1e-6) w.dir = Math.atan2(bx - w.x, bz - w.z);
  });
}
