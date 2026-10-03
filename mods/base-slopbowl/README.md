# The Slop Bowl is late (FLT-109)

The researchers' favourite lunch place, **Fancy Healthy Healthy Healthy Healthy Slop Bowl**, is three hours late. Everyone
gets hangry, research goes backwards, the Aura drops, and then the bowls arrive. Jem's idea. Every line is in
`docs/specs/FLT-109-script.md`.

The pack is one card (`content.events.add`) plus `rules.slopbowl`: the place's name, the odds, the campus-clock timing,
how far research slides, the crowd, the courier, and every beat's toast, headlines, thoughts, posts and rival posts. It is
loaded directly by `src/sim/slopbowl/pack.ts`, like `base-yacht`.

## When it happens

- Wakes with the Bird App at **Level 3** (`PACKS` in `src/sim/progression.ts`, a second `birdapp` row with its own switch).
  `?slopbowl=off` keeps it asleep. A save from before it wakes it on load if the Bird App is already awake.
- The order is due at **noon on the campus clock** (once a cycle of 30 game days). At each noon the pack rolls `odds.perNoon`
  on its own random stream (`(seed ^ 0x534c4f50) >>> 0`), with enough researchers, not in its first days, and never two
  noons running. A lab whose lunch is never late plays exactly as it would without the pack.
- A Daily Drama pack (or a test) makes the next noon's order late with `flag.set` `slopbowl:late`.

## The afternoon

`src/sim/slopbowl/machine.ts`: quiet → late (noon) → hangry (+1 hour) → worse (+2) → arriving (+3) → fed (the courier has
handed the bowls over) → quiet (two hours later). One campus hour is 25 ticks. The driver (`driver.ts`) plays each beat
the machine emits, and only asks the machine on the ticks something can happen.

- **The crowd** (`crowd.ts`, read by `walkers.ts`): from noon a share of the researchers (`crowd.late`, `.hangry`,
  `.worse`) drop what they are doing and wait just inside the gate, pacing between spots and staring at the gate when
  they stop. Who goes and where they stand is arithmetic on their id and the tick: no dice.
- **Research** (`research.ts`, read by `training.ts`): while hungry, a day of training takes away `research.backwards` of
  what it would have added (never below zero); fed, the lab wins it back at `research.catchUp` of a day's gain a day.
  The training window has no ETA while it slides (Frontier 95: "estimating time remaining…").
- **Aura**: the Bird App's (FLT-69), nudged by each beat's `aura`. While the Bird App is asleep the Vibes take it (×10).
- **The card**: up an hour late, once the ladder has opened cards (Level 5). It is minor colour (FLT-54): with the budget
  spent, or at 10×, the chief of staff answers "Wait. It's worth it." and the ticker says so. Answers come back as
  `slopbowl:pick:*` flags.
- **The courier**: a visitor with the role `Slop Bowl Courier` (lettuce green, `render/look.ts`) walks in from the gate
  and talks with the researcher nearest it (`sim/meetings.ts`), then goes home.

## Saved state

`GameState.slopbowl` (`state.ts`): `enabled`, `rngState`, the machine, `wokeDay`, `lastDay`, `crowd`, `owed` (research to
win back), the courier and host, the bubbles it put up, and a tally. Additive.

## Review links

`?moment=slop-late` (two hours late), `?moment=slop-card` (the card), `?moment=slop-arrives&beat` (the bowls arrive). The
`pnpm shots` set is `flt-109`.
