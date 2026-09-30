import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { registry, sim } from "../app/game";
import { createWatch } from "../render/fx/watch";
import { fx } from "../render/fx/state";
import { worldX, worldZ } from "../render/coords";
import { SoundKit, synthCue } from "./SoundKit";
import { audioReadyAtom, bindSound, mixerAtom } from "./state";
import { soundCues, soundSnapshot } from "./world";
import { CUES, type Cue } from "./score";

export function SoundLayer() {
  const kit = useRef<SoundKit | null>(null);
  const watch = useRef(createWatch());
  const last = useRef({ sample: -10, ...soundSnapshot(sim.world) });
  const position = useRef(new Vector3());
  useEffect(() => {
    const sound = new SoundKit(registry.get(mixerAtom));
    kit.current = sound; bindSound(sound);
    sound.setHidden(document.hidden);
    const unlock = () => { void sound.unlock().then((ok) => registry.set(audioReadyAtom, ok)); };
    const visibility = () => { sound.setHidden(document.hidden); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", visibility);
    if (new URLSearchParams(location.search).has("debug")) {
      Object.assign(window, { __sound: {
        cue: (cue: Cue) => sound.cue(cue), diagnostics: () => sound.diagnostics, cues: CUES,
        // Browser evidence uses the same synthesis as real playback, rendered offline with WebAudio.
        testCue: async (cue: Cue, variation = 0) => {
          const ctx = new OfflineAudioContext(1, 48000 * 2, 48000);
          synthCue(ctx, ctx.destination, cue, variation);
          const buffer = await ctx.startRendering();
          const data = buffer.getChannelData(0);
          let energy = 0; let peak = 0;
          for (const x of data) { energy += x * x; peak = Math.max(peak, Math.abs(x)); }
          return { cue, variation, rms: Math.sqrt(energy / data.length), peak, duration: buffer.duration };
        },
      } });
    }
    return () => {
      window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", visibility);
      bindSound(null); kit.current = null; sound.dispose();
      registry.set(audioReadyAtom, false);
      if (new URLSearchParams(location.search).has("debug")) Reflect.deleteProperty(window, "__sound");
    };
  }, []);
  useFrame(({ camera, clock }) => {
    const sound = kit.current;
    if (!sound) return;
    const world = sim.world;
    for (const e of watch.current.poll(world)) {
      switch (e.type) {
        case "placed": sound.cue("place"); break;
        case "removed": sound.cue("bulldoze"); break;
        case "path": sound.cue(e.added ? "place" : "bulldoze"); break;
        case "earned": sound.cue("coin"); break;
        case "release": sound.cue("release"); break;
        case "incident": sound.cue("card"); break;
        case "incidentClosed": sound.cue("choice"); break;
        case "cue": if ((CUES as readonly string[]).includes(e.cue)) sound.cue(e.cue as Cue); break;
        case "reset": Object.assign(last.current, soundSnapshot(world)); break;
      }
    }
    if (clock.elapsedTime - last.current.sample < 0.2) return;
    last.current.sample = clock.elapsedTime;
    const now = soundSnapshot(world);
    for (const cue of soundCues(last.current, now)) sound.cue(cue);
    last.current.era = now.era;
    last.current.broken = now.broken;
    const era = now.era;
    let density = 0; let protesters = 0;
    for (const w of world.walkers) {
      if (w.kind === "protester") protesters++;
      if (w.machine.value === "inside") continue;
      position.current.set(worldX(w.x), 0.8, worldZ(w.z)).project(camera);
      const { x, y, z } = position.current;
      if (Math.abs(x) < 1 && Math.abs(y) < 1 && z >= -1 && z <= 1) density += Math.max(0, 1 - Math.hypot(x, y) * 0.5);
    }
    const training = world.training.context;
    const running = world.buildings.some((b) => b.kind === "hall") && world.training.value === "training";
    sound.update({ crowd: Math.min(1, density / 60), protesters, training: running ? training.progress / training.cost : null, night: fx.night, era });
  });
  return null;
}
