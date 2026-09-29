// Behaviour guard, first written for the XState/Effect port (FLT-3): same seed + same commands must give the same
// numbers, RNG stream included. The FLT-3 digests were recorded from the hand-written sim before any system moved
// into a machine, and the port kept them. FLT-8 (the Crowd) changes the game on purpose (names, needs, queues,
// Vibes, new buildings, who spawns and when), so the digests below were re-recorded from that sim; the projection
// now also covers the new walker fields and the Vibes.
//
// The digest reads the game through `view()`, not the raw state, so the persisted shape can change (machine
// snapshots, moved fields) without touching the recorded values. Only `view()` follows the shape.
import { canPlace, type Command } from "./commands";
import { eventById } from "../content/events";
import { openEventOf } from "./events";
import { outcomeOf } from "./goals";
import { createInitialState } from "./state";
import { modeOf } from "./walkers";
import { tick } from "./tick";
import type { GameState } from "./types";
import type { PlaceableKind } from "../content/buildings";

const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** The flag bag as the pre-port sim kept it: values that moved into machine contexts are folded back in here. */
function flagsOf(s: GameState): Record<string, unknown> {
  const flags: Record<string, unknown> = { ...s.flags };
  if (s.economy.context.lastBailout !== null) flags.lastBailout = s.economy.context.lastBailout;
  if (s.goals.context.outcomeDay !== null) flags.outcomeDay = s.goals.context.outcomeDay;
  for (const [id, arc] of Object.entries(s.arcs)) if (arc.context.openedDay !== null) flags[`event:${id}`] = arc.context.openedDay;
  return flags;
}

/** Everything a player could observe or that feeds the next tick, in a shape-independent form. */
function view(s: GameState) {
  return {
    tick: s.tick,
    day: s.day,
    rngState: s.rngState,
    nextId: s.nextId,
    version: s.version,
    cash: s.cash,
    capability: s.capability,
    compute: s.compute,
    hype: s.hype,
    vibes: s.vibes,
    outcome: outcomeOf(s),
    event: openEventOf(s),
    waterDiscourse: s.waterDiscourse,
    ledger: s.ledger,
    training: s.training.context,
    models: s.models,
    goals: s.goals.context.goals,
    flags: sorted(flagsOf(s)),
    news: s.news,
    toasts: s.toasts,
    thoughts: s.thoughts,
    pops: s.pops,
    buildings: s.buildings,
    paths: s.grid.paths.reduce((acc, on, i) => (on ? acc + `${i},` : acc), ""),
    walkers: s.walkers.map((w) => ({
      id: w.id,
      kind: w.kind,
      x: w.x,
      z: w.z,
      px: w.px,
      pz: w.pz,
      dir: w.dir,
      route: w.route,
      targetId: w.targetId,
      mode: modeOf(w),
      timer: w.timer,
      name: w.name,
      role: w.role,
      energy: w.energy,
      focus: w.focus,
      fomo: w.fomo,
      patience: w.patience,
      impressed: w.impressed,
      drift: w.drift,
      need: w.need,
      lost: w.lost,
      mood: w.mood,
      stats: w.stats,
      phase: w.machine.value,
      visits: w.visits,
      step: w.step,
      loiter: w.machine.value === "loitering",
      fountain: w.fountain,
      homeX: w.homeX,
      homeZ: w.homeZ,
    })),
  };
}

/** FNV-1a over the JSON of the view. */
function digest(s: GameState): string {
  const text = JSON.stringify(view(s));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function spot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 8; z <= 21; z++) for (let x = 3; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

const BUILD_ORDER: PlaceableKind[] = ["gateway", "snack", "cluster", "nap", "gateway", "demo", "hall", "cluster", "gateway", "cluster"];

/** A busy player: builds every 30 ticks, paves a bit, bulldozes a path, answers every event card differently. */
function play(seed: number, ticks: number, checkpoints: number[]): Record<number, string> {
  const s = createInitialState(seed);
  const out: Record<number, string> = {};
  let built = 0;
  for (let i = 0; i < ticks; i++) {
    const cmds: Command[] = [];
    const open = openEventOf(s);
    if (open) cmds.push({ type: "chooseEvent", eventId: open.id, choiceIndex: (s.tick + seed) % eventById(open.id)!.choices.length });
    else if (i % 30 === 5 && built < BUILD_ORDER.length) {
      const kind = BUILD_ORDER[built]!;
      const at = spot(s, kind);
      if (at) {
        cmds.push({ type: "placeBuilding", kind, x: at[0], z: at[1] });
        built++;
      }
    }
    if (i === 250) cmds.push({ type: "placePath", x: 5, z: 16 });
    if (i === 700) cmds.push({ type: "bulldoze", x: 13, z: 16 });
    tick(s, cmds);
    if (checkpoints.includes(i + 1)) out[i + 1] = digest(s);
  }
  return out;
}

const CHECKPOINTS = [200, 800, 1600, 2400, 3200, 4000];

// Recorded from the pre-port sim (origin/flt-3-slice-2 @ 8f9750a; sorted-flags projection) and re-recorded by FLT-9,
// which changes the game on purpose: rivals, the Arena, eras, the R&D multiplier (training runs faster), bigger
// leaps per release, Training Halls that convert 30 compute a day, and a compute auction on day 40 that this
// script answers like any other card. The port itself was verified against the original numbers in FLT-3.
const GOLDEN: Record<number, Record<number, string>> = {
  1: { 200: "ad2f2688", 800: "802dc3b9", 1600: "a8dc30e1", 2400: "8a4e0509", 3200: "f7c66459", 4000: "502ed97f" },
  2: { 200: "efa3eff8", 800: "b238e095", 1600: "e458650d", 2400: "f2580b06", 3200: "7cb379e5", 4000: "e8a4633c" },
  3: { 200: "dbc1eb2d", 800: "8093e903", 1600: "f82a6a35", 2400: "5348a141", 3200: "9c7f7b03", 4000: "b7df570b" },
};

describe("golden runs", () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed} reproduces the recorded digests at every checkpoint`, () => {
      expect(play(seed, 4000, CHECKPOINTS)).toEqual(GOLDEN[seed]);
    });
  }
});
