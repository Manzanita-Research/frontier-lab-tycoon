# FLT-44: Skin port: Field Almanac (specimen cards)

(Copied from the task description.)

**Port: Field Almanac**, a naturalist's field guide to your lab (the round-1 mockup `field-almanac.html`). The calm, premium option. Frosted paper panels, hairlines, a soft serif.
- **Stats:** a header strip with a Vibes ring and serif numerals ("getting short", "↑ rising").
- **Training + OKRs:** Field Notes with a thin progress line and "This year's objectives".
- **Inspector:** a **specimen card** ("Specimen no. 42 · *Homo researchus, var. overcaffeinata*", with a fig. 1 plate and hairline need bars). Agents are "*Machina diligens*", visitors "*Homo curiosus*".
- **Thoughts:** italic serif bubbles.
- **Build bar:** a shelf of round tool icons.
- **Ticker:** **Dispatches**, with fleuron separators.
- **Toasts:** a wax-seal toast.
- **Type:** Fraunces + Figtree.
- **Note:** blur is allowed here only if it costs nothing in frame time. Otherwise use a flat translucent paper.

---
**How to port (every skin):**
- **Reference:** `docs/mockups/flt-14/field-almanac.html` (open it and reuse its CSS) and the stub in `src/skins/field-almanac/`. The guide is `docs/SKINS.md`. Frontier 95 (`src/skins/frontier-95/`) is the model of a *full* skin: tokens, strings, CSS **and** custom `slots.tsx` where the mockup's chrome can't be done with CSS alone.
- **Contract:** skins get `vm` + `actions` only, and never import the sim, the store or three (a test enforces this). Every slot must render. Keep the ≥ 4.5:1 text contrast and the ≥ 44px tap targets, and don't re-render every frame.
- **Fonts:** bundle OFL fonts with their licence files (no hot-linking). Pixel faces must keep **5 and S distinct** in numbers (prefer Jersey 10 for digits).
- **Parody names only** in any skin-specific copy.
- **Evidence (Jem's rule):** `pnpm shots --scenes skins --skin field-almanac --diff --out docs/img/flt-14-ports/field-almanac`, before (the stub) vs after (the full skin), plus phone. Include the strict perf number.
- **Merge:** open the PR and **don't merge**; the lead reviews and merges. After all five, the lead posts a six-skin gallery.
- **Lane:** `src/skins/field-almanac/**`, and `docs/img/flt-14-ports/field-almanac/**`. If you need a new slot or VM field, add it additively in `src/ui/hud/**` and say so in the PR, since other port builders run in parallel. FLT-29 is changing the right-column Layout and assistant anchoring; merge `origin/main` before you open the PR.


