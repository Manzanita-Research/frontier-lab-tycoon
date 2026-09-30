# The Promise Tracker (FLT-23)

The Hearing's three senators take positions on AI motions. The Tracker writes down what each one **promised**, then how each one **voted**, and scores them on a Truth-o-meter. The lab can pay lobbyists to make sure of a vote, which is the only way to be sure of one, and it tends to cost the senator their Truth score.

The pack uses the FLT-15 section shape and is direct-loaded, like `base-hearing`. `content.arcs.add[0]` is the chart, compiled by `src/sim/circus/chart.ts`. `content.events.add` holds two cards: the whip notice (`promises-whip`, `kind: "vote"`) and the roll call (`promises-rollcall`). `content.headlines.add` holds the post-vote headlines, keyed by `trigger` (`flip`, `flipLobbied`, `both`, `kept`). `rules.promises` holds the rest: each senator's lobbying fee and toast, the capture and heat a visit costs, the eight motions, the bill's promises (for FLT-22), the Truth-o-meter labels and the tally lines. Adding a motion is a JSON entry: a `title`, a `summary`, the side the lab wants (`labSide`), each senator's promise (`says`: `aye`, `nay` or `both`, plus a `line` for the ticker), their `lean` (the odds of voting the lab's way), and the `pass`/`fail` calls.

## The arc

| Stage | Gets there when | What happens |
|---|---|---|
| `dormant` | start | wakes after the lab's first hearing (toast, `promises:open`, and the Senate tile appears in the build bar) |
| `recess` | then | 18 days, or at once if a bill has been tabled (FLT-22 jumps the queue) |
| `campaign` | then | the next motion is on the docket. Each senator's promise goes on the ticker and the whip card opens. Lobbying is open for 5 days. |
| `rollCall` | 5 days later | one die per senator: lobbied, or roll < odds, means the lab's side |
| `passed` / `failed` | the count (2 of 3) | the motion's `pass`/`fail` calls, a tally headline, a `senate:passed:<id>`/`senate:failed:<id>` flag, and one headline about the first broken promise. The roll-call card opens if the lab lobbied or it was the bill. |

The docket is shuffled from the pack's own random stream, and it never repeats one of the last three motions.

## The numbers

- **Odds:** `lean + captureLean × Capture`, clamped to 2–98%. Capture from The Hearing makes every senator friendlier, but only a lobbyist makes a vote certain.
- **Lobbying:** each visit costs the senator's fee (Blusterworth $60K, Quimby-Vance $90K, Brickman $25K), plus Capture +2 and heat +1. Each senator can be lobbied once per motion. The lobbied senators still roll their die, so the random stream doesn't move.
- **Kept:** a vote is kept if it matches the promise. `both` is always kept, which is the joke: the senator who promised both sides has a perfect record. Truth is `kept / (kept + broken)`, labelled from Gospel down to Pants Ablaze, and Unrated before a first vote. Each senator's log keeps the last 8 votes.

## Saved state and the UI

`s.promises` is `{ enabled, rngState, machine: { value, context }, tabled, next, recent, last }`, and the context holds the motion, who was lobbied, the votes and each senator's record. The chart hears only `DAY` and `CHOSE`. A visit is the `lobby` command, sent to the chart as `CHOSE "lobby:<senator>"`, with the fee, Capture and heat as verbs. It wakes at Level 5 Scrutiny (`updateProgression`) unless `flags.promisesOff` (`?promises=off`). `promisesView(world)` is what the HUD reads. The `PromiseTracker` skin slot draws it on the whip and roll-call cards, and whenever the player opens the Senate tile. Frontier 95 draws it as Excess 95 with PROMISES.XLS.

Review links: `?moment=vote` (the whip card, one senator lobbied) and `?moment=rollcall` (the votes are in, with a flipped one).
