// The intro's actor, the same way the game runs its app actor: Effect owns the runtime, the actor lives in an atom,
// React reads atoms and sends events. The intro needs no services, so its runtime is empty.
import { Layer } from "effect";
import type { EventFromLogic } from "xstate";
import { createActorAtoms } from "@xstate/effect/atom";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { introMachine, START_BEATS, type IntroInput, type StartBeat } from "./machine";
import { SHEETS } from "./manual";
import { visitorSeed, weightsKey } from "./key";

export type IntroEvent = EventFromLogic<typeof introMachine>;

export type IntroParams = {
  input: IntroInput;
  /** The visitor's Model Weights Key, printed on the COA and checked by the BIOS. */
  key: string;
  /** `?tilt=x,y`: a preset COA tilt, in radians, for screenshots. */
  tilt: [number, number] | null;
  /** `?fx=0` turns the postprocessing off (a slow machine, or a clean screenshot). */
  fx: boolean;
  /** `?fps=1` shows the frame counter. */
  fps: boolean;
};

export function readParams(loc: { search: string }, storage: Storage | null, reducedMotion: boolean): IntroParams {
  const q = new URLSearchParams(loc.search);
  const beat = q.get("beat");
  const start = START_BEATS.includes(beat as StartBeat) ? (beat as StartBeat) : undefined;
  const sheet = Number(q.get("sheet"));
  const tilt = q.get("tilt")?.split(",").map(Number);
  const still = q.get("motion") === "reduced" || (q.get("motion") !== "full" && reducedMotion);
  const seed = visitorSeed(loc.search, storage, () => Math.floor(Math.random() * 2 ** 31));
  return {
    input: { still, sheets: SHEETS, start, page: Number.isFinite(sheet) && sheet > 0 ? sheet : undefined },
    key: weightsKey(seed),
    tilt: tilt && tilt.length === 2 && tilt.every(Number.isFinite) ? [tilt[0]!, tilt[1]!] : null,
    fx: q.get("fx") !== "0",
    fps: q.get("fps") === "1",
  };
}

export function createIntro(params: IntroParams) {
  const runtime = Atom.runtime(Layer.empty);
  const atoms = createActorAtoms(runtime, introMachine, { input: params.input });
  const registry = AtomRegistry.make();
  const send = (event: IntroEvent) => registry.set(atoms.send, event);
  const now = () => {
    const r = registry.get(atoms.snapshot);
    return AsyncResult.isSuccess(r) ? r.value : null;
  };
  return { params, atoms, registry, send, now };
}

export type Intro = ReturnType<typeof createIntro>;
