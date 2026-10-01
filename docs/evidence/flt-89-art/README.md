# FLT-89 evidence: the shelf's art and props

## Fal ledger (`fal-ledger.jsonl`, one line per call)

| # | endpoint | what | cost (USD) |
|---|---|---|---|
| 1–12 | Sunburst text-to-image (high quality) | the twelve shelf covers, one each | 0.8077 |
| 13 | Sunburst text-to-image | `shelf-alignment` re-roll (came back as a box mockup with a perspective edge) | 0.0664 |
| 14 | Sunburst text-to-image | `shelf-pitchdeck` re-roll (same: a mockup edge) | 0.0686 |
| 15 | Tripo H3.1 text-to-3D | standee | 0.40 (est.) |
| 16 | Tripo H3.1 text-to-3D | bin (a wire bin; decimated into zigzags, rejected) | 0.40 (est.) |
| 17 | Tripo H3.1 text-to-3D | mug | 0.40 (est.) |
| 18 | Tripo H3.1 text-to-3D | floppies | 0.40 (est.) |
| 19 | Tripo H3.1 text-to-3D | bin, re-rolled as a solid cardboard dump bin | 0.40 (est.) |
| | | **total** | **2.9427** of the $10 budget |

Tripo bills in credits this key can't read, so each run is booked at FLT-13's upper bound ($0.40).

## The props (`props.json`)

Each is one mesh with vertex colours, so it costs one draw call. Every model goes through Blender (weld, recalculate normals, decimate, bake colour to a palette, fit to size), then quantize and meshopt.

| prop | triangles | file size |
|---|---|---|
| standee | 2576 | 70 kB |
| bin | 2208 | 60 kB |
| mug | 2208 | 59 kB |
| floppies | 1840 | 52 kB |

## FPS and draw calls, shelf view, main against this branch

- **Setup:** `/box?seed=70&beat=shelf`, 1440×900, headless Chromium on SwiftShader (a CPU rasterizer), 1 vCPU. Main is 563887e.
- **Method:** each sample is `window.__intro.fps()` after 8 s. Main and branch runs were interleaved.

| | fx | runs | draw calls | triangles | fps (mean) | fps (median) |
|---|---|---|---|---|---|---|
| main | on | 3 | 158 | 907 | 1.74 | 1.89 |
| branch | on | 3 | 162 (+2.5%) | 5657 | 2.32 | 1.85 (−2%) |
| main | off | 6 | 136 | 880 | 10.86 | 11.19 |
| branch | off | 6 | 140 (+2.9%) | 5630 | 9.87 (−9%) | 9.72 (−13%) |

The run-to-run spread is as wide as the gap: main alone ranged from 9.6 to 11.8 fps with fx off. On a CPU rasterizer the extra triangles (the bin and the standee) are what cost frames; on a GPU, 5k triangles are free.

The desk (`beat=open`, fx on) went from 103 to 106 draw calls and from 963 to 7587 triangles; one sample each read 1.6 and 2.7 fps.
