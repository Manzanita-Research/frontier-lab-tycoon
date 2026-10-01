// FLT-91: how big people are drawn against a 1-unit tile. Walkers were 1.6x life size, which made a researcher 1.26 tiles
// tall: three quarters of a path tile's width on screen, where RollerCoaster Tycoon's guests stand a third to a half of
// one. At 1.0 they are 0.45 of a tile, and a path two people wide looks like a path. Everything pinned over a head (thought
// bubbles, name tags, the selection arrow, placards) is measured from these numbers, so it moves with them.

/** The crowd's scale: researchers, agents, visitors and protesters. */
export const PEOPLE = 1.0;
/** Staff and touring groups wear a uniform and stand a touch taller than the crowd, so you can pick them out. */
export const CREW = PEOPLE * 1.1;
/** Mod looks (FLT-55) were authored against the 1.6x crowd, so they shrink with it. */
export const MOD_LOOKS = PEOPLE / 1.6;
/** The top of a researcher's head at scale 1: a 0.52 capsule and a 0.125 head centred at 0.66. */
export const HEAD = 0.785;
/** The top of a crowd walker's head, in world units. */
export const HEAD_TOP = HEAD * PEOPLE;

/**
 * How tall something `height` units high stands on screen, as a share of a tile's on-screen width, from the game's
 * true-isometric camera (offset 20, 20, 20). A tile's diagonal is √2 across; the camera's 35.26° tilt shortens a
 * height by cos = √(2/3). So the ratio is height / √3.
 */
export const onScreenShare = (height: number) => (height * Math.sqrt(2 / 3)) / Math.SQRT2;

/** Where a walker's thought bubble hangs (its tail on the crown) and where a name tag or the selection arrow floats over it. */
export const OVER = {
  bubble: 0.69 * PEOPLE,
  agentBubble: 0.59 * PEOPLE,
  memberBubble: 0.71 * CREW,
  tag: 1.19 * PEOPLE,
  staffTag: 1.0 * CREW,
  arrow: 1.34 * PEOPLE,
  /** A tap aims at the middle of the body, not the feet. */
  pick: 0.34 * PEOPLE,
} as const;
