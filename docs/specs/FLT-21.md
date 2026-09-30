# FLT-21: The Hearing: senate minigame (Jev free-text later)

Copied from the task tracker (FLT-21) so the PR carries its spec.

**The Hearing: a senate hearing minigame.**
- Three **fictional** senators, each with a capsule portrait and a name plate, ask absurd questions ("Is the AI in the cloud or in the computer?", "Will it take my job, and can it also do my taxes?").
- Each question gets three answers: earnest, slick or chaotic. They move two meters: **Trust** and **Capture**.
- Triggered by scandals, disasters, era changes and audit results.
- **Jev mode (later, when Jem provides a key):** the player *types* an answer, and Jev (TypeSafe) scores it from evasive to honest via a tiny Worker endpoint in the FLT-12 Alchemy stack, keeping the key server-side. The score enters the sim as a recorded command, and multiple choice stays as the offline fallback.
- **Pack:** `mods/base-hearing/`.
- **Done when:** a hearing plays end to end, the meters feed Regulatory Capture (FLT-22), and there are screenshots and a preview link.

---
**How every Circus mechanic is built (shared rules):**
- **Standalone:** each mechanic works and ships on its own and can be toggled off. It's a **built-in content pack** in the FLT-15 mod format (`mods/base-<name>/mod.json`: JSON statecharts plus data), compiled to a Layer like any mod. The game's own satire therefore doubles as the modding examples.
- **Engine vs. content:** the engine adds only **generic verbs** to the `Vocabulary` service (e.g. `staff.divert`, `compute.drain`, `cost.spike`, `building.offline`, `visitors.arrive`, `investigate.start`, `trust.delta`, `heat.delta`, `camera.focus`, `sound.cue`, `news`, `card`) and generic systems. Everything specific to the mechanic (names, numbers, jokes, timing) lives in the pack.
- **Determinism:** statecharts are stepped purely in the tick, with the same seed, mods and commands giving the same game. Tests use `xstate/graph` reachability plus a headless 365-day run with the pack on.
- **Parody only:** no real companies, orgs or people.
- **UI through FLT-14 skin slots,** so every skin can dress it (Frontier 95 shows disasters as error dialogs, and so on). Add any new slot to the slot list and `docs/SKINS.md`.
- **Depends on:** FLT-15 M1 (mod format and loader) and FLT-10 (staff, breakdowns). Builders: Sonnet 5.5 or Codex Sol 6.1 on Modal, per the lead.
