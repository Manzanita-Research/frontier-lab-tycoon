# Frontier Lab Tycoon: roadmap

_Owned by the FLT lead (Opus 5.5 plans; Sonnet 5.5 builds). Each slice is an FLT task whose description is its spec. One or two builders run at a time, and each finishes before the next starts._

## North star

**A game people screenshot and send to friends.** RollerCoaster Tycoon, but you run a frontier AI lab, and by the end the park is running you.

The test for every feature: **does it make a moment worth a screenshot within 30 seconds?** That can be a thought bubble, a headline, a mob at the gate, an agent sprinting for the fence, or the front page when it all goes wrong.

## Five pillars

1. **The Crowd.** RCT-grade tiny people: named walkers with needs, moods and thoughts. There's a park rating (**Vibes, 0–999**), a "what people are thinking" list, slop on the paths, staff to hire, and buildings that break. Click anyone and learn their whole deal.
2. **The Race.** AI-2027 escalation, week by week. Rival labs are simulated competitors on a live leaderboard. Open-weight drops crash your prices; there are compute auctions and poaching wars. Eras change the rules: Stumbling Agents → Coding Automation → Superhuman Coder → Intelligence Explosion. The **R&D multiplier** is on screen, going up.
3. **The Circus.** Satire arcs as state machines: the Water Discourse (growing protests), the Sandbox Escape (a chase), the Hearing (fictional senators who ask whether it's "in the cloud or in the computer"), Regulatory Capture (you help write the bill), the Promise Tracker for lying politicians, a Collusion Scandal (the safety summit on a yacht, then the leaked group chat), and a Poaching War. **Parody names only**, punching at incentives, never at people or nationalities.
4. **The Juice.** Camera that swoops to the action, particles (confetti, GPU smoke, protest water droplets, agent sparkle trails), day/night with campus lights, odometer numbers, a synth sound kit, and a **tilt-shift photo mode** that makes the campus look like a real toy.
5. **The Front Page.** A weekly *Frontier Times* front page, a monthly "what just happened in AI" group chat (a skeptic, a doomer, an accelerationist and your mom), and five endings, each a shareable front page. The best one is **The Takeover**: you win the race and the AI politely starts playing the game for you.

## Slices, in order

| # | Task | Slice | Builders | Why now |
|---|---|---|---|---|
| 0 | FLT-4 | **Foundation**: port to XState v6 + Effect v4 | 1 (running) | Everything else is machines on this |
| 1 | FLT-8 | **The Crowd**: named walkers, needs, Vibes 0–999, inspector, thoughts list | 1 | The RCT heart; everything reads Vibes |
| 1 | FLT-6 | **Juice I**: camera director, particles, day/night, photo mode, odometers | 1 | Render-only, parallel-safe with FLT-8 |
| 2 | FLT-10 | **Operations**: staff, slop, breakdowns, queues | 1 | Gives the crowd problems to solve |
| 2 | FLT-9 | **The Race**: rivals, leaderboard, eras, R&D multiplier, open weights, compute auction | 1 | Pressure and pacing for a 45-minute run |
| 3 | FLT-5 | **The Circus**: Sandbox Escape chase, Hearing, Capture, Promise Tracker, Collusion, Poaching; Jev Worker API follows static hosting | 1 | The jokes people send |
| 3 | FLT-7 | **Sound + News Room**: synth kit, Frontier Times, group-chat recap | 1 | The news cycle as content |
| 4 | FLT-11 | **Endings + Share**: five endings, front-page share card, daily seed | 1 | The screenshot people send |
| any | FLT-12 | **Public link** (ship): [public Worker](https://flt-prod.manzanita.workers.dev), Alchemy deployment from GitHub, PR previews and cleanup | 1, done | Friends can play without bb |

FLT-3 (the first playable) closes when slice 2's PR (#4) merges.

## Rules for every slice

- Specs live in the task description. The builder copies it to `docs/specs/<task>.md` in its PR.
- **Parody names only.** Every line should land on first read, and short beats long.
- Sim logic is XState machines stepped purely inside the tick; Effect runs the app (see `docs/specs/architecture-xstate-effect.md`). Deterministic tests, a perf budget, `pnpm check` green.
- Evidence in every PR: screenshots at 1440×900 and 390×844, test output, and a `bb connect expose` link posted on the task. Builders never merge their own PR.
