// A scripted player, not a save-file fixture: every building, hire and release goes through the ordinary sim.
import type { PlaceableKind } from "../../content/buildings";
import { canPlace, type Command } from "../commands";
import { enableSlopBowl } from "../slopbowl/driver";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { buildingAt, isPathTile, rectContains } from "../pathfind";
import { createInitialState } from "../state";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState, Thought, WalkerKind } from "../types";
import { defs } from "../defs";
import { dhypot } from "../dmath";

export const MIDGAME_SEED = 48;
export const MIDGAME_CAMERA = { focus: [11.5, 14.5] as [number, number], zoom: 43 };
/** Start the tape on the chosen real SOTA joke; original ids let new headlines join normally on resume. */
const sotaHeadline = /has a new champion|SOTA|state-of-the-art|posts a new best|tops .*says|leaderboard:/;
/** FLT-48 hero: a short headline that lands whole in the ticker, from the same week (the SOTA claim follows on the tape). */
const heroHeadline = /valuation rises \d+% on news that it exists/;
export function midgameOpeningNews(s: GameState) {
  const sota = s.news.find((n) => n.day === s.leapfrog.last?.day && sotaHeadline.test(n.text));
  if (!sota) throw new Error("Mid-game opening headline is missing");
  const hero = s.news.filter((n) => n.id < sota.id && n.day >= sota.day - 7 && heroHeadline.test(n.text)).at(-1);
  const chosen = hero ?? sota;
  return s.news.filter((n) => n.id >= chosen.id);
}

/**
 * Read-only opening overlay. Existing content on real outdoor speakers; never write it into the World.
 * The speakers stand in the clear part of the hero camera (FLT-48): the top of the protest, its front, and the dome behind it.
 */
export function midgameOpeningThoughts(s: GameState): Thought[] {
  const picks: { kind: WalkerKind; text: string; near: [number, number] }[] = [
    { kind: "researcher", text: "They chant in perfect 4/4. Our uptime isn't even that stable.", near: [13, 20.5] },
    { kind: "agent", text: "I calculated my water usage. I'd rather not say.", near: [11.5, 12] },
    { kind: "protester", text: "Someone hand me a water. Not from them.", near: [8.6, 17.2] },
  ];
  const chosen: number[] = [];
  return picks.map((pick, i) => {
    const line = defs().thoughts.find((t) => t.kind === pick.kind && t.text === pick.text);
    const speaker = s.walkers.filter((w) => w.kind === pick.kind && w.machine.value !== "inside" && !chosen.includes(w.id))
      .sort((a, b) => dhypot(a.x - pick.near[0], a.z - pick.near[1]) - dhypot(b.x - pick.near[0], b.z - pick.near[1]) || a.id - b.id)[0];
    if (!line || !speaker) throw new Error(`Mid-game opening thought is missing: ${pick.kind}`);
    chosen.push(speaker.id);
    return { id: -(i + 1), walkerId: speaker.id, kind: pick.kind, text: line.text, expiresTick: s.tick + 1 };
  });
}

function pave(s: GameState, plaza = false) {
  const cmds: Command[] = [];
  const put = (x: number, z: number) => { if (canPlace(s, "path", x, z).ok) cmds.push({ type: "placePath", x, z }); };
  if (plaza) for (let z = 17; z <= 22; z++) for (let x = 6; x <= 17; x++) put(x, z);
  else {
    for (const z of [7, 10, 16]) for (let x = 5; x <= 18; x++) put(x, z);
    for (const x of [5, 17]) for (let z = 7; z <= 22; z++) put(x, z);
  }
  applyNow(s, cmds);
}

