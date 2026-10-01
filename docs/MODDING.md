# Modding Frontier Lab Tycoon (design, v1)

_FLT-15. Written by the FLT lead (Opus 5.5). Companion: `docs/EFFECT-FOR-MODDERS.md` (Effect in plain words, with a worked example). Jem: "this whole game should be agent native… designed for vibecoded mods to be shared with your friends."_

**The test:** someone asks their coding agent *"make me a Frontier Lab Tycoon mod where the protesters are all golden retrievers"*, gets a working mod in minutes, and sends a friend a link that opens the game with it loaded.

## Current implementation (M1a + M1b + M1c + M2)

This page describes the intended design. M1a foundations, M1b live integration
(FLT-37) and the private M2 kit are in: a mod loads with `?mod=<url>` on any build
(`?mod=/mods/examples/every-lab-is-steve/mod.json` renames the Arena), its content
runs in the sim, and the Frontier 95 Mod Manager (Start, Mods…) lists what loaded
and why anything failed. M1c (FLT-55) applies the presentation: a mod's skin joins the
picker (and opens with `?skin=<id>`, or is offered to the player), its bundled images, fonts and
`.glb` files are served as `blob:` URLs, its sound cues reach the sound kit, and its `looks`
redraw walkers (a primitive recipe, a sprite, a model or a tint, per kind, role or faction).
`?mod=/mods/examples/golden-retriever-protest/mod.json` is the showcase. See `src/mods/README.md` for the precise coverage. Start with `pnpm create-mod my-mod`,
then `pnpm --dir my-mod test`. From the game checkout, `pnpm flt-mod check <path>`,
`pnpm flt-mod bundle <dir>` and `pnpm flt-mod dev <dir>` use the private source-linked
kit. The scaffold includes the mod-authoring skill and every v1 content section.
Copy optional `mod.example.ts` to `mod.ts` to use `@flt/mod-sdk`; directory commands prefer it, while the
scaffold test checks `mod.json`. Bundle with an explicit `mod.json` output to
regenerate that file. Local assets are inlined; remote assets are rejected.
`dev` serves CORS on 5174 and prints the game link (`?mod=http://localhost:5174/mod.json`); reload the page to pick up edits (no hot reload).
Today's Drama (FLT-34) is the first published mod feed: merged Daily Drama packs at `/mods/drama/`, loaded by the same
`?mod=` (see `drama/README.md` ▸ Publishing).

**Adding a mod to a running lab (FLT-78).** A *data-only* mod (headlines, thoughts, tips, new plain event cards, a rival's
`tagline`) joins the lab on screen with no reload: `addModLive(source)` in `src/app/liveMods.ts` fetches it, recomposes the
session's `GameDefinition`, and sends the sim an `addMod` command; the sim swaps to the new definition on that command's
tick, so a replay with `addMod` at tick T is the same game. The World records it in `modsAdded`
(`{ id, version, hash, url, tick, day, cards }`), its cards turn up `ARRIVE_DAYS` (2) after, paced like any card, and its
first plain headline goes on the ticker. `removeMod` takes it out again: its unfired cards are cancelled (an open one closes),
its headlines and thoughts stop, a rival's tagline reverts. Anything else (a skin, looks, sounds, rules, arcs, rival stats)
needs a fresh start: `needsRestart(manifest)` says why, and the Mod Manager's Remove for those reloads without the mod.
`?mod=` links in a fresh tab work as before.

## 1. Principle: data first, code last

Most of the fun can be expressed as **data**, and data is safe to share, easy for agents to write, deterministic, and replayable. So mods come in four tiers, and only the last one runs code.

| Tier | What it changes | Format | Runs code? | Ships in |
|---|---|---|---|---|
| **Skin** | the whole 2D UI | tokens + CSS + strings + assets (FLT-14 `skin.json`) | no | M1 |
| **Content pack** | headlines, thoughts, walkers, buildings, rival labs, events and **story arcs**, endings, assistant tips | typed JSON | no | M1 |
| **Rules** | tuning knobs, patches to built-in machines | typed JSON | no | M3 |
| **Script** | anything a player could do, automated | JS in a sandboxed Worker | yes, sandboxed | M3 (later) |

**Story arcs are data-only statecharts.** An arc is an XState machine config written in JSON. Its guards and actions may only reference **named built-ins** the game registers via `setup()`: guards like `stat.gte`, `flag.is`, `day.after` and `chance`, and actions like `effect.cash`, `effect.hype`, `news`, `card`, `spawn.protesters` and `flag.set`. There are no functions in mods. The game still runs arcs with pure `transition()` inside the tick, so modded games stay deterministic, and the same seed plus the same mods replay identically.

## 1b. Architecture: every extension point is an Effect service, and every mod is a Layer

_Jem's idea. It fits perfectly, because the app already runs on Effect (`Sim` and `Frames` are services today). New to Effect? Read `docs/EFFECT-FOR-MODDERS.md` first._

