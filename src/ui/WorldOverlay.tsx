import { useEffect, useMemo, useRef, useState } from "react";
import { computeGhost } from "../render/ghost";
import { HALF, rectCenter, worldX, worldZ } from "../render/coords";
import { Anchored } from "../render/overlay";
import { pathGaps, type PathGap } from "../sim/pathgap";
import { panTo } from "../render/fx/state";
import { NO_PATH_HERE, NO_PATH_HERE_MANY, NO_PATH_RULE, noPathShort } from "../content/help";
import type { Rect } from "../sim/types";
import { formatMoney } from "../sim/format";
import { atoms, send, sim, toast } from "../app/game";
import { useApp } from "../app/hooks";
import { GATHERING_SIGN, GATHERING_SUB, INQUIRY_SIGN, WIKI_HOST } from "../content/crumbwiki";
import { COLLUSION } from "../sim/collusion/pack";
import { NEO_BALLOON_SUB } from "../content/neocampus";
import { balloonAt, balloonRadius } from "../render/NeoCampuses";
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

/** Said once per browser: the first time a building has No path!, the rule behind it (FLT-85). */
const TOLD_KEY = "flt.told.nopath";
const told = () => {
  try {
    return localStorage.getItem(TOLD_KEY) !== null;
  } catch {
    return false;
  }
};
const tell = () => {
  try {
    localStorage.setItem(TOLD_KEY, "1");
  } catch {
    // Storage that says no: it is said again next visit, which is fine.
  }
};
let toldThisVisit = false;

/**
 * Buildings nobody can walk to say so (FLT-85: and how far off they are). Clicking the flag pans to the gap and hands you
 * the path tool; the scene draws the gap itself (render/PathGaps).
 */
function NoPath() {
  const buildings = useApp(atoms.buildings);
  const version = useApp(atoms.version);
  const coach = useApp(atoms.coach);
  const tool = useApp(atoms.tool);
  const quiet = useApp(atoms.toasts).length === 0;
  const stranded = useMemo(() => {
    const gaps = pathGaps(sim.world);
    return buildings.flatMap((b) => {
      const gap = gaps.get(b.id);
      return gap ? [{ b, gap }] : [];
    });
    // `version` is what invalidates reachability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, version]);
  // The rule, once, when nothing else is talking over it: Frontier 95's paperclip hides toasts while the coach is up and
  // shows only the newest, so it waits for a clear screen. The flag's tooltip says it too, for anyone who missed it.
  useEffect(() => {
    if (stranded.length === 0 || coach || !quiet || toldThisVisit || told()) return;
    toldThisVisit = true;
    tell();
    toast(NO_PATH_RULE);
  }, [stranded.length, coach, quiet]);
  const show = (b: Rect, gap: PathGap) => {
    // Halfway between the building and the far end of the gap, so both are on screen.
    const [cx, cz] = rectCenter(b);
    const end = gap.join.at(-1) ?? gap.door;
    if (end) panTo((cx + worldX(end[0] + 0.5)) / 2, (cz + worldZ(end[1] + 0.5)) / 2);
    else panTo(cx, cz);
    if (tool !== "path" && gap.join.length > 0) send({ type: "SET_TOOL", tool: "path" });
  };
  return (
    <>
      {stranded.map(({ b, gap }) => (
        <Anchored
          key={b.id}
          className="nopath"
          pos={(out) => {
            const [cx, cz] = rectCenter(b);
            out.set(cx, 2.8, cz);
            return true;
          }}
        >
          <button type="button" className="nopath-flag" title={`${NO_PATH_RULE} Click to see the gap.`} onClick={() => show(b, gap)}>
            No path!
            <small>{noPathShort(gap.join.length)}</small>
          </button>
        </Anchored>
      ))}
      {/* With the path tool in hand, the tile that joins it says so. */}
      {tool === "path" &&
        stranded.map(({ b, gap }) => {
          const at = gap.join[Math.floor((gap.join.length - 1) / 2)];
          if (!at) return null;
          return (
            <Anchored
              key={`here-${b.id}`}
              className="nopath-here"
              pos={(out) => {
                out.set(worldX(at[0] + 0.5), 0.5, worldZ(at[1] + 0.5));
                return true;
              }}
            >
              {gap.join.length === 1 ? NO_PATH_HERE : NO_PATH_HERE_MANY}
            </Anchored>
          );
        })}
    </>
  );
}

/** Buildings that are out of order say so, and whether an SRE is on the way. */
function BrokenLabels() {
  const ops = useApp(atoms.ops);
  const buildings = useApp(atoms.buildings);
  const disasters = useApp(atoms.disasters);
  const sre = disasters.diverted.find((d) => d.job === "sre");
  const away = sre && sre.diverted === sre.total ? (disasters.runs.find((r) => r.id === sre.by)?.name ?? null) : null;
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
            {o.sre ? "SRE on the way" : away ? `OUT OF ORDER · SREs on the ${away}` : "OUT OF ORDER"}
          </Anchored>
        );
      })}
    </>
  );
}

