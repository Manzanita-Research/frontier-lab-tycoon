import { describe, expect, it } from "vitest";
import { BOX_SEEN_KEY, door, isBareRoot, SAVE_KEYS } from "./introRoute";
import { SLOTS, slotKey } from "./save/store";

const storage = (keys: Record<string, string> = {}) => ({ getItem: (k: string) => keys[k] ?? null });
const at = (url: string) => {
  const u = new URL(url, "https://app.frontierlabtycoon.com");
  return { pathname: u.pathname, search: u.search };
};

describe("FLT-95: the box is the intro", () => {
  it("a first visit to the bare root opens on the shelf", () => {
    expect(door(at("/"), storage())).toBe("box");
    expect(door(at(""), storage())).toBe("box");
    // A link shared on social media picks up tracking params; it is still a first visit.
    expect(door(at("/?utm_source=friend&fbclid=abc"), storage())).toBe("box");
    // Storage blocked (private browsing in some browsers): nothing is remembered, so it is always a first visit.
    expect(door(at("/"), null)).toBe("box");
  });

  it("a returning player (any save, or the box already seen) opens on the game", () => {
    for (const key of SAVE_KEYS) expect(door(at("/"), storage({ [key]: "{}" }))).toBe("game");
    expect(door(at("/"), storage({ [BOX_SEEN_KEY]: "1" }))).toBe("game");
  });

  it("staging links and every other param go straight into the game, never through the box", () => {
    for (const q of ["?moment=ops", "?scenario=midgame", "?mod=https://x.test/mod.json", "?seed=7", "?skin=base", "?load=auto", "?saves=demo", "?intro=0", "?page=gallery"])
      expect(door(at(`/${q}`), storage()), q).toBe("game");
    expect(door(at("/somewhere"), storage())).toBe("game");
  });

  it("/box and ?intro=1 always open the box, saves or not", () => {
    expect(door(at("/box"), storage({ [SAVE_KEYS[0]]: "{}" }))).toBe("box");
    expect(door(at("/box/"), storage())).toBe("box");
    expect(door(at("/?intro=1&seed=7"), storage({ [BOX_SEEN_KEY]: "1" }))).toBe("box");
  });

  it("a storage that throws is a first visit, not a crash", () => {
    const broken = { getItem: () => { throw new Error("SecurityError"); } };
    expect(door(at("/"), broken)).toBe("box");
  });

  it("knows the save slots' keys (src/save is too big to import into the entry chunk)", () => {
    expect([...SAVE_KEYS]).toEqual(SLOTS.map(slotKey));
    expect(isBareRoot(at("/?ref=hn"))).toBe(true);
    expect(isBareRoot(at("/?ref=hn&debug=1"))).toBe(false);
  });
});
