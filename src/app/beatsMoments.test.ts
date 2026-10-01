// FLT-76's staged beats (`?moment=beats-pileup|badnews|logo|offsite`): each lands on its beat, the way a link opens it.
import { describe, expect, it } from "vitest";
import { BADNEWS_LEAD } from "../sim/beatsDemo";
import { openEventOf } from "../sim/events";
import { levelOf } from "../sim/progression";
import { answer } from "../sim/testkit";
import { tick, TICKS_PER_DAY } from "../sim/tick";
import { createSimHandle } from "./sim";

const staged = (moment: string, seed = 1) => createSimHandle({ seed, warp: 0, agents: 0, discourse: 0, researchers: 0, moment }).world;

describe("FLT-76 beats moments", () => {
  it("beats-pileup: one tick ships a model and reaches Level 5; a card opens the next midnight", () => {
    const s = staged("beats-pileup");
    const models = s.models.length;
    expect(levelOf(s)).toBe(4);
    expect(openEventOf(s)).toBeNull();
    tick(s);
    expect(s.models.length).toBe(models + 1);
    expect(levelOf(s)).toBe(5);
    expect(s.race.rank).toBeLessThanOrEqual(3);
    expect(s.unlockCards?.map((c) => c.title)).toContain("New! Scrutiny");
    for (let i = 0; i < TICKS_PER_DAY && !openEventOf(s); i++) tick(s);
    expect(openEventOf(s)).not.toBeNull();
  });

  it.each([1, 3])("badnews (seed %i): no card in the way, then the caught report takes 10+ points of trust", (seed) => {
    const s = staged("badnews", seed);
    let high = s.disasters.trust;
    let i = 0;
    for (; i <= BADNEWS_LEAD && s.disasters.trust > high - 10; i++) {
      expect(openEventOf(s)).toBeNull();
      high = Math.max(high, s.disasters.trust);
      tick(s);
    }
    expect(high - s.disasters.trust).toBeGreaterThanOrEqual(10);
    expect(i).toBeGreaterThan(60); // a couple of seconds at ▶▶▶ to see it coming
    expect(s.auditors?.report?.caught).toBe(true);
  });

  it("logo: Level 1 with the logo card open; offsite: the offsite open", () => {
    const logo = staged("logo");
    expect(levelOf(logo)).toBe(1);
    expect(openEventOf(logo)?.id).toBe("theLogo");
    const offsite = staged("offsite");
    expect(openEventOf(offsite)?.id).toBe("offsite");
    tick(offsite, answer(offsite, 1));
    expect(openEventOf(offsite)).toBeNull();
  });
});
