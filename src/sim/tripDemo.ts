// Review moments for ACID MOD(E) (FLT-105): `?moment=acid-offer|acid-peak|acid-breakthrough|acid-researcher`. They play
// the example mod's own arc (mods/examples/acid-mode) through the same card and tick paths as a game: the offer opened by
// its `card` verb, answered "Take the medium dose", then days ticked until the beat. The app loads the mod for these links
// (app/mods.ts `momentSearch`); without it they are just a busy lab. The trip's warning still asks first: the sim only
// knows a trip is on, and consent is the player's (ui/juice/tripState.ts). Pure sim and deterministic.
import { canPlace } from "./commands";
import { defs } from "./defs";
import { dailyEvents, openEventOf, unpaced } from "./events";
import { createRng } from "./rng";
import { answer } from "./testkit";
import { applyNow, tick, TICKS_PER_DAY } from "./tick";
import type { GameState } from "./types";
import { runVerb } from "./verbs";
import { seedWalkers } from "./walkers";

export const ACID_MOMENTS = ["acid-offer", "acid-peak", "acid-breakthrough", "acid-researcher"] as const;
export type AcidMoment = (typeof ACID_MOMENTS)[number];
export const isAcidMoment = (m: string | null | undefined): m is AcidMoment => (ACID_MOMENTS as readonly unknown[]).includes(m);

const ARC = "acid-mode";
const CARD = "acid-offer";

/** A lab a couple of months in: paths, a Hall, a gateway, the Kombucha Bar, a dozen researchers and two releases. */
function lab(s: GameState) {
  s.cash = Math.max(s.cash, 8_000_000);
  for (let z = 18; z >= 10; z--) applyNow(s, [{ type: "placePath", x: 11, z }]);
  for (let x = 6; x <= 17; x++) applyNow(s, [{ type: "placePath", x, z: 16 }]);
  for (let x = 8; x <= 15; x++) applyNow(s, [{ type: "placePath", x, z: 10 }]);
  const place = (kind: "hall" | "gateway" | "kombucha", spots: readonly (readonly [number, number])[]) => {
    if (s.buildings.some((b) => b.kind === kind)) return;
    const at = spots.find(([x, z]) => canPlace(s, kind, x, z).ok);
    if (at) applyNow(s, [{ type: "placeBuilding", kind, x: at[0], z: at[1] }]);
  };
  place("hall", [[12, 11], [8, 11]]);
  place("gateway", [[6, 14], [15, 13], [7, 17]]);
  place("kombucha", [[12, 17], [9, 17], [13, 13], [7, 11]]);
  const rng = createRng(s.rngState);
  const have = s.walkers.filter((w) => w.kind === "researcher").length;
  if (have < 12) seedWalkers(s, "researcher", 12 - have, rng);
  s.rngState = rng.state();
  if (s.models.length < 2) s.models = ["Frontier-2", "Frontier-3-Reasoner"];
  s.capability = Math.max(s.capability, 30);
  s.hype = Math.max(s.hype, 40);
  for (let i = 0; i < TICKS_PER_DAY; i++) tick(s, answer(s));
  // Cards open from day 40 (the pacer's pressure): the offer is a mid-game beat.
  if (s.day < 60) {
    s.day = 60;
    s.tick = 60 * TICKS_PER_DAY + (s.tick % TICKS_PER_DAY);
  }
}

/** Play on, answering every other card with its first choice, until `done` or `days` run out; returns the first id of the last tick. */
function until(s: GameState, done: (s: GameState) => boolean, days: number) {
  let from = s.nextId;
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) {
    from = s.nextId;
    tick(s, answer(s));
  }
  return from;
}

/** Where each staged beat's news starts, so the ticker opens on the beat's headline rather than two months of backlog. */
const beatNews = new WeakMap<GameState, number>();
export const acidNewsFrom = (s: GameState) => beatNews.get(s) ?? 0;

export function stageAcid(s: GameState, moment: AcidMoment) {
  unpaced(s);
  lab(s);
  const arc = defs().arcs.find((a) => a.id === ARC);
  if (!arc || !defs().eventById(CARD)) return;
  // The arc's own way in: it is offered, and its `card` verb puts the proposal up (whatever else was asked first is answered).
  const rng = createRng(s.rngState);
  s.modArcs = { ...s.modArcs, [ARC]: { value: "offered", context: { enteredTick: s.tick } } };
  runVerb({ state: s, rng, run: null, owner: ARC }, { type: "card", params: { id: CARD } });
  s.rngState = rng.state();
  for (let i = 0; i < 6 && openEventOf(s) && openEventOf(s)!.id !== CARD; i++) {
    applyNow(s, answer(s));
    dailyEvents(s);
  }
  if (moment === "acid-offer") return;
  beatNews.set(s, s.nextId);
  applyNow(s, [{ type: "chooseEvent", eventId: CARD, choiceIndex: 0 }]);
  const at = (value: string) => (x: GameState) => x.modArcs?.[ARC]?.value === value;
  if (moment === "acid-breakthrough") {
    // The breakthrough lands on a new day's busy morning (releases, the Arena, offers): the ticker starts at its headline.
    const from = until(s, at("breakthrough"), 6);
    beatNews.set(s, s.news.find((n) => n.id >= from && n.text.includes("enlightenment"))?.id ?? from);
    // Whatever else the lab is asked that morning is answered: the screen is the enlightenment's.
    for (let i = 0; i < 6 && openEventOf(s); i++) applyNow(s, answer(s));
    return;
  }
  // The peak (and `acid-researcher`, the same afternoon with one of the team tapped): the come-up is a day, so a day and
  // a half in it is at full strength, and the team is somewhere.
  const start = s.trip?.start ?? s.tick;
  until(s, (x) => x.tick >= start + Math.round(1.5 * TICKS_PER_DAY), 3);
}

/** `acid-researcher`'s subject: the first researcher who has gone somewhere (the scene taps them). */
export const spelledResearcher = (s: GameState) => s.walkers.find((w) => w.kind === "researcher" && w.spell);
