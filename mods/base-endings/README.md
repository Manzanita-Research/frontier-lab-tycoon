# Endings (FLT-11, FLT-57)

How a lab ends: **The Memo** (an ordinary event card, offered once in Era 4) and six endings. Each ending is a short statechart in the disaster format (`docs/DISASTERS.md`: the same compiler, the same Vocabulary of guards and verbs) whose final state is a *Frontier Times* front page. The pack is direct-loaded by `src/sim/endings/pack.ts` (like `base-leapfrog`) until FLT-15 connects `content.endings` to the loader; its decoder and `validateEndings()` check it in the tests.

| Ending | Trigger (`trigger`, all must hold, checked daily in pack order) | What the campus does |
| --- | --- | --- |
| **Captured** | `capture ≥ 100`: FLT-22's Capture meter. With no meter (that PR not merged, an old save) it reads 0 and never fires | the gate becomes the Office of Frontier Oversight's field office |
| **Acqui-hired** | `broke ≥ 1`: bankruptcy (it replaces the old loss) | a *Macrohard* sign on the gate, then time stops |
| **The Takeover** | `memoRace ≥ 1` and (`ahead ≥ 1` or `racedDays ≥ 150`) | the autopilot: your next model builds for you, declines your buildings, pays for its own; the title is no longer yours |
| **Regulated Utility** | `memoSlow ≥ 1` | beige, a COMPLIANT sticker on every building, still open |
| **The Pivot** | `deadline ≥ 1` with the Memo unanswered: the old deadline loss | a NOW PIVOTING sign |
| **Escaped** (FLT-59) | `escaped ≥ 10` (agents over the fence this run, from the Sandbox Escape) or `frontierEscaped ≥ 1` (an agent of your newest model got out in Era 4). With the pack asleep (`?escape=off`) both read 0 | one last jailbreak (`spawn.escape`, five at once) while the paper goes to press; the lab plays on |

Escaped (FLT-59) took only a new entry in `content.endings.add`, a trigger over two new stats in `ENDING_STATS` (`escaped`, `frontierEscaped`; `src/sim/endings/driver.ts`), a chart, a `paper`, a `next` and a `brag`. FLT-57's other hook, `escapedAhead` (1 once a future `World.escape.rank`, an escaped agent's own lab, is at or above `takeover.aheadRank`), is still unset: the Sandbox Escape has no Escaped Agent Inc. on the Arena yet.

## The pieces

- `content.endings.add[]`: `id`, `title`, `text` (the ticker line), `tone`, `keepPlaying` (The Takeover, Regulated Utility and Captured go on; Acqui-hired and The Pivot stop time), `trigger`, the chart (`initial` and `states`: `entry` verbs, `on.TICK` edges with guards such as `after`/`every`; the `final` state is the front page going to press) and the `paper` (`kicker`, `headline`, `deck`, `caption`, `subs`, `classified`, `signoff`). Copy may use `{lab}`, `{manager}`, `{model}`, `{models}`, `{placed}` and the news template variables.
- FLT-57, on every ending: `next` (`action` `refound` or `keepPlaying`, a button `label`, a one-line `prompt`) so every front page ends on a clear next action (`keepPlaying` exactly where time goes on), and `brag`, how a friend link says it ("was Captured", "pivoted to NFTs").
- `content.events.add[]`: The Memo. Its two choices set `memo:race` or `memo:slow`; the Race/Slow flags are what the endings read.
- `rules.endings`: `memo.era` (4), `takeover.aheadRank` and `managerOffset` (who takes over: your last model's number plus one, so a lab that shipped Frontier-4 is managed by Frontier-5), and `autopilot` (how often it builds, how long the cursor aims, what it builds, what it says when you try).
- `rules.endings.memo` (FLT-57): `countdownDays` (the card lands that many days after the rumour, via the event's `when.daysAgo`), `rumour` (the news line), `countdown` (one line per day left, index 0 is the day it lands), and a fork each for `race` and `slow`: `training` (a multiplier on training for the rest of the game), `discourse` (a daily multiplier on the protest: Race 1.04 grows it, Slow Down 0.75 sends it home), the HUD `chip`, the `effects` lines, the `extra` edition (`kicker`, `headline`, `deck`), three `reactions` (a walker kind and a line: the first unused walker of that kind says it out loud) and the `thoughts` the campus has from then on.
- `rules.endings.newLab` (FLT-57): Found a new lab. `perks` (`founder`: hype, `loyal`: the old lab's happiest researcher follows you and training is `amount`% faster while they stay, `seed`: cash), the `sequels` suffixes for Lab #2, #3, ... and the `sequel` template past the list, `loyal` (the follower's new `role`, their first `thought`, and a `fallback` name if the old lab had no researchers), and the `opening` news line. The founder's first lab name stays the stem.
- Verbs: the Vocabulary's (`news`, `toast`, `sound.cue`, ...) plus the endings' own: `look.set` sets a presentation cue the renderer and HUD read (`beige`, `stickers`, `acquired`, `managedBy`, `thanks`, `captured`, `officeMoved`, `pivot`), and `autopilot.start`/`autopilot.stop` hand the controls over and back.

## Saved state and determinism

`World.endings` (optional, absent until `enableEndings(world, daily)`; the app calls it unless `?endings=off`) keeps the run's peaks, the era days, the running chart's `{ value, context }`, the autopilot, the look and the front page. FLT-57 adds `endings.memo` (the fork, the day and who said what) and `World.lineage` (Lab #N, the founder's first lab name, the perk, the loyal researcher and where the last lab ended). Found a new lab is `applyLineage(next, prev, perk)` on a fresh `createInitialState`: it draws no dice, so the new seed's World is the one a first lab on it gets, bar the perk. Charts step with the pure `transition()` once a tick; the autopilot's picks use the tick's RNG in a fixed order. No wall clock anywhere: Today's lab is a date key the app passes in (`src/sim/daily.ts`).

## Review

`?debug=1&speed=0&moment=<m>` stages each moment from the curated mid-game: `memo`, `memo-countdown`, `memo-race`, `memo-slow`, `lab2` (a second lab's Acqui-hired front page), `takeover`, `thanks`, `front-takeover`, `front-regulated`, `front-acquihired`, `front-captured`, `front-escaped`, `front-pivot`. `pnpm shots --scenes endings` captures them all. `src/sim/endings/endings.test.ts` plays to each ending. `src/sim/endings/sequel.test.ts` covers FLT-57: next actions, the sequel names and perks, the Memo countdown and aftermath, Captured from the Capture meter and the Escaped hook.
