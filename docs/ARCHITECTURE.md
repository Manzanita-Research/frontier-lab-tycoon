# Architecture: XState machines, run by Effect

All game logic is a statechart. Effect owns the runtime around it. The spec this follows is `docs/specs/architecture-xstate-effect.md`; the six rules are restated in `AGENTS.md`. This page is the map: what each machine is, how they are driven, what the numbers are, and where the alpha stack bit.

Stack (exact pins, no `^`): `xstate@6.0.0-alpha.62`, `effect@4.0.0-rc.118`, `@xstate/effect@0.1.0-alpha.5`, `@effect/atom-react@4.0.0-rc.118`, `@effect/vitest@4.0.0-rc.118`, `vitest@5.0.2`.

## Data flow

```mermaid
flowchart LR
  subgraph Effect["Effect runtime (Atom runtime / registry)"]
    F["Frames service<br/>requestAnimationFrame"] -->|"FRAME {now, dt}"| A
    A["appMachine<br/>(createEffectActor)"] -->|"Effect action:<br/>advance / hold / newLab"| S["Sim service<br/>SimHandle"]
    S -->|"SYNCED {card, outcome, snap?}"| A
  end
  S --> W[("World<br/>plain JSON")]
  W --- M["sim machines<br/>{ value, context } each<br/>advanced with pure transition()"]
  A -->|"context.snap ~5 Hz<br/>@xstate/effect/atom"| R["React HUD"]
  W -->|"useFrame reads sim.world<br/>+ sim.alpha"| T["react-three-fiber scene"]
  R -->|"send(event)"| A
  T -->|"send(event)"| A
```

- **`src/sim/`** is pure and deterministic. `tick(state, commands)` is the fixed step; machines inside it are advanced with `transition()`, synchronously, and are not actors.
- **`src/app/`** is the shell. `Sim` (the live World plus `step`/`applyNow`/`report`) and `Frames` (one item per animation frame) are `Context.Service`s. `appMachine` is a `setupEffect` machine started by `createEffectActor` inside an Atom runtime; the frame loop is a `fromEffectEventStream` actor that reads `Frames`. React reads selector atoms of that actor (`atoms.snap`, `atoms.tool`, ...) and sends events; the renderer reads `sim.world` and `sim.alpha` imperatively in `useFrame`.
- **Determinism.** Same seed and commands give a deep-equal persisted World, and `src/sim/golden.test.ts` pins that: three seeds, six checkpoints each, digests of every walker, the RNG state, cash, news and toasts, recorded from the hand-written sim *before* the port. The app shell test also replays 60 frames against 60 direct `tick()`s and compares the JSON.

## Machine map

| Machine | File | States | Events in | Emits / effects | Owns (context) |
|---|---|---|---|---|---|
| **app** | `src/app/machine.ts` | `playing.{running,paused}`, `eventOpen`, `gameOver` | `FRAME`, `SYNCED`, `SET_SPEED`, `TOGGLE_PAUSE`, `SET_TOOL`, `SET_HOVER`, `COMMAND`, `CHOOSE`, `KEEP_PLAYING`, `NEW_LAB`, `TOAST*` | Effect actions `advance`, `hold`, `newLab`; delayed `TOAST_EXPIRED` | speed, command queue, frame accumulator, tool, hover, toasts, the 5 Hz HUD snapshot |
| **training** | `src/sim/machines/training.ts` | `idle`, `training`, `releasing` | `DAY {halls, gain}`, `NAMED {name}` | `RELEASED`, `RUN_STARTED` | run, progress, cost, next model name |
| **tutorial** | `src/sim/machines/tutorial.ts` | `path`, `hall`, `gateway`, `hire`, `release`, `done`, `skipped` | `FACTS`, `CONTINUE`, `SKIP` | `FINISHED` (one launch toast) | acknowledgement of the current step; stored in `World.tutorial` |
| **guardrails** | `src/sim/machines/guardrails.ts` | `clear`, `confirming` | `REQUEST`, `CLEAR`, `OBSERVE`, `HALL` | low-runway nudge, redundant-Hall hint | exact pending spending command, low-runway and disconnected-gate warning flags; additive optional `World.guardrails` |
| **economy** | `.../economy.ts` | `solvent`, `runwayWarning`, `bailout`, `bankrupt` | `DAY {cash, day}` | `BAILOUT` | day of the last bridge round |
| **goals** | `.../goals.ts` | `tracking`, `won`, `lost` (final) | `DAY {day, cash, values}` | `WON`, `LOST` | the three milestones, the day it ended |
| **arc** (one per event card) | `.../arc.ts` | `calm`, `brewing`, `cardOpen`, `cooldown` | `DAY {day, ready, slotFree, pace}`, `CHOOSE {choiceIndex}` | `RESOLVED` | choices, cooldown days, day last opened |
| **walker** (one per walker) | `.../walker.ts` | `arriving`, `seeking`, `queuing`, `inside`, `loitering`, `wandering`, `choosing`, `leaving`, `quitting`, `picketing`, `gone` (final) | `ARRIVED`, `QUEUED`, `ADMITTED`, `GAVE_UP`, `LINGER`, `NEXT`, `TOUR_DONE`, `QUIT`, `CHOSE_BUILDING`, `CHOSE_WANDER`, `PROTEST_STARTED`, `SENT_HOME`, `EXITED` | none: the driver acts on the state entered | nothing (the need a walker is seeking, `visits` and `step` stay plain walker fields) |
| **rival** (one per rival lab) | `src/sim/race/rival.ts` | `idle`, `training`, `releasing`, `cooldown` | `WEEK {aggro, pace, chase, four dice, name}`, `SHOCK {capability, hype, momentum}` | `RELEASED`, `POACH` | personality, capability, hype, weeks left, open weights?, momentum, latest model |
| **era** | `src/sim/race/era.ts` | `era1`, `era2`, `era3`, `era4` | `DAY {mult}` | `ERA_REACHED` | the peak multiplier (the ratchet) |
| **staff** (one per staffer) | `src/sim/machines/staff.ts` | `arriving`, `idle`, `going`, `working`, `leaving`, `gone` (final) | `ARRIVED`, `TASK`, `DONE`, `LOST`, `FIRED`, `EXITED` | none: the driver acts on the state entered | nothing (the task, route, patrol zone and counters stay plain fields on the staffer) |
| **mood** (one per researcher and visitor) | `.../mood.ts` | `content`, `slumped`, `miserable`, `resigned` (final) | `LIFT`, `SLUMP`, `CRASH`, `DAY` | `RESIGNED` | the count of miserable days in a row |

