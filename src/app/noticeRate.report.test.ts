// FLT-51's evidence, not a CI test: toasts (and, since FLT-54, cards) per real minute in `?scenario=midgame` at 1x, 3x and 10x, through the real app
// machine (manual frames at 30 fps, cards answered with their first choice, as a player who clicks through would).
// It only uses what the app has always had (appMachine, SimHandle, framesManual, the midgame scenario), so the same file
// runs on the branch FLT-51 started from for the "before" numbers:
//
//   NOTICE_RATE=1 NOTICE_MINUTES=3 npx vitest run src/app/noticeRate.report.test.ts --disableConsoleIntercept
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { createEffectActor } from "@xstate/effect";
import { describe } from "vitest";
import { createMidgameScenario, midgameOpeningNews } from "../sim/scenarios/midgame";
import { framesManual, ManualFrames } from "./frames";
import { appMachine } from "./machine";
import { SimHandle, Sim, simLayer } from "./sim";

const MINUTES = Number(import.meta.env.NOTICE_MINUTES ?? 3);
const FPS = 30;

function measure(speed: 1 | 3 | 10) {
  const handle = new SimHandle(createMidgameScenario(), true);
  handle.newsStartId = midgameOpeningNews(handle.world)[0]!.id;
  // Count what the sim sends, by source where it says one.
  let raw = 0;
  // The scenario's own history (its construction toasts) is drained by the first report, as the app does: not counted.
  let counting = false;
  const bySource: Record<string, number> = {};
  const report = handle.report.bind(handle);
  handle.report = (due, force) => {
    const r = report(due, force);
    if (!counting) return r;
    for (const t of r?.toasts ?? []) {
      raw++;
      const k = `${(t as { source?: string }).source ?? "?"}/${(t as { importance?: string }).importance ?? "?"}`;
      bySource[k] = (bySource[k] ?? 0) + 1;
    }
    return r;
  };
  return Effect.gen(function* () {
    const sim = yield* Sim;
    const frames = yield* ManualFrames;
    const first = sim.report(true, true)!;
    first.toasts = [];
    counting = true;
    const actor = yield* createEffectActor(appMachine, { input: { speed, first } });
    const seen = new Set<number>();
    const shown: string[] = [];
    // Answers to the cards this player clicks (never held back), counted apart from the rest.
    let replies = 0;
    // Cards on screen: each new one the player has to answer.
    let cards = 0;
    let open: string | null = null;
    const startDay = handle.world.day;
    for (let f = 0; f < MINUTES * 60 * FPS; f++) {
      frames.emit(1 / FPS);
      for (let i = 0; i < 6; i++) yield* Effect.yieldNow;
      const c = actor.getSnapshot().context;
      for (const t of c.toasts) if (!seen.has(t.id)) {
        seen.add(t.id);
        shown.push(t.text);
        if ((t as { reply?: true }).reply) replies++;
      }
      if (c.event && c.event.id !== open) cards++;
      open = c.event?.id ?? null;
      if (c.event) actor.send({ type: "CHOOSE", choiceIndex: 0 });
    }
    const days = handle.world.day - startDay;
    const perMin = (n: number) => (n / MINUTES).toFixed(1);
    console.log(
      `NOTICE_RATE ${speed}x: ${MINUTES} real min, ${days} game days | sim sent ${raw} (${perMin(raw)}/min) | toasts shown ${shown.length} (${perMin(shown.length)}/min), of them replies ${replies} (${perMin(replies)}/min) | cards ${cards} (${perMin(cards)}/min)\n` +
        `  by source: ${JSON.stringify(bySource)}\n  shown: ${JSON.stringify(shown.slice(0, 40))}`,
    );
  }).pipe(Effect.provide(Layer.mergeAll(simLayer(handle), framesManual)));
}

describe.skipIf(!import.meta.env.NOTICE_RATE)("toasts per real minute, ?scenario=midgame", () => {
  it.effect("1x", () => measure(1), 600_000);
  it.effect("3x", () => measure(3), 600_000);
  it.effect("10x", () => measure(10), 600_000);
});
