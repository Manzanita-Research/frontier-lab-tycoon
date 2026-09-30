# FLT-49 paid opening report

Run with `node scripts/playable-report.mjs`. First build-panel action, three paid ghost paths, the paid suggested Hall, ordinary 1× ticks (0.3 s each), then the paid Gateway. No debug state injection.

| Seed | First 2-tile movement | First model day | Gateway step at 1× | Revenue after five more days | Visitors | JSON replay identical |
|---|---:|---:|---:|---:|---:|---|
| 1 | 5.1 s | 34 | 204.0 s | $26,000 | 3 | yes |
| 2 | 5.1 s | 34 | 204.0 s | $26,000 | 2 | yes |
| 3 | 5.1 s | 34 | 204.0 s | $26,000 | 2 | yes |
| 42 | 5.1 s | 34 | 204.0 s | $26,000 | 3 | yes |
| 2027 | 6.9 s | 34 | 204.0 s | $26,000 | 1 | yes |

This checks deterministic simulation time; the Playwright stranger test separately checks real wall time, rendering, clicking and console errors.

The inherited midgame scenario uses the full starter-campus preset with the ladder complete, paid purchases and staff, and a paid replacement of worn buildings before the opening. It opens on day 420 with 177 people, 20 connected, repaired buildings, training at 71.1%, cash $15,677,964 and a fresh rival record. The selected real headline/day changes with the new attendance/movement stream.
