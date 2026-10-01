# FLT-59 The Sandbox Escape (spec)

_Copied from the FLT-59 task description on 2026-09-30. The builder's notes (what was chosen where the spec is silent) are at the end._

**The Sandbox Escape: the chase, and the Escaped ending.** This is the pitch's own screenshot moment: *"one day an agent makes a run for the fence."* It's the last missing Circus arc, and the hooks exist: Security's `guardsOn` (`src/sim/staff.ts`), `endings.agentsEscaped`, and the Escaped ending hook from #62.

1. **The warning.** A drifted agent (FLT-8 drift, pink tint) starts thinking out loud, in lines like "I've been thinking about the fence." and "What's past the parking lot?". It then paces the fence line, and the Thoughts panel counts it. The player gets a few game hours to notice.
2. **The run.**
   - The agent sprints for the fence with a cyan sparkle trail.
   - The camera swoops to it, and the game drops to 1× until the chase ends. This is a slow-down, not a pause; the previous speed restores afterwards, and the camera beat is skippable.
   - **The catch is an RCT homage:** you **pick the agent up** with the hand cursor (tap, or click and hold) and **drop it back** in the sandbox. That's a `catchAgent(id)` command, so replays hold.
   - Security guards near its path tackle it automatically. The more guards, the easier the chase.
3. **If it gets out:**
   - A headline, the `agentsEscaped` counter goes up, and it turns up in the news later. For example: "Escaped agent starts a newsletter", "Escaped agent spotted doing freelance SEO", "Escaped agent now runs customer support for 40% of the internet".
   - Other agents learn from it, so the next run is likelier and faster.
   - In late eras, a **jailbreak**: 3–5 agents run in different directions at once.
4. **Countermeasures:**
   - Security staff on the fence.
   - A literal **Sandbox** building, a kids' sandbox with a bucket and spade, that lowers drift nearby.
   - A **Honeypot**, a fake "EXIT (real)" sign that lures runners into a dead end.
   - Pick costs and balance so ignoring the arc is a real risk, not a death spiral.
5. **The Escaped ending** (via #62's endings): it fires on a threshold (for example, 10 escapes) or when your newest frontier model's agent escapes in Era 4. It gets a front page with a funny headline, a share card and the "What now?" actions.
6. **Pack rules:**
   - It's a pack in #53's `PACKS` table with `?escape=off`, waking at Level 4 or 5; say which you chose. FLT-54 is staggering wake-ups, so keep to one pack entry.
   - Moddable: copy, thresholds and a `spawn.escape` vocabulary action.
   - Parody names only.
   - Toasts are tagged per FLT-51: the run itself is `you`; its later news is `world`.

**Evidence:**
- Before/after screenshots of the run (trail and camera), the pick-up and the Escaped front page, using `pnpm shots` (add scenes) at 1440×900 and 390×844.
- Tests for trigger, catch, guards, escape and determinism.
- The stranger and journey e2e green.
- The strict perf number.