- **Extension points are services** (`Context.Service` classes in `src/mods/services/`): `Skin`, `Content` (buildings, walker kinds and thoughts, headlines, arcs, rivals, endings, assistant tips, names), `Rules` (tunables and machine patches), `Vocabulary` (the named guards and effects JSON arcs may use), `Assets`, `Audio`, and `GameEvents` (a read-only stream). `Rng` and the clock are core and **not** moddable, which keeps games replayable.
- **The base game is just the default Layers** (`BaseGame.layer` = `Layer.mergeAll(baseSkin, baseContent, baseRules, …)`). Nothing in the game reads `src/content/*` directly any more; it asks for the services.
- **Every mod compiles to a Layer.** The loader validates a data mod's `mod.json` with Effect Schema and turns each section into a **wrapping Layer**: it reads the service as it was below it (`yield* Content`) and returns a changed copy. Modders never write Effect. Power users and built-in mods can write the Layer directly.
- **Composition is layering in load order:** `Layer.provide(modN, … Layer.provide(mod1, BaseGame.layer))`. Precedence and conflicts are explicit. Each content section uses `add` (an error if the id exists, unless it's the mod's own), `override` (the id must exist, and fields merge), or `remove`. Before building, the loader computes a **conflict report** (e.g. "water-dlc and every-lab-is-steve both override rival `metameta`; the later one wins"), and the Mod Manager shows it.
- **Resolved once per game:** at game start (and on dev hot-reload) the app resolves the services into one plain **`GameDefinition`** (content, rules, vocabulary). The pure sim takes it as input: `createInitialState(seed, def)` and `tick(state, def)`. Layers decide *what the game is made of*; the tick stays the same deterministic function.
- **Tests and `flt-mod check`** provide `Layer.provide(modLayer, BaseGame.layer)` and run the headless sim. It's the same mechanism as the game, so there's nothing special to mock.
- **Safety doesn't change:** a Layer is how things plug in, not an escape hatch. Shared mods are data turned into Layers by *our* loader. A sandboxed script mod never runs in the page; the host builds a Layer from its capability-limited messages (for example, `GameEvents` subscriptions and player `Command`s).

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
    "headlines": { "add": [{ "id": "wd-01", "when": { "stat.gte": ["discourse", 40] }, "text": "{lab} water discourse gets a streaming deal", "tone": "joke" }] },
    "thoughts":  { "add": [{ "id": "wd-t1", "kind": "protester", "when": "always", "text": "My sign is biodegradable. My anger is not." }] },
    "rivals":    { "override": [{ "id": "sirocco", "name": "Sirocco (Hydrated Edition)" }] },
    "events":    { "add": [ /* arcs as JSON statecharts, see docs/mods/arcs.md */ ] },
    "buildings": { "add": [ /* data: size, price, upkeep, effects; model = "primitive recipe" or a bundled .glb (FLT-13 pipeline) */ ] },
    "disasters": { "add": [ /* JSON statecharts (FLT-17): warning, active, cleanup, aftermath; see docs/DISASTERS.md and mods/base-disasters */ ] }
  },
  "assets": { "sign.png": "data:image/png;base64,…" },
  "audio": { "cues": { "protest.grow": [{ "at": 0, "hz": 300, "endHz": 560, "duration": 0.1, "gain": 0.1, "wave": "square" }] } },
  "looks": { "protester": { "tint": { "body": "#3a7bd5" }, "signs": ["HYDRATE RESPONSIBLY"] } }  // FLT-55: recipe, sprite, glb or tint per kind, role or faction
}
```

- **Composable:** load several mods in order. Every content section says what it does: `add`, `override` (fields merge) or `remove`. Each mod compiles to a Layer wrapping the ones below it (§1b), so a later mod wins, and the Mod Manager lists every conflict. Exactly one skin is active at a time; a mod's skin becomes *available*, and can ask to be activated.
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
  - the services in `src/mods/services/` and `BaseGame.layer`; the game reads content and rules through them, resolved into a `GameDefinition` passed to the pure sim
  - the manifest and schema
  - the loader: data mod → wrapping Layer, with composition, the conflict report and overrides
  - the Mod Manager
  - `?mod=` on the public site
  - the built-in skins migrated to `mods/skin-*`
  - content packs (headlines, thoughts, rivals, buildings-as-data, events and arcs as JSON statecharts)
  - the example **Water Usage Discourse DLC**
- **M2:** the SDK and CLI (check, bundle, dev), `create-flt-mod`, the skill and the modder `AGENTS.md`, then the fresh-agent show-and-tell.
- **M3 (later):** rules patches and tuning knobs, sandboxed scripts, and the gallery.

**Open for Jem:** publishing the SDK and skill publicly means making those parts of the repo public (or a separate public repo). That's Jem's call, and it isn't needed for M1.
