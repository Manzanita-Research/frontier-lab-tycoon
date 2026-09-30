# Endings (FLT-11)

How a lab ends: **The Memo** (an ordinary event card, offered once in Era 4) and five endings. Each ending is a short statechart in the disaster format (`docs/DISASTERS.md`: the same compiler, the same Vocabulary of guards and verbs) whose final state is a *Frontier Times* front page. The pack is direct-loaded by `src/sim/endings/pack.ts` (like `base-leapfrog`) until FLT-15 connects `content.endings` to the loader; its decoder and `validateEndings()` check it in the tests.

| Ending | Trigger (`trigger`, all must hold, checked daily in pack order) | What the campus does |
| --- | --- | --- |
| **Captured** | `capture ≥ 100`: FLT-22's Capture meter. With no meter (that PR not merged, an old save) it reads 0 and never fires | the gate becomes the Office of Frontier Oversight's field office |
| **Acqui-hired** | `broke ≥ 1`: bankruptcy (it replaces the old loss) | a *Macrohard* sign on the gate, then time stops |
| **The Takeover** | `memoRace ≥ 1` and (`ahead ≥ 1` or `racedDays ≥ 150`) | the autopilot: your next model builds for you, declines your buildings, pays for its own; the title is no longer yours |
| **Regulated Utility** | `memoSlow ≥ 1` | beige, a COMPLIANT sticker on every building, still open |
| **The Pivot** | `deadline ≥ 1` with the Memo unanswered: the old deadline loss | a NOW PIVOTING sign |

Escaped is not here yet: there is no Sandbox Escape to trigger it. Adding it is a new entry in `content.endings.add` with a trigger over a stat in `ENDING_STATS` (`src/sim/endings/driver.ts`), a chart and a `paper`.

## The pieces

- `content.endings.add[]`: `id`, `title`, `text` (the ticker line), `tone`, `keepPlaying` (The Takeover, Regulated Utility and Captured go on; Acqui-hired and The Pivot stop time), `trigger`, the chart (`initial` and `states`: `entry` verbs, `on.TICK` edges with guards such as `after`/`every`; the `final` state is the front page going to press) and the `paper` (`kicker`, `headline`, `deck`, `caption`, `subs`, `classified`, `signoff`). Copy may use `{lab}`, `{manager}`, `{model}`, `{models}`, `{placed}` and the news template variables.
- `content.events.add[]`: The Memo. Its two choices set `memo:race` or `memo:slow`; the Race/Slow flags are what the endings read.
- `rules.endings`: `memo.era` (4), `takeover.aheadRank` and `managerOffset` (who takes over: your last model's number plus one, so a lab that shipped Frontier-4 is managed by Frontier-5), and `autopilot` (how often it builds, how long the cursor aims, what it builds, what it says when you try).
- Verbs: the Vocabulary's (`news`, `toast`, `sound.cue`, ...) plus the endings' own: `look.set` sets a presentation cue the renderer and HUD read (`beige`, `stickers`, `acquired`, `managedBy`, `thanks`, `captured`, `officeMoved`, `pivot`), and `autopilot.start`/`autopilot.stop` hand the controls over and back.

## Saved state and determinism

`World.endings` (optional, absent until `enableEndings(world, daily)`; the app calls it unless `?endings=off`) keeps the run's peaks, the era days, the running chart's `{ value, context }`, the autopilot, the look and the front page. Charts step with the pure `transition()` once a tick; the autopilot's picks use the tick's RNG in a fixed order. No wall clock anywhere: Today's lab is a date key the app passes in (`src/sim/daily.ts`).

## Review

`?debug=1&speed=0&moment=<m>` stages each moment from the curated mid-game: `memo`, `takeover`, `thanks`, `front-takeover`, `front-regulated`, `front-acquihired`, `front-captured`, `front-pivot`. `pnpm shots --scenes endings` captures them all. `src/sim/endings/endings.test.ts` plays to each ending.
