// Money in the race: what the revenue factor is, what a funding round is worth, what an auction costs.
import { arenaScore, RIVAL_BY_ID, YOU, type RivalId } from "../../content/rivals";
import { formatMoney, runwayMonths } from "../format";
import type { GameState } from "../types";
import { rankOf } from "./arena";
import { valuationFactor } from "./leapfrog/factors";
import { leapfrogVars } from "./leapfrog/vars";
import { evalBonus } from "../collusion/scores";

/** Revenue while an open-weights rival is eating it. */
export const OPEN_DROP_FACTOR = 0.7;
/** Days the -30% lasts. */
export const OPEN_DROP_DAYS = 30;
/** Each "cut prices" is -15% for good. */
export const PRICE_CUT_FACTOR = 0.85;

export const openDropActive = (state: GameState): boolean => state.race.openDrop !== null && state.day < state.race.openDrop.until;

/** Multiplies every gateway's revenue. */
export function revenueFactor(state: GameState): number {
  return (openDropActive(state) ? OPEN_DROP_FACTOR : 1) * PRICE_CUT_FACTOR ** state.race.priceCuts;
}

/** The Vibes score (0 to 999, the Crowd's park rating) that gates funding rounds. */
export const vibesOf = (state: GameState): number => Math.round(state.vibes.value);

export const FUNDING_VIBES = 400;
export const FUNDING_RUNWAY_MONTHS = 3;
/** Days between funding offers. */
export const FUNDING_GAP_DAYS = 60;

/** Is the lab short of runway (under 3 months) and popular enough (Vibes over 400) for investors to call? */
export function fundingDue(state: GameState): boolean {
  const runway = runwayMonths(state.cash, state.ledger.net);
  return runway !== null && runway < FUNDING_RUNWAY_MONTHS && vibesOf(state) > FUNDING_VIBES && state.day - state.race.lastFunding >= FUNDING_GAP_DAYS;
}

/** Annualised revenue, for the headline. */
export const annualRevenue = (state: GameState): number => state.ledger.income * 360;

/** What investors say the lab is worth: capability squared, hype, and where you sit on the Arena. */
export function valuation(state: GameState): number {
  const rank = rankOf(state.race.board);
  return Math.round(state.capability ** 2 * 1_400_000 * (0.5 + state.hype / 100) * Math.max(0.5, 1.6 - 0.13 * rank) * valuationFactor(state));
}

/** The cash the round brings in: half a percent of the valuation, and never less than two months of gross burn. */
export const raiseAmount = (state: GameState): number => Math.max(Math.round(valuation(state) * 0.005), Math.round(state.ledger.expenses * 60), 4_000_000);

/** One auction "unit": ten days of gross burn, never under $600K. Bids are multiples of it. */
export const auctionUnit = (state: GameState): number => Math.max(600_000, Math.round((state.ledger.expenses * 10) / 100_000) * 100_000);

export const BID_MULTIPLES = { low: 1, mid: 2.5, all: 4 } as const;
export type Bid = keyof typeof BID_MULTIPLES;

export const bidAmount = (state: GameState, bid: Bid): number => Math.round(auctionUnit(state) * BID_MULTIPLES[bid]);

/**
 * Why each auction bid can't be made, in choice order, or null (FLT-58): a bid bigger than the cash in the bank is greyed out
 * with the reason. "Bid low" never is, so the card can always be answered (the sim clamps an offer to the cash anyway).
 */
export const auctionBlocked = (state: GameState): (string | null)[] =>
  (["low", "mid", "all"] as const).map((bid) => (bid !== "low" && bidAmount(state, bid) > state.cash ? `${formatMoney(bidAmount(state, bid))} is more than the ${formatMoney(Math.max(0, state.cash))} you have` : null));

/** The template variables the race's cards and effects use. They never shadow {lab}, {model} or {rival}. */
export function raceVars(state: GameState): Record<string, string> {
  const { race } = state;
  const top = race.board.find((r) => r.id !== YOU)!;
  const drop = race.openDrop;
  const nameOf = (id: string) => RIVAL_BY_ID[id as RivalId]?.name ?? id;
  const rivalScore = drop ? (race.board.find((r) => r.id === drop.rival)?.score ?? 0) : 0;
  const mine = arenaScore(state.capability, state.hype);
  return {
    collusionBonus: String(Math.round(evalBonus(state) * 100)),
    valuation: formatMoney(valuation(state)),
    revenue: formatMoney(annualRevenue(state)),
    raise: formatMoney(raiseAmount(state)),
    rank: String(rankOf(race.board)),
    bidLow: formatMoney(bidAmount(state, "low")),
    bidMid: formatMoney(bidAmount(state, "mid")),
    bidAll: formatMoney(bidAmount(state, "all")),
    topRival: nameOf(top.id),
    dropRival: drop ? nameOf(drop.rival) : "",
    dropModel: drop?.model ?? "",
    gap: drop ? `${Math.abs(rivalScore - mine)} points` : "",
    // Release Leapfrog's cards ({lfRival}, {lfReady}, ...): empty while the pack is off.
    ...leapfrogVars(state),
  };
}