Arithmetic stays in plain functions: money per day, the training gain (`spend * (0.75 + 0.25 * morale)`), movement along a route, routing itself.

## Statecharts

### App

```mermaid
stateDiagram-v2
  [*] --> playing
  state playing {
    [*] --> running
    running --> paused: SET_SPEED 0 / TOGGLE_PAUSE
    paused --> running: SET_SPEED n / TOGGLE_PAUSE
    running --> running: FRAME (advance n ticks)
    paused --> paused: FRAME (apply queued commands only)
  }
  playing --> eventOpen: SYNCED [a card opened]
  eventOpen --> playing: SYNCED [card answered]
  playing --> gameOver: SYNCED [won or lost, not dismissed]
  eventOpen --> gameOver: SYNCED [outcome, card answered]
  gameOver --> playing: KEEP_PLAYING / NEW_LAB
  note right of eventOpen
    CHOOSE queues a chooseEvent command;
    FRAME applies it without advancing time
  end note
```

The target after every event that could change it is one function, `phaseFor(context)`: card open wins, then an undismissed outcome, then speed. A machine booted with speed 0 starts `paused` (an `always` transition).

### First-run pacing (FLT-16)

At 1× the shell feeds 20 ticks per six seconds: one game day. Day/night still spans 30 days (three minutes), with six-hour dawn/dusk blends. A clean lab starts with one connected Compute Cluster, three researchers, one agent and no visitors or Training Hall. The shell opens at speed 1 but holds time until the first successful build and while a new tutorial message needs acknowledgement. Selecting that step's build tool or sending `continueTutorial` acknowledges it. The sim itself can still be stepped headlessly; `applyNow` advances tutorial facts for commands made while paused.

`Snapshot.assistant` / `atoms.assistant` expose `{ step, message, highlight, paused, canSkip }`, or `null` on completion/skip/older saves. Content is `content/tutorial.ts`; targets are `build:path`, `build:hall`, `build:gateway`, `staff:hire`, `training`. Send `COMMAND { command: { type: "continueTutorial" } }` for Next and `{ type: "skipTutorial" }` for Skip. FLT-29 owns the assistant skin, pulsing targets, visible Skip and paused indicator; FLT-16 only routes plain messages through the existing hint host.

`SET_OVERLAY { id, open }` holds time for independently owned menus. Existing Staff, News Room, sound mixer, phone stats/Objectives/Thoughts/Arena and photo mode are wired through it; new hosts can use `useAutoPause`. An inspector, event or outcome card also holds time. Closing one overlay preserves both other overlays and the player's selected speed; no catch-up time is banked while held. Desktop readout panels are persistent HUD, rather than modal menus.

Visitor arrivals run once a day. `visitorDemand` combines connected Gateways/Demo Stages/campus size × hype × Vibes, with word of mouth over the first 60 days and a small trickle. Disconnected or broken attractions contribute nothing. Cards wait until day 40; pressure also requires a release and a reachable Gateway (prior revenue proves that introduction, so bulldozing a Gateway cannot disable later fires). `scripts/pacing-report.mjs` uses paid commands over three seeds × 365 days; the actual 1× browser sequence is `scripts/pacing-shots.mjs`, with no debug URL or clock override.

### Playtest guardrails (FLT-16)

The two tiles directly in front of the gate are reserved against building placement even after their paths are removed. Reachability starts there, and the disconnected-entrance warning persists until that approach reaches another path tile. Stranded visitors and staff follow small deterministic routes around the entrance; restoring the path lets their existing machines resume. Unzoned staff patrol the full reachable network (the playtest fixed a dangling `else` that previously left them standing at the gate).

All paid path/build/hire commands forecast runway from fresh `estimateLedger` books, including the new building's upkeep, prospective Hall researchers, hire wages and connected Gateway revenue. Under three months, the command records `Snapshot.pendingConfirm { kind, cost, runwayAfter, message, command }` without spending or consuming RNG; `confirmed: true` on that exact command approves it, and `cancelConfirm` clears it. A hire has zero upfront cost and adds its daily salary. The first proposal wins a burst of unconfirmed commands. The app holds time without changing the selected speed; the pure tick also holds so a saved pending proposal survives load without a surprise bill. Under two months, `Snapshot.warnings` offers the existing 50% bulldoze refund, firing staff and the automatic $2M emergency bridge round at zero cash. Entrance warnings use the same persistent array.

A second Hall gets a one-line hint when existing halls already consume the available compute and there is no stored surplus. `Snapshot.releaseGoal` counts shipped models and uses the training machine's actual next name, rather than promising Frontier-4 while Frontier-2 is running. The legacy HUD only hosts these plain warnings, confirmation controls and the goal label; FLT-29 can consume the same snapshot contract in skins. A paused tutorial hint now includes “Continue →” so the final waiting instruction has an explicit acknowledgement.

### Water Discourse arc

