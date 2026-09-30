// The app shell: what the game is doing right now, as one statechart.
//
//   playing { running | paused }  <->  eventOpen  <->  gameOver
//
// It owns speed, the command queue, the frame accumulator and the UI-level state (tool, hover, toasts). Frames arrive
// from a Stream (the Frames service); each one either advances the sim (`running`) or only applies queued commands
// (everything else: time stands still while paused, while a card is open, and while the outcome card is up).
// Effect actions do the impure part through the Sim service and report back with SYNCED, which is where card and
// outcome changes move the machine. Player input is just an event: choosing a card is `CHOOSE`, and the machine
// forwards it into the sim as a `chooseEvent` command on the next tick.
import { Clock, Effect, Schema, Stream } from "effect";
import { fromEffectEventStream, setupEffect } from "@xstate/effect";
import type { Command } from "../sim/commands";
import { dailySeed } from "../sim/daily";
import { TICKS_PER_SECOND } from "../sim/constants";
import type { NewsItem, OpenEvent, Outcome, Tone } from "../sim/types";
import { Frames } from "./frames";
import type { Snapshot, Speed, Tool, UiSelection, UiToast } from "./hud";
import { gateToasts, mergeWire, newGate, WIRE_MAX, type NoticeGate, type WireItem } from "./notices";
import { Sim, type SyncReport } from "./sim";

export { TICKS_PER_SECOND };
export const MAX_CATCHUP_TICKS = 40;
export const SNAPSHOT_MS = 200;
export const TOAST_MS = 5200;
/** A batch summary is a list: it gets longer to be read. */
export const BATCH_TOAST_MS = 9000;

/** A type-only schema: the context carries these shapes as they are, with nothing to validate at runtime. */
const opaque = <T>() => Schema.declare<T>((_value): _value is T => true);

export const AppContext = Schema.Struct({
  speed: opaque<Speed>(),
  tool: opaque<Tool | null>(),
  hover: opaque<{ x: number; z: number } | null>(),
  /** True once the player has clicked "Keep playing" on the win card. */
  outcomeDismissed: Schema.Boolean,
  /** Real time banked toward the next sim tick. */
  acc: Schema.Number,
  /** Commands waiting for the next tick. */
  queue: opaque<readonly Command[]>(),
  lastPublishAt: Schema.Number,
  event: opaque<OpenEvent | null>(),
  outcome: opaque<Outcome>(),
  /** The HUD's view of the World, refreshed at about 5 Hz. */
  snap: opaque<Snapshot>(),
  /** The ticker: the sim's headlines with the world notices merged in (see `notices.ts`). */
  news: opaque<readonly NewsItem[]>(),
  /** The sim's own headlines, as last published. */
  headlines: opaque<readonly NewsItem[]>(),
  /** The world notices the notice policy sent to the ticker, newest last. */
  wire: opaque<readonly WireItem[]>(),
  toasts: opaque<readonly UiToast[]>(),
  toastSeq: Schema.Number,
  /** The `you` toasts the notice policy is holding for its window (see `notices.ts`). */
  gate: opaque<NoticeGate>(),
  /** The walker whose inspector card is open (their id), if any. */
  selected: Schema.NullOr(Schema.Number),
  /** The camera is following `selected`. */
  follow: Schema.Boolean,
  /** The Thoughts row (`kind|text`) whose walkers are lit up, if any. */
  highlight: Schema.NullOr(Schema.String),
  /** The staffer whose patrol zone is being painted (their id), if any: dragging on the map paints it. */
  zone: Schema.NullOr(Schema.Number),
  /** Independently owned menus: closing one cannot resume time beneath another. */
  overlays: opaque<readonly string[]>(),
});
export type AppContext = typeof AppContext.Type;

export const AppInput = Schema.Struct({ speed: opaque<Speed>(), first: opaque<SyncReport>() });
export type AppInput = typeof AppInput.Type;

/** The animation frames, as machine events. */
const frameLoop = fromEffectEventStream(() =>
  Stream.unwrap(Frames.use((f) => Effect.succeed(f.frames.pipe(Stream.map((frame) => ({ type: "FRAME" as const, now: frame.now, dt: frame.dt })))))),
);

