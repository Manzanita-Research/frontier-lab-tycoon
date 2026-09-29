import { useEffect, useMemo, useRef, useState } from "react";
import { computeGhost } from "../render/ghost";
import { HALF, rectCenter, worldX, worldZ } from "../render/coords";
import { Anchored } from "../render/overlay";
import { getReach } from "../sim/pathfind";
import { formatMoney } from "../sim/format";
import { getAlpha, useStore } from "../store";
import type { Thought } from "../sim/types";

function Bubble({ thought }: { thought: Thought }) {
  return (
    <Anchored
      className={`bubble bubble-${thought.kind}`}
      pos={(out) => {
        const w = useStore.getState().sim.walkers.find((o) => o.id === thought.walkerId);
        if (!w || w.machine.value === "inside") return false;
        const a = getAlpha();
        out.set(w.px + (w.x - w.px) * a - HALF, w.kind === "agent" ? 0.95 : 1.1, w.pz + (w.z - w.pz) * a - HALF);
        return true;
      }}
    >
      {thought.text}
    </Anchored>
  );
}

interface Live {
  id: number;
  x: number;
  z: number;
  text: string;
}

/** "+$15K" floats up from each gateway that earned this day. */
function CoinPops() {
  const pops = useStore((s) => s.snap.pops);
  const lastSeen = useRef(useStore.getState().snap.pops.at(-1)?.id ?? 0);
  const [live, setLive] = useState<Live[]>([]);
  useEffect(() => {
    const fresh = pops.filter((p) => p.id > lastSeen.current);
    if (fresh.length === 0) return;
    lastSeen.current = fresh[fresh.length - 1]!.id;
    setLive((l) => [...l, ...fresh.map((p) => ({ id: p.id, x: p.x, z: p.z, text: `+${formatMoney(p.amount)}` }))].slice(-12));
    const ids = new Set(fresh.map((p) => p.id));
    setTimeout(() => setLive((l) => l.filter((p) => !ids.has(p.id))), 1700);
  }, [pops]);
  return (
    <>
      {live.map((p) => (
        <Anchored
          key={p.id}
          className="coinpop"
          pos={(out) => {
            out.set(worldX(p.x), 2.6 + (p.id % 3) * 0.32, worldZ(p.z));
            return true;
          }}
        >
          {p.text}
        </Anchored>
      ))}
    </>
  );
}

/** Buildings nobody can walk to say so. */
function NoPath() {
  const buildings = useStore((s) => s.snap.buildings);
  const version = useStore((s) => s.snap.version);
  const stranded = useMemo(() => {
    const reach = getReach(useStore.getState().sim);
    return buildings.filter((b) => !reach.buildings.has(b.id));
    // `version` is what invalidates reachability.
  }, [buildings, version]);
  return (
    <>
      {stranded.map((b) => (
        <Anchored
          key={b.id}
          className="nopath"
          pos={(out) => {
            const [cx, cz] = rectCenter(b);
            out.set(cx, 2.8, cz);
            return true;
          }}
        >
          No path!
        </Anchored>
      ))}
    </>
  );
}

/** Why the ghost is red. */
function Reason() {
  const tool = useStore((s) => s.tool);
  const hover = useStore((s) => s.hover);
  const version = useStore((s) => s.snap.version);
  const cash = useStore((s) => Math.floor(s.snap.cash / 10_000));
  const ghost = useMemo(
    () => computeGhost(useStore.getState().sim, tool, hover),
    // Recompute when the world or the wallet changes, not just the pointer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, hover, version, cash],
  );
  if (!ghost || ghost.ok || !ghost.reason) return null;
  return (
    <Anchored
      className="reason"
      pos={(out) => {
        const [cx, cz] = rectCenter(ghost.rect);
        out.set(cx, 2.3, cz);
        return true;
      }}
    >
      {ghost.reason}
    </Anchored>
  );
}

export function WorldOverlay() {
  const thoughts = useStore((s) => s.snap.thoughts);
  return (
    <div className="world">
      {thoughts.map((t) => (
        <Bubble key={t.id} thought={t} />
      ))}
      <CoinPops />
      <NoPath />
      <Reason />
    </div>
  );
}
