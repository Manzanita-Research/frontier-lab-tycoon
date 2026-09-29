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
- `src/store.ts`: zustand. It owns the sim state and runs the loop, with speed pause/1×/3×/10×.
- Performance: 300+ walkers stay smooth on a laptop; instancing only, with no per-walker React components.

## Later (not now)

Eras and the intelligence explosion; safety versus capability; the Sandbox Escape chase; research tree; staff (SREs, janitor bots for slop, PR reps); scenario objectives; poaching; sound; and the ending where the superintelligence politely takes over running your park.