/** Targets for the root-level handlers, so each has the leading dot. */
type Phase = ".playing.running" | ".playing.paused" | ".eventOpen" | ".gameOver";

const outcomeHeld = (c: AppContext) => c.outcome !== "playing" && !c.outcomeDismissed;

/** Which state the machine belongs in, given what the sim last reported and what the player chose. */
export function phaseFor(c: AppContext): Phase {
  if (c.event) return ".eventOpen";
  if (outcomeHeld(c)) return ".gameOver";
  return c.speed === 0 || autoPaused(c) ? ".playing.paused" : ".playing.running";
}

export const autoPaused = (c: AppContext): boolean => c.snap.firstBuildPending || !!c.snap.pendingConfirm;

/** Why time is standing still, for the "Paused" indicator: null while the clock runs. A card beats the pause button, which beats the auto-pauses. */
export type PauseReason = "card" | "player" | "tutorial" | "build" | "menu" | "inspector";
export function pauseReasonOf(c: AppContext): PauseReason | null {
  if (c.event || outcomeHeld(c) || c.snap.pendingConfirm) return "card";
  if (c.speed === 0) return "player";
  if (c.snap.firstBuildPending) return "build";
  return null;
}

/** The same words twice are one toast (the newer replaces the older); the HUD shows only the newest, so keep just a few. */
const addToasts = (c: AppContext, fresh: readonly UiToast[]) => ({ ...c, toasts: [...c.toasts.filter((t) => !fresh.some((f) => f.text === t.text)), ...fresh].slice(-3) });

