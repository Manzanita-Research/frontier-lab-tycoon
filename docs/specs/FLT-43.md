# FLT-43: Skin port: Karaoke Night (AI News Karaoke ticker)

(Copied from the task description; the spec this PR is built to. See the PR for the deviations.)

**Port: Karaoke Night**, where a karaoke machine runs the lab (the round-1 mockup `karaoke-night.html`), **flattened**: lilac plastic without heavy gradients, and glow kept subtle.
- **Stats:** a console with glowing screen stats.
- **Training:** "NOW TRAINING" as the song. **OKRs:** the "UP NEXT" song queue.
- **Inspector:** a contestant card with heart meters.
- **Speed:** tape-transport buttons. **Build bar:** arcade buttons with LCD price tags.
- **Ticker:** **AI News Karaoke**, a bouncing ball over the headline, with the sung part highlighted. It's the signature piece, so make it lovely.
- **Toasts:** "★ NEW RELEASE! ★" stars.
- **Type:** a pixel display face for headings; **use Jersey 10 for all digits** (Pixelify's 5 and S clash) + Nunito for body. Keep a font-token slot open for Chalmers in case Jem buys it.

---
**How to port (every skin):**
- **Reference:** `docs/mockups/flt-14/karaoke-night.html` (open it and reuse its CSS) and the stub in `src/skins/karaoke-night/`. The guide is `docs/SKINS.md`. Frontier 95 (`src/skins/frontier-95/`) is the model of a *full* skin: tokens, strings, CSS **and** custom `slots.tsx` where the mockup's chrome can't be done with CSS alone.
- **Contract:** skins get `vm` + `actions` only, and never import the sim, the store or three (a test enforces this). Every slot must render. Keep the ≥ 4.5:1 text contrast and the ≥ 44px tap targets, and don't re-render every frame.
- **Fonts:** bundle OFL fonts with their licence files (no hot-linking). Pixel faces must keep **5 and S distinct** in numbers (prefer Jersey 10 for digits).
- **Parody names only** in any skin-specific copy.
- **Evidence (Jem's rule):** `pnpm shots --scenes skins --skin karaoke-night --diff --out docs/img/flt-14-ports/karaoke-night`, before (the stub) vs after (the full skin), plus phone. Include the strict perf number.
- **Merge:** open the PR and **don't merge**; the lead reviews and merges. After all five, the lead posts a six-skin gallery.
- **Lane:** `src/skins/karaoke-night/**`, and `docs/img/flt-14-ports/karaoke-night/**`. If you need a new slot or VM field, add it additively in `src/ui/hud/**` and say so in the PR, since other port builders run in parallel. FLT-29 is changing the right-column Layout and assistant anchoring; merge `origin/main` before you open the PR.
