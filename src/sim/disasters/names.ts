// How a disaster's card is named in the World. No imports: the content side (content/events.ts) needs these before the
// rest of the sim has finished loading.

/** The event id of a disaster's card. */
export const cardId = (disaster: string, card: string): string => `dz:${disaster}:${card}`;
/** The flag that says "this card is due" (an ordinary arc condition). */
export const offerFlag = (id: string): string => `offer:${id}`;
/** The flag a choice sets to say what the player picked (the driver turns it into a CHOSE beat). */
export const pickFlag = (id: string, key: string): string => `pick:${id}:${key}`;
/** The flag that says "a mod arc asked for this card" (the `card` verb): it opens whatever the card's own `when` says. */
export const askFlag = (id: string): string => `ask:${id}`;
