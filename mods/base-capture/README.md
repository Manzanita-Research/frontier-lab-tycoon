# Regulatory Capture (FLT-22)

A Senate staffer emails the lab a blank bill with the subject line "quick favour". The lab picks two of five clauses in a word processor with track changes turned on. The Hearing's three senators vote on it. If it passes, the clauses bend the race for 180 days. Nobody ever checks the file properties, until somebody does.

The pack uses the FLT-15 section shape and is direct-loaded, like `base-hearing`. `content.arcs.add[0]` is the chart, compiled by `src/sim/circus/chart.ts`. `content.events.add` holds two cards: the draft (`kind: "bill"`) and the leak (`capture-exposed`). `content.headlines.add` holds the ticker jokes. `rules.capture` holds the clauses, `pick` (2), the act names, `floorDays`, the backfire odds and the Properties dialog's `author`. Adding a clause is a JSON entry: a `legal` line, a `plain` gloss (the margin comment), an `effect` line, a `shame` weight and the `effects` (any Vocabulary calls) that run while the law stands.

## The arc

| Stage | Gets there when | What happens |
|---|---|---|
| `quiet` | start | waits for the lab to have been to one hearing, Capture ≥ 15, and 10 days |
| `invited` | then | the staffer's toast and the draft card: tick up to two clauses, then **Send it to the floor** or **Shred it** |
| `declined` | shred | trust +2, Capture −5, quiet again after 60 days |
| `floor` | send | the bill is tabled as a motion on the Promise Tracker (FLT-23), so lobbying counts; `floorDays` later the senators vote (with the same dice if FLT-23 is off) |
| `law` | 2 or 3 ayes | the clauses' calls run as timed effects owned by `capture`; 40 pens, the lab gets one |
| `failed` | 0 or 1 aye | heat +4, quiet again after 60 days |
| `exposed` | a reporter's story running (`warning.days` after the leak roll hit; FLT-56), or another pack handing over the file | trust −10, heat +20, Capture −20, auditor odds ×2 for 120 days, a note on the auditors' `honesty` grade, and the law is struck (`effects.end`). The card offers three answers: blame an intern, call it a typo, or own it. |
| `sunset` | 180 days as law | the law quietly lapses, Capture +5 |

The leak odds each day are `base × max(1, shame) × (1 + heat/heatScale) × (1 + (50 − trust)/trustScale)`, so a greedy bill in a hot, distrustful year gets found. Another pack can hand the journalists the file by setting the `capture:leak` flag (an audit, a subpoena), which exposes the law at once.

**The warning (FLT-56).** A hit on the roll does not expose the law on the spot. A reporter starts asking: a camera beat at the gate (kind `leak`, with a Bury button), a toast, and the story runs `rules.capture.warning.days` (10) days later. Burying it (the beat's button, or the law's row in the Senate window) costs `cost` × `costGrowth` for each burial before, Capture −`capture` and Heat +`heat`, puts a headline from `buried` on the ticker, and adds `shame` to the odds for the rest of the law's life: buried stories grow back. The draft shows a leak-risk meter: the odds the file leaks before the sunset if the ticked clauses became law today, labelled by `meter`.

## The clauses

| Clause | Plain English | Race hook |
|---|---|---|
| Licence threshold | Labs behind you need a licence to catch up | `rival.growth` ×0.55 for `below` |
| Open weights permit | Open labs ship closed; Sirocco moves to a boat | `rival.closed` for `open, !sirocco`, `rival.pace` ×0.6 for `sirocco` |
| Mandatory kombucha standards | Every rival learns to ferment | `rival.pace` ×0.85 for everyone, hype +4 |
| 90-day safety review | Everyone's next model waits; yours is already out | `rival.pace` ×0.65 for `above` |
| Safe harbour for previews | Liability is a state of mind | your revenue +15%, trust −3 |

The three `rival.*` verbs are new in `src/sim/verbs.ts`. The race reads them in `src/sim/race/rules.ts` (`rivalRules(state, lab)`): `below`/`above`/`open` are resolved each day, so a rival that overtakes you slips out from under the licence. The bill may be empty. It passes anyway, and everyone claims victory.

## Saved state and the UI

`s.bill` is `{ enabled, rngState, machine: { value, context }, act, draft, floorDay, lawDay, ayes, seen, history }`. The chart hears only `DAY` and `CHOSE`. Picks come back as `capture:pick:<choice>` flags; the draft's ticks are the `draftClause` command. It wakes at Level 5 Scrutiny (`updateProgression`) unless `flags.captureOff` (`?capture=off`). `captureView(world)` is what the HUD reads, and the `Bill` skin slot draws it (Frontier 95: WordPerfectly 6.0 with margin comments and a Properties dialog).

Review links: `?moment=bill` (the draft), `?moment=bill-law` (then open the Senate tile), `?moment=bill-leak` (a reporter asking, the beat on screen), `?moment=bill-exposed`. `runSenateYear(seed, policy)` in `src/sim/capture/headless.ts` plays a year with both packs awake and a fixed policy (the clauses to tick, whether to lobby, which answer to the leak).
