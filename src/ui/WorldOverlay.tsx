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

/** Buildings that are out of order say so, and whether an SRE is on the way. */
function BrokenLabels() {
  const ops = useApp(atoms.ops);
  const buildings = useApp(atoms.buildings);
  return (
    <>
      {ops.broken.map((o) => {
        const b = buildings.find((x) => x.id === o.id);
        if (!b) return null;
        return (
          <Anchored
            key={o.id}
            className={`brokenlabel ${o.sre ? "fixing" : ""}`}
            pos={(out) => {
              const [cx, cz] = rectCenter(b);
              out.set(cx, 3.1, cz);
              return true;
            }}
          >
            {o.sre ? "SRE on the way" : "OUT OF ORDER"}
          </Anchored>
        );
      })}
    </>
  );
}

/** Who is who: a small tag over each staffer (their job), so a Janitor Bot in a crowd is still a Janitor Bot. */
function StaffTags() {
  const ops = useApp(atoms.ops);
  return (
    <>
      {ops.staff.map((o) => (
        <Anchored
          key={o.id}
          className={`stafftag job-${o.job}`}
          pos={(out) => {
            const s = sim.world.staff.find((q) => q.id === o.id);
            if (!s) return false;
            const a = sim.alpha;
            out.set(s.px + (s.x - s.px) * a - HALF, 1.75, s.pz + (s.z - s.pz) * a - HALF);
            return true;
          }}
        >
          {o.title}
        </Anchored>
      ))}
    </>
  );
}

/** A line of three or more outside a building gets a count over the door. */
function QueueLabels() {
  const ops = useApp(atoms.ops);
  const buildings = useApp(atoms.buildings);
  return (
    <>
      {ops.queues
        .filter((q) => q.n >= 3)
        .map((q) => {
          const b = buildings.find((x) => x.id === q.id);
          if (!b) return null;
          return (
            <Anchored
              key={q.id}
              className={`queuelabel ${q.n >= 8 ? "long" : ""}`}
              pos={(out) => {
                const [cx, cz] = rectCenter(b);
                out.set(cx, 1.9, cz);
                return true;
              }}
            >
              {q.n} waiting
            </Anchored>
          );
        })}
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
      <BrokenLabels />
      <StaffTags />
      <QueueLabels />
      <Reason />
    </div>
  );
}
