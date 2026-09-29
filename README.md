# Frontier Lab Tycoon

A browser tycoon game about running a frontier AI lab. Build compute, keep your researchers (and your agents) happy, ship models, outrun the rivals, and try to stay ahead of the protesters, the regulators and your own sandbox.

Built with React, react-three-fiber and a deterministic TypeScript simulation. See [docs/DESIGN.md](docs/DESIGN.md) for the design and [AGENTS.md](AGENTS.md) for how to work on it.

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
