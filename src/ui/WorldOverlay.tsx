import { useEffect, useMemo, useRef, useState } from "react";
import { computeGhost } from "../render/ghost";
import { HALF, rectCenter, worldX, worldZ } from "../render/coords";
import { Anchored } from "../render/overlay";
import { getReach } from "../sim/pathfind";
import { formatMoney } from "../sim/format";
import { atoms, sim } from "../app/game";
import { useApp } from "../app/hooks";

interface Live {
  id: number;
  x: number;
  z: number;
  text: string;
}

/** "+$15K" floats up from each gateway that earned this day. */
function CoinPops() {
  const pops = useApp(atoms.pops);
  const lastSeen = useRef(pops.at(-1)?.id ?? 0);
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
  const buildings = useApp(atoms.buildings);
  const version = useApp(atoms.version);
  const stranded = useMemo(() => {
    const reach = getReach(sim.world);
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
  const tool = useApp(atoms.tool);
  const hover = useApp(atoms.hover);
  const version = useApp(atoms.version);
  const cash = useApp(atoms.cashBucket);
  const ghost = useMemo(
    () => computeGhost(sim.world, tool, hover),
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

/** The name of the walker whose card is open, on the ground beside them. */
function NameTag() {
  const inspect = useApp(atoms.inspect);
  if (!inspect) return null;
  return (
    <Anchored
      key={inspect.id}
      className="nametag"
      pos={(out) => {
        const w = sim.world.walkers.find((o) => o.id === inspect.id);
        if (!w || w.machine.value === "inside") return false;
        const a = sim.alpha;
        out.set(w.px + (w.x - w.px) * a - HALF, -0.05, w.pz + (w.z - w.pz) * a - HALF);
        return true;
      }}
    >
      {inspect.name}
    </Anchored>
  );
}

/** The world's own labels: names, coin pops, warnings. Thought bubbles are the skin's (see hud/BubbleLayer). */
export function WorldOverlay() {
  return (
    <div className="world">
      <NameTag />
      <CoinPops />
      <NoPath />
      <Reason />
    </div>
  );
}
