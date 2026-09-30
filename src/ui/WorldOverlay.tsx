import { useEffect, useMemo, useRef, useState } from "react";
import { computeGhost } from "../render/ghost";
import { HALF, rectCenter, worldX, worldZ } from "../render/coords";
import { Anchored } from "../render/overlay";
import { getReach } from "../sim/pathfind";
import { formatMoney } from "../sim/format";
import { atoms, sim } from "../app/game";
import { useApp } from "../app/hooks";
import { BUILDINGS } from "../content/buildings";
import { cursorOf } from "../sim/endings/view";

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

/**
 * The Takeover (FLT-11): the lab's own model has the mouse. A cursor glides from one build to the next, hops over the
 * campus on the way, and clicks when the building lands. Read straight from the World each frame, like the walkers.
 */
function GhostCursor() {
  const manager = useApp(atoms.managedBy);
  const placed = useApp(atoms.autopilotPlaced);
  const glide = useRef({ aimed: -1, fx: 0, fz: 0, x: 0, z: 0 });
  if (!manager) return null;
  return (
    <Anchored
      className="ghost-cursor click"
      pos={(out) => {
        const w = sim.world;
        const c = cursorOf(w, w.tick + sim.alpha);
        const g = glide.current;
        const t = c ? w.endings?.autopilot.target : null;
        // Between buildings it waits where it clicked last.
        if (!c || !t) {
          if (g.aimed === -1) return false;
          out.set(g.x, 1.2, g.z);
          return true;
        }
        const [sx, sz] = BUILDINGS[t.kind as keyof typeof BUILDINGS]?.size ?? [
          1, 1,
        ];
        const tx = worldX(t.x + sx / 2);
        const tz = worldZ(t.z + sz / 2);
        // A new target: set off from wherever the cursor is now (the first one comes in from the gate side).
        if (g.aimed !== t.aimedTick) {
          if (g.aimed === -1) [g.x, g.z] = [tx - 6, tz + 6];
          g.aimed = t.aimedTick;
          g.fx = g.x;
          g.fz = g.z;
        }
        const k = c.t * c.t * (3 - 2 * c.t);
        g.x = g.fx + (tx - g.fx) * k;
        g.z = g.fz + (tz - g.fz) * k;
        out.set(g.x, 1.2 + Math.sin(Math.PI * c.t) * 2.2, g.z);
        return true;
      }}
    >
      <svg key={placed} width="42" height="51" viewBox="0 0 28 34" aria-hidden>
        <path
          d="M3 2 L3 27 L9.5 21 L14 31.5 L18.5 29.5 L14 19.5 L23 19.5 Z"
          fill="#fff"
          stroke="#0b1016"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
      <span>{manager}</span>
    </Anchored>
  );
}

/** A sign on the gate and stickers on every building: how the campus looks once an ending has it (FLT-11). */
function EndingLabels() {
  const look = useApp(atoms.endingLook);
  const buildings = useApp(atoms.buildings);
  const beige = !!look?.beige;
  useEffect(() => {
    document.body.classList.toggle("ending-beige", beige);
    return () => document.body.classList.remove("ending-beige");
  }, [beige]);
  if (!look) return null;
  const gate =
    typeof look.acquired === "string"
      ? `A ${look.acquired} company`
      : look.pivot
        ? "🔁 NOW PIVOTING"
        : look.officeMoved
          ? "🏛️ Office of Frontier Oversight · Field Office"
          : null;
  return (
    <>
      {gate && (
        <Anchored
          className={`gatesign ${look.acquired ? "acquired" : look.officeMoved ? "captured" : "pivot"}`}
          pos={(out) => {
            const g = sim.world.gate;
            out.set(worldX(g.x + g.w / 2), 2.4, worldZ(g.z + g.d / 2));
            return true;
          }}
        >
          {gate}
        </Anchored>
      )}
      {look.stickers &&
        buildings.map((b) => (
          <Anchored
            key={b.id}
            className="compliant"
            pos={(out) => {
              const [cx, cz] = rectCenter(b);
              out.set(cx, 1.9, cz);
              return true;
            }}
          >
            COMPLIANT ✓
          </Anchored>
        ))}
    </>
  );
}

/** The world's own labels: names, coin pops, warnings. Thought bubbles are the skin's (see hud/BubbleLayer). */
export function WorldOverlay() {
  return (
    <>
      <div className="world">
        <NameTag />
        <CoinPops />
        <NoPath />
        <BrokenLabels />
        <StaffTags />
        <QueueLabels />
        <Reason />
        <EndingLabels />
      </div>
      {/* Above the HUD: it is using your mouse now. */}
      <div className="world ghost-layer">
        <GhostCursor />
      </div>
    </>
  );
}
