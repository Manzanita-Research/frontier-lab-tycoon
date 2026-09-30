# FLT-24: Corporate Collusion: the yacht summit

Copied from the task tracker (FLT-24) so the PR carries its spec.

**Corporate Collusion: the yacht summit.** A small mechanic.
- An invitation to a "Voluntary Safety Summit" on a yacht: sign non-binding commitments (hype +).
- Thirty days later a **leaked group chat** (shown in the chat UI) reveals the labs coordinating salary caps.
- Choose **deny**, **apologise** or **blame the yacht**.
- It links to price-fixing jokes in the ticker.
- **Pack:** `mods/base-yacht/`.
- **Done when:** the arc plays end to end, and there are screenshots and a preview link.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.
