# Frontier Lab Tycoon

A browser tycoon game about running a frontier AI lab. Build compute, keep your researchers (and your agents) happy, ship models, outrun the rivals, and try to stay ahead of the protesters, the regulators and your own sandbox.

Built with React, react-three-fiber and a deterministic TypeScript simulation. See [docs/DESIGN.md](docs/DESIGN.md) for the design and [AGENTS.md](AGENTS.md) for how to work on it.

**[Play Frontier Lab Tycoon](https://flt-prod.manzanita.workers.dev)** — a public link, with no sign-in needed.

GitHub deploys checked merges to `main` to Cloudflare Workers static assets through Alchemy. Same-repository PRs get a preview link in a bot comment; closing the PR removes the preview. Deployment setup and pinned infrastructure dependencies live in [infra/README.md](infra/README.md).

```sh
pnpm install
pnpm dev
```

## Playing

| | |
|---|---|
| Build | Pick a tool at the bottom (or keys `1`-`6`), click to place, `Esc` to put it away. Path and Bulldoze paint as you drag. |
| Camera | Drag to pan, wheel or pinch to zoom, `Q` / `E` to turn the campus. With Path or Bulldoze selected, pan with the right mouse button or two fingers. |
| Time | `Space` pauses; the buttons top right switch between pause, 1x, 3x and 10x. |

Every building needs a path touching it, or nobody visits and gateways earn nothing.

### URL knobs (screenshots and stress tests)

`/?seed=3&warp=25&speed=3&zoom=80&focus=12,14&agents=200&debug=1`: seed the lab, pre-simulate `warp` game days, start at a speed, set the camera zoom and focus tile, add extra agents, and (with `debug`) expose `window.__flt` for probes.

## License

The code and the content are licensed separately. Anything not listed below as CC BY-NC 4.0 or third-party is code, under MIT.

**MIT ([LICENSE](LICENSE)): the code.**
- `src/**` code: `.ts`, `.tsx` and `.css`, including UI labels and other strings that live inside components, and any picture a component draws in code (SVG in a `.tsx`, CSS art).
- `infra/`, `worker/`, `scripts/`, `e2e/`, `packages/`, `.github/`, `drama/*.mjs` and `drama/automation.sh`, and the build and config files at the root.
- The docs' prose (`docs/**/*.md`, READMEs).

**CC BY-NC 4.0 ([LICENSE-ASSETS](LICENSE-ASSETS)): the art, the sound and the writing.**
- Images, audio and music, and 3D models wherever they live: `src/intro/assets/`, `public/` (icons, the link-preview card), and anything generated for the game.
- Skin art: `src/skins/*/assets/` (except fonts, below), and the skins' copy in `strings.json` and `tips.json`.
- Game text and content packs: `src/content/` (the game's writing, even though it's stored as `.ts` data; its `*.test.ts` files are code), and `mods/**`, including `mods/examples/`.
- Daily Drama: the packs in `mods/drama/`, plus the writing in `drama/` (`pick.md`, `glossary.json`, `denylist.json`, `sources.json`).
- Docs images: `docs/img/`, `docs/evidence/` and `docs/mockups/` screenshots and art.

So you can fork the engine for anything, and you can share, remix and mod the art and jokes for non-commercial use with credit ("Frontier Lab Tycoon by Manzanita Research and contributors").

**Third-party pieces keep their own licences:**
- Fonts: the licence file next to each font in `src/skins/*/assets/fonts/` (all SIL Open Font License).
- SCOWL word list: [`drama/words.LICENSE.txt`](drama/words.LICENSE.txt).
- The CRT shader (MIT): [`src/render/crt/LICENSE`](src/render/crt/LICENSE), credited in [docs/CREDITS.md](docs/CREDITS.md).
- Kit Langton's Effect skill (MIT): [`.agents/skills/effect/LICENSE`](.agents/skills/effect/LICENSE).
