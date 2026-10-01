import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { FIXTURE_DRAMA_FEED } from "../ui/hud/fixtures";
import { agoText, dateText, DRAMA_PLAY_CONFIRM, dramaPath, dramaViewModel, FeedIndex, feedBase, NO_DRAMA_UI, summaryText, withDrama, withoutAutosave, withoutMod } from "./feed";
import { isStagedLink } from "../app/saves";

const href = "https://flt.test/?seed=7&mod=/mods/other/mod.json&mod=/mods/drama/2026-09-28/mod.json&skin=base";
const now = new Date(2026, 8, 29, 12);

describe("Today's Drama links", () => {
  it("reads the rehearsal feed only when asked", () => {
    expect(feedBase("?drama=fixture")).toBe("/mods/drama-fixture");
    expect(feedBase("?drama=1")).toBe("/mods/drama");
    expect(feedBase("")).toBe("/mods/drama");
  });

  it("knows a Drama pack only when it is this site's, at a pack path", () => {
    expect(dramaPath("/mods/drama/2026-09-28/mod.json", href)).toBe("/mods/drama/2026-09-28/mod.json");
    expect(dramaPath("https://flt.test/mods/drama-fixture/2026-09-29/mod.json", href)).toBe("/mods/drama-fixture/2026-09-29/mod.json");
    expect(dramaPath("https://elsewhere.test/mods/drama/2026-09-28/mod.json", href)).toBeNull();
    expect(dramaPath("/mods/drama/latest.json", href)).toBeNull();
    expect(dramaPath("/mods/other/mod.json", href)).toBeNull();
  });

  it("plays one drama at a time and keeps everything else in the address", () => {
    const next = new URL(withDrama(href, "/mods/drama/2026-09-29/mod.json"));
    expect(next.searchParams.getAll("mod")).toEqual(["/mods/other/mod.json", "/mods/drama/2026-09-29/mod.json"]);
    expect(next.searchParams.get("seed")).toBe("7");
    expect(next.searchParams.get("skin")).toBe("base");
  });

  it("switches one mod off", () => {
    const next = new URL(withoutMod(href, "/mods/drama/2026-09-28/mod.json"));
    expect(next.searchParams.getAll("mod")).toEqual(["/mods/other/mod.json"]);
    expect(next.searchParams.get("seed")).toBe("7");
  });
});

describe("Today's Drama words", () => {
  it("dates a pack by its own day and says how old it is", () => {
    expect(dateText("2026-09-29")).toBe("Tue 29 Sep");
    expect(agoText("2026-09-29", now)).toBe("today");
    expect(agoText("2026-09-30", now)).toBe("today");
    expect(agoText("2026-09-28", now)).toBe("yesterday");
    expect(agoText("2026-09-24", now)).toBe("5 days ago");
    expect(agoText("2026-09-01", now)).toBe("4 weeks ago");
    expect(agoText("2026-05-29", now)).toBe("4 months ago");
  });

  it("sums a pack up, leaving out what it doesn't have", () => {
    expect(summaryText({ events: 1, headlines: 8, thoughts: 7, rivals: 1 })).toBe("1 event card · 8 headlines · 7 thoughts · 1 rival tweak");
    expect(summaryText({ events: 0, headlines: 1, thoughts: 0, rivals: 2 })).toBe("1 headline · 2 rival tweaks");
  });

  it("refuses a feed that points anywhere but a pack on this site", () => {
    const decode = Schema.decodeUnknownSync(FeedIndex);
    expect(decode({ apiVersion: 1, packs: FIXTURE_DRAMA_FEED }).packs).toHaveLength(3);
    expect(() => decode({ apiVersion: 1, packs: [{ ...FIXTURE_DRAMA_FEED[0], url: "https://evil.test/mod.json" }] })).toThrow();
    expect(() => decode({ apiVersion: 2, packs: [] })).toThrow();
  });
});

describe("dramaViewModel", () => {
  const ready = { ...NO_DRAMA_UI, open: true, status: "ready" as const, packs: FIXTURE_DRAMA_FEED, latest: FIXTURE_DRAMA_FEED[0]! };
  const playing = (url: string) => [{ id: "x", name: "Daily Drama: Old News", description: "From a shared link.", source: url }];

  it("is quiet before anything is fetched", () => {
    const vm = dramaViewModel(NO_DRAMA_UI, [], href, now);
    expect(vm).toMatchObject({ open: false, latest: null, archive: [], on: null, fresh: false, intro: false });
  });

  it("flags a new pack until it is seen or playing", () => {
    expect(dramaViewModel({ ...NO_DRAMA_UI, latest: FIXTURE_DRAMA_FEED[0]! }, [], href, now).fresh).toBe(true);
    expect(dramaViewModel({ ...NO_DRAMA_UI, latest: FIXTURE_DRAMA_FEED[0]!, seen: FIXTURE_DRAMA_FEED[0]!.id }, [], href, now).fresh).toBe(false);
    expect(dramaViewModel({ ...NO_DRAMA_UI, latest: FIXTURE_DRAMA_FEED[0]! }, playing(FIXTURE_DRAMA_FEED[0]!.url), href, now).fresh).toBe(false);
  });

  it("puts the newest pack up front and the rest in the archive, marking the one playing", () => {
    const vm = dramaViewModel(ready, playing(FIXTURE_DRAMA_FEED[1]!.url), href, now);
    expect(vm.latest?.id).toBe(FIXTURE_DRAMA_FEED[0]!.id);
    expect(vm.archive.map((p) => p.id)).toEqual(FIXTURE_DRAMA_FEED.slice(1).map((p) => p.id));
    expect(vm.archive[0]!.on).toBe(true);
    expect(vm.on?.id).toBe(FIXTURE_DRAMA_FEED[1]!.id);
    expect(vm.latest?.on).toBe(false);
  });

  it("describes a pack from an old shared link by its manifest, and only introduces a pack that is playing", () => {
    const vm = dramaViewModel({ ...ready, intro: true }, playing("/mods/drama/2026-01-02/mod.json"), href, now);
    expect(vm.on).toMatchObject({ title: "Old News", description: "From a shared link.", date: "2026-01-02", on: true });
    expect(vm.intro).toBe(true);
    expect(dramaViewModel({ ...ready, intro: true }, [], href, now).intro).toBe(false);
  });
});

describe("Play it never wipes a lab (hotfix)", () => {
  it("plays the pack on a staged link, so the Drama lab can't autosave over the player's lab", () => {
    const next = new URL(withoutAutosave(withDrama("https://app.frontierlabtycoon.com/?seed=3", "/mods/drama/2026-09-30/mod.json")));
    expect(next.searchParams.get("autosave")).toBe("off");
    expect(next.searchParams.getAll("mod")).toEqual(["/mods/drama/2026-09-30/mod.json"]);
    expect(next.searchParams.get("seed")).toBe("3");
    expect(isStagedLink(next.search)).toBe(true);
  });
  it("asks before starting a new lab", () => {
    expect(DRAMA_PLAY_CONFIRM).toMatch(/NEW lab/);
    expect(DRAMA_PLAY_CONFIRM).toMatch(/autosave/);
  });
});
