# FLT-17: Disasters (SimCity-style acts of God)

_The spec, copied from the task description (Sep 30). Sim side only: the UI (Disasters menu, `DisasterAlert` skin slot) is a follow-up sub-task (FLT-32). What was built and where the spec was silent is in `docs/DISASTERS.md` and the PR._

**Disasters, SimCity "acts of God" style.** Event-driven disasters hit the lab, with a **Disasters menu** to trigger them on purpose and random ones scaled by risk. There are no physical escapes on the map; the damage shows through staff, compute, costs and buildings.

**Framework (build first):**
- **The disaster statechart:** a disaster is content, `warning → active → cleanup → aftermath`, with effects over time and a cleanup condition (staff-hours spent, a player choice, or a timer).
- **Engine verbs:**
  - `staff.divert(kind → building, fraction)`: walkers leave their posts and **jog** to the target with a red "!". Their posts go unstaffed: the gate isn't guarded, and breakdowns aren't repaired.
  - `compute.drain(pct/day)`, `cost.spike(×, days)`, `building.offline`, `building.fire`.
  - `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue` (FLT-7's alarm), plus shake (FLT-6).
- **A Security Office** building if FLT-10 didn't add one. It's where incident response happens.
- **The Disasters menu:** a list read from `Content.disasters`, so mods can add their own ("Kaiju", anyone?). Triggering asks for confirmation. A setting for random disasters: **Off / Rare / Normal / Chaos**, with frequency scaled by risk stats.
- **Skin slot `DisasterAlert`:** in Frontier 95 it's a Win95 error dialog; other skins dress it their own way.

**First wave (build these three):**
1. **Rogue Agent Swarm** (off-map): "An agent swarm is loose on the internet, and it's wearing your API key."
   - Compute drains 40%/day and API costs triple.
   - **All Security staff divert to the Security Office**, so the rest of the campus is understaffed until cleanup reaches 100% (progress = security staff-hours).
   - Aftermath: a postmortem headline, and the odds of an auditor visit (FLT-19) go up.
2. **GPU Fire:** one cluster burns. Smoke, and it spreads to an adjacent cluster if no SRE arrives within N hours. "GPU fire contained; GPUs less so."
3. **Weights Leak:** your latest model's weights turn up on a torrent. An open-weights rival jumps to your capability −10%, and hype drops. The card offers **Sue**, **Shrug**, or **"It was always going to be open"** (rebrand it as an open release, hype +).

**Second wave (specced; build if time allows):**
- **Viral Jailbreak:** gateway revenue dips while the meme spreads; patch it at the Safety Lab.
- **Datacenter Flood:** a datacenter goes offline, and the Water Discourse gets ironic.
- **Grid Brownout:** everything runs at 50%, with gas turbine vs. solar interplay.
- **Benchmark Contamination Scandal:** Arena scores invalidated. It's a different cause from collusion.

**Done when:**
- Each first-wave disaster can be triggered from the menu, plays through all its phases, and is cleaned up.
- Random mode fires them at the configured rate in a headless run.
- The pack is `mods/base-disasters/`.
- Screenshots: the menu, the swarm (with staff jogging to Security and empty posts), the GPU fire, the leak card, phone.
- A preview link is posted.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.

---
**Split by Jem's routing (Sep 30):**
- **This task, on Codex Sol 6.1: the sim side.** Machines, systems, verbs, balance, content as data and tests.
- **The UI is a Sonnet 5.5 sub-task** that follows once this merges.
- **Content format:** until FLT-15 M1b lands, author the content as plain data in the FLT-15 section shape (see `docs/MODDING.md`) under `mods/base-<name>/`, and load it directly. M1b will switch it to the loader, and that should be a mechanical change.
