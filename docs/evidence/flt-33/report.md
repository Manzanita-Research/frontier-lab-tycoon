# FLT-33/25 sim report

`FACTIONS_REPORT=1 pnpm vitest run src/sim/factions/factions.test.ts`. Seed 1, 365 days, the Release Leapfrog bot building and hiring, three stances (src/sim/factions/headless.ts). Meters are −100..100; the mood is the one on the last day.

| faction | open + fast (end / min..max) | closed + careful (end / min..max) | compromise (end / min..max) |
|---|---|---|---|
| accelerationists | 85 (0..100) fan | -37 (-79..0) upset | -5 (-25..35) calm |
| safetyists | -34 (-99..3) upset | 24 (-2..53) calm | -12 (-55..15) calm |
| doomers | -64 (-89..0) protesting | 41 (0..70) fan | 3 (-32..20) calm |
| ethicists | -38 (-66..7) calm | -26 (-65..5) calm | 4 (-18..43) calm |
| open-weights | 63 (0..78) fan | -58 (-75..0) protesting | 0 (-3..11) calm |
| vcs | 37 (-5..59) fan | 8 (-21..29) calm | -2 (-30..29) calm |
| wonks | -62 (-76..4) upset | -2 (-19..21) calm | -7 (-29..18) calm |
| luddites | -45 (-83..0) protesting | 3 (-15..30) calm | 5 (-29..45) calm |
| normies | -13 (-40..0) calm | -15 (-43..14) calm | -8 (-19..30) calm |
| truthers-truthers | 79 (0..100) fan | 15 (-15..100) calm | 53 (-37..100) fan |
| alliances | 6 | 2 | 1 |
| schisms | 1 | 0 | 0 |
| feuds | 22 | 7 | 4 |
| arguments | 202 | 203 | 202 |
| opEds | 19 | 15 | 9 |
| shouts | 79 | 79 | 50 |
| marches | 22 | 4 | 0 |
| hype | 16 | 1 | 1 |
| boycotts | 20 | 3 | 1 |
| max at the gate (water / faction crowd) | 39 / 21 | 40 / 22 | 27 / 16 |
| days with two crowds | 304 | 210 | 87 |

- **open + fast**: first alliance day 45 (doomers|safetyists); first schism day 46 (safetyists|doomers); water escalation quiet → simmering → filming → aired → counter → resolved.
- **closed + careful**: first alliance day 108 (doomers|safetyists); first schism none; water escalation quiet → simmering → filming → aired → counter → resolved.
- **compromise**: first alliance day 266 (accelerationists|vcs); first schism none; water escalation quiet → simmering → filming → aired → counter → resolved.

## The discourse log, open + fast (last dozen)

- d334 Doomers fold their signs and go home.
- d335 Doomers have calmed down.
- d338 Doomers are upset: Rushed launch. The timeline in their spreadsheet moved left.
- d338 VCs are fans now.
- d342 Safetyists fold their signs and go home.
- d344 Pictogram Luddites are upset: Another model. 'Nobody asked for this' (posted from a phone).
- d346 Doomers march on the gate.
- d349 Pictogram Luddites march on the gate.
- d351 Doomers and Water Truthers Truthers trade op-eds about Stochastic Parrots Anonymous.
- d356 Safetyists march on the gate.
- d362 Safetyists fold their signs and go home.
- d364 Ethicists are upset: A gas plant next to the kombucha tap. Bold.

## Cost

- `dailyFactions` (stance, ten moods, 45 relations, op-eds): **32 µs** a game day, once every 20 ticks.

