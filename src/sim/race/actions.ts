// What the race's cards do, beyond the effects any card can have (cash, hype, news, flags). One entry per choice
// in content/events.ts; the driver draws the dice here, at the moment of the pick.
import { BUILDINGS, RACE_KINDS, type BuildingKind } from "../../content/buildings";
import type { RaceAction } from "../../content/events";
import { RIVAL_BY_ID, type RivalId } from "../../content/rivals";
import { eraDef } from "../../content/eras";
import { canPlace, placeBuilding } from "../commands";
import { formatMoney } from "../format";
import { step } from "../machines/run";
import { addToast } from "../news";
import type { Rng } from "../rng";
import type { GameState } from "../types";
import { bidAmount, auctionUnit, BID_MULTIPLES, raiseAmount, type Bid } from "./finance";
import { eraOfState, raceNews } from "./race";
import { rivalMachine } from "./rival";

/** Days between compute auctions at era 1; later eras run faster. */
export const AUCTION_GAP_DAYS = 40;
/** Where the rivals' best bid sits, in auction units: 0.6 to 4.2. */
const RIVAL_BID_LOW = 0.6;
const RIVAL_BID_SPAN = 3.6;

function shockRival(state: GameState, id: string, hit: { capability: number; hype: number; momentum: number }) {
  const race = state.race;
  const i = race.rivals.findIndex((r) => r.context.id === id);
  if (i < 0) return;
  race.rivals[i] = step(rivalMachine, race.rivals[i]!, { type: "SHOCK", ...hit }).stored;
}

export function applyRaceAction(state: GameState, rng: Rng, action: RaceAction) {
  const race = state.race;
  switch (action) {
    case "cutPrices":
      race.priceCuts++;
      race.openDrop = null;
      addToast(state, "API prices cut. Revenue -15% for good; the -30% is history.", "neutral");
      return;
    case "openRelease": {
      const id = race.openDrop?.rival ?? "sirocco";
      state.flags.openModel = state.day;
      shockRival(state, id, { capability: 0, hype: -15, momentum: -0.45 });
      addToast(state, `${RIVAL_BY_ID[id as RivalId]?.name ?? "The rival"} loses momentum. The community is 'cautiously into it'.`, "good");
      return;
    }
    case "safetyConcerns":
      state.flags.raisedSafety = state.day;
      addToast(state, "You raised safety concerns. Somebody in Washington wrote that down.", "neutral");
      return;
    case "bidLow":
      return resolveAuction(state, rng, "low");
    case "bidMid":
      return resolveAuction(state, rng, "mid");
    case "bidAll":
      return resolveAuction(state, rng, "all");
    case "raise":
      state.cash += raiseAmount(state);
      return;
    case "raiseCircular":
      state.cash += Math.round(raiseAmount(state) * 0.6);
      return;
  }
}

const centre = (state: GameState): [number, number] => {
  if (state.buildings.length === 0) return [state.grid.w / 2, state.grid.h / 2];
  let x = 0;
  let z = 0;
  for (const b of state.buildings) {
    x += b.x + b.w / 2;
    z += b.z + b.d / 2;
  }
  return [x / state.buildings.length, z / state.buildings.length];
};

/** The free spot nearest the middle of the campus that fits `kind` and touches a path, or null if it is full. */
export function findSpot(state: GameState, kind: BuildingKind): [number, number] | null {
  const [w, d] = BUILDINGS[kind].size;
  const [cx, cz] = centre(state);
  let best: [number, number] | null = null;
  let bestDist = Infinity;
  for (let z = 0; z <= state.grid.h - d; z++) {
    for (let x = 0; x <= state.grid.w - w; x++) {
      if (!canPlace(state, kind, x, z).ok) continue;
      const dist = Math.hypot(x + w / 2 - cx, z + d / 2 - cz);
      if (dist < bestDist) {
        bestDist = dist;
        best = [x, z];
      }
    }
  }
  return best;
}

/** The auction is won: unlock the race's buildings, and place a free Datacenter (or hand over the voucher). */
function grantDatacenter(state: GameState, rng: Rng) {
  for (const kind of RACE_KINDS) if (state.flags[`unlocked:${kind}`] === undefined) state.flags[`unlocked:${kind}`] = state.day;
  state.flags["free:datacenter"] = 1;
  const spot = findSpot(state, "datacenter");
  // Won at auction, not asked for: no spending check (FLT-16) on a free building.
  if (spot) placeBuilding(state, rng, "datacenter", spot[0], spot[1], true);
  else addToast(state, "No room for the Datacenter. It's yours, free, wherever you make room.", "neutral");
}

/** Bid against the rivals. Only the winner pays. The rivals' best bid is rolled here, at the moment of the pick. */
export function resolveAuction(state: GameState, rng: Rng, bid: Bid) {
  const race = state.race;
  const unit = auctionUnit(state);
  const offer = Math.min(Math.max(0, state.cash), bidAmount(state, bid));
  const rival = unit * (RIVAL_BID_LOW + RIVAL_BID_SPAN * rng.next());
  race.nextAuction = state.day + Math.round(AUCTION_GAP_DAYS * eraDef(eraOfState(state)).pace);
  const top = race.board.filter((r) => r.id !== "you");
  const rival_ = RIVAL_BY_ID[top[rng.int(0, Math.min(2, top.length - 1))]!.id as RivalId];
  if (offer >= rival) {
    state.cash -= offer;
    state.hype = Math.min(100, state.hype + 4);
    grantDatacenter(state, rng);
    raceNews(state, rng, "auctionWon");
    addToast(state, `SOLD! ${formatMoney(offer)} for a Datacenter. Now find it some power.`, "good");
  } else {
    shockRival(state, rival_.id, { capability: 5, hype: 3, momentum: 0 });
    raceNews(state, rng, "auctionLost", { rival: rival_.name });
    addToast(state, `Outbid by ${rival_.name}. Your ${formatMoney(offer)} stays in the vault.`, "bad");
  }
}

/** The chance the given bid wins, for the tests and the hint. */
export const winChance = (bid: Bid): number => Math.min(1, Math.max(0, (BID_MULTIPLES[bid] - RIVAL_BID_LOW) / RIVAL_BID_SPAN));
