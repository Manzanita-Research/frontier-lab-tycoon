# FLT-70 art pass: before/after

Same visitor seed (`?seed=70`, so the same weights key), same beat, same viewport. Before = `main` @ 8fb8e58, after = `flt-70-art`. Captured headless (Chromium + SwiftShader) by `node scripts/box-shots.mjs docs/img/flt-70-art`; every image passes `pnpm shots --verify`.

| Scene | Before (main) | After (flt-70-art) |
|---|---|---|
| Shelf (1440×900) | <img src="before/shelf.png"> | <img src="after/shelf.png"> |
| Box open | <img src="before/open.png"> | <img src="after/open.png"> |
| Manual | <img src="before/manual.png"> | <img src="after/manual.png"> |
| COA tilted, angle A (`?tilt=0.35,-0.45`) | <img src="before/coa-tilt-a.png"> | <img src="after/coa-tilt-a.png"> |
| COA tilted, angle B (`?tilt=-0.3,0.45`) | <img src="before/coa-tilt-b.png"> | <img src="after/coa-tilt-b.png"> |
| BIOS / POST (through FLT-73's CRT) | <img src="before/bios.png"> | <img src="after/bios.png"> |
| Frontier 95 splash (sunrise mark) | <img src="before/splash.png"> | <img src="after/splash.png"> |
| Phone 390×844: shelf | <img src="before/phone-shelf.png" width="220"> | <img src="after/phone-shelf.png" width="220"> |
| Phone: box open | <img src="before/phone-open.png" width="220"> | <img src="after/phone-open.png" width="220"> |
| Phone: COA | <img src="before/phone-coa.png" width="220"> | <img src="after/phone-coa.png" width="220"> |

## Shelf frame rate

`node scripts/box-check.mjs --only fps` (SwiftShader, CPU-rendered, 1440×900, so absolute numbers are far below a real GPU; compare the two columns):

| Build | fx on | fx off | Draw calls (fx on) | Triangles |
|---|---|---|---|---|
| main | 4.0 fps | 20.6 fps | 153 | 897 |
| flt-70-art | 3.4 fps | 16.7 fps | 158 | 907 |

The difference is fill rate on the CPU rasteriser: the box front is now a clear-coated physical material and the shrinkwrap a crinkled additive mirror over the whole box. Draw calls and triangles barely move.
