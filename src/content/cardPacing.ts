// How event cards take turns (FLT-54). Data only: which story a card belongs to, which cards are minor (they answer
// themselves rather than wait, and at 10× always do), which are urgent (a disaster does not wait for a quiet week), and the
// choice a minor card takes by itself. A card not listed here is its own story, full size, and patient.

/** Game days after any card before the next may open. */
export const CARD_GAP_DAYS = 5;
/** Game days after a story's card before another card of the same story may open (a hearing's next question, the next roll call). */
export const STORY_GAP_DAYS = 10;
/** At 10× the presentation allows one card about every this many real seconds; the sim turns it into game days. */
export const CARD_REAL_SECONDS = 20;

/** The ticker line for a minor card answered without you. */
export const HANDLED = "Your chief of staff handled \"{title}\" while you were busy: {choice}.";

export interface CardPace {
  /** Cards of one story never follow each other closely (the id's first word when not set: `hearing-cloud` is `hearing`). */
  story?: string;
  /** Answers itself with `default` (and says so on the ticker) instead of waiting for a gap, and always at 10×. */
  minor?: true;
  /** Opens as soon as the 1× gap is over, ahead of the line, however fast the game runs. */
  urgent?: true;
  /** An offer on a clock (money, a launch, an era): keeps the gap, but goes ahead of the line instead of waiting behind colour. */
  priority?: true;
  /** The choice a minor card takes by itself (0 if not set): the shrug, not the grand gesture. */
  default?: number;
}

/** First match wins. */
export const CARD_PACING: readonly { match: RegExp; pace: CardPace }[] = [
  // A disaster's own cards: the fire is now.
  { match: /^dz:/, pace: { story: "disaster", urgent: true } },
  // The Memo: the ticker has been counting it down all week, so it lands the first day the desk is free.
  { match: /^memo$/, pace: { urgent: true } },
  // The money (FLT-86): a round on the table, or the bank's letter. The game is already out of cash; it can't wait for a quiet week.
  { match: /^(bridge\d|overdraft)$/, pace: { story: "money", urgent: true } },
  // The race's offers: a term sheet that waits behind a documentary crew is a term sheet at the wrong valuation.
  { match: /^(fundingRound|computeAuction|openWeights|shipNow|era\d+)$/, pace: { priority: true } },
  // The factions' asks: colour, not decisions. The lab's intern can sign an open letter.
  { match: /^fx:/, pace: { story: "factions", minor: true } },
  // The Water Discourse is one story, from the viral post to the counter-protest.
  { match: /^(waterDiscourse|drumCircle|documentary|truthers)$/, pace: { story: "water" } },
  // The launch livestream's mishap: if it can't be shown on the day, the clip goes straight to the ticker.
  { match: /^stream:/, pace: { story: "stream", minor: true } },
  { match: /^audit-/, pace: { story: "auditors" } },
];

const cache = new Map<string, Required<Pick<CardPace, "story" | "default">> & CardPace>();

/** The pacing of one card, by id. */
export function paceOfCard(id: string): Required<Pick<CardPace, "story" | "default">> & CardPace {
  let pace = cache.get(id);
  if (!pace) {
    const rule = CARD_PACING.find((r) => r.match.test(id))?.pace ?? {};
    pace = { ...rule, story: rule.story ?? id.split(/[-:]/)[0]!, default: rule.default ?? 0 };
    cache.set(id, pace);
  }
  return pace;
}
