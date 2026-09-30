# FLT-28 sim evidence

Normal ticks with Release Leapfrog on; the bot builds revenue, compute, halls and amenities, hires operations staff, and answers every event card. Each run stops at actual day 365. No forced papers, scoop dice or awards. Applicant focus is recorded on arrival. Spill is cumulative capability delivered through rival SHOCK; final rival capability also reflects their ordinary releases.

| Seed | Policy | Days | Applicants | Mean applicant focus | Published | Scoops | Awards | Critiques | Knowledge spill | Final rival capability sum |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Off | 365 | 51 | 0.734 | 0 | 0 | 0 | 0 | 0.00 | 583.65 |
| 1 | Open | 365 | 59 | 0.772 | 5 | 0 | 0 | 0 | 30.00 | 611.68 |
| 1 | Selective | 365 | 56 | 0.751 | 3 | 1 | 1 | 0 | 17.40 | 602.26 |
| 1 | Closed | 365 | 53 | 0.762 | 0 | 0 | 0 | 0 | 0.00 | 623.40 |
| 2 | Off | 365 | 49 | 0.733 | 0 | 0 | 0 | 0 | 0.00 | 624.69 |
| 2 | Open | 365 | 49 | 0.795 | 5 | 0 | 0 | 1 | 30.00 | 585.41 |
| 2 | Selective | 365 | 51 | 0.749 | 3 | 1 | 1 | 0 | 16.20 | 616.27 |
| 2 | Closed | 365 | 47 | 0.759 | 0 | 0 | 0 | 0 | 0.00 | 627.37 |
| 3 | Off | 365 | 43 | 0.734 | 0 | 0 | 0 | 0 | 0.00 | 575.22 |
| 3 | Open | 365 | 50 | 0.782 | 5 | 0 | 0 | 0 | 30.00 | 598.21 |
| 3 | Selective | 365 | 48 | 0.735 | 3 | 0 | 0 | 0 | 20.40 | 622.23 |
| 3 | Closed | 365 | 49 | 0.781 | 0 | 0 | 0 | 0 | 0.00 | 605.98 |

Seed 1 Selective replay: complete JSON World equal.

30-paper daily driver: 949.8 µs/day; view: 7.2 µs/snapshot. Measured on 1-vCPU Modal; daily budget 6 ms (doubled under CI). No per-tick publication work.

Closed retains drafts and accumulates publication pressure for FLT-26. Explicit publish commands can override defaults. Best-paper awards exist in the snapshot; the campus trophy and papers panel belong to the following UI task.
