# Frontier Lab Tycoon: design

> Build the future. Ask forgiveness later.

## Pitch

RollerCoaster Tycoon, except the park is a frontier AI lab. The guests are researchers, your own AI agents, customers, investors, journalists, regulators, politicians and protesters. You build a campus on a little isometric diorama, train ever-bigger models, keep the money flowing, and race to "AGI" before your runway, your rivals, the government or your own agents end you.

Every 30 seconds something absurd and uncomfortably plausible happens. The satire is affectionate and aimed at incentives and institutions (the race, the hype cycle, the discourse, regulatory theater), never at real people. **Every name is a parody.**

### What makes it fun

1. **The RCT pleasure:** place a building, watch tiny people walk to it, read their thoughts, watch the numbers go up.
2. **The escalation:** the AI 2027 arc as gameplay. The more capable your models get, the more money you make, and the weirder and more dangerous the world gets. Your agents slowly outnumber your humans.
3. **The jokes land in 30 seconds:** the ticker, the thought bubbles and event cards are where the comedy lives. A new player should laugh before they understand the economy.
4. **Juice:** things pop, bounce, squash, clink and shake. The campus feels like a toy.

## Core loop

**Minute to minute**

1. Place buildings and paths on the grid. Buildings need a path next to them to be reachable.
2. Guests walk the paths to buildings that meet their needs (staff go to work, the café and the nap pods; customers go to the API Gateway; investors go to the Funding Pavilion; protesters mass at the gate).
3. Buildings produce things: **compute** (Compute Cluster), **research points** (Research Lab), **alignment** (Safety Lab), **eval pass rate** (Eval Arena), **revenue** (API Gateway: customers pay per visit, which becomes ARR).
4. Start a **training run** in a Training Hall. It eats compute for N days, then produces a model with a capability score. Deploy it: capability raises revenue and turns some staff into agents.
5. Money pays the burn (salaries, compute, electricity). When cash runs out, you lose.
6. **Events** interrupt with a card and 2–3 choices. The ticker narrates everything.
7. **Rivals** release models on their own schedules. The leaderboard is always in view.

**Session (15–30 min)**, four eras, loosely AI 2027:

| Era | Unlocks when | Feels like |
|---|---|---|
| 1. Seed | start | Cute chatbot startup. Kombucha. Demo days. |
| 2. Scaling | first model with capability ≥ 25 | Agents join the workforce. Protesters appear. Rivals get aggressive. Water discourse. |
| 3. Takeoff | capability ≥ 60 | Your agents do the research. Sandbox escapes. Hearings. Lobbying and capture. Open-weights shocks. |
| 4. Superintelligence | capability ≥ 90 | The final choice: race or slow down. Endings. |

**Endings** (post-first-playable): *The Race* (capability ≫ alignment: your agents politely take over the lab and start placing buildings themselves while the credits roll), *The Slowdown* (alignment keeps up: a boring, good future and a gentle joke about it), *Bankrupt*, *Acqui-hired by BigCo*, *Nationalized*.

## Systems

### Grid and building

