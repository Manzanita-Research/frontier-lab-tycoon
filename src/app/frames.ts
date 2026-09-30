// The Frames service: one item per animation frame. The browser feeds it from requestAnimationFrame; tests feed it
// from a Queue they own, so nothing here depends on wall-clock time.
import { Context, Effect, Layer, Queue, Stream } from "effect";

export interface Frame {
  /** Milliseconds on the frame clock (performance.now in the browser). */
  now: number;
  /** Seconds since the previous frame, clamped so a hidden tab can't dump a huge step on the sim. */
  dt: number;
}

export interface FramesApi {
  readonly frames: Stream.Stream<Frame>;
}

export class Frames extends Context.Service<Frames, FramesApi>()("@flt/Frames") {}

// Keep ordinary low-FPS frames at real 1× speed. Still discard long tab sleeps;
// the app also caps each catch-up at 40 fixed sim ticks.
const MAX_DT = 1;

/** requestAnimationFrame, for as long as the layer's scope lives. */
export const framesBrowser = Layer.effect(
  Frames,
  Effect.gen(function* () {
    const queue = yield* Queue.sliding<Frame>(2);
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        let last = performance.now();
        let raf = 0;
        const loop = (now: number) => {
          raf = requestAnimationFrame(loop);
          Queue.offerUnsafe(queue, { now, dt: Math.min(MAX_DT, (now - last) / 1000) });
          last = now;
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
      }),
      (cancel) => Effect.sync(cancel),
    );
    return Frames.of({ frames: Stream.fromQueue(queue) });
  }),
);

/** A frame source a test drives by hand: `emit(dt)` pushes one frame, `dt` seconds after the last. */
export const framesManual = Layer.effectContext(
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<Frame>();
    let now = 0;
    const emit = (dt: number) => {
      now += dt * 1000;
      Queue.offerUnsafe(queue, { now, dt: Math.min(MAX_DT, dt) });
    };
    return Context.empty().pipe(Context.add(Frames, Frames.of({ frames: Stream.fromQueue(queue) })), Context.add(ManualFrames, { emit }));
  }),
);

export class ManualFrames extends Context.Service<ManualFrames, { readonly emit: (dt: number) => void }>()("@flt/ManualFrames") {}
