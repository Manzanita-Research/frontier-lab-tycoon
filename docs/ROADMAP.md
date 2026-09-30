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

## Where we are (updated Sep 30)

**Shipped and live** at https://flt-prod.manzanita.workers.dev (deploys on every merge):
- the first playable and slice 2 (FLT-3)
- the XState + Effect port (FLT-4)
- Juice I (FLT-6)
- The Crowd (FLT-8)
- The Race (FLT-9)
- Sound + News Room (FLT-7)
- the public link (FLT-12)

The FLT-13 Fal 3D experiment is done; its recommendation is hybrid, and rolling it out is Jem's call.

## Next, in order

| # | Task | What | Notes |
|---|---|---|---|
| now | FLT-10 | **Operations**: staff, slop, breakdowns, queues | building |
| now | FLT-14 | **Skin system** + **Frontier 95** default skin; then 5 more skins (Swag Drop, Karaoke Night, Field Almanac, Discovery Disc '96, GeoCities) | Jem approves before merge; the ports run on Codex Sol |
| next | FLT-16 | **First-run + pacing**: calm start, RCT-style visitor growth, guided opening | urgent; Jem plays it before merge |
| then | FLT-15 | **Agent-native modding**: every extension point is an Effect service, every mod a Layer; `?mod=` links; `flt-mod check`; a mod-authoring skill | M1 after the FLT-14 skin format |
| then | FLT-27 | **Release Leapfrog**, the heartbeat of The Race: rival drops on a relentless paired cadence, a live parody benchmark leaderboard, "ship now at 94% or lose the news cycle", share-of-voice, livestream chaos, benchmark saturation | first after the bones |
| then | FLT-5 | **The Circus**, 10 standalone mechanics, each a built-in content pack (mod example) | see below |
| then | FLT-28 | **Publishing Papers**: open vs. closed trade-off, arXive drops with "…Is All You Need" titles, citations, getting scooped the day before, best-paper awards | alongside the Circus |
| later | FLT-11 | **Endings + share card + daily seed** | |

**The Circus (FLT-5 sub-tasks):**
- FLT-17 Disasters (SimCity-style menu; Rogue Agent Swarm, GPU Fire, Weights Leak)
- FLT-18 Agent Collusion ("the Swarm")
- FLT-19 External Auditors ("Evals Without Borders")
- FLT-20 Poaching War
- FLT-21 The Hearing (Jev later)
- FLT-22 Regulatory Capture
- FLT-23 Promise Tracker
- FLT-24 Corporate Collusion (the yacht)
- FLT-25 Protests grow
- FLT-26 **Defection**: top researchers spin out a rival lab

## Open questions (Jem's design notes; bones first, decide later)

1. **A cute homage to RollerCoaster Tycoon.** Jem loves RCT. Welcome RCT touches wherever they fit naturally: park-rating feel, guest thoughts, queues, handymen, the finance chart, awards and scenario goals. Don't force them in.
2. **Not everything is a human walking between buildings.**
   - Walkers make sense for **visitors** (users, protesters, journalists, VCs, auditors) and **employees**.
   - Other things in an AI lab may read better another way. **Agents, compute, data, tokens and models** could be abstract flows (particles along paths or cables), sprites or icons on buildings, meters, or not on the map at all.
   - This is undecided. Today agents are walkers; that may change.

**Standing rule until these are decided:** keep the entity model flexible. Don't assume every actor is a walker. A thing in the world should have a `presentation` (e.g. `walker | flow | sprite | offmap`) that is separate from its sim logic, so changing how agents or compute are *shown* doesn't touch the rules. New mechanics describe effects on entities and stats, not on "walkers" specifically, unless they really are people on foot.

## Rules for every slice

- **Don't assume every actor is a walker** (see Open questions): keep presentation separate from sim logic.
- Specs live in the task description. The builder copies it to `docs/specs/<task>.md` in its PR.
- **Parody names only.** Every line should land on first read, and short beats long.
- Sim logic is XState machines stepped purely inside the tick; Effect runs the app (see `docs/specs/architecture-xstate-effect.md`). Deterministic tests, a perf budget, `pnpm check` green.
- Evidence in every PR: screenshots at 1440×900 and 390×844, test output, and a `bb connect expose` link posted on the task. Builders never merge their own PR.
