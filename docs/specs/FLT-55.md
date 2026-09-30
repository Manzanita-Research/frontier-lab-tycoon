# FLT-55: Mods M1c, mod skins, assets, audio and walker looks, live by link

_Task spec as assigned (the task says explore; the brief asks for a PR into `main`, stacked on the train #60, not merged). Pinned here for the PR._

**Mods M1c: mod skins, assets, audio and walker looks, live by link** (FLT-15 follow-up to #53).

**Why:** the modding acceptance test in `docs/MODDING.md` is *"make me a Frontier Lab Tycoon mod where the protesters are all golden retrievers"*, with a link that opens the game with that mod loaded. After #53, `?mod=` applies content and arcs, but a mod's **skin, assets and audio aren't applied**, and a mod **can't change how walkers look**. So the headline example can't be built yet.

**Build (presentation only; the sim and the goldens don't change):**
1. **Mod skins:** a mod's `skin` (FLT-14 `skin.json`) appears in the skin picker and opens with `?skin=<id>`. A mod may ask to activate its skin, and the player is asked first. The CSS is sanitised: scoped under `[data-skin]`, `@import` stripped, and `url()` limited to the mod's own assets. Strings render as text.
2. **Assets:** bundled images, fonts and `.glb` files are inlined, served as `blob:` URLs through the `Assets` service, and capped at 2 MB per mod. Remote URLs are rejected with a friendly error.
3. **Audio:** mods can add or override sound-kit cues (for example `protest.chant`, `ui.click`) through the `Audio` service. Respect mute and volume.
4. **Walker looks:** a `looks` section maps a walker kind or role (protester, a faction, visitor type, agent) to a presentation:
   - a **primitive recipe** (for example a dog built from body, head, ears and tail primitives),
   - a **billboard sprite** from a bundled image,
   - a **tint**, or
   - a bundled **`.glb`**.
   Instancing stays, and so does the strict perf budget. Keep `presentation` separate from sim logic, per AGENTS.md "Entities: don't assume everything walks".
5. **The example mod** `mods/examples/golden-retriever-protest/`:
   - Protesters are golden retrievers with signs ("WOOF LIES", "GOOD BOY TRUTH NOW", "WHO'S A GOOD MODEL").
   - A bark cue plays when the protest grows.
   - A few thoughts and headlines.
   - It must be delightful on first sight.
6. **Tooling and docs:**
   - `flt-mod check` validates asset, audio and looks references and the size cap.
   - Update the skill (`.agents/skills/flt-modding/SKILL.md`), `docs/MODDING.md` and the `create-mod` scaffold (one example of each new section).
7. **Fix:** the Frontier 95 tutorial hides mod toasts until it's skipped. Mod toasts should follow the FLT-51 policy (`source: mod:<id>`) once the train has #63.

**Done when:**
- A fresh agent thread given only the skill makes a working golden-retriever-style mod on the first try (report the time and the number of `check` runs).
- `pnpm check` is green, with the strict perf number reported.
- The stranger e2e is green on the PR preview.

**Evidence:**
- Before/after screenshots of the same gate scene: no mod vs `?mod=` golden retrievers (1440×900 and 390×844).
- The mod link working on the PR preview.
- The `flt-mod check` output.


