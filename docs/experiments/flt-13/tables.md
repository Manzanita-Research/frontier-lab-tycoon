| Model | Fal cost (est.) | Gen time | Raw tris | Raw size | Clean tris | Blender GLB | Final (meshopt) | Load / parse (ms) | Calls, tris in scene (x1) | Frame ms x1 / x12 | Style (1-5) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **hall procedural** | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 21, 2142 | 16.7 / 36.0 | 4 |
| hunyuan B | $0.30 | 75 s | 50k | 15.1 MB | 4600 | 471 kB | 114 kB | 102 / 5 | 8, 5326 | 16.7 / 50.9 | 3 |
| tripo B | $0.40 | 205 s | 1393k | 39.8 MB | 4600 | 471 kB | 116 kB | 102 / 5 | 8, 5326 | 16.7 / 56.2 | 4 |
| hunyuan A | $0.30 | 80 s | 50k | 14.2 MB | 4600 | 471 kB | 116 kB | 102 / 5 | 8, 5326 | 16.7 / 52.2 | 3 |
| tripo A | $0.40 | 232 s | 1443k | 41.2 MB | 4599 | 471 kB | 117 kB | 103 / 5 | 8, 5325 | 16.7 / 52.0 | 4 |
| **cluster procedural** | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 58, 854 | 16.7 / 29.3 | 4 |
| hunyuan B | $0.30 | 81 s | 50k | 16.3 MB | 2760 | 284 kB | 68 kB | 69 / 4 | 3, 2762 | 16.7 / 29.9 | 2 |
| hunyuan A | $0.30 | 73 s | 50k | 15.3 MB | 2760 | 284 kB | 68 kB | 68 / 4 | 3, 2762 | 16.7 / 32.0 | 3 |
| tripo B | $0.40 | 234 s | 1422k | 41.7 MB | 2760 | 284 kB | 70 kB | 71 / 5 | 3, 2762 | 16.7 / 32.5 | 5 |
| tripo A | $0.40 | 226 s | 1467k | 42.5 MB | 2760 | 283 kB | 72 kB | 69 / 4 | 3, 2762 | 16.7 / 32.5 | 4 |
| **float procedural** | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 19, 1566 | 16.7 / 25.9 | 3 |
| hunyuan B | $0.30 | 87 s | 50k | 14.5 MB | 4600 | 470 kB | 112 kB | 69 / 5 | 2, 4602 | 16.7 / 40.0 | 3 |
| hunyuan A | $0.30 | 62 s | 50k | 14.8 MB | 4600 | 470 kB | 111 kB | 67 / 5 | 2, 4602 | 16.7 / 39.6 | 4 |
| tripo B | $0.40 | 169 s | 1489k | 42.8 MB | 4600 | 470 kB | 114 kB | 65 / 5 | 2, 4602 | 16.7 / 40.0 | 4 |
| tripo A | $0.40 | 171 s | 1423k | 40.9 MB | 4599 | 470 kB | 114 kB | 64 / 4 | 2, 4601 | 16.7 / 39.6 | 4 |
| trellis B | $0.25 | 117 s | 487k | 16.5 MB | 4814 | 488 kB | 103 kB | 65 / 4 | 2, 4816 | 16.7 / 40.4 | 1 |

Failed or rejected calls:
- 2026-09-29T23:51:05.940Z fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d cluster B/hunyuan: FAILED Gateway Timeout ($0.30 counted)

Total spend, upper-bound estimate: **$4.99** over 20 calls.
