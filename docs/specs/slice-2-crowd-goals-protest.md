# Spec: slice 2, crowd + goals + first event card (FLT-3 follow-up)

_Written by the FLT lead (Opus 5.5) for one Sonnet 5.5 builder. It builds on the first playable (PR #3, branch `flt-3-first-playable`). Read `docs/DESIGN.md` and skim `docs/specs/first-playable.md` first._

**Goal:** the campus feels **crowded and alive**, there's something to **aim for**, and the world **pushes back** with the first choice-driven event: protesters at the gate. After this slice, a 10-minute session has a shape (build, grow, get protested at, choose, win).

**Out of scope:** sound, more event arcs beyond this one, research tree, staff hiring, save/load, the Sandbox Escape chase.

## 1. Crowd (the RCT magic: fix first)

- **Density:** double the walker counts. Researchers: `8 + 3 × TrainingHalls`. Agents: `6 + floor(capability / 2)`, cap 400. Visitors: spawn rate ×2, and each visitor tours 2–3 buildings.
- **Readable at default zoom:** make walkers about 1.6× bigger, and set the default camera zoom so a building fills about 1/8 of the screen width at 1440×900. Agents keep the cyan emissive visor and add a faint cyan ground-glow disc (instanced, additive) so they read from far away.
- **Idling:** walkers not on a route loiter near their last building (small random steps on adjacent path tiles), so paths never look empty.
- **Performance:** instancing stays. 400 agents plus people in the sim must stay ≤ 0.3 ms per tick. Add that as a test assertion on a 500-walker state, measured over 200 ticks.

## 2. Goals (RCT scenario objectives)

- `src/content/goals.ts`: a scenario with 3 objectives and a deadline:
  1. "Release Frontier-4" (3 completed training runs)
  2. "Reach $250K/day revenue"
  3. "Hype 60+"
  All three must be met by **Y2 · Jan 1** (360 days).
- Sim: `state.goals` holds each goal's progress and met/unmet state, checked daily. When all three are met, `state.outcome = "won"`. At the deadline with anything unmet, `"lost"`. Cash below −$2M (after the existing bailout joke) also means `"lost"`.
- UI: a collapsible **Objectives** panel under the training chip, with checkboxes and progress text ("Revenue $140K / $250K per day"). On win or loss, show a modal card with a parody headline, the day and the stats, plus "Keep playing" (win only) and "New lab" buttons. "New lab" restarts with a fresh seed.
- Win headline: "{lab} hits every milestone; board celebrates by raising the milestones". Loss headline: "{lab} pivots to selling AI-generated NFTs of its own GPUs".

## 3. First event card: The Water Discourse

A choice-driven event system that's small, data-driven and reusable, plus one arc.

- `src/content/events.ts`: `EventDef {id, title, body, when: Condition, choices: {label, hint, effects: Effect[]}[] (1–3), tone}`. Keep `Effect` small: `cash`, `hype`, `protesters` (set or add), `flag` (set a string flag), `news` (push a headline), `thought` (burst of a thought on N random walkers).
- `src/sim/events.ts`: check once per day. At most one open event at a time, and the game **auto-pauses** while a card is open. A per-event cooldown lets the same event repeat no sooner than every 60 days. The choice arrives as a new `Command`: `chooseEvent(eventId, choiceIndex)`.
- **Trigger:** `waterDiscourse` is a new stat, rising daily by `0.5 × clusters` and decaying by 0.3/day. At 30 or more, fire the event **"Viral post: every prompt drinks a bottle of water"**. Choices:
  1. **"Publish a 90-page water report"**: −$150K, discourse −20. Headline: "{lab} publishes rigorous water report; nobody reads past the abstract."
  2. **"Build a Transparency Fountain"**: −$300K, discourse −35, hype +5, and it places a free 1×1 **Fountain** scenery piece next to the gate (a new building kind; researchers' energy +0.1 when they pass it).
  3. **"Say nothing, ship faster"**: $0, hype +3, discourse +10, and it sets flag `ignoredWater`. The follow-up event "Protesters now have a drum circle" can fire 20 days later if discourse is ≥ 40.
- **Protesters:** a 4th walker kind, `protester`, with a count of `floor(waterDiscourse / 4)`, capped at 40. They gather on and beside the gate path and don't enter buildings. They carry little signs, placard meshes that show short texts from `content/protest.ts` ("H2O LIES", "STOP THE LEAKS", "WATER TRUTH NOW", "MY GPU DRANK MY LATTE"). **Crowding:** while ≥ 10 protesters are present, visitor spawns are halved, and visitors get the thought condition `protest` ("Had to crowd-surf past a drum circle to see the demo.").
- **UI:** an **EventCard** modal: warm cream card, tone-coloured header stripe, title, body, and 1–3 big choice buttons each with a one-line hint of its effects ("−$300K · discourse −35 · hype +5"). It has a bouncy entrance, and keys 1–3 choose. It must work at 390×844.
- Add ≥ 10 protest-flavoured headlines and ≥ 8 thoughts, across researchers, agents and visitors, e.g. agent: "I calculated my water usage. I'd rather not say."

## 4. Polish bugs from the first-playable review

- **Font:** the UI falls back to monospace on Linux. Use the stack `ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif`, and self-host **Nunito** via `@fontsource/nunito` (it's small; the dependency is justified).
- The "Build an API Gateway…" hint must disappear once a gateway exists.
- Starting capability should be 10, as in the first spec (retune revenue if it gets too easy).
- The starting layout must not hide the Kombucha Bar behind a gateway at the default camera angle.

## Done when

1. `pnpm check` passes. New tests: goal progress and win/lose; the event triggering, cooldown, each choice's effects, and auto-pause; protester count following discourse; the perf assertion; and determinism still holding with events.
2. Playing at 3× from a fresh start, the Water Discourse card fires within about 3–5 minutes. Protesters visibly mass at the gate and thin out after the fountain. All 3 objectives are reachable by about day 250 with reasonable play.
3. **Evidence:** a PR from `flt-3-slice-2` into `main`, with 4 screenshots at 1440×900 (crowded campus, event card, protesters at the gate, win card) and one at 390×844 showing the event card. Include the test output. Then run `pnpm build && pnpm preview` plus `bb connect expose 4173`, and post the link and screenshots on **FLT-3**. **Don't merge.**
