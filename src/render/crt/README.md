# The picture tube (FLT-73)

The CRT look on the canvas, plus the parts the CSS tube over the DOM has to agree with. The shader stages are a port of [crt-shader](https://github.com/OutThisLife/crt-shader) (MIT, Brooklyn / OutThisLife: see `LICENSE`, `NOTICE.md` and `docs/CREDITS.md`).

| File | What |
|---|---|
| `shaders.ts`, `presets.ts` | The ported GLSL (prepare, horizontal, vertical, optics) and the upstream presets. FLT additions are marked `FLT:` (ACES, the sky backdrop, the tube). |
| `pipeline.ts` | `CRTPipeline`: one CRT, from any render target to the screen or to another target. Plain three, no React. |
| `pass.ts` | `CRTPass`: the pipeline as a postprocessing `Pass` (the multi tier). |
| `lite.ts` | `LiteCrtEffect`: one cheap full-resolution pass (scanlines, mask, bow, vignette). This is the lite tier. |
| `looks.ts` | The two looks (`CRT_LOOKS.subtle`, `.full`), `screenOptions` and `monitorOptions`, and `warp`/`unwarp` (the bow, for aiming clicks and pinning labels). |
| `governor.ts` | Frame-time governor: multi → lite → flat, undone if a step didn't help. |
| `state.ts` | `crtAtom` (what is on), `crtView.curve`, `onGlass()`. Kept light so the UI can import it without pulling in postprocessing. |
| `CrtFX.tsx`, `CrtLayer.tsx` | The scene side: `CrtLayer` (always mounted) feeds the governor and lazy-loads `CrtFX` (the composer) only while the tube is on. |
| `events.ts` | R3F `events` whose pointer goes through the bowed glass. |

The UI side is `src/ui/juice/crt.ts`, which works out the setting (the player's pick, else the skin's `crt` default, else off; `?crt=` pins it). `Tube.tsx` and `crt.css` draw the scanlines, vignette, corners and glow over the DOM.

## Reusing it on a texture (FLT-70's beige PC)

`CRTPipeline` renders from any `WebGLRenderTarget` to another one, so a monitor in the scene can show a picture through the same tube:

```tsx
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { HalfFloatType, WebGLRenderTarget } from "three";
import { CRTPipeline } from "../crt/pipeline";
import { CRT_LOOKS, monitorOptions } from "../crt/looks";

function MonitorScreen({ scene, camera }: { scene: THREE.Scene; camera: THREE.Camera }) {
  const [w, h] = [512, 384];
  // What the monitor shows (linear, before tone mapping), and the tube's picture of it.
  const screen = useMemo(() => new WebGLRenderTarget(w, h, { type: HalfFloatType }), []);
  const glass = useMemo(() => new WebGLRenderTarget(w, h), []);
  // The whole tube is in the picture: more bow than the screen look, and corners in texture pixels.
  const crt = useMemo(() => new CRTPipeline(monitorOptions(CRT_LOOKS.full, w, h, 24)), []);
  useEffect(() => () => (screen.dispose(), glass.dispose(), crt.dispose()), []);
  useFrame(({ gl }) => {
    gl.setRenderTarget(screen);
    gl.render(scene, camera);
    crt.render(gl, screen, glass, { linearInput: true, linearOutput: true });
    gl.setRenderTarget(null);
  }, -1);
  return (
    <mesh>
      <planeGeometry args={[1.6, 1.2]} />
      <meshBasicMaterial map={glass.texture} toneMapped={false} />
    </mesh>
  );
}
```

- `monitorOptions(look, width, height, cornerPx)` turns `toneMap` on, so feed it linear scene colour. Turn it off with `{ ...monitorOptions(...), toneMap: false }` if your input is already display-ready.
- `crt.backdrop = texture` lays the input over a backdrop by its alpha, the way the game lays the campus over the sky. Leave it `null` for an opaque picture.
- `inputResolution` sets how many scanlines the tube has (`monitorOptions` uses the look's pitch). A smaller number gives fewer, fatter lines.
- The pipeline is cheap at monitor sizes: 4 to 5 draws, and at most 15 texture reads per output pixel in any one stage.
