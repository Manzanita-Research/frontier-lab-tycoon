# FLT-40: Skin port: Discovery Disc '96 (edutainment CD-ROM)

(Copied from the task description.)

**Port: Discovery Disc '96**, an edutainment CD-ROM (the round-2 mockup `discovery-disc-96.html`). Bright primaries, thick black outlines, hard offset shadows, graph paper.
- **Stats:** clip-art stickers (a gold star for Vibes, a green circle for cash, a "5.8 months of runway ⏰ hurry!" circle, rotated pills for capability and hype).
- **Training + OKRs:** a **Star Chart** on graph paper ("NOW TRAINING"; stars fill in as goals are met).
- **Inspector:** a **Field Trip Badge** (green header, "please return to front desk", thermometer meters, an "Ada is thinking…" fact box, a big FOLLOW button).
- **Assistant:** a friendly robot guide with a "GREAT JOB!" speech bubble.
- **Build bar:** Kid Pix-style **Build Stamps** in a starry blue tray.
- **Speed:** Oregon Trail **Pace** buttons (Rest / Steady / Strenuous / Grueling).
- **Ticker:** a yellow **DID YOU KNOW?** bar.
- **Event card:** a big worksheet card with a red ribbon title.
- **Type:** Jersey 10 + Comic Neue.

---
**How to port (every skin):**
- **Reference:** `docs/mockups/flt-14/discovery-disc-96.html` (open it and reuse its CSS) and the stub in `src/skins/discovery-disc-96/`. The guide is `docs/SKINS.md`. Frontier 95 (`src/skins/frontier-95/`) is the model of a *full* skin: tokens, strings, CSS **and** custom `slots.tsx` where the mockup's chrome can't be done with CSS alone.
- **Contract:** skins get `vm` + `actions` only, and never import the sim, the store or three (a test enforces this). Every slot must render. Keep the ≥ 4.5:1 text contrast and the ≥ 44px tap targets, and don't re-render every frame.
- **Fonts:** bundle OFL fonts with their licence files (no hot-linking). Pixel faces must keep **5 and S distinct** in numbers (prefer Jersey 10 for digits).
- **Parody names only** in any skin-specific copy.
- **Evidence (Jem's rule):** `pnpm shots --scenes skins --skin discovery-disc-96 --diff --out docs/img/flt-14-ports/discovery-disc-96`, before (the stub) vs after (the full skin), plus phone. Include the strict perf number.
- **Merge:** open the PR and **don't merge**; the lead reviews and merges. After all five, the lead posts a six-skin gallery.
- **Lane:** `src/skins/discovery-disc-96/**`, and `docs/img/flt-14-ports/discovery-disc-96/**`. If you need a new slot or VM field, add it additively in `src/ui/hud/**` and say so in the PR, since other port builders run in parallel. FLT-29 is changing the right-column Layout and assistant anchoring; merge `origin/main` before you open the PR.
