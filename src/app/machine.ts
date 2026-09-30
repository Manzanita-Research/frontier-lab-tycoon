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
import type { NewsItem, OpenEvent, Outcome, Tone } from "../sim/types";
import { Frames } from "./frames";
import type { Snapshot, Speed, Tool, UiSelection, UiToast } from "./hud";
import { Sim, type SyncReport } from "./sim";

/** Twenty sim ticks per day, six real seconds at 1×. */
export const TICKS_PER_SECOND = 20 / 6;
export const MAX_CATCHUP_TICKS = 40;
export const SNAPSHOT_MS = 200;
export const TOAST_MS = 5200;

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
  news: opaque<readonly NewsItem[]>(),
  toasts: opaque<readonly UiToast[]>(),
  toastSeq: Schema.Number,
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
        sim.reset(((ms ^ Math.imul(sim.world.seed, 2654435761)) >>> 0) || 1);
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
    queue: [],
    lastPublishAt: 0,
    event: input.first.event,
    outcome: input.first.outcome,
    snap: input.first.snap!,
    news: input.first.news ?? [],
    toasts: input.first.toasts.slice(-3),
    toastSeq: 1,
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
      const fresh = report.toasts;
      const next: AppContext = {
        ...addToasts(context, fresh),
        event: report.event,
        outcome: report.outcome,
        snap: report.snap ?? context.snap,
        news: report.news ?? context.news,
        lastPublishAt: report.snap ? now : context.lastPublishAt,
        // The walker left the map (out the gate, or the game was reset): close the card.
        ...(report.snap && context.selected !== null && report.snap.selectedId === context.selected && report.snap.inspect === null ? { selected: null, follow: false } : {}),
        // The staffer whose zone was being painted has been let go.
        ...(report.snap && context.zone !== null && !report.snap.ops.staff.some((o) => o.id === context.zone) ? { zone: null } : {}),
      };
      for (const t of fresh) enq.raise({ type: "TOAST_EXPIRED", id: t.id }, { id: `toast:${t.id}`, delay: TOAST_MS });
      return { context: next, target: phaseFor(next) };
    },
    SET_SPEED: ({ context, event }) => {
      const next = { ...context, speed: event.speed };
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
      if (!context.event) return;
      const command: Command = { type: "chooseEvent", eventId: context.event.id, choiceIndex: event.choiceIndex };
      return { context: { ...context, queue: [...context.queue, command] } };
    },
    KEEP_PLAYING: ({ context }) => {
      const next = { ...context, outcomeDismissed: true, speed: (context.speed === 0 ? 1 : context.speed) as Speed };
      return { context: next, target: phaseFor(next) };
    },
    // Selection changes reset the publish timer, so the next frame publishes and the card opens straight away.
    SELECT: ({ context, event }) => {
      const next = { ...context, selected: event.id, follow: event.id === context.selected ? context.follow : false, lastPublishAt: 0, acc: 0 };
      return { context: next, target: phaseFor(next) };
    },
    SET_FOLLOW: ({ context, event }) => (context.selected === null ? undefined : { context: { ...context, follow: event.follow, lastPublishAt: 0 } }),
    HIGHLIGHT: ({ context, event }) => ({ context: { ...context, highlight: event.key === context.highlight ? null : event.key, lastPublishAt: 0 } }),
    NEW_LAB: (args, enq) => {
      const { context, actions } = args;
      enq(actions.newLab, args);
      const next = { ...context, queue: [], acc: 0, toasts: [], outcomeDismissed: false, speed: 1 as Speed, tool: null, hover: null, selected: null, follow: false, highlight: null, zone: null, overlays: [] };
      return { context: next, target: ".playing.running" };
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
