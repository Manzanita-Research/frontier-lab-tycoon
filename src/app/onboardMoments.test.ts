// FLT-93's staged links: the New! card Jem sees is the ladder's own, grouped, and the goal note knows its next step.
import { describe, expect, it } from "vitest";
import { fixtureInput } from "../ui/hud/fixtures";
import { hudViewModel } from "../ui/hud/vm";
import { createSimHandle } from "./sim";

const vmOf = (moment: string, guide: string | null = null) => {
  const handle = createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, moment });
  return hudViewModel({ ...fixtureInput(), snap: handle.report(true, true)!.snap!, guide });
};

describe("FLT-93 onboarding moments", () => {
  it("onboard-growing-team: Level 3's card, by kind, with a Show me on each hire", () => {
    const vm = vmOf("onboard-growing-team");
    expect(vm.progress?.level).toBe(3);
    expect(vm.unlock?.id).toBe("team");
    expect(vm.unlock?.groups?.map((g) => g.title)).toEqual(["Build", "Hire", "New systems", "New apps"]);
    expect(vm.unlock?.groups?.find((g) => g.id === "hire")?.entries.map((e) => e.anchor)).toEqual(["hire:sre", "hire:janitor", "hire:comms"]);
    expect(vm.unlock?.quip).toBeTruthy();
  });

  it("onboard-hire-sre: the card is read, the goal says Hire an SRE, and [Show me] is the coach pointing at it", () => {
    const vm = vmOf("onboard-hire-sre", "hire:sre");
    expect(vm.unlock).toBeNull();
    expect(vm.progress?.goal.showMe).toEqual({ label: "Hire an SRE", anchor: "hire:sre" });
    expect(vm.coach).toMatchObject({ target: "hire:sre", guide: true, ask: "hire an SRE", canSkip: false });
    expect(vm.coach?.text).toMatch(/^Hire an SRE here\./);
  });

  it("onboard-race: Level 4's card is all new apps, and the goal points at the Arena", () => {
    const vm = vmOf("onboard-race");
    expect(vm.progress?.level).toBe(4);
    expect(vm.unlock?.id).toBe("race");
    expect(vm.unlock?.groups?.some((g) => g.id === "apps")).toBe(true);
    expect(vm.progress?.goal.showMe?.anchor).toBe("app:arena");
  });
});