/** Who is who: a small tag over each staffer (their job), so a Janitor Bot in a crowd is still a Janitor Bot. */
function StaffTags() {
  const ops = useApp(atoms.ops);
  const diverted = new Set(useApp(atoms.disasters).divertedIds);
  return (
    <>
      {ops.staff.map((o) => (
        <Anchored
          key={o.id}
          className={`stafftag job-${o.job} ${diverted.has(o.id) ? "diverted" : ""}`}
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

/**
 * Disasters on the map (FLT-32): the cleanup's progress over wherever a disaster has sent people, and a shout at the
 * gate when every guard has been pulled off it.
 */
function DisasterLabels() {
  const disasters = useApp(atoms.disasters);
  const buildings = useApp(atoms.buildings);
  const security = disasters.diverted.find((d) => d.job === "security");
  const over = (to: number, y: number) => (out: { set: (x: number, y: number, z: number) => unknown }) => {
    const rect = (to !== 0 && buildings.find((b) => b.id === to)) || sim.world.gate;
    const [cx, cz] = rectCenter(rect);
    out.set(cx, y, cz);
    return true;
  };
  return (
    <>
      {disasters.sites.map((site) => {
        const run = disasters.runs.find((r) => r.id === site.owner);
        if (!run) return null;
        const pct = run.progress === null ? null : Math.round(run.progress * 100);
        return (
          <Anchored key={`${site.owner}-${site.to}`} className="dzsite" pos={over(site.to, 3.6)}>
            <b>{run.name}</b>
            {pct !== null && (
              <span className="dzsite-bar">
                <i style={{ width: `${pct}%` }} />
                <small>{pct}%</small>
              </span>
            )}
          </Anchored>
        );
      })}
      {security && security.diverted === security.total && (
        <Anchored className="dzgate" pos={over(0, 2.4)}>
          GATE UNGUARDED
        </Anchored>
      )}
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

/**
 * The coach's "read their mind" step (FLT-58): a "psst" over one researcher who is out on the paths, the first one by id, so it does
 * not hop between people. The coach's ring finds it by `data-coach-active`; clicking it opens their card like clicking them does.
 */
function PeekTag() {
  const coach = useApp(atoms.coach);
  const who = useRef<number | null>(null);
  if (coach?.target !== "map:researcher") return null;
  return (
    <Anchored
      className="peektag"
      pos={(out) => {
        const w = sim.world.walkers.find((o) => o.kind === "researcher" && o.machine.value !== "inside" && o.machine.value !== "quitting");
        who.current = w?.id ?? null;
        if (!w) return false;
        const a = sim.alpha;
        out.set(w.px + (w.x - w.px) * a - HALF, 1.9, w.pz + (w.z - w.pz) * a - HALF);
        return true;
      }}
    >
      <button type="button" data-coach="map:researcher" data-coach-active="" onClick={() => who.current !== null && send({ type: "SELECT", id: who.current })}>
        psst… 💭
      </button>
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

/** FLT-56: each neo lab's valuation, on its balloon beyond the fence. */
function NeoBalloons() {
  const labs = useApp(atoms.neo);
  return (
    <>
      {labs.map((lab, i) => (
        <Anchored
          key={lab.id}
          className={`neoballoon neo-${lab.nemesis ? "nemesis" : lab.mood}`}
          pos={(out) => {
            const r = balloonRadius(lab.valuation);
            const [x, y, z] = balloonAt(i, performance.now() / 1000, r);
            out.set(x, y + r * 1.2, z);
            return true;
          }}
        >
          <b style={{ borderColor: lab.color }}>${lab.valuation}B</b>
          <small>{NEO_BALLOON_SUB[lab.nemesis ? "nemesis" : lab.mood]}</small>
        </Anchored>
      ))}
    </>
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

/**
 * An agent running for the fence says what to do about it (at its feet: its thought bubble has the space over its head),
 * and one in the hand has the hand over it (FLT-59). The
 * grab itself is in Pick.tsx; the lift is in Walkers.tsx.
 */
function GrabTags() {
  const runners = useApp(atoms.runners);
  if (!runners) return null;
  return (
    <>
      {runners.split(",").map((tag) => {
        const id = Number(tag.slice(0, -1));
        const held = tag.endsWith("c");
        return (
          <Anchored
            key={tag}
            className={held ? "grabhand" : "grabit"}
            pos={(out) => {
              const w = sim.world.walkers.find((o) => o.id === id);
              if (!w) return false;
              const a = sim.alpha;
              out.set(w.px + (w.x - w.px) * a - HALF, held ? 2.75 : 0, w.pz + (w.z - w.pz) * a - HALF);
              return true;
            }}
          >
            {held ? "🤏" : "✋ GRAB IT!"}
          </Anchored>
        );
      })}
    </>
  );
}

/** The world's own labels: names, coin pops, warnings. Thought bubbles are the skin's (see hud/BubbleLayer). */
export function WorldOverlay() {
  return (
    <>
      <div className="world">
        <NameTag />
        <PeekTag />
        <CoinPops />
        <BrokenLabels />
        <StaffTags />
        <QueueLabels />
        <CollusionSigns />
        <NeoBalloons />
        <DisasterLabels />
        <EndingLabels />
        <GrabTags />
      </div>
      {/* Warnings beat thoughts (FLT-85): above the thought bubbles, still under the HUD's windows. */}
      <div className="world world-top">
        <NoPath />
        <Reason />
      </div>
      {/* Above the HUD: it is using your mouse now. */}
      <div className="world ghost-layer">
        <GhostCursor />
      </div>
    </>
  );
}
