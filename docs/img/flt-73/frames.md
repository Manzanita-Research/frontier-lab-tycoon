_SwiftShader (software), 10 s per row, busy mid-game campus running._

| Viewport | Tube | Tier | Frames | Mean ms | p50 | p95 | vs off | gpu ms (pass) | DPR | Shader input | Page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1440×900 | off | – | 47 | 215.1 | 200.0 | 416.7 |  |  |  |  | 0 |
| 1440×900 | subtle | multi | 33 | 305.1 | 316.6 | 566.7 | +90.0 ms | n/a | 1 | 720×450 | 0 |
| 1440×900 | subtle | lite | 54 | 189.3 | 183.4 | 366.7 | -25.8 ms | n/a | 1 |  | 0 |
| 1440×900 | full | multi | 35 | 286.0 | 316.7 | 533.3 | +70.9 ms | n/a | 1 | 720×450 | 0 |
| 1440×900 | full | lite | 53 | 189.5 | 200.0 | 416.7 | -25.6 ms | n/a | 1 |  | 0 |
| phone 390×844 @2x | off | – | 58 | 175.8 | 166.7 | 350.0 |  |  |  |  | 0 |
| phone 390×844 @2x | subtle | multi | 52 | 196.4 | 183.4 | 416.6 | +20.7 ms | n/a | 1.25 | 195×422 | 0 |
| phone 390×844 @2x | subtle | lite | 81 | 124.4 | 116.7 | 166.7 | -51.4 ms | n/a | 1.25 |  | 0 |
| phone 390×844 @2x | full | multi | 53 | 192.2 | 183.4 | 366.7 | +16.4 ms | n/a | 1.25 | 195×422 | 0 |
| phone 390×844 @2x | full | lite | 85 | 119.4 | 116.7 | 216.7 | -56.4 ms | n/a | 1.25 |  | 0 |