export const appMachine = setupEffect({
  schemas: {
    context: AppContext,
    input: AppInput,
    events: {
      FRAME: Schema.Struct({ now: Schema.Number, dt: Schema.Number }),
      /** The sim was touched: what it reports back, always at least the open card and the outcome. */
      SYNCED: Schema.Struct({ report: opaque<SyncReport>(), now: Schema.Number }),
      SET_SPEED: Schema.Struct({ speed: opaque<Speed>() }),
      TOGGLE_PAUSE: Schema.Struct({}),
      SET_TOOL: Schema.Struct({ tool: opaque<Tool | null>() }),
      SET_HOVER: Schema.Struct({ hover: opaque<{ x: number; z: number } | null>() }),
      /** A validated player action: place a path or building, or bulldoze. Applied on the next tick. */
      COMMAND: Schema.Struct({ command: opaque<Command>() }),
      /** Pick a choice on the open event card. */
      CHOOSE: Schema.Struct({ choiceIndex: Schema.Number }),
      KEEP_PLAYING: Schema.Struct({}),
      NEW_LAB: Schema.Struct({}),
      /** Today's lab: a new lab on the date's seed ("2026-09-30"), the same campus for everyone that day. */
      DAILY_LAB: Schema.Struct({ daily: Schema.String }),
      TOAST: Schema.Struct({ text: Schema.String, tone: opaque<Tone>() }),
      /** Tap a walker (or tap away: null) to open or close the inspector. */
      SELECT: Schema.Struct({ id: Schema.NullOr(Schema.Number) }),
      /** The inspector's Follow button. */
      SET_FOLLOW: Schema.Struct({ follow: Schema.Boolean }),
      /** Tap a Thoughts row to light up who thinks it; tap it again to switch off. */
      HIGHLIGHT: Schema.Struct({ key: Schema.NullOr(Schema.String) }),
      /** Start (or stop, with null) painting a staffer's patrol zone. */
      SET_ZONE: Schema.Struct({ id: Schema.NullOr(Schema.Number) }),
      SET_OVERLAY: Schema.Struct({ id: Schema.String, open: Schema.Boolean }),
      DISMISS_TOAST: Schema.Struct({ id: Schema.Number }),
      TOAST_EXPIRED: Schema.Struct({ id: Schema.Number }),
    },
  },
  actors: { frameLoop },
  actions: {
    /** Run `n` ticks (commands on the first), then report. */
    advance: (args) =>
      Effect.gen(function* () {
        const sim = yield* Sim;
        const p = args.params as { n: number; commands: readonly Command[]; alpha: number; publish: boolean; now: number; ui: UiSelection };
        sim.ui = p.ui;
        sim.step(p.n, p.commands);
        sim.alpha = p.alpha;
        const report = sim.report(p.publish);
        if (report) args.self.send({ type: "SYNCED", report, now: p.now });
      }),
    /** Time stands still: apply what was queued, then report. */
    hold: (args) =>
      Effect.gen(function* () {
        const sim = yield* Sim;
        const p = args.params as { commands: readonly Command[]; publish: boolean; now: number; ui: UiSelection };
        sim.ui = p.ui;
        sim.alpha = 1;
        sim.applyNow(p.commands);
        const report = sim.report(p.publish);
        if (report) args.self.send({ type: "SYNCED", report, now: p.now });
      }),
    /** A new lab, seeded from the clock and the old seed. */
    newLab: (args) =>
      Effect.gen(function* () {
        const sim = yield* Sim;
        const ms = yield* Clock.currentTimeMillis;
        const daily = args.event.type === "DAILY_LAB" ? args.event.daily : null;
        sim.reset(daily ? dailySeed(daily) : ((ms ^ Math.imul(sim.world.seed, 2654435761)) >>> 0) || 1, daily);
        const report = sim.report(true, true);
        if (report) args.self.send({ type: "SYNCED", report, now: 0 });
      }),
  },
}).createMachine({
  context: ({ input }) => ({
    speed: input.speed,
    tool: null,
    hover: null,
    outcomeDismissed: false,
    acc: 0,
    queue: input.speed > 1 ? [{ type: "setPace", speed: input.speed }] : [],
    lastPublishAt: 0,
    event: input.first.event,
    outcome: input.first.outcome,
    snap: input.first.snap!,
    news: input.first.news ?? [],
    headlines: input.first.news ?? [],
    wire: [],
    toasts: input.first.toasts.slice(-3),
    toastSeq: 1,
    gate: newGate(),
    selected: null,
    follow: false,
    highlight: null,
    zone: null,
    overlays: [],
  }),
  invoke: { src: "frameLoop" },
  initial: "playing",
  states: {
    playing: {
      initial: "running",
      states: {
        running: {
          // Booted with the speed at 0 (a `?speed=0` link): start paused.
          always: ({ context }) => (context.speed === 0 || autoPaused(context) ? { target: "paused" } : undefined),
          on: {
            FRAME: (args, enq) => {
              const { context, event, actions } = args;
              const banked = context.acc + event.dt * TICKS_PER_SECOND * context.speed;
              const n = Math.min(MAX_CATCHUP_TICKS, Math.floor(banked));
              const acc = n === MAX_CATCHUP_TICKS ? 0 : banked - n;
              const params = { n, commands: n > 0 ? context.queue : [], alpha: acc, publish: event.now - context.lastPublishAt >= SNAPSHOT_MS, now: event.now, ui: uiOf(context) };
              enq(actions.advance, { ...args, params });
              return { context: { ...context, acc, queue: n > 0 ? [] : context.queue } };
            },
          },
        },
        paused: { on: { FRAME: (args, enq) => {
  const h = heldFrame(args.context, args.event.now);
  enq(args.actions.hold, { ...args, params: h.params });
  return h.next;
} } },
      },
    },
    eventOpen: { on: { FRAME: (args, enq) => {
  const h = heldFrame(args.context, args.event.now);
  enq(args.actions.hold, { ...args, params: h.params });
  return h.next;
} } },
    gameOver: { on: { FRAME: (args, enq) => {
  const h = heldFrame(args.context, args.event.now);
  enq(args.actions.hold, { ...args, params: h.params });
  return h.next;
} } },
  },
  on: {
    SYNCED: ({ context, event }, enq) => {
      const { report, now } = event;
      // One policy for every notice: what is about you is a toast (one per window), the world's news is for the ticker.
      const gated = gateToasts(context.gate, report.toasts, {
        now,
        day: report.snap?.day ?? context.snap.day,
        leapfrog: report.snap?.leapfrog,
        rank: report.snap ? { prev: context.snap.race.rank, next: report.snap.race.rank, top: report.snap.race.board.find((r) => r.rank === 1)?.short ?? "" } : null,
        seq: context.toastSeq,
      });
      const fresh = gated.toasts;
      const wire = gated.wire.length > 0 ? [...context.wire, ...gated.wire].slice(-WIRE_MAX) : context.wire;
      const next: AppContext = {
        ...addToasts(context, fresh),
        gate: gated.gate,
        toastSeq: gated.seq,
        event: report.event,
        outcome: report.outcome,
        // A new outcome is shown even if the last one was waved away (won, kept playing, and now an ending's front page).
        outcomeDismissed: report.outcome === context.outcome ? context.outcomeDismissed : false,
        snap: report.snap ?? context.snap,
        headlines: report.news ?? context.headlines,
        wire,
        news: report.news || wire !== context.wire ? mergeWire(report.news ?? context.headlines, wire) : context.news,
        lastPublishAt: report.snap ? now : context.lastPublishAt,
        // The walker left the map (out the gate, or the game was reset): close the card.
        ...(report.snap && context.selected !== null && report.snap.selectedId === context.selected && report.snap.inspect === null ? { selected: null, follow: false } : {}),
        // The staffer whose zone was being painted has been let go.
        ...(report.snap && context.zone !== null && !report.snap.ops.staff.some((o) => o.id === context.zone) ? { zone: null } : {}),
      };
      for (const t of fresh) enq.raise({ type: "TOAST_EXPIRED", id: t.id }, { id: `toast:${t.id}`, delay: t.batch ? BATCH_TOAST_MS : TOAST_MS });
      return { context: next, target: phaseFor(next) };
    },
    SET_SPEED: ({ context, event }) => {
      // The coach asked for ▶▶ while the first model trains (FLT-58).
      const saw = event.speed > 1 && context.snap.coach?.id === "speed";
      const queue: Command[] = [...context.queue];
      if (saw) queue.push({ type: "coachSaw", what: "speed" });
      // The card budget (FLT-54) is counted in game days; the sim hears the speed so a card stays ~20 real seconds from the last.
      if (event.speed > 0 && event.speed !== context.speed) queue.push({ type: "setPace", speed: event.speed });
      const next = { ...context, speed: event.speed, queue };
      return { context: next, target: phaseFor(next) };
    },
    TOGGLE_PAUSE: ({ context }) => {
      const next = { ...context, speed: (context.speed === 0 ? 1 : 0) as Speed };
      return { context: next, target: phaseFor(next) };
    },
    SET_TOOL: ({ context, event }) => {
      const tool = context.tool === event.tool ? null : event.tool;
      const queue: readonly Command[] = tool ? [...context.queue, { type: "buildPanelOpened" }] : context.queue;
      return { context: { ...context, tool, hover: null, zone: null, queue, speed: context.snap.firstBuildPending && tool ? 1 : context.speed, lastPublishAt: 0 } };
    },
    SET_OVERLAY: ({ context, event }) => {
      const overlays = context.overlays.filter((id) => id !== event.id);
      if (event.open) overlays.push(event.id);
      const build = event.open && /start|build|menu/.test(event.id);
      const queue: readonly Command[] = build ? [...context.queue, { type: "buildPanelOpened" }] : context.queue;
      const next = { ...context, overlays, queue, speed: build && context.snap.firstBuildPending ? 1 as Speed : context.speed };
      return { context: next, target: phaseFor(next) };
    },
    SET_ZONE: ({ context, event }) => ({ context: { ...context, zone: event.id === context.zone ? null : event.id, tool: null, hover: null } }),
    SET_HOVER: ({ context, event }) => {
      if (context.hover?.x === event.hover?.x && context.hover?.z === event.hover?.z) return;
      return { context: { ...context, hover: event.hover } };
    },
    // A player command publishes the snapshot on the very next frame, so a hire or a painted tile shows straight away.
    COMMAND: ({ context, event }) => ({ context: { ...context, speed: event.command.type === "buildPanelOpened" && context.snap.firstBuildPending ? 1 : context.speed, queue: [...context.queue, event.command], lastPublishAt: 0 } }),
    CHOOSE: ({ context, event }) => {
      // A greyed-out choice (a bid you can't afford) can't be taken by key either.
      if (!context.event || context.snap.eventBlocked?.[event.choiceIndex]) return;
      const command: Command = { type: "chooseEvent", eventId: context.event.id, choiceIndex: event.choiceIndex };
      return { context: { ...context, queue: [...context.queue, command] } };
    },
    KEEP_PLAYING: ({ context }) => {
      const next = { ...context, outcomeDismissed: true, speed: (context.speed === 0 ? 1 : context.speed) as Speed };
      return { context: next, target: phaseFor(next) };
    },
    // Selection changes reset the publish timer, so the next frame publishes and the card opens straight away.
    SELECT: ({ context, event }) => {
      // ...and then to read somebody's mind: anybody's card counts (the sim checks it is a person, not a building).
      const queue: readonly Command[] = event.id !== null && context.snap.coach?.id === "peek" ? [...context.queue, { type: "coachSaw", what: "mind", id: event.id }] : context.queue;
      const next = { ...context, selected: event.id, follow: event.id === context.selected ? context.follow : false, lastPublishAt: 0, acc: 0, queue };
      return { context: next, target: phaseFor(next) };
    },
    SET_FOLLOW: ({ context, event }) => (context.selected === null ? undefined : { context: { ...context, follow: event.follow, lastPublishAt: 0 } }),
    HIGHLIGHT: ({ context, event }) => ({ context: { ...context, highlight: event.key === context.highlight ? null : event.key, lastPublishAt: 0 } }),
    DAILY_LAB: (args, enq) => {
      enq(args.actions.newLab, args);
      return { context: freshLab(args.context), target: ".playing.running" };
    },
    NEW_LAB: (args, enq) => {
      const { context, actions } = args;
      enq(actions.newLab, args);
      return { context: freshLab(context), target: ".playing.running" };
    },
    TOAST: ({ context, event }, enq) => {
      const id = 1_000_000 + context.toastSeq;
      enq.raise({ type: "TOAST_EXPIRED", id }, { id: `toast:${id}`, delay: TOAST_MS });
      const kept = context.toasts.filter((t) => t.text !== event.text).slice(-2);
      return { context: { ...context, toasts: [...kept, { id, text: event.text, tone: event.tone }], toastSeq: context.toastSeq + 1 } };
    },
    DISMISS_TOAST: ({ context, event }, enq) => {
      enq.cancel(`toast:${event.id}`);
      return { context: { ...context, toasts: context.toasts.filter((t) => t.id !== event.id) } };
    },
    TOAST_EXPIRED: ({ context, event }) => {
      if (!context.toasts.some((t) => t.id === event.id)) return;
      return { context: { ...context, toasts: context.toasts.filter((t) => t.id !== event.id) } };
    },
  },
});

/** The app's side of a new lab: nothing queued, nothing selected, running at 1x. */
const freshLab = (context: AppContext): AppContext => ({ ...context, queue: [], acc: 0, toasts: [], gate: newGate(), wire: [], headlines: [], outcomeDismissed: false, speed: 1, tool: null, hover: null, selected: null, follow: false, highlight: null, zone: null, overlays: [] });

/** The selection as the sim handle wants it. */
const uiOf = (c: AppContext): UiSelection => ({ selected: c.selected, follow: c.follow, highlight: c.highlight });

/** Every frame outside `running`: time stands still, so only queued commands apply. */
function heldFrame(context: AppContext, now: number) {
  return {
    params: { commands: context.queue, publish: now - context.lastPublishAt >= SNAPSHOT_MS, now, ui: uiOf(context) },
    // Nothing banked and nothing queued: no new context, so subscribers are not woken at 60 Hz for nothing.
    next: context.acc === 0 && context.queue.length === 0 ? undefined : { context: { ...context, acc: 0, queue: [] } },
  };
}
