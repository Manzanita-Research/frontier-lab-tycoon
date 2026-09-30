// Regulatory Capture (FLT-22) and the Promise Tracker (FLT-23) as the HUD sees them: real staged Worlds through the
// view-model, then through the base skin and Frontier 95.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkinProvider } from "../../skins/context";
import { prepareSkin } from "../../skins/registry";
import { fixtureInput } from "./fixtures";
import { Modals } from "./tree";
import type { HudActions, HudVM } from "./types";
import { hudViewModel } from "./vm";

type Moment = "bill" | "bill-law" | "bill-leak" | "bill-exposed" | "vote" | "rollcall";
const vmOf = (senate: Moment, senateOpen = false) => hudViewModel(fixtureInput({ senate, senateOpen }));
const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;

describe("the bill", () => {
  it("opens the staffer's draft: five clauses, two ticked, and the file name everyone will see later", () => {
    const vm = vmOf("bill");
    const e = vm.event!;
    expect(e.kind).toBe("bill");
    expect(e.body).not.toMatch(/\{\w+\}/);
    const b = e.bill!;
    expect(b.editable).toBe(true);
    expect(b.clauses).toHaveLength(5);
    expect(b.clauses.filter((c) => c.on).map((c) => c.id)).toEqual(["threshold", "permit"]);
    expect(b.pickText).toBe("2 of 2 clauses");
    expect(b.fileName).toMatch(/^[A-Za-z0-9_]+_FINAL_v3\.doc$/);
    for (const c of b.clauses) expect(`${c.legal} ${c.plain}`).not.toMatch(/\{\w+\}/);
    // The Senate tile is in the palette, and says a draft is due.
    const tile = vm.buildItems.find((it) => it.kind === "senate")!;
    expect(tile.panel).toBe(true);
    expect(tile.priceText).toBe("draft due");
  });
  it("shows the law in force: its tally, the leak odds, and what it does to each rival", () => {
    const b = vmOf("bill-law", true).senate.bill!;
    expect(b.stage).toBe("law");
    expect(b.status).toMatch(/^In force · day \d+$/);
    expect(b.tally).toBe("3–0");
    expect(b.leakText).toMatch(/% a day$/);
    const tags = b.rivals.flatMap((r) => r.tags);
    expect(tags).toContain("ships closed");
    expect(tags.some((t) => /grows \d+% slower/.test(t))).toBe(true);
  });
  it("FLT-56: the draft has a leak-risk meter, and the law a reporter with a Bury button (in the beat, too)", () => {
    const draft = vmOf("bill").event!.bill!;
    expect(draft.risk).toBeGreaterThan(0);
    expect(draft.riskText).toMatch(/^\d+% before the sunset$/);
    expect(draft.riskLabel).not.toBe("");
    expect(draft.warning).toBeNull();
    expect(vmOf("bill-law", true).senate.bill!.warning).toBeNull();
    const input = fixtureInput({ senate: "bill-leak", senateOpen: true });
    const law = hudViewModel(input).senate.bill!;
    expect(law.warning).toMatchObject({ text: expect.stringMatching(/is asking about the file$/), daysText: expect.stringMatching(/^The story runs in \d+ days$/), buryText: expect.stringMatching(/^Bury it \(\$/), canBury: true });
    const vm = hudViewModel({ ...input, senateOpen: false, beat: { id: 1, kind: "leak", caption: "c", sub: "" } });
    expect(vm.beat?.kicker).toBe("Someone is asking about the file");
    expect(vm.beat?.action).toEqual({ id: "bury", label: law.warning!.buryText, enabled: true });
    expect(hudViewModel({ ...input, beat: { id: 1, kind: "exit", caption: "c", sub: "" } }).beat?.action ?? null).toBeNull();
  });
  it("leaks: the file properties name the lab's lawyers", () => {
    const e = vmOf("bill-exposed").event!;
    expect(e.id).toBe("capture-exposed");
    expect(e.bill!.stage).toBe("exposed");
    expect(e.bill!.author).toMatch(/ Legal$/);
    expect(e.choices).toHaveLength(3);
  });
});

describe("the Promise Tracker", () => {
  it("whips a vote: a motion, what each senator promised, how they lean, and one lobbied", () => {
    const vm = vmOf("vote");
    const e = vm.event!;
    expect(e.kind).toBe("vote");
    expect(e.body).not.toMatch(/\{\w+\}/);
    const tr = e.tracker!;
    expect(tr.lobbying).toBe(true);
    expect(tr.status).toMatch(/^Roll call in \d days?$/);
    expect(tr.motion?.labSideText).toMatch(/ wants (Aye|Nay)$/);
    // FLT-56: what the motion does either way.
    expect(tr.motion?.stakes?.pass).toBeTruthy();
    expect(tr.motion?.stakes?.fail).toBeTruthy();
    expect(tr.senators).toHaveLength(3);
    expect(tr.senators.filter((s) => s.lobbied)).toHaveLength(1);
    for (const s of tr.senators) {
      expect(s.said).not.toBeNull();
      expect(s.oddsText).toMatch(/^\d+%$/);
      expect(s.canLobby).toBe(!s.lobbied);
    }
  });
  it("reads the roll call: votes, kept and broken, and the Truth-o-meters move", () => {
    const tr = vmOf("rollcall").event!.tracker!;
    expect(tr.lobbying).toBe(false);
    expect(tr.last).not.toBeNull();
    expect(tr.status).toMatch(/^(Passed|Failed) \d–\d$/);
    for (const s of tr.senators) {
      expect(s.recent).toHaveLength(1);
      expect(s.truth).not.toBeNull();
    }
    // The lobbied senator voted the lab's way, whatever they promised.
    const lobbied = tr.senators.find((s) => s.recent[0]!.lobbied)!;
    expect(lobbied.recent[0]!.voted.toLowerCase()).toBe(tr.motion!.labSide);
  });
  it("opens as a window from the Senate tile, and not while a vote card shows it anyway", () => {
    expect(vmOf("bill-law", true).senate.open).toBe(true);
    expect(vmOf("bill-law", false).senate.open).toBe(false);
    expect(hudViewModel(fixtureInput({})).senate).toEqual({ open: false, tracker: null, bill: null });
    expect(hudViewModel(fixtureInput({})).buildItems.some((it) => it.kind === "senate")).toBe(false);
  });
});

async function render(skinId: string, vm: HudVM) {
  const { skin } = await prepareSkin(skinId);
  return renderToString(
    <SkinProvider skin={skin}>
      <Modals vm={vm} actions={actions} />
    </SkinProvider>,
  );
}

describe("in the skins", () => {
  it("base: the bill has tick boxes on the draft and the file properties on the leak; the tracker has lobby buttons", async () => {
    const draft = await render("base", vmOf("bill"));
    expect(draft).toContain("bill-card");
    expect((draft.match(/type="checkbox"/g) ?? []).length).toBe(5);
    expect(await render("base", vmOf("bill-exposed"))).toContain("bill-props");
    expect(draft).toContain("bill-risk");
    expect(await render("base", vmOf("bill-leak", true))).toMatch(/bill-warning.*Bury it/s);
    const vote = await render("base", vmOf("vote"));
    expect(vote).toContain("tracker-card");
    expect(vote).toContain("If it passes");
    expect(vote).toMatch(/Lobby \$/);
  });
  it("Frontier 95: WordPerfectly with track changes, and PROMISES.XLS", async () => {
    const draft = await render("frontier-95", vmOf("bill"));
    expect(draft).toContain("WordPerfectly 6.0");
    expect(draft).toContain("Track changes: ON");
    expect(draft).toContain("Comment [LL1]:");
    expect(draft).toContain("Metadata risk:");
    expect(await render("frontier-95", vmOf("bill-leak", true))).toMatch(/#REF!.*Bury it/s);
    expect(await render("frontier-95", vmOf("vote"))).toContain("=IF(PASS)");
    const leak = await render("frontier-95", vmOf("bill-exposed"));
    expect(leak).toContain("Properties");
    expect(leak).toMatch(/Author:.*Legal/s);
    const sheet = await render("frontier-95", vmOf("bill-law", true));
    expect(sheet).toContain("PROMISES.XLS");
    expect(sheet).toContain("Truth-o-meter");
    expect(sheet).toContain("ships closed");
    const roll = await render("frontier-95", vmOf("rollcall"));
    expect(roll).toMatch(/KEPT|BROKEN/);
  });
});
