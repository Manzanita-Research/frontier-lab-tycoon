# FLT-73: CRT shader (crt-shader, MIT): canvas CRT + matching CSS tube layer over the DOM; Display toggle; reduced motion; perf

**CRT shader** (Jem: "this will make it look really, really cool"). The source is https://crt-shader.vercel.app/ (repo `OutThisLife/crt-shader`, **MIT**, so we can use it with credit in `docs/CREDITS.md` and the manual's credits page). It's queued with the skin quality pass (FLT-72) and done by an Opus UI builder.

**Stack check:**
- We run three **0.180**, R3F 9, `@react-three/postprocessing` 3.1.3 and `postprocessing` 6.39.5.
- three renders **WebGL 2** already, so **no WebGPU switch is needed**.
- Port the shader as a postprocessing `Effect`, or use its R3F/pmndrs entry if it matches our versions. It's multi-pass, so budget it.

**Design decision: CRT on the world, plus a matching CSS tube over the DOM** (my recommendation). The shader only touches the canvas, and Frontier 95's windows are DOM.
- **(a)** Canvas only: the 3D campus is a CRT but the windows look flat on top. It reads as a mismatch.
- **(b) ✅ Canvas CRT plus a CSS tube layer:**
  - The **world** gets the real shader: scanlines, mask, bloom, slight curvature.
  - The **DOM** gets a single overlay layer: `pointer-events: none`, low-opacity scanlines (repeating gradient), vignette and corner curvature matched to the shader's parameters, and a faint phosphor glow on text via `text-shadow`.
  - **No blur and no distortion on DOM text**, so it stays crisp, selectable and accessible.
  - The whole screen reads as one tube.
- **(c)** UI rendered into the canvas: rejected. It's heavy, kills accessibility and text crispness, and breaks the skin system.

**Requirements:**
- **Display settings toggle:** CRT off / subtle / full. The default is **subtle on Frontier 95**, pending Jem's taste call on screenshots.
- **Reduced motion:** no flicker and no roll, a static tube only.
- **Performance:** 60 fps on a mid laptop at 1440×900 (the CRT pass ≤ 2 ms GPU). On phones, auto-reduce to a single-pass variant, or off below a frame-time threshold.
- **Readability:** text contrast checked against the overlay, WCAG AA for body copy.
- **FLT-70 (big box):** the beige PC's monitor uses the full shader on the game rendered to a texture before the camera dollies in.

**Evidence:**
- Before/after screenshots of the same scene (Frontier 95 overview, busy midgame, phone) at off / subtle / full.
- The frame-time table.
- The credits entry.

