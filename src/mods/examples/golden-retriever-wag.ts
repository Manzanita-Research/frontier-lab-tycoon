// FLT-75: the Golden Retriever Protest's code companion. `mods/examples/golden-retriever-protest/mod.json` makes the
// protesters golden retrievers; this Layer gives each one a `WagLevel` that rises while they can smell a Kombucha
// Bar and settles when they can't. A dog that hits full wag says so. It is a Koota trait plus one system, added
// through the `Systems` service the way a JSON mod's patches wrap `Content`.
import { Effect, Layer } from "effect";
import { Not, trait } from "koota";
import { Systems } from "../services/systems";
import { Body, byWalkerId, OnLab } from "../../sim/ecs/protesters";
import type { EcsSystem } from "../../sim/ecs/systems";
import { THOUGHT_TICKS } from "../../sim/constants";
import type { Building } from "../../sim/types";

/** How hard a good dog wags: 0, a firm demand; 1, a helicopter. */
export const WagLevel = trait({ wag: 0 });

/** Tiles from a Kombucha Bar's edge a dog can still smell it. */
const SNIFF = 4;
/** Wag gained per tick in range (full wag in under three seconds of game time), and lost per tick out of it. */
const RISE = 0.02;
const FALL = 0.004;
const FULL_WAG = [
  "*tail achieves liftoff* KOMBUCHA",
  "WOOF. (this is a fermented beverage)",
  "demands paused. sniffing.",
  "SIT. STAY. SCOBY.",
  "I have forgotten the water. There is only the bar.",
];

const sniff = (b: Building, x: number, z: number) => Math.hypot(x - Math.max(b.x, Math.min(x, b.x + b.w)), z - Math.max(b.z, Math.min(z, b.z + b.d)));

export const wagNearKombucha: EcsSystem = {
  id: "wag-near-kombucha",
  after: "protesters",
  traits: [
    {
      key: "wag",
      save: (e) => (e.has(WagLevel) ? e.get(WagLevel)!.wag : undefined),
      load: (e, v) => e.add(WagLevel({ wag: Number(v) })),
    },
  ],
  run(world, crowd, state) {
    // Every dog at the gate gets a tail.
    for (const e of world.query(OnLab(crowd.lab), Body, Not(WagLevel))) e.add(WagLevel);
    const bars = state.buildings.filter((b) => b.kind === "kombucha" && !b.broken);
    // It writes thoughts (and takes ids), so it goes in id order: the store's order depends on who else spawned.
    world
      .query(OnLab(crowd.lab), Body, WagLevel)
      .sort(byWalkerId)
      .updateEach(([body, level]) => {
        const was = level.wag;
        level.wag = bars.some((b) => sniff(b, body.x, body.z) <= SNIFF) ? Math.min(1, was + RISE) : Math.max(0, was - FALL);
        if (was < 1 && level.wag === 1 && state.thoughts.filter((t) => t.expiresTick > state.tick).length < 4) {
          state.thoughts.push({ id: state.nextId++, walkerId: body.id, kind: "protester", text: FULL_WAG[(body.id + state.day) % FULL_WAG.length]!, expiresTick: state.tick + THOUGHT_TICKS });
        }
      });
  },
};

/** The companion Layer: whatever systems the mods below it have, plus the wag. */
export const GoldenRetrieverWag = Layer.effect(
  Systems,
  Effect.gen(function* () {
    const below = yield* Systems;
    return Systems.of({ systems: [...below.systems, wagNearKombucha] });
  }),
);
