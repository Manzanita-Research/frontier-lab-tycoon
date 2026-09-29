// Behaviour-preservation guard for the XState/Effect port (FLT-3). The digests below were recorded from the
// hand-written sim before any system moved into a machine. If a port step changes one, it changed the game:
// same seed + same commands must give the same numbers, RNG stream included.
//
// The digest reads the game through `view()`, not the raw state, so the persisted shape can change (machine
// snapshots, moved fields) without touching the recorded values. Only `view()` follows the shape.
import { canPlace, type Command } from "./commands";
import { createInitialState } from "./state";
import { tick } from "./tick";
import type { GameState } from "./types";
import type { PlaceableKind } from "../content/buildings";

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
    outcome: s.outcome,
    event: s.event,
    waterDiscourse: s.waterDiscourse,
    ledger: s.ledger,
    training: s.training,
    models: s.models,
    goals: s.goals,
    flags: s.flags,
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
      mode: w.mode,
      timer: w.timer,
      energy: w.energy,
      visits: w.visits,
      step: w.step,
      loiter: w.loiter,
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

const BUILD_ORDER: PlaceableKind[] = ["gateway", "cluster", "gateway", "hall", "cluster", "gateway", "cluster"];

/** A busy player: builds every 30 ticks, paves a bit, bulldozes a path, answers every event card differently. */
function play(seed: number, ticks: number, checkpoints: number[]): Record<number, string> {
  const s = createInitialState(seed);
  const out: Record<number, string> = {};
  let built = 0;
  for (let i = 0; i < ticks; i++) {
    const cmds: Command[] = [];
    if (s.event) cmds.push({ type: "chooseEvent", eventId: s.event.id, choiceIndex: (s.tick + seed) % 3 });
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

// Recorded from the pre-port sim (origin/flt-3-slice-2 @ 8f9750a).
const GOLDEN: Record<number, Record<number, string>> = {
  1: { 200: "611ac035", 800: "3d0c5434", 1600: "eff0376e", 2400: "9cb16cc2", 3200: "2a885c18", 4000: "97353ad7" },
  2: { 200: "855e5f57", 800: "92b2ddb2", 1600: "d6e561c2", 2400: "f3e9e0a1", 3200: "5c72e52a", 4000: "ad5d3007" },
  3: { 200: "6754f24a", 800: "be2f434c", 1600: "08adf11e", 2400: "26369288", 3200: "b8cde705", 4000: "618bc1ae" },
};

describe("golden runs", () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed} reproduces the recorded digests at every checkpoint`, () => {
      expect(play(seed, 4000, CHECKPOINTS)).toEqual(GOLDEN[seed]);
    });
  }
});
