# Modding Frontier Lab Tycoon (design, v1)

_FLT-15. Written by the FLT lead (Opus 5.5). Jem: "this whole game should be agent native… designed for vibecoded mods to be shared with your friends."_

**The test:** someone asks their coding agent *"make me a Frontier Lab Tycoon mod where the protesters are all golden retrievers"*, gets a working mod in minutes, and sends a friend a link that opens the game with it loaded.

## 1. Principle: data first, code last

Most of the fun can be expressed as **data**, and data is safe to share, easy for agents to write, deterministic, and replayable. So mods come in four tiers, and only the last one runs code.

| Tier | What it changes | Format | Runs code? | Ships in |
|---|---|---|---|---|
| **Skin** | the whole 2D UI | tokens + CSS + strings + assets (FLT-14 `skin.json`) | no | M1 |
| **Content pack** | headlines, thoughts, walkers, buildings, rival labs, events and **story arcs**, endings, assistant tips | typed JSON | no | M1 |
| **Rules** | tuning knobs, patches to built-in machines | typed JSON | no | M3 |
| **Script** | anything a player could do, automated | JS in a sandboxed Worker | yes, sandboxed | M3 (later) |

**Story arcs are data-only statecharts.** An arc is an XState machine config written in JSON. Its guards and actions may only reference **named built-ins** the game registers via `setup()`: guards like `stat.gte`, `flag.is`, `day.after` and `chance`, and actions like `effect.cash`, `effect.hype`, `news`, `card`, `spawn.protesters` and `flag.set`. There are no functions in mods. The game still runs arcs with pure `transition()` inside the tick, so modded games stay deterministic, and the same seed plus the same mods replay identically.

## 2. The manifest

One `mod.json`, validated on load with **Effect Schema**. Errors are friendly and give the exact JSON path, e.g. `content.events[2].choices[0].effects[1]: unknown effect "effect.cashh" (did you mean "effect.cash"?)`.

```jsonc
{
  "apiVersion": 1,
  "id": "water-dlc",                 // kebab-case, unique
  "name": "Water Usage Discourse DLC",
  "version": "1.0.0",
  "author": "you",
  "description": "The discourse is now a documentary. Then a musical.",
  "skin": null,                      // or an FLT-14 skin.json object (tokens, strings, css, fonts, assets)
  "content": {
    "headlines": [{ "id": "wd-01", "when": { "stat.gte": ["discourse", 40] }, "text": "{lab} water discourse gets a Netflix deal", "tone": "joke" }],
    "thoughts":  [{ "id": "wd-t1", "kind": "protester", "when": "always", "text": "My sign is biodegradable. My anger is not." }],
    "events":    [ /* arcs as JSON statecharts, see docs/mods/arcs.md */ ],
    "buildings": [ /* data: size, price, upkeep, effects; model = "primitive recipe" or a bundled .glb (FLT-13 pipeline) */ ]
  },
  "assets": { "sign.png": "data:image/png;base64,…" }
}
```

- **Composable:** load several mods in order. Content merges by `id` (a later mod wins, and the Mod Manager lists every override). Exactly one skin is active at a time; a mod's skin becomes *available*, and can ask to be activated.
- **Identity:** the active mod set (ids, versions, content hashes) is part of a run's identity, so share links and replays reproduce the same game.

## 3. Safety

- **No code in tiers 1–3.** Everything is data checked by schema, and strings render as text, never HTML.
- **CSS is sanitised:** it's scoped under `[data-skin]`, `@import` is stripped, and `url()` may only point at the mod's own bundled assets (served as `blob:`). There are no remote fetches, which means no tracking pixels.
- **Assets:** only images, fonts and `.glb` files, with a size cap (2 MB per mod by default).
- **Scripts (tier 4, later):** they run in a dedicated **Web Worker** with no DOM and no network (page CSP `connect-src 'self'`). A narrow capability API over `postMessage` lets them read throttled snapshots, issue the **same `Command`s a player can** (recorded, so replays hold) and show assistant or toast lines. Loading one asks the player first: *"This mod runs code. It can read the game and place buildings. It can't reach the internet or your files."* Built-in skins may ship React slot components; third-party mods may not.

## 4. Sharing

- **By link:** `?mod=<url>` (repeatable) points at a `mod.json` or a single-file `.fltmod.json` (assets inlined). Shorthands: `?mod=gist:<id>`, and raw GitHub URLs. The in-game **Share** button copies `https://<public site>/?seed=…&mod=…&mod=…`.
- **In-game Mod Manager:** a list, on/off toggles, load order, overrides and errors. You can also import from a file or the clipboard.
- **Later:** a tiny gallery on the public Worker (the Alchemy stack from FLT-12: R2 + D1), with no accounts in v1.

## 5. Agent native

- **`packages/flt-mod-sdk`:** TypeScript types generated from the schema, a `defineMod()` helper, and the **`flt-mod` CLI**:
  - `flt-mod check`: validates, then **runs the game headless for 365 days with the mod** (the deterministic sim needs no browser) and reports errors, unreachable arc states (`xstate/graph`) and missing assets.
  - `flt-mod bundle`: produces one shareable file.
  - `flt-mod dev`: serves the mod with CORS; the game hot-reloads it via `?mod=http://localhost:5174/mod.json&dev=1`.
- **`create-flt-mod` template:** `mod.json`, an `AGENTS.md` for modders, one example of each content type, and a test that runs `flt-mod check`.
- **A mod-authoring skill** (`.agents/skills/flt-modding/SKILL.md`, Claude and Codex compatible): the API, the built-in guard and action vocabulary, ten worked examples, and the golden rule ("run `flt-mod check` until it's green").
- **One contract, many surfaces (Rat Stack idea):** the same validate and preview capability is exposed in-game, from the CLI and later as MCP tools (`flt.mod.validate`, `flt.mod.preview` → screenshot), so agents can test mods without a browser.
- **The acceptance test:** a fresh agent thread given *only* the skill makes a working mod on the first try: `flt-mod check` is green and it loads on the public site by link.

## 6. Plan

- **M1** (after FLT-14 Phase 1 lands the skin format):
  - the manifest and schema
  - the loader, with composition and overrides
  - the Mod Manager
  - `?mod=` on the public site
  - the built-in skins migrated to `mods/skin-*`
  - content packs (headlines, thoughts, rivals, buildings-as-data, events and arcs as JSON statecharts)
  - the example **Water Usage Discourse DLC**
- **M2:** the SDK and CLI (check, bundle, dev), `create-flt-mod`, the skill and the modder `AGENTS.md`, then the fresh-agent show-and-tell.
- **M3 (later):** rules patches and tuning knobs, sandboxed scripts, and the gallery.

**Open for Jem:** publishing the SDK and skill publicly means making those parts of the repo public (or a separate public repo). That's Jem's call, and it isn't needed for M1.