The arc is two event cards chained through a flag, both instances of one generic arc machine (`content/events.ts` is data; a new arc is a new entry there and never an engine change).

```mermaid
stateDiagram-v2
  [*] --> calm
  calm --> cardOpen: DAY [ready, slot free] (opens today)
  calm --> brewing: DAY [ready, another card open]
  brewing --> cardOpen: DAY [ready, slot free]
  brewing --> calm: DAY [condition faded]
  cardOpen --> cooldown: CHOOSE [valid pick] / RESOLVED
  cooldown --> cooldown: DAY [inside cooldown]
  cooldown --> cardOpen: DAY [elapsed, ready, slot free]
  cooldown --> calm: DAY [elapsed, not ready]
```

```mermaid
flowchart LR
  D["discourse: +0.5/cluster/day, -0.3/day<br/>protesters = floor(discourse / 4), max 40"] --> W
  W["waterDiscourse card<br/>discourse ≥ 30 and day ≥ 60"] -->|"report / fountain"| C1["cooldown 60 d"]
  W -->|"say nothing: sets flag ignoredWater"| G["ignoredWater<br/>20 days ago, discourse ≥ 40"]
  G --> DC["drumCircle card"]
  DC -->|"any choice clears the flag"| C2["cooldown 60 d"]
```

The driver evaluates each card's condition against the World (`ready`) and tells every arc machine, in content order, whether the screen is free; the first arc to open takes it and the rest wait as `brewing`. `state.event` and the old `event:<id>` cooldown flags are derived from the arcs.

### Walker

```mermaid
stateDiagram-v2
  [*] --> arriving
  arriving --> inside: ARRIVED
  seeking --> inside: ARRIVED
  arriving --> queuing: QUEUED
  seeking --> queuing: QUEUED
  queuing --> inside: ADMITTED
  queuing --> choosing: GAVE_UP
  inside --> loitering: LINGER
  arriving --> choosing: NEXT
  seeking --> choosing: NEXT
  inside --> choosing: NEXT
  loitering --> choosing: NEXT
  wandering --> choosing: NEXT
  choosing --> seeking: CHOSE_BUILDING
  choosing --> wandering: CHOSE_WANDER
  arriving --> leaving: TOUR_DONE
  seeking --> leaving: TOUR_DONE
  inside --> leaving: TOUR_DONE
  loitering --> leaving: TOUR_DONE
  wandering --> leaving: TOUR_DONE
  arriving --> quitting: QUIT
  seeking --> quitting: QUIT
  queuing --> quitting: QUIT
  inside --> quitting: QUIT
  loitering --> quitting: QUIT
  wandering --> quitting: QUIT
  leaving --> gone: EXITED
  quitting --> gone: EXITED
  arriving --> picketing: PROTEST_STARTED
  wandering --> picketing: PROTEST_STARTED
  picketing --> leaving: SENT_HOME
  gone --> [*]
```

`arriving` is a newcomer on the way to a first stop (a visitor or an applicant through the gate, or anyone at the start of the game); `seeking` is every trip after that, and *which* need it is for lives in `Walker.need` (`seeking(need)` in the spec): `energy`, `focus`, `fomo`, `patience`, or `work`/`tour` for the day job and sightseeing. `queuing` is a full building's doorstep: researchers and visitors wait until a spot frees or patience runs out; agents ignore capacity.

The walker machine is declarative on purpose (see the numbers below). The dice and facts a decision needs are folded into which event the driver sends: when a stay ends, the driver rolls `rng.chance(0.55)` and sends `LINGER`, or checks `tourDone(kind, visits, patience)` and sends `TOUR_DONE` or `NEXT`. The world work a state implies runs when the driver sees it entered: `choosing` scores the buildings (see below) and routes to the winner (then answers `CHOSE_*`), `loitering` steps out, `leaving` and `quitting` route to the gate. Walkers get events only on discrete changes; movement is a plain function.

**Destination choice** (`chooseTarget` in `sim/walkers.ts`) is RCT's: find the walker's most urgent need, score every reachable building that hosts them by `(how much it gives of that need, plus a little for their other needs) / (1 + distance / 6)`, and go to the best. If no reachable building gives at least 0.3 of it, the walker is `lost` ("I can't find a snack") and carries on with the day job or the tour. All of it is data in `content/buildings.ts` (`serves`, `hosts`, `capacity`, `stay`).

### Mood

```mermaid
stateDiagram-v2
  direction LR
  [*] --> content
  content --> slumped: SLUMP
  slumped --> content: LIFT
  content --> miserable: CRASH
  slumped --> miserable: CRASH
  miserable --> content: LIFT
  miserable --> slumped: SLUMP
  miserable --> miserable: DAY [days < 5]
  miserable --> resigned: DAY [5th in a row] / RESIGNED
```

The second machine on every researcher and visitor. Once a game day the driver (`sim/crowd.ts`) works out happiness from the needs and, if the mood it implies (`moodFor`: slump under 0.4 and back out above 0.5, miserable under 0.2) differs from the one the walker is in, sends the event; only a miserable researcher also gets a `DAY`. `slumped` and `miserable` are the slump walk in the renderer; the fifth miserable day in a row emits `RESIGNED` and the driver sends the walker machine `QUIT` (box, gate, headline, an incident for the Vibes). That is a few events a day for the whole crowd, never one per walker per tick.

### Vibes

Not a machine: arithmetic, in `sim/vibes.ts`. `value = 999 * (0.4 happiness + 0.2 visitors impressed + 0.15 cleanliness (stubbed at 1) + 0.15 hype/100 + 0.1 * (1 - penalty))`, where penalty is the mean of the incident score (resignations, failed demos, bailouts; fades 10% a day) and the protester count at the gate over 25. Recalculated daily and eased a quarter of the gap at a time. It sets the visitor cap and spawn chance, brings researcher applicants when it is above 350 and a Training Hall has room, and turns some visitors into investors.