function spot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 7; z <= 16; z++) for (let x = 3; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

function build(s: GameState): Command[] {
  const n = (kind: PlaceableKind) => s.buildings.filter((b) => b.kind === kind).length;
  const halls = n("hall");
  let kind: PlaceableKind | null = null;
  if (n("gateway") < Math.min(4, 1 + Math.floor(s.day / 80))) kind = "gateway";
  else if (n("kombucha") < Math.min(2, 1 + Math.floor(halls / 2))) kind = "kombucha";
  else if (s.day > 30 && n("nap") < Math.min(2, Math.ceil(halls / 2))) kind = "nap";
  else if (s.day > 50 && n("snack") < 1) kind = "snack";
  else if (n("cluster") < Math.min(5, 2 * halls)) kind = "cluster";
  else if (halls < 5) kind = "hall";
  else if (n("demo") < 1) kind = "demo";
  if (!kind || s.buildings.length >= 20 || s.cash < defs().buildings[kind].price + 400_000) return [];
  const at = spot(s, kind);
  return at ? [{ type: "placeBuilding", kind, x: at[0], z: at[1] }] : [];
}

function answer(s: GameState): Command[] {
  const open = openEventOf(s);
  if (!open) return [];
  // Hold the run, bid low at auctions, and leave the Water Discourse unresolved in the world (not a modal).
  const choice = open.id === "shipNow" ? 1 : open.id === "computeAuction" ? 0 : open.id === "waterDiscourse" ? 2 : 0;
  return [{ type: "chooseEvent", eventId: open.id, choiceIndex: Math.min(choice, defs().eventById(open.id)!.choices.length - 1) }];
}

/**
 * On a path, in a building or in the gate. The water crowd (FLT-33) pickets on the lawn by the gate and walks out past
 * it on purpose, so a protester only has to be out of the buildings.
 */
export function walkerPlaced(s: GameState, w: { kind?: string; x: number; z: number }): boolean {
  if (w.kind === "protester") return !buildingAt(s, w.x, w.z);
  return isPathTile(s, Math.floor(w.x), Math.floor(w.z)) || !!buildingAt(s, w.x, w.z) || rectContains(s.gate, w.x, w.z);
}

export function walkerOnCampus(s: GameState): boolean {
  return s.walkers.every((w) => walkerPlaced(s, w));
}

export function createMidgameScenario(): GameState {
  const s = createInitialState(MIDGAME_SEED, "campus");
  // FLT-109: the curated campus is the one FLT-86 tuned its money moments on, so its 480 days play without the late
  // lunch (switched off before the campus opening could wake it); it wakes at the opening, for the player.
  s.flags.slopbowlOff = 1;
  delete s.slopbowl;
  // The curated mid-game scenario starts with every system earned (the campus opening already woke every pack).
  s.coach = { value: "skipped", context: { index: 0, elapsed: 0 } };
  s.flags.coachBuildOpened = 0;
  pave(s);
  for (let i = 0; s.day < 480 && i < 500 * TICKS_PER_DAY && outcomeOf(s) !== "lost"; i++) {
    let cmds = answer(s);
    // Auction cards have no pass button; bid low, then resell any awarded unpowered bunker.
    for (const b of s.buildings) if (b.kind === "datacenter") cmds.push({ type: "bulldoze", x: b.x, z: b.z });
    if (!cmds.length && s.tick % (4 * TICKS_PER_DAY) === 0) cmds = build(s);
    if (!cmds.length && s.tick % (4 * TICKS_PER_DAY) === 2) {
      const n = (job: string) => s.staff.filter((o) => o.job === job).length;
      if (s.day > 15 && n("sre") < Math.min(12, 1 + Math.floor(s.day / 25))) cmds.push({ type: "hire", job: "sre" });
      else if (s.day > 30 && n("janitor") < 12) cmds.push({ type: "hire", job: "janitor" });
    }
    if (s.day === 350 && s.tick % TICKS_PER_DAY === 0) pave(s, true);
    // A paid refresh before the curated opening: ordinary demolition refunds and replacement costs.
    if (s.day === 390 && s.tick % TICKS_PER_DAY === 0) {
      for (const b of [...s.buildings]) if (b.reliability < 0.8 && s.cash > defs().buildings[b.kind].price + 400_000) {
        applyNow(s, [{ type: "bulldoze", x: b.x, z: b.z }, { type: "placeBuilding", kind: b.kind, x: b.x, z: b.z, confirmed: true }]);
      }
    }
    // This scripted player approves its paid purchases; confirmations must not freeze the replay.
    tick(s, cmds.map((c) => c.type === "placeBuilding" || c.type === "placePath" || c.type === "hire" ? { ...c, confirmed: true } : c));
    // Near Y2 March: choose a real fresh record after every repair completes. The new
    // opening/attendance stream changes its day, so select by gameplay facts, never injected state. (FLT-54: the card
    // budget moved the records; a run 60–90% done still reads as mid-run.) Nobody out of the Sandbox either (FLT-59): an
    // agent halfway over the fence is a moment of its own, not the opening.
    const ready = s.training.context.progress / s.training.context.cost;
    if (s.day >= 420 && s.day <= 480 && ready >= 0.6 && ready <= 0.9 &&
      s.leapfrog.last?.day === s.day && s.leapfrog.last.claims.length &&
      s.buildings.every((b) => !b.broken) && !openEventOf(s) && !s.escape?.runners.length &&
      s.news.some((n) => n.day === s.day && sotaHeadline.test(n.text))) {
      delete s.flags.slopbowlOff;
      enableSlopBowl(s);
      return s;
    }
  }
  throw new Error(`Mid-game scenario could not reach its opening moment: day ${s.day}, tick ${s.tick}, outcome ${outcomeOf(s)}, cash ${s.cash}, confirm ${JSON.stringify(s.guardrails?.context.pendingConfirm)}, buildings ${s.buildings.map(b => b.kind)}`);
}
