# The glass (FLT-88): the CRT over the UI, through HTML-in-canvas

FLT-73's tube bent only the 3D world; the 2D UI sat flat on top, so FLT-70 turned the in-game CRT off
(`GAME_CRT`). This spike puts it back where the browser can bend the UI too.

- `support.ts` probes once at load for [HTML-in-canvas](https://github.com/WICG/html-in-canvas). `GAME_CRT`
  (`src/render/crt/state.ts`) is `glassSupport !== null`. **No support means no CRT at all and the plain DOM UI.**
- `Glass.tsx` makes the sky (back) and the world labels + HUD (front) `drawable` children of one full-screen
  `<canvas layoutsubtree content="drawable">`. Each `paint` event it snapshots the children that changed, copies the
  R3F canvas, and `tube.ts` runs one WebGL 2 pass (sky < world < HUD, bow, bleed, scanlines, triad, vignette, bezel).
- The children stay real DOM: focus, keyboard, screen readers, and hit testing. The glass canvas takes no pointer,
  so a miss falls through to the world, aimed through the bow (`crtView.curve`). The bow is not affine, so a click
  lands where the *undistorted* control is: a few px off at the edges in `subtle`, up to ~20 px in `full`.

## See it in your own Chrome

1. Chrome 154 or newer (Stable 155 works; Canary 157 has the newest API). Open `chrome://flags`, enable
   **`#canvas-draw-element`** and **`#enable-experimental-web-platform-features`**, and relaunch.
2. Open the game: `?crt=subtle` (Frontier 95's default) or `?crt=full`. Add `&glassmeter` for fps, frame time and
   the glass's own cost. Add `&glass=off` to compare with the plain DOM on the same browser.
3. Without the flags (or in Safari/Firefox) the game looks exactly like `main`: no tube.

Knobs: `?glass=off`, `?glassmeter`, `?glasscut=hud,world,bleed` (cost hunting). Probe:
`node scripts/glass-probe.mjs --chrome <bin> --flag --url <url> --frames 60 --hits --curve 0.012`.
