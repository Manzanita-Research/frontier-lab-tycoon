# FLT-86: money and the win, before vs after (20 seeds)

`node scripts/money-report.mjs` on main and on this branch. The careful player is the playthrough bot (`src/sim/bot.ts`); the careless player is PLAY IT's run 2 (a new lab that builds two Halls and three Clusters on day 1, never a Gateway, and answers every card with its first choice).

## Careful player: the win

| | Before | After |
|---|---:|---:|
| Won | 18/20 | 19/20 |
| Win day: min / median / max | 462 / 476 / 1029 | 491 / 498 / 512 |
| Lowest cash: min / median | −$2.19M / $79K | −$7.78M / $80K |

Win day per seed:

| Seed | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Before | 469 | 483 | 462 | lost | 469 | lost | 476 | 469 | 476 | 476 | 470 | 476 | 469 | 462 | 469 | 476 | 1029 | 469 | 490 | 490 |
| After | 492 | 498 | 491 | 512 | 505 | 505 | 505 | 498 | 505 | 498 | 498 | 498 | 491 | 512 | 498 | 498 | 505 | 498 | lost | 505 |

### Careful player: median cash by day

| Day | Before | After |
|---:|---:|---:|
| 30 | $419K (n=20) | $419K (n=20) |
| 60 | $9.84M (n=20) | $9.95M (n=20) |
| 90 | $23.00M (n=20) | $23.23M (n=20) |
| 120 | $16.35M (n=20) | $16.35M (n=20) |
| 180 | $50.63M (n=20) | $44.02M (n=20) |
| 240 | $39.70M (n=20) | $45.81M (n=20) |
| 300 | $26.66M (n=20) | $36.11M (n=20) |
| 360 | $94.59M (n=20) | $35.19M (n=20) |
| 480 | $69.61M (n=4) | $94.54M (n=19) |
| 600 | $244.53M (n=1) | – (n=0) |
| 720 | $184.85M (n=1) | – (n=0) |

## Careless player: going broke

| | Before | After |
|---|---:|---:|
| Outcome after up to 720 days | playing 20 | ended 20 |
| Day it ended: min / median / max | never | 146 / 146 / 146 |
| Emergency rounds taken: min / median / max | 19 / 19 / 19 | 3 / 3 / 3 |

### Careless player: median cash by day

| Day | Before | After |
|---:|---:|---:|
| 30 | $1.83M (n=20) | $1.83M (n=20) |
| 60 | $245K (n=20) | $245K (n=20) |
| 90 | $655K (n=20) | $155K (n=20) |
| 120 | $1.06M (n=20) | −$435K (n=20) |
| 180 | $1.89M (n=20) | – (n=0) |
| 240 | $705K (n=20) | – (n=0) |
| 300 | $1.52M (n=20) | – (n=0) |
| 360 | $345K (n=20) | – (n=0) |
| 480 | $1.99M (n=20) | – (n=0) |
| 600 | $1.63M (n=20) | – (n=0) |
| 720 | $1.26M (n=20) | – (n=0) |

## What it says

- **The win is paced, not delayed by much.** The careful player wins about three weeks later (median day 476 → 498) because the Arena objective is now "hold Top 3 for 30 days". The spread narrows (462–1029 → 491–512): the hold is almost always the last objective, so "2 of 3, final stretch" is a real stretch of play instead of a same-day pile-up.
- **Going broke is a story with an end.** Before, the board wired $2M every few weeks forever: the careless lab took 19 bailouts in two years and was still "playing" with no revenue at all. Now it takes its three rounds (10%, 15%, 20% of revenue, the first choice on each card), then the bank's 30 days, and is Acqui-hired on day 146, every seed.
- **The careful player feels it too, sometimes.** Seeds 4 and 6 used to sink past −$2M and lose; the rounds are now a lifeline, so both win. Seed 19 runs out of money, signs all three rounds and goes under on day 368 (the bank needs all three signed, then 30 days below $0): the pressure is real, and the bot doesn't bulldoze or fire anyone to get back above $0, which a person would.
- The first four months match to within a few percent; after that each seed's run diverges (new toasts shift ids, rounds change spending), so compare the medians, not single seeds.