### Economy, goals, training

```mermaid
stateDiagram-v2
  direction LR
  state "economy" as E {
    [*] --> solvent
    solvent --> runwayWarning: DAY [cash < 0, cooldown]
    solvent --> bailout: DAY [cash < 0, due] / BAILOUT
    runwayWarning --> bailout: DAY [cash < 0, due] / BAILOUT
    bailout --> solvent: DAY [cash ≥ 0]
    runwayWarning --> solvent: DAY [cash ≥ 0]
    solvent --> bankrupt: DAY [cash < -$2M after any round]
  }
```

```mermaid
stateDiagram-v2
  direction LR
  state "goals" as G {
    [*] --> tracking
    tracking --> won: DAY [all milestones met] / WON
    tracking --> lost: DAY [day ≥ 360 or cash < -$2M] / LOST
  }
  state "training" as T {
    [*] --> training
    training --> releasing: DAY [progress ≥ cost] / RELEASED
    releasing --> training: NAMED / RUN_STARTED
    releasing --> releasing: NAMED [still ≥ cost] / RUN_STARTED, RELEASED
    training --> idle: DAY [no Training Hall]
    idle --> training: DAY [hall built]
  }
```

## How a machine is driven

A sim machine never touches the World and never draws random numbers:

1. **State in the World is `{ value, context }`** (JSON). `step(machine, stored, event)` in `src/sim/machines/run.ts` rebuilds a live snapshot with `machine.resolveState`, calls `transition()`, and returns the next `{ value, context }` plus the emitted events in order. The World never holds a live snapshot, so `JSON.parse(JSON.stringify(world))` deep-equals it.
2. **The driver applies effects.** `training.ts` turns `RELEASED` into capability, hype, cash, a toast and a headline; `economy.ts` turns `BAILOUT` into +$2M and a headline; and so on. It applies them in the order they were emitted, which is the order the pre-port code ran them in.
3. **Randomness is pre-rolled.** After a training release the machine waits in `releasing`; the driver rolls the next model name *after* the release effects and *before* the next run's, then sends `NAMED`. That is exactly where the old loop drew, so the RNG stream is unchanged.

## Numbers (measured on the 1-vCPU Modal box, Node 22)

| Measurement | Result |
|---|---|
| 500-walker tick (400 agents + crowd + 160 discourse), best of 3 x 200 ticks | **0.11 - 0.23 ms** over 5 runs (pre-port baseline 0.085 ms; budget 0.3 ms) |
| Discrete walker events at that load | about 12 per tick (7.6 arrivals, 4.1 stay-overs, 4.2 next-stop picks) |
| 800+ walker tick (400 agents, 300 researchers fighting over three small buildings, 110 visitors, 40 protesters; 850 at the start of each batch), best of 3 x 200 ticks (FLT-8) | **0.33 - 0.39 ms** over 3 runs (budget 0.5); the 500-walker test above is now 0.13 ms |
| Walker events at that load | about 27 per tick, because a crowd that size fights over a nap pod: about 8 queue joins and give-ups, 12 pick-a-stop events (measured before the memo below) |
| `transition()` with a plain `{ target }` (resolveState included) | 3 - 5 us |
| `transition()` with a `matches` pattern | about 7 us |
| `transition()` when the transition contains any function (`to`, a `context` mapper) | 14 - 20 us; 22 - 27 us when it also `emit`s |
| `resolveState` + `transition()` + reading `{ value, context }` | 9.6 us on a small function machine |
| `getPersistedSnapshot` + `restoreSnapshot` round trip, same machine | 37 us |

The 800-walker budget needed one more trick. With the Crowd, a walker changes phase about 27 times a tick at that load, and 27 x 10 us was over half the budget. Because the walker machine has no context and no functions, a transition depends on nothing but the phase and the event type, so `stepWalker` (in `machines/walker.ts`) asks XState once per (phase, event) pair, remembers the answer, and returns it from then on: about 0.3 us instead of 10. `walker.test.ts` checks it against the real `step` for every pair. It only works because the machine stays context-free; the moment a walker machine needs a counter, that shortcut is gone (the mood machine, which has one, is only stepped a few times a day).

Two design consequences: the World stores `{ value, context }` and rebuilds with `resolveState` (the official persist/restore pair is 4x slower and this runs hundreds of times per tick), and the walker machine contains no functions at all. The first version of it used function transitions to keep `visits`/`step` in context and to decide leave-or-pick inside the machine; it measured 0.45 - 0.54 ms per tick and failed the perf test, so those decisions moved into the driver's choice of event.

## Alpha-stack notes

- **`@xstate/effect@0.1.0-alpha.5/atom` does not load against `effect@4.0.0-rc.118`.** It imports `effect/unstable/reactivity`; rc.118 (and `@effect/atom-react@rc.118`) expose `effect/reactivity`. There is no newer `@xstate/effect`. Workaround, with no version change: an alias in `vite.config.ts` (`effect/unstable/reactivity` to `effect/reactivity`), `server.deps.inline: ["@xstate/effect"]` so vitest applies it, and a matching `paths` entry in `tsconfig.json`. The atom API behaves the same in our use (actor start, `snapshot`, `send`, `select`). Drop all three the day a release fixes the import.
- **`@effect/vitest@rc.118` needs `vitest >=5 <6`**, so the repo moved from vitest 3.2 to 5.0.2 (all pre-existing tests passed unchanged). Vitest 5 hides `console.log` from passing tests.
- **Root-level machine transitions need a leading dot on nested targets** (`.playing.running`), and `guard` objects are gone in v6 alpha: conditions are inline functions or `matches` patterns.
- **Registered Effect actions take the transition's full args**: enqueue with `enq(actions.advance, { ...args, params })`; inside, `args.params` is the payload and `args.self.send(...)` reports back.
- A canary test (`src/machines/effect-smoke.test.ts`) fails first if a pin moves and breaks these assumptions.

