// Review moments for Defection (FLT-26) and the Poaching War (FLT-20): `?moment=defection-chat|defection-card|
// defection-exit|defection-manifesto|defection-arena|poach-offer[:<rival id>]`. They use the same card and tick paths as play.
// No renderer or UI dependencies.
import { canPlace } from "../commands";
import { RIVAL_DEFS } from "../../content/rivals";
import { dailyEvents, openEventOf } from "../events";
import { createRng } from "../rng";
import { answer } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState } from "../types";
import { seedWalkers } from "../walkers";
import { enablePoaching, offerPoach } from "../poaching/driver";
import { CARD as POACH_CARD } from "../poaching/pack";
import { dailyDefection, enableDefection } from "./driver";
import { CARD, CHOICES, MANIFESTO_CARD, MANIFESTO_CHOICES } from "./pack";

export const DRAMA_MOMENTS = ["defection-chat", "defection-card", "defection-exit", "defection-manifesto", "defection-arena", "poach-offer"] as const;
export type DramaMoment = (typeof DRAMA_MOMENTS)[number];
/** `poach-offer:<rival id>` is the offer in that lab's voice (FLT-56). */
export const isDramaMoment = (m: string | null | undefined): m is DramaMoment => (DRAMA_MOMENTS as readonly unknown[]).includes(m) || !!m?.startsWith("poach-offer:");

/** A lab a year in: paths, a Hall, a gateway, the Kombucha Bar, ten researchers and three releases. */
function busyLab(s: GameState) {
  s.cash = 20_000_000;
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
  if (have < 10) seedWalkers(s, "researcher", 10 - have, rng);
  s.rngState = rng.state();
  s.models = ["Frontier-2", "Frontier-3-Reasoner", "Frontier-4"];
  s.capability = 48;
  s.hype = 62;
  s.vibes = { ...s.vibes, value: 520 };
  // A couple of days for the crowd to spread out, answering whatever the lab gets asked.
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) tick(s, answer(s));
  s.day = 90;
  s.tick = 90 * TICKS_PER_DAY;
  for (const w of s.walkers) if (w.kind === "researcher") w.stats.joined = Math.min(w.stats.joined, 30);
}

/** Tick (answering any other card with its first choice) until `done`, for at most `days`. */
function until(s: GameState, done: (s: GameState) => boolean, days: number) {
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) {
    const open = openEventOf(s);
    tick(s, open && !done(s) ? answer(s) : []);
  }
}
const cardIs = (id: string) => (s: GameState) => openEventOf(s)?.id === id;

export function stageDrama(s: GameState, moment: DramaMoment) {
  busyLab(s);
  if (moment.startsWith("poach-offer")) {
    const id = moment.split(":")[1] ?? "metameta";
    const rival = RIVAL_DEFS.find((r) => r.id === id) ?? RIVAL_DEFS.find((r) => r.id === "metameta")!;
    enablePoaching(s);
    // The unhappiest few are who MetaMeta calls: make sure somebody is.
    s.walkers.filter((w) => w.kind === "researcher").slice(0, 3).forEach((w) => { w.energy = 0.25; w.focus = 0.3; });
    offerPoach(s, { from: rival.id, name: rival.name, short: rival.short });
    dailyEvents(s);
    // Whatever else the lab gets asked first (the app's launch livestream, say) is answered: the letter is the card.
    for (let i = 0; i < 6 && openEventOf(s) && openEventOf(s)!.id !== POACH_CARD; i++) {
      applyNow(s, answer(s));
      dailyEvents(s);
    }
    return;
  }
  enableDefection(s);
  enablePoaching(s);
  // The most senior researcher has had enough: the VCs have noticed.
  const star = s.walkers.filter((w) => w.kind === "researcher").sort((a, b) => a.stats.joined - b.stats.joined || a.id - b.id)[0]!;
  s.defection!.scores[star.id] = 60;
  dailyDefection(s);
  until(s, (x) => x.meetings?.some((m) => m.phase === "talking") ?? false, 8);
  if (moment === "defection-chat") return;
  // Nobody fixed their morale: a week of warnings later, they are all but gone.
  s.defection!.scores[star.id] = 95;
  until(s, cardIs(CARD), 30);
  if (moment === "defection-card") return;
  // Most of their team is fed up too (FLT-56): the walk-out is a proper conga line.
  for (const id of s.defection!.subject?.team.slice(0, 4) ?? []) {
    const w = s.walkers.find((x) => x.id === id);
    if (w) Object.assign(w, { energy: 0.15, focus: 0.2, fomo: 0.9 });
  }
  // And the die agrees: the first nudge of Defection's own stream where three or more walk out with them.
  const base = s.defection!.rngState;
  for (let k = 0; k < 16; k++) {
    const trial = structuredClone(s);
    trial.defection!.rngState = (base + k * 0x9e3779b9) >>> 0;
    applyNow(trial, answer(trial, CHOICES.indexOf("goodbye")));
    tick(trial);
    if ((trial.defection!.exit?.followerIds.length ?? 0) >= 3) {
      s.defection!.rngState = (base + k * 0x9e3779b9) >>> 0;
      break;
    }
  }
  applyNow(s, answer(s, CHOICES.indexOf("goodbye")));
  // A few steps: the boxes are out and heading for the gate.
  for (let i = 0; i < 6; i++) tick(s);
  if (moment === "defection-exit") return;
  until(s, cardIs(MANIFESTO_CARD), 4);
  if (moment === "defection-manifesto") return;
  applyNow(s, answer(s, MANIFESTO_CHOICES.indexOf("vaguepost")));
  // A week later: the new lab is on the board and has decided you are the one to beat.
  until(s, () => false, 7);
}