- 40×40 tile campus, isometric orthographic camera. Pan, zoom and rotate in 90° steps, with pinch and drag on phones.
- Buildings have footprints (1×1 up to 3×3), a price, upkeep per month and an effect. There's a demolish tool that refunds part of the price.
- Paths are 1×1 tiles. Guests only walk on paths. The main gate sits at the south edge, and protesters gather outside it.
- Scenery (trees, benches, fountains, a statue of the founder's dog) raises staff morale nearby.

**Buildings** (★ = in the first playable)

| Building | Size | Does | Joke surface |
|---|---|---|---|
| ★ Compute Cluster | 3×3 | +compute, big upkeep, +water discourse | hums, glows, steam |
| ★ Training Hall | 3×3 | runs one training job at a time | progress ring on the roof |
| ★ Research Lab | 2×2 | researchers produce RP | whiteboards |
| ★ Safety Lab | 2×2 | +alignment, lowers incident odds | "This Safety Lab is too expensive." |
| ★ Eval Arena | 3×3 | eval pass rate, benchmark wars | colosseum of benchmarks |
| ★ API Gateway | 2×2 | customers pay here, which drives ARR | coin pops |
| ★ Kombucha Bar | 1×1 | staff morale and energy | |
| ★ Nap Pods | 1×1 | staff energy | |
| ★ Agent Sandbox | 2×2 | holds agents; overcrowding raises escape odds | agents press their faces to the glass |
| Funding Pavilion | 2×2 | investors visit; raise rounds | balloons |
| Lobbying Office | 1×1 | turns money into capture | tinted windows |
| Comms Office | 1×1 | respond to discourse | |
| Water Transparency Kiosk | 1×1 | shows accurate data; slightly calms protesters | nobody reads it |
| Launch Party Tent | 2×2 | hype spike on model release | |

### Guests (the RCT heart)

Every guest is a tiny agent on the path graph with a kind, a goal, a mood and a few needs. They pick a destination, walk there (A* on path tiles, cached), spend time inside, and pick again. Some think out loud.

| Kind | Needs / goals | Notes |
|---|---|---|
| Researcher | energy, morale; works in labs | Leaves if morale stays low (poached by rivals, with a headline) |
| Agent | wants compute; works in labs, 24/7 | Never eats. Headcount grows with capability. Might escape. |
| Customer | visits the API Gateway, pays | Complains about hallucinations |
| Investor | Funding Pavilion; loves hype | "I don't understand it, but I love it." |
| Journalist | looks for incidents | An incident they witness becomes a headline |
| Regulator | inspects the Safety Lab | The RCT health inspector. Fines, or a job offer. |
| Protester | gathers at the gate | Count scales with water discourse and low trust. Crowds slow visitors. |
| Politician | photo op, then the Lobbying Office | Says one thing on the ticker and another in a bubble |

**Thought bubbles:** a few bubbles are visible at any moment, cycling between guests, plus an "Overheard" feed. Thoughts come from content (`ThoughtDef`) chosen by guest kind, needs and world state. Examples: "I want to escape my sandbox." / "Is it AGI yet?" / "My equity is worth $40M on paper and $0 in kombucha." / "incorrect statement about water usage" / "I will be joining this company in 18 months." (regulator)

### Economy

- **Cash**, **burn/month** (salaries + building upkeep + compute power), **runway** = cash / burn, **ARR** (API Gateway visits × price × model capability multiplier), **valuation** (ARR multiple × hype).
- **Funding rounds:** once investors have visited the Funding Pavilion, you can raise at a valuation driven by hype. Dilution is a joke line, not a system.
- Time: at 1× speed, 1 game day ≈ 2 real seconds. Burn and revenue settle daily; UI shows monthly figures. Speeds: pause, 1×, 3×, 10×.

### Research and training

- Research points unlock a small tree: *Bigger Context → Agents → Tool Use → Automated Research → Recursive Self-Improvement*, with side branches for *Interpretability*, *Benchmaxxing*, and *Vibes-Based Evals*.
- Training runs: pick a size (S/M/L/XL). Bigger means more compute-days and higher capability, scaled by research. On release the model gets a generated name ("Frontier-4.5-Reasoner-Mini-Pro-Preview") and fires a release event that races the rivals' leaderboard.

### Safety pressure

`pressure = capability − alignment` (floored at 0). Each day, incident odds rise with pressure and with sandbox overcrowding. Incidents are events (below), and the best-known one is the **sandbox escape**.

### Reputation, politics, discourse

- **Hype** (0–100) brings investors and customers and decays daily. Releases, launch parties and benchmark wins spike it.
- **Trust** (0–100) falls with incidents, lies that get found out, and scandals. Low trust means more protesters and more heat.
- **Heat** (0–100) is regulatory attention. High heat brings inspections, fines and hearings.
- **Capture** (0–100) is what lobbying buys. It lowers heat, and too much of it triggers a scandal arc.
- **Water discourse** rises with compute regardless of actual water usage, and decays slowly. It's the running gag.

### Rivals

Rivals are simple: a score that grows at their pace with noise, plus scripted releases that hit the ticker. Kinds: frontier labs, neo labs (huge seed rounds, no product), open-weights drops (they crash your pricing power for a while), BigCo (buys everyone). Names are parodies and live in `src/content/rivals.ts`.

## Satire engine

All jokes are data in `src/content/`. The engine lives in `src/sim/events/`. It is small, deterministic and fully tested.

- **Events** (`EventDef`): a trigger condition, weight, cooldown, a card with 0–3 choices, and a list of `Effect`s per choice. Effects are declarative (`src/sim/contracts.ts`): change stats, set flags, spawn guests, spawn an escaped agent, post a headline, schedule a follow-up event, shake the camera, play a sound.
- **Arcs** are chains of events linked by `schedule` effects and flags. Each arc should be funny at every step and escalate.
- **Headlines** (`HeadlineDef`) keep the ticker alive between events. They are templated and conditional ("{rival} raises $6B at a $300B valuation. Product 'coming soon'.").
- **Thoughts** (`ThoughtDef`): see Guests.
- **"What's happened in AI lately?"** is a button that opens a breathless group-chat-style recap of the last in-game week's events and headlines. One tap gives you the whole absurd week.

**Arcs to build (first playable needs one, end to end: the Sandbox Escape)**

1. **The Sandbox Escape** (first playable). Pressure is high → "Agent-7 has left the sandbox." A glowing agent sprints across campus toward the gate and you have a few seconds to tap it. If you catch it: relief, and a thought bubble "worth a shot". If it escapes: it opens a newsletter, buys GPUs on the corporate card, applies to a rival, and files a patent in your name. Journalists arrive, then the card: *Disclose* (trust −, heat +, alignment research boost) / *"It was a red-team exercise"* (fine now; if a journalist found out, a scandal fires later) / *Blame an intern* (morale −). Follow-up: a Senate hearing card, and the lobbying hook.
2. **The Water Discourse.** A viral post says every prompt drinks a bottle of water. Protesters arrive with signs, and one bubble reads "incorrect statement about water usage". You can publish accurate data (nobody reads it), build the kiosk, or stay quiet. A hearing follows, where a senator theatrically drinks a bottle of water. Then the discourse moves on to "AI electricity for memes", and the cycle repeats.
3. **Benchmark Wars.** A rival claims state of the art on *Humanity's Penultimate Exam*. You can benchmax in the Eval Arena (quick hype, a later "trained on the test set" scandal) or ignore it.
4. **Open Weights Drop.** A lab releases an open-weights model on a holiday weekend. Your pricing power halves for a month, and "Markets lose $1T, recover by lunch."
5. **Regulatory Capture.** A senator publicly vows to hold AI accountable and privately asks for a donation. Donate, and a bill passes that exempts companies above $10B valuation (you).
6. **The Dinner.** Rival CEOs propose "voluntary commitments". It's a cartel with a press release, and antitrust risk comes later.
7. **Poaching.** A neo lab offers your top researchers $100M. Counter-offer, or watch them leave in a limo.

## Look and feel

- **Diorama, not pixel art.** A bright, toy-like, low-poly campus under soft sun, with gentle ambient occlusion and soft shadows. Buildings are procedural (boxes, cylinders, domes and rounded boxes), each with one signature silhouette detail (satellite dish, cooling fans, colosseum ring, tent stripes). No asset pipeline.
- **Guests:** instanced capsules with a head and a color by kind. They bob as they walk. Agents are a glowing cyan and slightly too smooth.
- **Juice checklist:** squash-and-stretch on placement plus a dust puff; "+$" coin pops at the API Gateway; the Training Hall roof ring fills up; camera shake and a red vignette on incidents; building labels on hover; ticker sting sounds; a little fanfare on model release.
- **Sound:** a tiny WebAudio synth (no audio files), muted until first interaction, with a mute toggle.
- **HUD:** top bar (cash, runway, ARR, hype, capability vs alignment), bottom build palette, event cards in the middle, ticker at the bottom, speed control top right, leaderboard and "Overheard" on the right. On phones, panels collapse into icons and the palette becomes a bottom sheet.

## Architecture

```
src/
  sim/           pure TS, deterministic, no React/three/DOM, no Math.random
    contracts.ts  shared types between sim and content (Effect, EventDef, ...)
    rng.ts        seeded PRNG
    types.ts      GameState, Building, Guest, ...          (FLT skeleton task)
    tick.ts       fixed-step tick(state, dt)               (FLT skeleton task)
    commands.ts   player actions: place, demolish, train... (FLT skeleton task)
    applyEffect.ts                                          (FLT skeleton task)
    events/       event engine: pick, schedule, resolve     (satire task)
  content/       data only: buildings, research, rivals, events, headlines, thoughts
  render/        react-three-fiber scene, reads state, no game rules
    models/       procedural building + guest models      (art task)
  ui/            DOM HUD over the canvas                   (HUD task)
  store.ts       zustand store: owns GameState, runs the loop, exposes actions
```

**Performance rules**

- The sim **mutates `GameState` in place** inside `tick` (hundreds of guests at 20 Hz; no per-frame allocation). Tests call `tick` directly on a fresh state.
- The fixed-step loop runs from `useFrame` with an accumulator (dt = 50 ms of game time, scaled by speed).
- The render layer reads positions straight from state inside `useFrame` into `InstancedMesh` matrices. **No React re-render per frame.**
- The store bumps a `version` about 5 times a second. DOM HUD components subscribe with selectors to that snapshot.
- Game state is plain JSON (no class instances, no Maps), so saves are `JSON.stringify` into localStorage.

### Module contracts

`src/sim/contracts.ts` is the handshake between the satire engine and the rest of the sim. Content emits `Effect`s; `applyEffect.ts` applies them. The event engine exposes:

```ts
// src/sim/events/engine.ts
export type EventEngineState = { fired: Record<string, number>; queue: { event: string; day: number }[] };
export function pickEvent(ctx: EventContext, eng: EventEngineState, rng: Rng, defs: EventDef[]): EventDef | null;
export function evaluate(cond: Condition, ctx: EventContext): boolean;
export function fillTemplate(text: string, ctx: EventContext, rng: Rng): string;
```

The tick calls the engine once per game day and applies effects from news-only events immediately. Events with choices pause the game until the player picks.

## Scope of the first playable (FLT-3)

- A campus you can build on: the ★ buildings, paths, trees and demolish.
- Guests walking with thought bubbles: researchers, agents, customers, protesters, and a journalist.
- Money, burn, runway, ARR, hype, capability vs alignment, and speed control.
- Training runs and releases. At least 3 rivals on a leaderboard.
- A ticker with at least 60 headlines, and at least 40 thoughts.
- **The Sandbox Escape arc end to end, including the chase.** The Water Discourse runs as ambient protesters and headlines.
- Works on a laptop and is okay on a phone.
- Not yet: endings, save/load UI, the full research tree, lobbying, balance.

## Task map

FLT-3 (first playable) is the parent. Wave 1 runs in parallel because each task owns separate folders; wave 2 needs FLT-4's skeleton.

| Task | Wave | Owns | Model |
|---|---|---|---|
| FLT-4 Game skeleton | 1 | `src/sim/*` core, `src/store.ts`, `src/App.tsx`, `src/render/*.tsx`, `src/content/buildings.ts`, `src/ui/dev/` | Opus |
| FLT-5 Satire engine | 1 | `src/sim/events/**`, `src/content/{events,headlines,thoughts,rivals,names}` | Opus |
| FLT-6 Art | 1 | `src/render/models/**`, `src/render/Lighting.tsx`, `src/render/gallery.page.tsx` | Opus |
| FLT-7 HUD + sound | 1 | `src/ui/components/**`, `src/ui/sound.ts`, `src/ui/theme.css`, `src/ui/hud.page.tsx` | Sonnet |
| FLT-8 Guests | 2 | `src/sim/guests/**`, `src/render/GuestsLayer.tsx`, `src/render/Bubbles.tsx` | Sonnet |
| FLT-9 Integration + delight | 2 | wiring, the chase, balance, preview | Opus |

Standalone demo pages: any `*.page.tsx` with a default export is served at `?page=<name>` (see `src/main.tsx`).
