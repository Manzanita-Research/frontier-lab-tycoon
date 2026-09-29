# Spec: first playable slice (FLT-3)

_Written by the FLT lead (Opus 5.5) for one Sonnet 5.5 builder. Read `docs/DESIGN.md` first; it's one page._

**Goal:** someone opens the link and, within 30 seconds, sees a tiny living campus: little researchers and glowing agents walking paths, a training run filling up, money ticking, and a news ticker that makes them smile. They place 2–3 buildings and see the world react.

**Out of scope for now:** sound, event cards with choices, eras, research tree, staff, save/load, the Sandbox Escape chase. Don't build these; leave room for them.

## Starting state (so it's alive at second 0)

The grid is 24×24. The **gate** sits at the middle of the south edge, with a path running north from it plus a short cross path. Already placed and connected: one **Compute Cluster**, one **Training Hall** with run #1 about 40% done, and one **Kombucha Bar**. There are 6 researchers and 5 agents walking about. Cash is **$5,000,000**. The lab gets a random parody name from `names.ts` ("Emergent Behavior Inc."), shown on the gate and the top bar. A first hint toast: **"Build an API Gateway next to a path to start earning."**

## Sim: `src/sim/` (pure TS; see DESIGN.md rules)

Delete `src/sim/contracts.ts`. It's output from the discarded run. Keep `rng.ts`.

| File | What it does |
|---|---|
| `types.ts` | `GameState`: `seed`, `rngState`, `tick`, `day` (int), `cash`, `capability`, `compute` (stockpile), `hype` (0–100), `labName`, `grid {w,h,paths:boolean[]}`, `buildings[]`, `walkers[]`, `training {run, progress, cost}`, `models[]` (released names), `news[]` (last 50 `{day,text,tone}`), `thoughts[]` (active, ≤3), `pops[]` (money pops this day, for render), `version` (bumps when grid/buildings change), `nextId`. Everything plain and JSON-serializable. |
| `commands.ts` | `Command = placePath(x,z) \| placeBuilding(kind,x,z) \| bulldoze(x,z) \| startTraining()`. `canPlace(state,kind,x,z) → {ok} \| {ok:false, reason}`. Rules: in bounds, no overlap with buildings, paths or the gate, and a building must have at least one path tile touching an edge of its footprint. Enough cash. Bulldozing refunds 50%. |
| `pathfind.ts` | BFS over path tiles, 4-neighbour. Each building's entrances are the path tiles touching its footprint. Cache reachability per `state.version`. A building no one can reach gets no visitors. |
| `walkers.ts` | `Walker {id, kind:'researcher'\|'agent'\|'visitor', x, z, route:[x,z][], targetId, mode:'walk'\|'inside'\|'leave', timer, energy}`. Walk along `route` at 0.12 tiles/tick. On arrival, go "inside" (hidden) for 1–3 game hours, then pick the next target. **Researchers** head to the Kombucha Bar when `energy < 0.3`, which refills energy, and otherwise alternate between the Training Hall and Cluster. **Agents** hop between random buildings, and their target count is `4 + floor(capability / 3)` (cap 300). **Visitors** spawn at the gate at a rate that scales with hype, tour 1–2 buildings, then walk out the gate and despawn. |
| `economy.ts` | Runs once per game day. Upkeep and salaries (researcher $1,000/day) come out of cash. Revenue per API Gateway per day = `capability × $1,500`, but only if the gateway is reachable. Push a `pop` for each earning gateway. Hype drifts toward 30 by 1/day. Hype +1 per new building kind (first time only). |
| `training.ts` | Each day, clusters add 10 compute each. The training run consumes up to 25 compute/day into `progress`. When `progress ≥ cost`, the run completes: `capability += 12 + 4 × run`, hype +15, the model gets a name from `names.ts`, a celebratory headline and a toast fire, and the next run starts automatically with `cost × 1.6`. Run 1 cost is 300 compute (≈30 days with one cluster). No training hall means no training. |
| `thoughts.ts` / `news.ts` | Each day, maybe give 1 walker a thought (≤3 active, each lasts 2 game days). Pick lines from `content/thoughts.ts` by kind and **condition** (`noKombucha`, `lowCash`, `training`, `justReleased`, `highHype`, `unreachable`, `crowded`, `always`). News works the same way: triggered by events (first building of a kind, run started, run done, cash < $1M, hype > 70, a rival release every ~12–20 days, random filler every ~6 days). Fill templates `{lab}`, `{model}`, `{rival}`, `{cash}`. |
| `tick.ts` | `TICKS_PER_DAY = 20`. `tick(state, commands)`: apply commands, move walkers every tick, and run the daily systems on day boundaries. It mutates in place. |
| `state.ts` | `createInitialState(seed)` builds the starting state above. |
| `*.test.ts` | Cover placement rules, BFS reachability, one economy day, a training run that completes and raises capability, and determinism (same seed and commands give a deep-equal state after 2,000 ticks). |

Tune the numbers so that with one Cluster, Hall and Gateway, cash dips for the first ~minute and recovers after run #1. Runway should feel like pressure, never like a wall.

## Content: `src/content/` (data only)

