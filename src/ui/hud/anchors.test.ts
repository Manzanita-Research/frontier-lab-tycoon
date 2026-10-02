import { describe, expect, it } from "vitest";
import { GOAL_STEPS, SYSTEM_GUIDES } from "../../content/anchors";
import { PROGRESSION, SYSTEM_IDS } from "../../content/progression";
import { STAFF } from "../../content/staff";
import { defs } from "../../sim/defs";
import { doorMatches, doorScore, goalStep, guideText, nextDoor, standInDoor, unlockGroupsOf, type DoorSeen } from "./anchors";
import { WIDGET_IDS } from "./widgets";

/** Every anchor a skin is asked to mark: the build tools, the Hire buttons, the applets, the bird, and the coach's own. */
const KNOWN = new Set([
  ...Object.keys(defs().buildings).map((k) => `build:${k}`),
  "build:path",
  "build:bulldoze",
  ...Object.keys(STAFF).map((j) => `hire:${j}`),
  ...WIDGET_IDS.map((id) => `app:${id}`),
  "app:bird",
  "start",
  "speed",
  "training",
  "goals",
  "stat:runway",
]);

const door = (opens: string, depth: number, more: Partial<DoorSeen> = {}): DoorSeen => ({ opens, depth, open: false, tried: false, ...more });

describe("the anchor registry (FLT-93)", () => {
  it("points every system and every goal step at an anchor a skin marks", () => {
    for (const [id, g] of Object.entries(SYSTEM_GUIDES)) if (g?.anchor) expect(KNOWN.has(g.anchor), `${id} → ${g.anchor}`).toBe(true);
    for (const [id, steps] of Object.entries(GOAL_STEPS)) for (const s of steps) expect(KNOWN.has(s.anchor), `${id} → ${s.anchor}`).toBe(true);
  });

  it("knows every system a rung can bring, and every rung and scenario objective has a step", () => {
    for (const id of SYSTEM_IDS) expect(id in SYSTEM_GUIDES, id).toBe(true);
    for (const row of PROGRESSION) expect(GOAL_STEPS[row.id]?.length, row.id).toBeGreaterThan(0);
    for (const g of defs().goals) expect(GOAL_STEPS[g.id]?.length, g.id).toBeGreaterThan(0);
  });

  it("matches doors exactly or by prefix, and prefers the exact one", () => {
    expect(doorMatches("hire:*", "hire:sre")).toBe(true);
    expect(doorMatches("hire:*", "build:hall")).toBe(false);
    expect(doorMatches("*", "anything")).toBe(true);
    expect(doorMatches("app:staff", "app:staff")).toBe(true);
    expect(doorScore("build:* hire:*", "hire:sre")).toBe(5);
    expect(doorScore("hire:sre", "hire:sre")).toBeGreaterThan(doorScore("hire:*", "hire:sre"));
    expect(doorScore("build:*", "hire:sre")).toBe(-1);
  });

  it("walks the Start menu to the Hire button one door at a time, never shutting one that is open", () => {
    // Start (shut) → Facilities ▸ → the Staff entry → the Hire tab: what F95 draws on the way to `hire:sre`.
    const start = door("build:* hire:* app:*", 1);
    expect(nextDoor("hire:sre", [start])).toBe(0);
    const facilities = door("build:* hire:* app:staff", 3);
    const doors = [{ ...start, open: true, tried: true }, facilities];
    expect(nextDoor("hire:sre", doors)).toBe(1);
    const staffEntry = door("hire:*", 4);
    expect(nextDoor("hire:sre", [...doors.map((d) => ({ ...d, tried: true })), staffEntry])).toBe(2);
    // The Hire tab is already selected: nothing left to click, and the anchor should be on the page by now.
    expect(nextDoor("hire:sre", [door("hire:*", 6, { open: true })])).toBe(-1);
    // Nothing can be clicked (the player shut the menu after the walk tried it): the Start button stands in.
    expect(standInDoor("hire:sre", [{ ...start, tried: true }])).toBe(0);
  });

  it("prefers the deeper door when two open it as specifically", () => {
    expect(nextDoor("hire:sre", [door("hire:*", 1), door("hire:*", 4)])).toBe(1);
  });

  it("groups the Growing team card into Build, Hire and New systems/apps, each with a line and a place", () => {
    const team = PROGRESSION.find((r) => r.id === "team")!;
    const items = [...team.buildings.map((k) => defs().buildings[k]!.name), ...team.staff.map((j) => STAFF[j].title), ...team.systems];
    const groups = unlockGroupsOf({ id: "team", items }, PROGRESSION);
    expect(groups.map((g) => g.title)).toEqual(["Build", "Hire", "New systems", "New apps"]);
    const hire = groups.find((g) => g.id === "hire")!;
    expect(hire.entries.map((e) => e.anchor)).toEqual(team.staff.map((j) => `hire:${j}`));
    expect(hire.entries.every((e) => e.line.length > 0)).toBe(true);
    expect(groups.find((g) => g.id === "systems")!.entries.map((e) => e.anchor)).toEqual(["hire:sre", "hire:janitor"]);
    expect(groups.find((g) => g.id === "apps")!.entries).toEqual([expect.objectContaining({ name: "The Bird App", anchor: "app:bird" })]);
  });

  it("keeps secrets off the card, gives a wake card its one system, and keeps a line it does not know", () => {
    expect(unlockGroupsOf({ id: "scrutiny", items: ["collusion"] }, PROGRESSION)).toEqual([]);
    expect(unlockGroupsOf({ id: "wake:papers", items: [] }, PROGRESSION)).toEqual([{ id: "apps", title: "New apps", entries: [expect.objectContaining({ anchor: "app:papers" })] }]);
    expect(unlockGroupsOf({ id: "scrutiny", items: ["…and a fresh headache"] }, PROGRESSION)[0]!.entries[0]).toEqual({ name: "…and a fresh headache", line: "" });
  });

  it("steps through a goal: the SRE, then the Janitor Bot, then the clock", () => {
    const facts = (built: string[], staff: string[]) => ({ built: new Set(built), staff: new Set(staff) });
    expect(goalStep("team", facts([], []))?.anchor).toBe("hire:sre");
    expect(goalStep("team", facts([], ["sre"]))?.anchor).toBe("hire:janitor");
    expect(goalStep("team", facts([], ["sre", "janitor"]))?.anchor).toBe("speed");
    expect(goalStep("garage", facts(["hall"], []))?.anchor).toBe("training");
    expect(goalStep("a-mods-rung", facts([], []))).toBeNull();
    expect(goalStep(undefined, facts([], []))).toBeNull();
  });

  it("says what each thing is in the balloon, with the right article", () => {
    expect(guideText("hire:sre")).toMatch(/^Hire an SRE here\./);
    expect(guideText("hire:janitor")).toMatch(/^Hire a Janitor Bot here\./);
    expect(guideText("build:hall")).toMatch(/^Training Hall is here\./);
    expect(guideText("app:bird")).toMatch(/Bird App/);
  });
});
