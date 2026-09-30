# FLT-10: Operations: staff, slop, breakdowns, queues

**Slice 2 · Operations · Sonnet 5.5 builder · starts after FLT-8 merges**

**Screenshot moment:** a path ankle-deep in glittering grey **slop**, a lone Janitor Bot mopping, and a Compute Cluster on fire with an SRE jogging toward it, while the ticker reads "Status page: all systems operational."

**Build (machines per the architecture spec)**
- **Slop (RCT litter):**
  - Agents with `drift > 0.6` drop slop on the path tile they're on (about 1 per 8 game hours each). Levels 1–3 per tile, drawn as grey puddles with a ✨ sparkle.
  - Walking through slop lowers happiness: "This path is covered in slop."
  - Cleanliness feeds Vibes, replacing the FLT-8 stub.
  - Above 20% of path tiles slopped: "{lab} campus now {pct}% slop by volume."
- **Staff** (a Staff panel with hire and fire buttons; salaries are daily; each staffer is a walker with a machine and an optional painted **patrol zone**, RCT-style):
  - **Janitor Bot** $2K/day: cleans slop.
  - **SRE** $4K/day: walks to broken buildings and fixes them in 2–4 game hours.
  - **Comms Rep** $3K/day: walks to protesters and hands out tote bags. Discourse −2/day each while protesters are present.
  - **Security** $3K/day: patrols the fence. It's the hook for catching escaped agents in FLT-5.
- **Breakdowns:**
  - Buildings have reliability that starts at 100% and loses 0.5%/day. Daily breakdown chance = `(1 − reliability) × utilisation × 0.2`.
  - A broken building stops working and shows smoke and sparks.
  - A cluster fire brings the headline "GPU fire contained; GPUs less so."
  - A gateway outage stops revenue, and the ticker runs the status-page joke.
  - A repair restores reliability to 90%.
- **Queues:**
  - Capacity per building: Kombucha 4, Nap Pods 6, Snack Wall 3, Demo Stage 12.
  - Walkers form a **visible line** on the path next to the entrance. They leave when patience runs out: "This queue is longer than our context window."

**Done when:** `pnpm check` is green; tests cover slop drop and clean, breakdown and repair, queue join and leave, and patrol zones. The PR has screenshots of the moment above plus a phone shot, and a preview link posted here.

**Carry-over polish from earlier reviews (do these too)**
- Day/night cycle: slow it from 10 to **30 game days** per cycle. The lamps currently flip too often.
- Toasts: dedupe hints that say the same thing ("Build an API Gateway…" and "Frontier-2 is out! Build an API Gateway to sell it" stack up). Show one at a time, with the newest winning.
- Night thoughts: add a `night` thought condition to the sim so FLT-6's `content/night.ts` lines flow through the normal thought system and the Thoughts panel (see that file's header).
- Thought bubbles: stop them overlapping. Nudge them vertically when their screen rects intersect, and keep at most 3 on screen with the closest to the camera winning.
- Phone HUD: on narrow screens the TopBar, the chips and the inspector cover about 80% of the map. Add a compact mode: the TopBar collapses to one row (Vibes, cash, runway; tap to expand), Objectives and Thoughts become icon buttons, and the inspector becomes a short bottom sheet (name, one need bar, thought; swipe up for more).
- Sound hooks (from FLT-7): adapt `src/audio/world.ts` to FLT-9's real era field so the era sting and the music key change fire, and set the building `broken`/`offline` flags from this slice's breakdowns so the breakdown alarm plays.
- The right column gets crowded on short screens (Arena, Thoughts, inspector). Leave the layout to FLT-14's design pass, but don't add new always-visible panels there.

