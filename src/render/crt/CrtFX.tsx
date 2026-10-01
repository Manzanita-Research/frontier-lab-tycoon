// The CRT on the canvas (FLT-73). Lazy-loaded, like PhotoFX: the rest of the game never pays for postprocessing.
// Multi tier: the ported crt-shader pipeline as one composer pass. Lite tier: the one-pass LiteCrtEffect. Both
// tone-map the scene themselves and lay it over the sky (the canvas stays see-through, so the sky is not tone-mapped).
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo } from "react";
import { useSkyBackdrop } from "../fx/useSkyBackdrop";
import { GpuTimer } from "./gpuTimer";
import { LiteCrtEffect } from "./lite";
import { CRT_LOOKS, screenOptions, type CrtTier } from "./looks";
import { CRTPass } from "./pass";
import { crtView } from "./state";

/** The canvas's pixel ratio range while the tube is on (1.75 without): the shader softens the picture anyway, and each output pixel costs ~35 texture reads. */
export const CRT_DPR: [number, number] = [1, 1.25];

interface Debug {
  tier: CrtTier;
  mode: string;
  gpuMs: number | null;
  gpuTimer: boolean;
  dpr: number;
  input?: { width: number; height: number };
  output?: { width: number; height: number };
}

export default function CrtFX({ mode, tier }: { mode: "subtle" | "full"; tier: Exclude<CrtTier, "flat"> }) {
  const look = CRT_LOOKS[mode];
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useThree((s) => s.viewport.dpr);

  const sky = useSkyBackdrop(false);

  useEffect(() => {
    setDpr(CRT_DPR);
    return () => setDpr([1, 1.75]);
  }, [setDpr]);

  useEffect(() => {
    crtView.curve = look.curve;
    return () => {
      crtView.curve = 0;
    };
  }, [look]);

  const pass = useMemo(() => {
    if (tier !== "multi") return null;
    const p = new CRTPass();
    p.pipeline.backdrop = sky;
    return p;
  }, [tier, sky]);
  const lite = useMemo(() => (tier === "lite" ? new LiteCrtEffect({ pitch: 2, scan: 0, mask: 0, curve: 0, vignette: 0, vignetteInner: 0.5 }, sky) : null), [tier, sky]);
  useEffect(() => () => pass?.dispose(), [pass]);
  useEffect(() => () => lite?.dispose(), [lite]);

  useEffect(() => {
    pass?.setOptions(screenOptions(look, size.width, size.height));
    lite?.set({ pitch: look.pitch * dpr, ...look.lite, curve: look.curve, vignette: look.vignette, vignetteInner: look.vignetteInner });
  }, [pass, lite, look, size.width, size.height, dpr]);

  // `window.__crt`: what the canvas is doing, and with `?debug=1` the pass's GPU time (the frame-time table's source).
  const timer = useMemo(() => (new URLSearchParams(window.location.search).has("debug") ? new GpuTimer(gl.getContext()) : null), [gl]);
  useEffect(() => {
    if (!pass || !timer) return;
    const render = pass.render.bind(pass);
    pass.render = (...args: Parameters<CRTPass["render"]>) => {
      timer.begin();
      render(...args);
      timer.end();
    };
    return () => {
      pass.render = render;
    };
  }, [pass, timer]);
  useEffect(() => () => timer?.dispose(), [timer]);
  useFrame(() => {
    const w = window as unknown as { __crt?: Debug };
    const d = (w.__crt ??= { tier, mode, gpuMs: null, gpuTimer: false, dpr });
    d.tier = tier;
    d.mode = mode;
    d.dpr = gl.getPixelRatio();
    d.gpuTimer = !!timer?.supported;
    d.gpuMs = timer?.ms ?? null;
    if (pass) {
      d.input = pass.inputSize;
      d.output = pass.stats.outputSize;
    }
  });
  useEffect(
    () => () => {
      delete (window as unknown as { __crt?: Debug }).__crt;
    },
    [],
  );

  return (
    // No multisampling. The multi tier downsamples the scene to its scanline grid, which antialiases it; the lite tier is
    // the cheap one, and a 4x target cost it more than the shader did (SwiftShader: lite went from the slowest tier to
    // the fastest without it). Its edges stair-step a little, which on a CRT reads as pixel art.
    <EffectComposer multisampling={0}>
      <primitive object={(pass ?? lite)!} />
    </EffectComposer>
  );
}
