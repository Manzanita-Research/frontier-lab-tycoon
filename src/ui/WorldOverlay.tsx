import { useEffect, useMemo, useRef, useState } from "react";
import { computeGhost } from "../render/ghost";
import { HALF, rectCenter, worldX, worldZ } from "../render/coords";
import { Anchored } from "../render/overlay";
import { getReach } from "../sim/pathfind";
import { formatMoney } from "../sim/format";
import { atoms, sim } from "../app/game";
import { useApp } from "../app/hooks";
import { GATHERING_SIGN, GATHERING_SUB, INQUIRY_SIGN, WIKI_HOST } from "../content/crumbwiki";
import { COLLUSION } from "../sim/collusion/pack";

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

const PACKET_LIFE = COLLUSION.rules.signs.packetLifetimeTicks;

/**
 * Agent collusion's signs (FLT-46), none of which says what they are: tiny POSTs arcing off the map from the Compute
 * Cluster, a members-only night at the Kombucha Bar, and a sign over the office while Security looks into it.
 */
function CollusionSigns() {
  const c = useApp(atoms.collusion);
  const buildings = useApp(atoms.buildings);
  if (!c.enabled) return null;
  const bar = c.gathering?.active ? buildings.find((b) => b.id === c.gathering!.buildingId) : undefined;
  const office = c.investigation ? buildings.find((b) => b.id === c.investigation!.office) : undefined;
  return (
    <>
      {c.packets.map((p) => (
        <Anchored
          key={p.id}
          className="packet"
          pos={(out) => {
            const t = (sim.world.tick + sim.alpha - p.tick) / PACKET_LIFE;
            if (t < 0 || t > 1) return false;
            const x = p.from[0] + (p.to[0] - p.from[0]) * t;
            const z = p.from[1] + (p.to[1] - p.from[1]) * t;
            out.set(worldX(x), 2.2 + Math.sin(Math.PI * t) * 2.4, worldZ(z));
            return true;
          }}
        >
          <span title={`POST ${WIKI_HOST}/wiki/${p.page}`}>POST</span>
        </Anchored>
      ))}
      {bar && (
        <Anchored
          className="aftersign"
          pos={(out) => {
            const [cx, cz] = rectCenter(bar);
            out.set(cx, 3.2, cz);
            return true;
          }}
        >
          <b>{GATHERING_SIGN}</b>
          <small>
            {GATHERING_SUB} · {c.gathering!.members}
          </small>
        </Anchored>
      )}
      {office && (
        <Anchored
          className="inquirysign"
          pos={(out) => {
            const [cx, cz] = rectCenter(office);
            out.set(cx, 3.4, cz);
            return true;
          }}
        >
          {INQUIRY_SIGN} · {c.investigation!.arrived} on site
        </Anchored>
      )}
    </>
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
      <CollusionSigns />
      <Reason />
    </div>
  );
}
