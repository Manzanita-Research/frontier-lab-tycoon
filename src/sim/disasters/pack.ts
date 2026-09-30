// The disaster content pack the game ships with: the base game's `content.disasters` (FLT-37 put it on the mod loader, so
// a mod can add, override or remove disasters; the sim reads them through `defs().disasters`). This file holds the
// shipped pack (mods/base-disasters/mod.json) and turns a disaster's cards into ordinary event cards.
//
// Deliberately light on imports: content/events.ts reads the cards from here while the rest of the sim is still loading.
import pack from "../../../mods/base-disasters/mod.json";
import type { EventDef } from "../../content/events";
import { cardId, offerFlag, pickFlag } from "./names";
import type { DisasterDef, DisasterPack } from "./types";

export const PACKS: readonly DisasterPack[] = [pack as unknown as DisasterPack];

export const DISASTERS: readonly DisasterDef[] = PACKS.flatMap((p) => p.content.disasters.add);

const byId = new Map(DISASTERS.map((d) => [d.id, d]));
export const disasterById = (id: string): DisasterDef | undefined => byId.get(id);

/**
 * A disaster's cards as ordinary event cards. The card is due when the `card` verb sets its offer flag (the same pattern
 * the Race's cards use), and each choice, besides its own effects, clears that flag and sets a pick flag the driver turns
 * back into the machine's CHOSE beat. A card comes back after a day (the disaster paces itself).
 */
export function cardEvents(defs: readonly DisasterDef[] = DISASTERS): EventDef[] {
  return defs.flatMap((d) =>
    (d.cards ?? []).map((c): EventDef => {
      const id = cardId(d.id, c.id);
      return {
        id,
        stripe: c.stripe,
        title: c.title,
        body: c.body,
        tone: c.tone,
        cooldown: 1,
        when: { flag: offerFlag(id), daysAgo: 0 },
        choices: c.choices.map((ch) => ({
          label: ch.label,
          hint: ch.hint,
          effects: [...ch.effects, { type: "flag", name: offerFlag(id), clear: true }, { type: "flag", name: pickFlag(id, ch.key) }],
        })),
      };
    }),
  );
}
