import { describe, expect, it } from "vitest";
import { SIGN_CARD } from "../../sim/collusion/pack";
import { fixtureInput, fixtureSnapshot } from "./fixtures";
import { crumbWikiOf, investigationOf } from "./collusion";
import { arxiveId, byline, paperMomentOf } from "./papers";
import { playableOf } from "./playable";
import { hudViewModel } from "./vm";

describe("Papers in the view-model (FLT-45)", () => {
  it("stays hidden until Level 5 earns it, then opens with the policy, the drafts first", () => {
    expect(hudViewModel(fixtureInput({ papers: "panel", level: 4 })).papers.enabled).toBe(false);
    const vm = hudViewModel(fixtureInput({ papers: "panel", level: 5 }));
    expect(vm.papers.enabled).toBe(true);
    expect(vm.papers.open).toBe(true);
    expect(vm.papers.policies.map((p) => p.label)).toEqual(["Open", "Selective", "Closed"]);
    expect(vm.papers.policies.filter((p) => p.active)).toHaveLength(1);
    const firstPublished = vm.papers.papers.findIndex((p) => p.status !== "draft");
    expect(vm.papers.papers.slice(firstPublished === -1 ? vm.papers.papers.length : firstPublished).every((p) => p.status !== "draft")).toBe(true);
  });

  it("gives each paper a stable arXive number and a byline with the others folded", () => {
    expect(arxiveId(7, 40)).toBe(arxiveId(7, 40));
    expect(arxiveId(7, 40)).toMatch(/^arXive:\d{4}\.\d{5}$/);
    expect(byline(7, 3)).not.toContain("others");
    expect(byline(7, 400)).toMatch(/and 39\d others$/);
  });

  it("shows the scoop with both timestamps and the gap, and never twice once closed", () => {
    const snap = fixtureSnapshot({ papers: "scoop" });
    const m = paperMomentOf(snap, true, []);
    expect(m?.kind).toBe("scoop");
    expect(m!.gapText).toContain("hours before you");
    expect(m!.theirStamp).not.toBe(m!.yourStamp);
    expect(paperMomentOf(snap, true, [m!.key])).toBeNull();
    expect(paperMomentOf(snap, false, [])).toBeNull();
  });

  it("puts your paper in the middle of the arXive listing on a drop, and an award wins over everything", () => {
    const drop = paperMomentOf(fixtureSnapshot({ papers: "drop" }), true, [])!;
    expect(drop.kind).toBe("drop");
    const you = drop.listing.findIndex((l) => l.you);
    expect(you).toBeGreaterThan(0);
    expect(you).toBeLessThan(drop.listing.length - 1);
    expect(paperMomentOf(fixtureSnapshot({ papers: "award" }), true, [])?.kind).toBe("award");
  });

  it("holds a moment back while a card is open", () => {
    const vm = hudViewModel(fixtureInput({ collusion: "sign" }));
    expect(vm.event).not.toBeNull();
    expect(vm.paperMoment).toBeNull();
  });
});

describe("Agent collusion in the view-model (FLT-46)", () => {
  it("puts the evidence on the sign card only: the bonus, the guards and a POST log", () => {
    const vm = hudViewModel(fixtureInput({ collusion: "sign" }));
    expect(vm.event?.id).toBe(SIGN_CARD);
    const inv = vm.event!.investigation!;
    expect(inv.log.length).toBeGreaterThan(0);
    expect(inv.log.every((l) => l.includes("POST definitely-not-the-internet.local/wiki/"))).toBe(true);
    expect(investigationOf(fixtureSnapshot({ collusion: "sign" }), "some-other-card")).toBeNull();
  });

  it("never names it before an ending, and leaves it off the unlock card", () => {
    const vm = hudViewModel(fixtureInput({ collusion: "traffic" }));
    expect(vm.crumbWiki).toBeNull();
    expect(JSON.stringify(vm.collusion)).not.toMatch(/swarm|collu/i);
    const unlock = playableOf({ unlockCard: { id: "level-5", title: "New! Scrutiny", body: "Ship model #3", items: ["Demo Stage", "papers", "collusion"] } }).unlock!;
    expect(unlock.items).toEqual(["Demo Stage", "Papers: publish or perish"]);
  });

  it("opens CrumbWiki at the exposed ending with the front page, once", () => {
    const snap = fixtureSnapshot({ collusion: "scandal" });
    const wiki = crumbWikiOf(snap, [])!;
    expect(wiki.ending).toBe("exposed");
    expect(wiki.frontPage?.headline).toBeTruthy();
    expect(wiki.url).toContain("definitely-not-the-internet.local");
    expect(crumbWikiOf(snap, [wiki.key])).toBeNull();
  });
});
