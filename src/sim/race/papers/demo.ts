// Deterministic ticker/toast moments. Outcomes go through the real machines and seeded driver dice.
import { createRng } from "../../rng";
import { TICKS_PER_DAY } from "../../constants";
import type { GameState } from "../../types";
import { dailyPapers, enablePapers, publishPaper, setPublicationPolicy } from "./driver";
import { P } from "./content";
export const PAPER_MOMENTS = ["paper-drop", "paper-scoop", "paper-award"] as const;
export type PaperMoment = typeof PAPER_MOMENTS[number];
export const isPaperMoment = (s: string | null | undefined): s is PaperMoment => PAPER_MOMENTS.some((m) => m === s);
export function stagePapers(s: GameState, moment: PaperMoment) {
  enablePapers(s);
  const rng = createRng(s.rngState);
  setPublicationPolicy(s, "Closed", rng);
  s.day = 10;
  s.tick = s.day * TICKS_PER_DAY;
  s.race.era = { value: "era2", context: { peak: 2 } };
  s.models.push("Frontier-2-Appendix");
  dailyPapers(s, rng);
  const p = s.papers!.list.find((p) => p.machine.value === "draft")!;
  s.toasts.length = 0;
  publishPaper(s, p.id, moment === "paper-drop" ? "preprint" : "review", rng);
  if (moment !== "paper-drop") {
    s.toasts.length = 0;
    s.day = p.machine.context.dueDay! - (moment === "paper-scoop" ? 1 : 0);
    s.tick = s.day * TICKS_PER_DAY;
    // Find a replayable seed whose ordinary daily dice produce the requested moment.
    for (let seed = 1; seed < 1000; seed++) {
      const probe = createRng(seed);
      const scoop = probe.next(), award = probe.next();
      if (moment === "paper-scoop" ? scoop < P.scoopChance : award < P.awardChance) {
        const sceneRng = createRng(seed);
        dailyPapers(s, sceneRng);
        s.rngState = sceneRng.state();
        return;
      }
    }
    throw new Error(`No deterministic seed for ${moment}`);
  }
  s.rngState = rng.state();
}
