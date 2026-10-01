import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { appNow, registry, sim } from "../app/game";
import { pauseReasonOf } from "../app/machine";
import { createWatch } from "../render/fx/watch";
import { fx } from "../render/fx/state";
import { worldX, worldZ } from "../render/coords";
import { modSession } from "../app/mods";
import { skinUiAtom } from "../ui/hud/state";
import { Band, renderMusic } from "./Band";
import { MODES, flavourFor } from "./music";
import { SoundKit, musicFor, synthNotes } from "./SoundKit";
import { audioReadyAtom, bindSound, mixerAtom } from "./state";
import { soundCues, soundSnapshot } from "./world";
import { CUES, HOOKS } from "./score";

/** Seconds between `protest.grow` cues: a crowd that swells by twenty is a few barks, not twenty. */
const GROW_GAP = 2.5;

export function SoundLayer() {
  const kit = useRef<SoundKit | null>(null);
  const watch = useRef(createWatch());
  const last = useRef({ sample: -10, protesters: -1, grew: -10, ...soundSnapshot(sim.world) });
  const position = useRef(new Vector3());
  useEffect(() => {
    const sound = new SoundKit(registry.get(mixerAtom));
    kit.current = sound; bindSound(sound);
    sound.setCues(modSession().cues);
    sound.setHidden(document.hidden);
    // `ui.click` (FLT-55): silent in the base game, a mod can give HUD buttons a sound.
    const click = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest("button")) sound.cue("ui.click"); };
    document.addEventListener("click", click, true);
    const unlock = () => { void sound.unlock().then((ok) => registry.set(audioReadyAtom, ok)); };
    const visibility = () => { sound.setHidden(document.hidden); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", visibility);
    if (new URLSearchParams(location.search).has("debug")) {
      Object.assign(window, { __sound: {
        cue: (cue: string) => sound.cue(cue), diagnostics: () => sound.diagnostics, cues: [...CUES, ...HOOKS, ...Object.keys(modSession().cues)],
        // Browser evidence uses the same synthesis as real playback, rendered offline with WebAudio.
        testCue: async (cue: string, variation = 0) => {
          const ctx = new OfflineAudioContext(1, 48000 * 2, 48000);
          synthNotes(ctx, ctx.destination, sound.notes(cue, variation) ?? []);
          const buffer = await ctx.startRendering();
          const data = buffer.getChannelData(0);
          let energy = 0; let peak = 0;
          for (const x of data) { energy += x * x; peak = Math.max(peak, Math.abs(x)); }
          return { cue, variation, rms: Math.sqrt(energy / data.length), peak, duration: buffer.duration };
        },
        // FLT-66: the band's own main-thread cost, away from the scene: a pump per 60 Hz frame for `seconds` of each mode.
        benchMusic: (seconds = 30, skin = "base") => Object.fromEntries(MODES.map((mode) => {
          const ctx = new OfflineAudioContext(1, 48000, 48000);
          const band = new Band(ctx, ctx.destination, { mode, flavour: flavourFor(skin), era: "1" });
          const ms: number[] = [];
          for (let t = 0; t < seconds; t += 1 / 60) { const t0 = performance.now(); band.pump(t, 0.3); ms.push(performance.now() - t0); }
          ms.sort((a, b) => a - b);
          const at = (q: number) => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))]!;
          return [mode, { meanMs: ms.reduce((a, b) => a + b, 0) / ms.length, p50: at(0.5), p99: at(0.99), maxMs: ms.at(-1)!, voicesPerSecond: band.costReport()[mode]!.voicesPerSecond }];
        })),
        // FLT-66: the band rendered offline (`[{ at: 0, mode: "zoomies" }]`, seconds, skin), as base64 float32 samples for a WAV.
        modes: MODES,
        renderMusic: async (takes: { at: number; mode: (typeof MODES)[number] }[], seconds: number, skin = "base", era = "1") => {
          const buffer = await renderMusic(takes, seconds, { flavour: flavourFor(skin), era });
          const bytes = new Uint8Array(buffer.getChannelData(0).buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return { sampleRate: buffer.sampleRate, float32: btoa(binary) };
        },
      } });
    }
    return () => {
      window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("click", click, true);
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
        case "beat": sound.cue(e.beat === "huddle" ? "drumroll" : e.beat === "viral" ? "shutter" : "conga"); break;
        case "cue": sound.cue(e.cue); break;
        case "reset": Object.assign(last.current, soundSnapshot(world)); break;
      }
    }
    sound.play();
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
    // `protest.grow` (FLT-55): the crowd at the gate got bigger. Silent in the base game.
    if (last.current.protesters >= 0 && protesters > last.current.protesters && clock.elapsedTime - last.current.grew >= GROW_GAP) {
      last.current.grew = clock.elapsedTime;
      sound.cue("protest.grow");
    }
    last.current.protesters = protesters;
    // FLT-66: the band naps when the player pauses or a card is on the table. A menu or the first-build wait holds the
    // clock too, but that is plumbing, not a mood: the music the player was hearing plays on.
    const app = appNow();
    const reason = app && pauseReasonOf(app);
    const music = musicFor(app?.speed ?? 1, reason === "player" || reason === "card", registry.get(skinUiAtom).active);
    sound.update({ crowd: Math.min(1, density / 60), protesters, training: running ? training.progress / training.cost : null, night: fx.night, era, ...music });
  });
  return null;
}