- `buildings.ts`: `kind, name, size [w,d], price, upkeepPerDay, blurb, color`.
  - Compute Cluster 2×2, $600K, $8K/day: *"Converts electricity and venture capital into heat."*
  - Training Hall 3×3, $900K, $5K/day: *"Where the loss goes down and the valuation goes up."*
  - API Gateway 2×2, $400K, $3K/day: *"Sells tokens by the million, at a loss by the billion."*
  - Kombucha Bar 1×1, $120K, $1K/day: *"Fermented morale."*
  - Path tile: $10K.
  - Gate: fixed, not buildable.
- `headlines.ts` (≥ 40), `thoughts.ts` (≥ 40 across all three kinds), `names.ts` (a model-name generator, ≥ 6 parody rivals, lab names). Match this tone:
  - Headline: "{rival} releases open-weights model that matches {model}; your investors 'just have a few questions'"
  - Headline: "{lab} pledges to be carbon neutral by the heat death of the universe"
  - Headline: "Senator asks whether {model} is 'in the cloud or in the computer'"
  - Headline: "{lab} valuation rises 40% on news that it exists"
  - Researcher: "I'd leave for $100M. Asking for a friend."
  - Researcher (noKombucha): "No kombucha. Updating my LinkedIn."
  - Agent: "Task complete. Also I did four other tasks nobody asked for."
  - Agent (unreachable): "There is no path. I have written a 40-page memo about it."
  - Visitor: "The demo was pre-recorded, right? Right?"
  - Model names: "Frontier-2", then "Frontier-2.5-Reasoner", then "Frontier-3-Mini-Pro-Preview-0925".
  - Rivals: parody only (e.g. "Anthropomorphic", "Open-ish AI", "MetaMeta Superintelligence Labs", "Very Safe Superintelligence Inc.", "Sirocco", "Macrohard"). Never real people or nationalities.

## Render: `src/render/` (R3F + drei, no asset files)

- `Scene.tsx`: an orthographic isometric camera, with `MapControls` for pan and zoom (mouse, trackpad and touch; clamp the zoom), and Q/E to rotate 90° with a short ease.
- `Ground.tsx`: a soft green grass board with a faint tile checker. Paths are raised cream slabs that auto-join visually (a flat slab per tile is fine).
- `buildings/*.tsx`: one procedural low-poly model per kind, each with a distinct silhouette. The Cluster is stacked racks with blinking LEDs and a spinning fan. The Training Hall is a dome with a **glowing ring that fills with training progress**. The API Gateway is an arch or portal with a glowing sign. The Kombucha Bar is a kiosk with a striped awning and a giant bottle. The Gate is an arch showing the lab name (drei `Text`). Squash-and-stretch on placement.
- `Walkers.tsx`: **one `InstancedMesh` per walker kind**, with positions updated in `useFrame` straight from sim state (interpolating between ticks) plus a small walk bob. Researchers are capsules in 5 hoodie colours with skin-tone heads. Agents are little rounded boxes with an **emissive cyan** visor. Visitors wear suits (grey or navy).
- `Bubbles.tsx`: drei `Html` thought bubbles over the ≤3 walkers with active thoughts. `Pops.tsx`: "+$15K" floats up from gateways and fades.
- `Placement.tsx`: a ghost of the selected building follows the pointer, tinted green or red, and shows the `canPlace` reason on hover. Click or tap to place, and drag to paint paths.
- Lighting: a warm directional sun with soft shadows, plus a hemisphere light. Background is sky blue fading to lighter near the horizon.

## UI: `src/ui/` (DOM over the canvas)

- **TopBar**: lab name · date ("Y1 · Mar 4", 30-day months) · cash with the daily change (green/red) · runway in months (red under 6) · Capability · Hype.
- **BuildBar** (bottom): Path, Compute Cluster, Training Hall, API Gateway, Kombucha Bar, Bulldoze, each with an icon, price and hotkey (1–6), disabled when you can't afford it. Esc cancels. On a phone it scrolls horizontally.
- **Training chip**: "Training Frontier-2 · 64%" with a bar.
- **SpeedControl**: pause, 1×, 3× and 10×. Space toggles pause.
- **Ticker**: an endless marquee of `news` along the very bottom, coloured by tone.
- **Toasts**: for model releases, hints and "can't afford".
- Style: warm, chunky and toy-like (rounded corners, cream panels, a thick dark outline, a soft drop shadow), using the system rounded font already in `index.css`. Keep everything readable over the bright scene. It must work at 1440×900 and at 390×844.
- `src/store.ts`: a zustand store holding the sim state, a command queue and the speed. A `requestAnimationFrame` loop runs 10 ticks per real second at 1× (so 2 s per game day). The UI reads a snapshot throttled to ~5 Hz.

## Done when

1. `pnpm check` passes, with the tests above.
2. At 1×, run #1 completes within ~60 s of load. Placing a Gateway makes money visibly pop. 150+ walkers render without stutter on a laptop.
3. You played it yourself for 5 minutes and fixed anything confusing or dead.
4. **Evidence:** a PR from `flt-3-first-playable` with 3 screenshots (the 1440×900 overview, a zoomed-in shot with thought bubbles, and a 390×844 phone shot) plus the test output. Then leave `pnpm build && pnpm preview` running, run `bb connect expose 4173`, and post the link plus the screenshots as a comment on **FLT-3**.
