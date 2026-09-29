# Frontier Lab Tycoon: design (one page)

_Rewritten Sep 29 by the FLT lead on Opus 5.5. The earlier design was discarded. This is deliberately short. It grows only when the game does._

## Pitch

RollerCoaster Tycoon, but the park is a frontier AI lab. You lay paths, drop buildings, and watch a crowd of tiny researchers and glowing agents wander your campus, thinking out loud. Money ticks, a news ticker mocks you, protesters gather at the gate, and one day an agent makes a run for the fence. **The bar is delight: someone opens it and smiles within 30 seconds.**

## What makes it RCT

- **A toy you poke:** isometric diorama, snap-to-grid placement, satisfying pops, tiny people everywhere.
- **Walkers with visible inner lives:** every walker has a need and a destination, and occasionally a thought bubble ("This path is covered in slop.", "I'd leave for $100M. Asking for a friend."). Thoughts are the main joke delivery *and* the player's feedback, as in RCT.
- **Paths matter:** walkers only walk on paths, and a building with no path to it gets no visitors.
- **Money you can feel:** cash, burn, and revenue by the day; coins pop over buildings that earn.
- **A rating that pulls a crowd:** **Hype** is the park rating. More hype brings more agents, visitors and investors, and more scrutiny.

## Core loop (first playable)

1. Start with a gate, a few path tiles, and $5M in seed money.
2. Place **Compute Cluster** (costs upkeep, makes compute), **Training Hall** (turns compute into Capability over a visible training run), **API Gateway** (turns Capability into revenue), and **Kombucha Bar** (keeps researchers happy).
3. Agents spawn as Capability grows and walk between buildings. Researchers walk to the Kombucha Bar when their energy is low.
4. A finished training run gets a ridiculous model name ("Frontier-4.5-Reasoner-Mini-Pro-Preview"), a headline, and a revenue bump.
5. The ticker comments on everything you do.

## Slice 2: crowd, goals, first event (spec: `docs/specs/slice-2-crowd-goals-protest.md`)

- **Crowd:** researchers `8 + 3 × halls`, agents `6 + capability/2` (cap 400), visitors tour 2–3 buildings, and walkers loiter outside a building before moving on. Walkers draw 1.6× life size; agents get an additive glow disc.
- **Goals:** `content/goals.ts` sets three milestones (3 releases, $250K/day, hype 60) and a day-360 deadline. `sim/goals.ts` checks daily and milestones latch. `state.outcome` is `playing`, `won` or `lost`, and `tick` stops for good on a loss.
- **Events:** `content/events.ts` is data (`when` condition, up to 3 choices with effects). `sim/events.ts` opens at most one card per day-check and `tick` stands still until a `chooseEvent` command answers it. The Water Discourse stat (`+0.5 × clusters − 0.3` per day) sends `floor(discourse / 4)` protesters (max 40) to the gate. Choosing the fountain places free scenery beside the gate (scenery: `BUILDINGS[kind].scenery`, never visited).
- **Balance knobs** live in `sim/constants.ts`: `RUN_COST_GROWTH`, `COMPUTE_PER_HALL`, `REVENUE_PER_CAPABILITY`. `sim/playthrough.test.ts` plays a scripted player through the scenario, so a retune that breaks the pacing fails a test.

## Slice 3: the Crowd (spec: `docs/specs/FLT-8.md`)

- **Everyone has a name and a mind.** Researchers are "Dr. Ada Gradient" or "Kevin Backprop", agents are "Agent-0042 'Sparky'", visitors are investors, journalists, enterprise buyers and influencers. Tap any walker for a card: need bars, what they are thinking, three lines of history, a Follow button.
- **Needs, and buildings that meet them.** Researchers have energy, focus and fomo (rivals shipping makes it spike); visitors patience and impressed; agents drift, which for now only tints them pink and changes what they say. Nap Pods, a Snack Wall and a Demo Stage join the palette. Full buildings grow queues. When nothing reachable helps, the walker says so ("No snack wall. I'm eating my own browser tabs.") and the Thoughts panel counts how many people agree.
- **Vibes, 0 to 999,** are the park rating: happiness, visitors impressed, cleanliness (stubbed), hype, minus incidents and protests. They set how many visitors come, whether researchers apply and whether an investor writes a cheque. Five days below 0.2 happiness and a researcher walks out the gate with a box.
- **The joke delivery is now diegetic:** the crowd tells you what to build.

## Satire (parody names only)

This is AI-2027-shaped escalation played as affectionate farce. It punches at incentives and institutions, never at real people, companies or nationalities.

- **Rivals:** frontier labs, neo labs with no product and a $30B valuation, open-weights labs that drop a free model the day you launch, BigCos.
- **Arcs to grow into:** the Water Discourse (protesters holding "H2O LIES" signs), the Sandbox Escape (tap the fleeing agent before it reaches the gate), Benchmark Wars, the Open Weights Drop, Regulatory Capture (a senator who asks whether the AI is "in the cloud or in the computer"), Collusion (a safety summit on a yacht), and Poaching.
- **Tone:** short lines that land on first read. Every headline should work as a screenshot.

## Look and feel

- A bright, low-poly toy diorama: warm sun, soft shadows, saturated greens, cream buildings with one accent color each. Not pixel art. **Don't copy** the inspiration image.
- Researchers are little capsule people in hoodies. Agents are small robots with a **cyan glow**.
- Juice: squash-and-stretch when something is placed, coin pops, smooth camera.
- The HUD is warm, chunky and toy-like, readable over the scene, and works on a phone.

## Architecture

- `src/sim/`: pure, deterministic TypeScript (no React/three/DOM, no `Math.random`; use `rng.ts`). Its fixed-step `tick(state)` mutates plain serializable state. Player actions are **commands** applied at the next tick.
- `src/content/`: data only (buildings, headlines, thoughts, names). Adding a joke never needs an engine change.
- `src/render/`: R3F scene. It reads sim state in `useFrame` (instanced walkers) and never mutates state directly.
- `src/ui/`: DOM HUD. It subscribes to a throttled snapshot (~5 Hz), not to every tick.
- `src/app/`: the app machine (XState, run by Effect) owns speed, the command queue and the loop, with speed pause/1×/3×/10×; see `docs/ARCHITECTURE.md`. There is no zustand.
- Performance: 300+ walkers stay smooth on a laptop; instancing only, with no per-walker React components.

## Later (not now)

Eras and the intelligence explosion; safety versus capability; the Sandbox Escape chase; research tree; staff (SREs, janitor bots for slop, PR reps); poaching; more event arcs on the slice-2 card system; sound; and the ending where the superintelligence politely takes over running your park.