## Deliberate differences from the spec

- **No `title` state.** The game has no title screen and this port adds no features; the app machine starts in `playing`.
- **Toasts expire per toast** (a delayed `raise` on the Effect clock, 5.2 s from when each was shown) instead of the old component effect that restarted every timer whenever the list changed. It is the one visible timing difference.
- **Walker machine has no context.** See the numbers above.
- **Machine events use plain data only** (no functions or handles), so `xstate/graph` can explore every machine; `src/sim/machines/graph.test.ts` asserts every state is reachable and only final states are dead ends.

## The juice layer (FLT-6): render and UI only

Everything that makes the campus feel alive lives in `src/render/fx/` and `src/ui/juice/`. It **reads** the World (`sim.world`, `sim.alpha`) and never writes to it, adds no sim events and changes no `src/sim/**` file, so the golden digests and the perf test are untouched.

```mermaid
flowchart LR
  W[("sim.world")] -->|"each frame"| WATCH["watch.ts<br/>diff vs last frame"]
  WATCH -->|"FxEvents: release, incident, placed,<br/>removed, path, earned, reset"| DIR["FxDirector<br/>(useFrame, priority -3)"]
  DIR --> P["particles.ts<br/>pool of 2,000"] --> PL["ParticleLayer<br/>1 instanced draw call"]
  DIR --> CIN["cinema.ts<br/>camera director + shake"] --> RIG["CameraRig<br/>MapControls, WASD, edge, dblclick"]
  DIR --> FX["fx state: hour, night,<br/>cheerAt, earnAt"]
  FX --> L["Lighting, lamps, windows,<br/>Sky, Walkers, models"]
  UI["ui/juice: P key, camera button"] -->|"photoAtom"| PFX["PhotoFX (lazy)<br/>postprocessing"]
```

| Piece | File | What it does |
|---|---|---|
| Campus clock | `fx/clock.ts` (the time part is `sim/daylight.ts`) | Pure. `hourAt(tick)`: one cycle per 30 game days (600 ticks; FLT-10 slowed it from 10, the lamps were flipping too often), the game opens at 8am. `ambience(hour)` gives light colours and intensities, sky gradient, window and lamp glow. `chaseHour` low-passes the shown hour to 3 h/s, so 10x speed drifts through dusk instead of strobing. Tested to stay continuous and never darker than 35% of noon light. |
| Watcher | `fx/watch.ts` | Compares the World with the previous frame and returns `FxEvent`s. The first poll of a World (load, `?warp=`, new lab) only records a baseline. This is how "release" and "event card" reach the juice layer with no sim change. |
| Particles | `fx/particles.ts`, `ParticleLayer.tsx` | One struct-of-arrays pool (cap 2,000; ambient sparkles and dust are dropped when full so a confetti burst always gets in) drawn as camera-facing quads by one `InstancedBufferGeometry`. Kinds: confetti, coins, smoke and dust puffs, water droplets, four-point sparkles. Sparkles are additive, the rest premultiplied alpha. |
| Camera director | `fx/cinema.ts`, `CameraRig.tsx` | `idle -> in -> hold -> out -> idle`. A shot remembers the player's view and eases back to it; any player input cancels it. A release goes to the Training Hall (2.6 s), an event card to the gate (held until the card closes, with the subject aimed above the card). `shake(strength)` adds trauma; the offset is trauma squared. |
| Lights | `fx/Lighting.tsx`, `fx/glow.ts`, `fx/Night.tsx` | One directional light swings from sun to moon; shared window and lantern materials are updated once per frame, so every window and lamp lights together. Path lamps sit on every fourth path tile. |
| Photo mode | `fx/PhotoFX.tsx`, `ui/juice/photo.ts` | `@react-three/postprocessing` (tilt-shift, ACES tone mapping, saturation, contrast, vignette) is a lazy chunk mounted **only** while photo mode is on. The sky becomes the scene background so the blur has something to blur into. The PNG is the composer's frame plus the thought bubbles that were on screen plus the stamp. |

Decisions worth knowing:

- **The camera director is a plain class, not a machine.** It is render code with no game logic in it, driven by frame `dt`; the rules about sim machines and tick-based time are about the sim.
- **Photo mode is an Effect atom** (`photoAtom`), not a field on the app machine, so it adds no events to `appMachine` and can't collide with other UI state. It is mirrored into `fx.photo` for the render side.
- **Night thoughts** were client-side at first (`ui/juice/NightThoughts.tsx`); FLT-10 moved them into the sim. `sim/daylight.ts` (the clock, now shared) sets the `night` thought condition, `content/night.ts` feeds both the bubbles and the Thoughts panel, and the first night of a game is always "It's 2am. Still shipping."
- **Debug knobs:** `?hour=22` pins the clock, `?photo` opens photo mode, and with `?debug=1` `window.__fx` exposes `{ fx, cinema, pool }`. `scripts/juice-shots.mjs` scripts the moments a URL can't (a release, a saved photo, frame times).

Measured on the 1-vCPU Modal box: a full pool of 2,000 particles updates in 0.08 ms per frame, watching a 429-walker World costs 0.0005 ms per frame, and the SwiftShader frame time of the whole game is unchanged against the FLT-4 build (mean 117 ms with juice vs 126 to 132 ms without, both rasteriser-bound).

## The Race (FLT-9): rivals, the Arena, eras

