# FLT-35: `pnpm shots`: before/after screenshot helper for PRs

_Copied verbatim from the FLT-35 task description (label: explore). Lead: Opus 5.5. Builder: Sonnet 5.5._

**`pnpm shots`: a reusable before/after screenshot helper** (Codex Sol 6.1, infra). Jem's rule: visible PRs show before/after of the same scene.
- `pnpm shots --scenes overview,inspector,event,phone [--skin <id>] [--base main]` builds `main` (in a temporary worktree) and the current branch, serves both, and captures each named scene at a fixed seed, camera and viewport with the existing `scripts/shot.mjs` (Playwright + SwiftShader). It writes `shots/before/*.png`, `shots/after/*.png` and a side-by-side `shots/compare/*.png`, and prints a markdown table for the PR body.
- Scenes are defined in data (`scripts/shots.scenes.json`) using the existing `?moment=` / `?debug=` hooks, so tasks can add their own.
- It absorbs the FLT-14 skin-shots script if that has landed (`--skin all` gives a gallery).
- **Done when:** one command produces before/after pairs for 4 standard scenes in under 3 minutes on a Modal builder, and `AGENTS.md` points to it. It merges itself once green (it's logic and tooling, so the evidence is a sample output in the PR).

