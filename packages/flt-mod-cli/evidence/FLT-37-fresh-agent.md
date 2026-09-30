# FLT-37 evidence: the fresh-agent acceptance test, after M1b

The M1b "done when" says an agent with only the skill makes a mod that visibly changes a PR preview via `?mod=`.
This is that test, run twice against the live game (FLT-37's branch).

## Setup

- A clean scaffold outside the repo: `node packages/flt-mod-cli/create.mjs retriever-mod`, moved to `/tmp/fresh/retriever-mod`
  (the template's `SKILL.md`, `AGENTS.md`, starter `mod.json`, `pnpm test` = `flt-mod check mod.json`).
- A fresh headless process with no conversation: `claude -p --model claude-sonnet-5-5`, tools limited to
  Read, Edit, Write, Glob and `Bash(pnpm test)` / `Bash(ls …)`, working directory the scaffold. The prompt told it to read
  nothing outside the directory and to report gaps in the guide instead of going to look.
- The player's request, verbatim:

  > Make me a Frontier Lab Tycoon mod where the protesters are all golden retrievers. I want to actually see it when I
  > load the game, in the first few minutes of play.

## Run 1 (the skill as of aae6120)

8 turns, 40 s. Read SKILL.md and mod.json, wrote a mod, `pnpm test` failed once
(`id protester already exists; use override`: it had `add`ed the protester kind), fixed it, `pnpm test` passed.
Its feedback, all folded into the skill before run 2: no real-time length of a day; `add` vs `override` for renaming;
the "a mod can't change how a walker looks" limit should come first; whether discourse fades; whether a transition
with no guard is valid; when the `start` headline fires.

## Run 2 (the skill after those fixes)

6 turns, 32 s, **passed on the first `pnpm test`**. Commands: `ls -a` (listing), `pnpm test` (pass).
The mod is committed unedited as [`mods/examples/golden-retriever-protest/mod.json`](../../../mods/examples/golden-retriever-protest/mod.json):
six protester thoughts, three headlines, and an arc `gr-arrival` that at the first midnight toasts
"Protesters have gathered at the gate. They are all golden retrievers.", flies the camera to the gate, plays a cue,
adds 8 discourse, then every 5 days adds 4 more and toasts "Another good dog joins the picket line."

```text
PASS golden-retriever-protest@1.0.0: 365 days, 7300 ticks, 20 cards answered, 2 releases
Replay identical: 95ef6c41a9ee9ef65f9e872f2543e3a645f869856598eb182591196921755aeb; cash $6981600; 931 ms
Arc reachability: 1 arcs checked with xstate/graph (structural, guards/actions omitted)
  gr-arrival: 2 states, 2 configurations
Arcs ran in the sim: gr-arrival ended in "barking"
Executed: headlines, thoughts, arcs (the real sim ran with your definition)
```

In the game: `?mod=/mods/examples/golden-retriever-protest/mod.json` shows the toast and the camera flight about
6 seconds into a new game once the first-run tutorial is skipped or done (the tutorial's coach holds toasts; see the
`mod-retriever` shot in `docs/img/flt-37`, which skips it). With `&scenario=midgame` the retrievers'
thoughts and headlines show on the protesters and the ticker. The agent reported, correctly, that the protesters still
look like people (no mod can change a walker's look yet) and that in a new garage game the protesters themselves only
arrive at level 5.

Its feedback, folded into the skill after run 2:

- The starter mod.json's `walkerKinds` "Golden Retriever" sprite suggests dogs can be drawn. The skill now says which
  starter sections change nothing on screen yet.
- No way to know how long level 5 takes. The skill now says it takes a while and shows how a mod moves a system down
  the ladder (`progression` override); `src/sim/defs.test.ts` proves protesters then stand at the gate on day 1.
- `camera.focus` `zoom` had no scale. Now documented (times closer, default 1.3).