```mermaid
flowchart LR
  D["dailyRace (each game day)"] --> M["R&D multiplier<br/>1 + agents x skill / max(1, researchers x 10)"]
  M --> E["era machine<br/>era1 -> era2 -> era3 -> era4 (ratchet)"]
  E -->|"ERA_REACHED: offer:eraN flag"| CARD
  D -->|"every 7th day"| W["weekly()"]
  W --> R["6 rival machines, WEEK events<br/>(dice and model name pre-rolled)"]
  R -->|"RELEASED / POACH"| FX["news, hype, open-weights check,<br/>a researcher resigns"]
  W --> A["Arena: re-rank, remember last week's places"]
  FX -->|"free model within reach, you have revenue"| DROP["openDrop (-30% for 30 days)<br/>flag offer:openWeights"]
  D -->|"day >= nextAuction"| AUC["flag offer:auction"]
  D -->|"runway < 3 months, Vibes > 400"| FUND["flag offer:funding"]
  DROP --> CARD
  AUC --> CARD
  FUND --> CARD
  CARD["event cards (content/events.ts)<br/>one at a time, arcs as before"] -->|"race effect on a pick"| ACT["sim/race/actions.ts"]
```

Everything the race does is a machine plus a driver, in the same shape as the rest of the sim:

- **Rivals** (`sim/race/rival.ts`) step once a week with a `WEEK` event that carries every die and the next model name, pre-rolled by the driver in a fixed order, so a rival transition never draws a random number. Personality (`content/rivals.ts`: cadence, growth, openness, poaching, hype-hunger) is data in the machine's context. A lab with cadence under two weeks never leaves `releasing`; a slow one takes a press-tour `cooldown`. Open weights: labs in the middle flip-flop (a lab that just went open is likelier to close up again). Era aggression (`content/eras.ts`) scales release size and shortens runs, and a rubber band (`chase`, the square root of how far ahead you are) keeps the race close: labs far behind you catch up faster, labs far ahead ease off.
- **The R&D multiplier** (`sim/race/rd.ts`) is the spec's formula with `agentSkill = capability / 8`, using the capability the lab has *shipped plus the part of the next release training has already delivered*, so the number creeps up all through a run and an era can start mid-run. It multiplies training progress (`sim/training.ts`) and, from Era 2, makes each release a bigger leap: `(mult / 2) ^ 0.75`, capped at 4x. That is what turns "training gets faster" into a takeoff.
- **Eras** are a ratchet (`sim/race/era.ts`): they only climb, so building a hall (more researchers, a lower multiplier) never shows a title card twice. Each era brings a full-screen card (an ordinary event card whose `kind` is `era`), agent looks (hard hats, halos, size and glow, in `render/Walkers.tsx`), its own thought and headline pools (`content/raceThoughts.ts`, `content/raceNews.ts`), shorter event cooldowns (the arc machine's `DAY` event gained `pace`) and more aggressive rivals.
- **Cards are data.** The driver sets an `offer:*` flag when a card is due and the card's choices clear it; the existing arc machines queue and open them one at a time. `content/events.ts` gained one effect, `{ type: "race", action }`, whose handlers live in `sim/race/actions.ts`. The open-weights card opens a day after the drop, so the Arena shuffles and the screen shakes first.
- **Buildings:** Datacenter (4x4, +60 compute a day) needs a Gas Turbine or Solar Farm each, and all three stay locked (`BuildingDef.locked`) until a compute auction is won; the win places a free Datacenter (or leaves a voucher when the campus has no room).

### Numbers (1-vCPU Modal box)

| Measurement | Result |
|---|---|
| `weekly()`: six rival transitions, Arena re-rank, headlines | about 0.2 ms, once every 140 ticks |
| `dailyRace` on an ordinary day; `rdMultiplier`; the HUD's `raceView` | 13 us; 0.1 us at 40 walkers; 3 us |
| The 500-walker perf test | unchanged within noise (0.23 to 0.28 ms; the budget stays 0.3, doubled under `CI`) |
| A scripted player (`sim/playthrough.test.ts`, three seeds) | Era 2 around day 70 to 100, Era 3 and the win around day 450, first #1 around day 100 then back to #5 or #6, Era 4 around day 1000 |

Debug scenes: `?moment=shuffle` (you are #1, a week turns, three labs pass you and a free model drops), `?moment=era`, `?moment=era3`, `?moment=auction` and `?moment=funding` stage the game about a second before the thing happens (`sim/race/demo.ts`); `scripts/race-shots.mjs` drives the same moments for screenshots.

Test files now run one at a time (`fileParallelism: false` in `vite.config.ts`): on a 1-vCPU box the wall-clock perf tests were measuring their neighbours.

## Operations (FLT-10): staff, slop, breakdowns, queues

```mermaid
flowchart LR
  A["drifted agents<br/>(drift > 0.6)"] -->|"1 drop per 7-21 ticks"| S[("world.slop<br/>0..3 a tile")]
  S -->|"share of path tiles"| V["Vibes: cleanliness (15%)<br/>headline at 20%"]
  S -->|"standing in it: mess 0..1"| H["happiness -0.08 at most<br/>'This path is covered in slop.'"]
  J["Janitor Bot<br/>(staff machine)"] -->|"walks to the nearest puddle, mops it"| S
  B["dailyBreakdowns<br/>reliability -0.5%/day<br/>chance = (1-r) x use x 0.2"] -->|"building.broken"| F["no compute, training or revenue;<br/>nobody goes in; fire, smoke, alarm"]
  R["SRE (staff machine)"] -->|"runs to it, fixes it in 2-4 hours: r = 0.9"| F
  C["no SRE for 5 days"] -->|"contractor: -$60K, r = 0.8"| F
  Q["full building"] -->|"QUEUED"| L["a line on the path:<br/>two tiles of it per person, FIFO,<br/>patience -> GAVE_UP"]
  P["Comms Rep"] -->|"-2 discourse a day each while there are protesters"| D["Water Discourse"]
```

- **Staff** (`sim/staff.ts`, `sim/machines/staff.ts`, `content/staff.ts`) are `state.staff`, not walkers: each has a position, a route, a task and a painted patrol zone (tile indices; empty means the whole campus) and one machine. The driver looks for work every 3 ticks while they are `idle` (the nearest slopped tile, broken building or protester, in the zone, not claimed by a colleague), sends `TASK`, walks them there (`going`), sends `ARRIVED`, works for a few ticks (`working`), does the world work (`finish`) and sends `DONE`. `hire`, `fire`, `paintZone` and `clearZone` are commands; salaries are part of the daily expenses; nothing in staff draws a random number except where a patrol picks a tile. Security walks the fence (`FENCE` waypoints) and is the hook FLT-5's escaped agents look for (`guardsOn`).
- **Slop** (`sim/slop.ts`): `world.slop` is a level (0 to 3) per grid tile. `dropSlop`/`messTick` run inside the walker loop (a second pass over 800 walkers cost more than the arithmetic itself). Mess is a smooth 0..1 exposure, not a flag: the daily mood check reads happiness at midnight, and an on/off flag flipped whole crowds between slumped and content from one day to the next.
- **Breakdowns** (`sim/breakdowns.ts`): `Building` gained `reliability`, `broken` and `brokenTick`. A broken building is skipped by `reachableBuildings` (nobody goes in; anyone inside is thrown out on the next `version`), makes no compute (`computePerDay`, `powerOf`), trains nothing (`dailyTraining`) and earns nothing (`dailyEconomy`). `state.version` is bumped on break and repair, so the walkers re-plan.
- **Queues** (`sim/queues.ts`, `sim/walkers.ts`): a full building's doorstep forms a line on the path tiles leading away from the entrance (`chainFor` walks straight on, then turns), one person every `SLOT_SPACING` (0.66 tile) along it. Admission is FIFO across a building's lines; walkers walking up to a building with a line stop at its tail; only the front of a line longer than the path ever shuffles (the rest share the last place). The 800-walker test has 300 researchers fighting for three small buildings, so this is the expensive case.
- **Debug scenes:** `?moment=ops` (the screenshot moment: slop, a Janitor Bot, a cluster on fire, an SRE jogging toward it, the status page), `?moment=queue` and `?moment=slop` (`sim/opsDemo.ts`); `scripts/ops-shots.mjs` drives them for screenshots, including the phone HUD.

### The UI side

- The **Staff panel** (`ui/ops/Staff.tsx`) opens from the last tile of the build palette and is not part of the right-hand column. **Painting a zone** is app state (`zone` in the app machine, `SET_ZONE`): while it is set, a left drag on the map paints tiles into that staffer's zone (or erases, if it started on a painted tile), and `Placement`, `Pick` and the camera rig treat it like a build tool.
- **Toasts:** the HUD shows one at a time, the newest winning; the same words twice are one toast; the standing hints ("Build an API Gateway...") stand down when a toast has said it. Every player command now publishes the HUD snapshot on the very next frame.
- **Thought bubbles** (`render/bubbles.ts`, `render/overlay.tsx`): at most three on screen, the closest to the camera win, and bubbles whose screen rectangles overlap are nudged up until they clear.
- **Phone compact mode** (`ui/useCompact.ts`, `ui/compact.css`, at 640 px and narrower): the top bar is one row (Vibes, cash, runway; a caret opens the rest), Objectives and Thoughts are icon buttons that open over the map, and the inspector is a short bottom sheet (name, the most urgent need, the thought; swipe up or tap the handle for more, swipe down to fold it and again to close it).
- **Sound:** `audio/world.ts` reads the real era (`eraOfState`) and the buildings' `broken` flag, so the era sting and the music key change fire, and the breakdown alarm plays for every new fire (`soundCues` is the pure diff, tested).

### Numbers (1-vCPU Modal box)

| Measurement | Result |
|---|---|
| 800+ walker tick (the FLT-8 stress test: 400 fully drifted agents, 300 researchers, 110 visitors, 40 protesters) | **0.36 - 0.51 ms** over 12 runs, against 0.30 - 0.35 on main measured the same way (budget 0.5, doubled under `CI`). It got the same treatment from the test: an event card had frozen the clock (`tick` stands still while a card is open), so the old version of this test was measuring nothing; it now answers every card and checks that days passed. |
| 500-walker tick | 0.13 ms (unchanged) |
| `updateStaff` with 10 staff, `dailyBreakdowns`, `opsView` (the HUD's 5 Hz snapshot part), `slopStats` | 5 us, 12 us, 24 us, 1 us |
| A scripted player (`sim/playthrough.test.ts`, which now hires staff) | Era 2 around day 70, Era 3 and the win around day 470 to 520, Era 4 around day 1060 to 1110 (about 60 days later than before: repairs, slop and salaries are not free) |

Determinism: the goldens (`sim/golden.test.ts`) were re-recorded on purpose: every building draws a breakdown die each day, and the script now hires a few staff and paints a zone, so the digests also cover slop, the payroll and every building's reliability.


## The 2D UI is skinned (FLT-14)

```mermaid
flowchart LR
  A["app actor<br/>(snapshot ~5 Hz)"] --> S["useAppSource<br/>(re-renders only when a piece changed)"]
  U["UI atoms: photo, news room,<br/>mixer, skin picker, staff panel"] --> H
  S --> H["hudViewModel(input)<br/>pure, unit-tested"]
  H -->|"HudVM (plain JSON)"| L["active skin's slots<br/>Layout + 25 components"]
  L -->|"HudActions"| G["send(app, event) / atoms"]
  R["skins/registry.ts<br/>import.meta.glob: skin.json, skin.css,<br/>slots.tsx, fonts (lazy)"] --> L
```

- **`src/ui/hud/vm.ts`** is the seam between the game and its skins: one pure function from the snapshot (and a little UI state) to `HudVM`. `src/ui/hud/types.ts` is the contract; it imports nothing from the game. Skins render `vm` and call `actions`; they cannot reach the sim, the store or three (`skins.test.tsx` fails on such an import).
- **The host** (`HudHost.tsx`, `tree.tsx`) subscribes once (`useAppSource`), builds the view-model, and renders the skin's `Layout` with the docked slots pre-rendered, plus the modal slots and the thought bubbles. The hotkeys, the photo-mode keys, the news desk and the chat playback live in `useHudEffects.ts`, so every skin gets them and none can get them wrong.
- **Skins** (`src/skins/<id>/`): `skin.json` (tokens, strings, fonts, the slots it replaces) validated by an Effect Schema, `skin.css` scoped under `[data-skin="<id>"]`, an optional `slots.tsx`. The registry loads only the active skin's files and switches live; a refused skin falls back to Frontier 95, then to the base (`docs/SKINS.md`).
- **The base skin** (`src/skins/base/`) is the previous HUD, moved and made to render from `vm` + `actions`: every slot has a default, and `base.css` reads tokens (`--flt-*`), so the five token-only skins are a `skin.json` and a little CSS.

Measured on the 1-vCPU Modal box (software-rendered WebGL, so about 8 frames per second):

| Measurement | Result |
|---|---|
| `hudViewModel` on a 60-day campus | well under 1 ms per call (asserted in `vm.test.ts`); one call per snapshot, about every 200 ms |
| HUD renders while the game runs at 1× | about 3.5 per second (one per snapshot publish) while 7 to 9 frames a second are drawn, so nothing re-renders per frame. `useAtomSuspense` would have re-rendered the tree on every machine snapshot (about 12 per second here); the host compares the pieces instead |
| Phone (390×844), nothing open, default hints showing | campus unobstructed: main 61.6%, Frontier 95 57.0% (`scripts/skin-shots.mjs --only e --measure`) |
| Skin assets | only the active skin's CSS, slots and fonts load; a skin's fonts are 8 to 100 KB of woff2 |

Determinism and the sim are untouched: the only `src/sim/**` change is one read-only helper (`trainingEtaDays`, for the copy dialog's "about 18 days remaining"), and the golden and perf tests are unchanged and green.

### The guided opening and the pause, in the UI (FLT-29)

FLT-16 decides *when* the tutorial speaks and when time is held; FLT-29 is everything the player sees of it, and it lives in the skin system, not beside it.

- **The view-model** (`hudViewModel`) gained `assistant` (the current step: `message`, `highlight` target, `number` of `total`, `paused` while the game waits for **Next**, `waitingForBuild` while only the first build is left, `canSkip`; `null` once done or skipped) and `pause` (`paused`, `reason`, `auto`). The reason comes from `pauseReasonOf(context)` in `app/machine.ts`: a card beats the pause button, which beats the automatic holds (`tutorial`, `build`, `menu`, `inspector`). `pause.auto` is what a skin shows a gentle "Paused" for; a card says it itself, and the pause button already shows it is pressed.
- **Actions**: `continueTutorial()`, `skipTutorial()` (the same commands FLT-16 defined) and `holdTime(id, open)`, which is `SET_OVERLAY`. Panels the host owns (the payroll, the mixer, the News Room, the phone Arena) hold time from `useHudEffects`; a slot's own phone sheets (Stats, Objectives, Thoughts) hold it through the kit's `useAutoPause(actions, id, open)`. That is FLT-16's wiring, ported from the deleted `HUD.tsx`/`Staff.tsx`/`Thoughts.tsx`/... into the slot system.
- **Highlights**: the host wraps `Docked` in a `HighlightProvider` carrying `vm.assistant.highlight`; a slot calls `useHighlight()` and gives the thing the `flt-hl` class. `base/tutorial.css` draws the pulsing ring from two tokens, `color.highlight` and `motion.pulse` (`motion.reduced.pulse` turns the pulse off and keeps the ring). Targets are `build:<tool>` (the tool, or in Frontier 95 the Start button until the menu is open, then the entry, and the quick-launch button), `staff:hire` (the Staff tile, then the Hire buttons of the two starter jobs: `StaffJobVM.starter`) and `training` (the Training window). The ring stops when the tool is in hand.
- **The Assistant slot** delivers it. Frontier 95's paperclip puts the lesson, "Step N of 5", **Next** and **Skip tutorial** in its balloon, with any toast queued under the lesson; the base skin (so the five stub skins) draws a card above the build bar, centred, where it covers only campus. On a phone the base stacks toasts, the card and the build bar at the bottom, and Frontier 95's balloon sits above the taskbar.
- **The Paused indicator** is part of the `Speed` slot (`pause` is one of its props): a pill under the speed buttons in the base, a breathing tray icon in Frontier 95.
- **Frontier 95's right column is a managed stack** (`skins/frontier-95/stack.tsx`). Windows tile down `.f95-right`; the column shares its height with the news arrival and the paperclip, so a balloon can never sit on a window, and a `ResizeObserver` folds the window that has been open longest whenever they no longer fit (never the newest one). On a phone the column dissolves (`display: contents`) and the windows keep their sheets.
- **Calm by default**: while the tutorial is up, the Arena starts folded (`arenaOpenByDefault(tutorialUp)`; it opens by itself when the tutorial ends, or when you drop a place) and the "no Training Hall" reminder waits for the hall step.

Evidence scripts: `scripts/tutorial-shots.mjs` drives a real ten-minute first run through the UI only (`docs/evidence/FLT-29-sequence/`).
