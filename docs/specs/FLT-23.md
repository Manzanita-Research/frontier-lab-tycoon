# FLT-23: Promise Tracker: lying politicians

Copied from the task tracker (FLT-23) so the PR carries its spec.

**Promise Tracker: lying politicians.**
- A panel shows three **fictional** politicians, each with promises (from headlines), actual actions, and a **Truth-o-meter**.
- Your lobbyists can flip their votes.
- Example line: "Senator Blandsworth promises to ban the AI and invest in the AI, in the same sentence."
- Their votes affect the regulatory heat that feeds FLT-21 and FLT-22.
- **Pack:** `mods/base-promises/`.
- **Done when:** promises and actions diverge over a run, lobbying flips a vote, and there are screenshots and a preview link.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.

