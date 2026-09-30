# The Hearing (FLT-21)

The Senate calls the lab in. Three senators each ask one question. Every answer is earnest, slick or chaotic, and it moves two meters: public **Trust** (the Vocabulary's `trust`, shared with Disasters and Leapfrog) and **Regulatory Capture** (`capture`, new). A gavel ends each hearing with one of four verdicts.

The pack uses the FLT-15 section shape and is direct-loaded, like `base-leapfrog`. `content.arcs.add[0]` is the chart, compiled by `src/sim/circus/chart.ts`. `content.events.add` holds the question cards and the gavel card (`kind: "hearing"`). `content.headlines.add` holds one summons line per trigger. `rules.hearing` holds the senators, the triggers, the verdict copy and the meter labels. Adding a question is a JSON entry: name the senator and give the three answers `effects` like any other card.

## When the lab is called

It wakes at **Level 5 Scrutiny**: `updateProgression` calls `enableHearing` unless `flags.hearingOff` is set (`?hearing=off`). Once awake, every day while quiet, the first trigger that fired is the one that summons the lab:

| Trigger | Fires when | Topic |
|---|---|---|
| `debut` | 20 days after the pack woke | what {lab} even is |
| `era` | a new era's card was offered | the new era |
| `scandal` | an `auditors:*` flag is set (Agent Collusion exposed) | the scandal |
| `subpoena` | a `subpoena:*` flag is set (the yacht, if the lab denied or blamed) | the yacht |
| `disaster` | a disaster began (50% chance) | the incident |
| `heat` | regulatory heat reaches 60 | the heat |

A toast warns three days ahead. Then the questions arrive one after another. The cards hold time like any other card.

## Verdicts (checked in this order)

| Verdict | When | Effect |
|---|---|---|
| **Went viral** | two or more chaotic answers | hype +6, heat +8 |
| **Thanked for your service** | slick answers added Capture ≥ 14 this session | capture +5, heat −10 |
| **Commended** | earnest answers added Trust ≥ 9 this session | trust +4, heat −6 |
| **Grilled** | anything else | trust −3, heat +4 |

After the gavel, the pack stays quiet for 45 days. `s.hearing.history` keeps the last 12 hearings.

## Saved state and the UI

`s.hearing` is `{ enabled, rngState, machine: { value, context }, enabledDay, seen, history }`. The chart hears only `DAY` and `CHOSE`, stepped purely inside the tick with its own random stream. Picks come back as `hearing:pick:<style>` flags and are consumed straight away, even while paused. `hearingView(world)` is what the HUD reads; the `Hearing` skin slot draws it.

Review links: `?debug=1&moment=hearing` (question 2 of 3) and `?moment=hearing-verdict` (the gavel). `runCircusYear(seed, witness)` in `src/sim/circus/headless.ts` plays a year with a fixed answering policy.
