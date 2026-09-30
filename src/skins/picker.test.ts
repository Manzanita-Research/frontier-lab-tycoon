// FLT-71: Frontier 95 for everyone, the other five hidden from the picker (still reachable with ?skin=), and an old pick
// of a hidden skin moved to Frontier 95 once, with a notice.
import { describe, expect, it } from "vitest";
import { BASE_ID, CLASSIC, DEFAULT_SKIN, MIGRATED_NOTICE, bootChoice, catalog, isListed, pickToSave, prepareSkin, skinList } from "./registry";

const HIDDEN = ["discovery-disc-96", "field-almanac", "homepage-98", "karaoke-night", "swag-drop"];

describe("the Display picker", () => {
  it("lists Frontier 95 first, then Classic (the base), and nothing else", () => {
    expect(skinList().map((s) => s.id)).toEqual([DEFAULT_SKIN, BASE_ID]);
    expect(skinList().at(-1)).toEqual(CLASSIC);
    expect(CLASSIC.preview, "Classic needs a thumbnail: src/skins/base/assets/preview.jpg").not.toBe("");
  });
  it("hides the five with `unlisted: true` in their skin.json, and they still load for ?skin=", async () => {
    expect(catalog.filter((e) => e.manifest?.unlisted).map((e) => e.folder).sort()).toEqual(HIDDEN);
    for (const id of HIDDEN) {
      expect(isListed(id)).toBe(false);
      expect((await prepareSkin(id)).skin.id).toBe(id);
    }
  });
  it("unhiding a skin is dropping that one line", () => {
    const entries = catalog.map((e) => (e.folder === "swag-drop" ? { ...e, manifest: { ...e.manifest!, unlisted: undefined } } : e));
    expect(skinList(entries).map((s) => s.id)).toEqual([DEFAULT_SKIN, "swag-drop", BASE_ID]);
  });
});

describe("which skin a player starts on", () => {
  it("a fresh profile (nothing saved, no ?skin=) gets Frontier 95, and nothing is written", () => {
    expect(bootChoice("", null)).toEqual({ id: DEFAULT_SKIN, notice: false });
  });
  it("a ?skin= link shows that skin for the visit and never saves it", () => {
    expect(bootChoice("?skin=swag-drop", null)).toEqual({ id: "swag-drop", notice: false });
    expect(bootChoice("?skin=swag-drop", "base")).toEqual({ id: "swag-drop", notice: false });
    // The picker's OK on that visit keeps the player's own pick: a hidden skin is not one they could have chosen.
    expect(pickToSave("swag-drop")).toBeNull();
    expect(pickToSave(DEFAULT_SKIN)).toBe(DEFAULT_SKIN);
    expect(pickToSave(BASE_ID)).toBe(BASE_ID);
  });
  it.each(HIDDEN)("an old saved pick of %s moves to Frontier 95, once, with the notice", (id) => {
    const first = bootChoice("", id);
    expect(first).toEqual({ id: DEFAULT_SKIN, save: DEFAULT_SKIN, notice: true });
    // Next visit, storage holds Frontier 95: no second notice.
    expect(bootChoice("", first.save!)).toEqual({ id: DEFAULT_SKIN, notice: false });
    expect(MIGRATED_NOTICE).toBe("Frontier 95 is back as your desktop.");
  });
  it("an old hidden pick with a ?skin= link still migrates, but the notice waits for Frontier 95 to be what shows", () => {
    expect(bootChoice("?skin=karaoke-night", "swag-drop")).toEqual({ id: "karaoke-night", save: DEFAULT_SKIN, notice: false });
    expect(bootChoice("?skin=frontier-95", "swag-drop")).toEqual({ id: DEFAULT_SKIN, save: DEFAULT_SKIN, notice: true });
  });
  it("a saved pick that is still listed is left alone", () => {
    expect(bootChoice("", BASE_ID)).toEqual({ id: BASE_ID, notice: false });
    expect(bootChoice("", DEFAULT_SKIN)).toEqual({ id: DEFAULT_SKIN, notice: false });
  });
});
