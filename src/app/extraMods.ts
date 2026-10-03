// Mods every build ships that a player can add to the lab on screen from Add/Remove Mods (FLT-102): no address bar, no
// reload. Only mods that can join mid-game belong here (recipe looks, voice, data).
import { DUCK } from "../../mods/examples/duck-mode/name";

export interface ExtraMod {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** Where its mod.json is served (the `?mod=` value). */
  readonly source: string;
}

export const EXTRA_MODS: readonly ExtraMod[] = [
  {
    id: "duck-mode",
    name: DUCK.name,
    blurb: "Everyone in the lab is a rubber duck, and the lab's chatter quacks along. The numbers stay numbers.",
    source: "/mods/examples/duck-mode/mod.json",
  },
];
