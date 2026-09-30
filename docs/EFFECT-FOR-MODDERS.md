# Effect for modders (no prior Effect needed)

Data modders write JSON, or optionally `defineMod({...})` in local TypeScript.
Effect is how the game turns that data into services. No Effect knowledge is
required to use the private SDK or `flt-mod` CLI.

| Word | Meaning |
|---|---|
| Effect | A description of work, run later. |
| Service | A named slot: Content, Skin, Rules, Vocabulary, Assets, Audio or GameEvents. |
| Layer | A recipe that fills service slots. |
| provide | Supply a Layer to an Effect or another Layer. |
| Schema | The checked data description that validates a manifest. |

Mods wrap services in load order. Each content section uses `add`, `override`,
`remove`. An override merges top-level fields; nested objects and arrays replace
whole fields. The later valid patch wins and composition reports conflicts.
RNG and the clock remain owned by the game.

## A rival rename, using the real manifest API

```json
{
  "apiVersion": 1,
  "id": "every-lab-is-steve",
  "name": "Every Lab Is Named Steve",
  "version": "1.0.0",
  "content": {
    "rivals": {
      "override": [
        { "id": "anthro", "name": "Steve (Safety-Flavoured)" },
        { "id": "openish", "name": "Steve (Formerly Non-Profit)" },
        { "id": "metameta", "name": "Steve Superintelligence Labs" }
      ]
    }
  }
}
```

The ids identify existing rivals. Display names do not. The other canonical ids
are `vssi`, `sirocco`, and `macrohard`.

## What the loader actually does

These imports and calls match the M1a API. `composeMods` supplies `BaseGame.layer`
by default, validates references, and builds wrapping Layers for changed services.

```ts
import { Effect } from "effect";
import { decodeManifest } from "../src/mods/schema";
import { composeMods } from "../src/mods/loader";
import { resolveGameDefinition } from "../src/mods/game-definition";

const input = JSON.parse('{"apiVersion":1,"id":"steve","name":"Steve","version":"1.0.0","content":{"rivals":{"override":[{"id":"anthro","name":"Steve"}]}}}');
const manifest = await Effect.runPromise(decodeManifest(input));
const { layer, conflicts } = composeMods([manifest]);
const definition = await Effect.runPromise(resolveGameDefinition(layer));
console.log(definition.content.rivals[0]?.name, conflicts);
```

`definition` is plain content, rules and vocabulary. Resolve it once at game
start, outside the deterministic tick. Skin, assets and audio remain services
outside the sim. `Content` is the real `Context.Service` in
`src/mods/services/content.ts`; `Skin`, `Rules`, `Vocabulary`, `Assets`, `Audio`
and the read-only `GameEvents` stream live beside it. Rules and vocabulary have
base services, but manifest patches to them are reserved for M3.

## The private SDK and check command

```ts
import { defineMod, type RivalId } from "@flt/mod-sdk";
const rival: RivalId = "anthro";
export default defineMod({
  apiVersion: 1, id: "steve", name: "Steve", version: "1.0.0",
  content: { rivals: { override: [{ id: rival, name: "Steve" }] } },
});
```

`Mod` is derived from the game's Effect Schema; `defineMod` also validates with
that Schema. `mod.ts` executes trusted local author code. Bundle it to JSON
before sharing: `pnpm flt-mod bundle ./my-mod ./my-mod/mod.json`.

```sh
pnpm flt-mod check mods/examples/every-lab-is-steve/mod.json
pnpm flt-mod check mods/examples/headline-pack/mod.json
pnpm create-mod my-mod
pnpm --dir my-mod test
```

The check uses the real M1a entry point, which can also be called directly:

```ts
import { checkMod } from "../src/mods/check";
const { report, replay } = await checkMod({
  apiVersion: 1, id: "empty", name: "Empty", version: "1.0.0",
});
console.log(report.days, replay.days); // 365, 365
```

It composes services, validates assets/references, then runs 365 actual days
and a deterministic replay. The CLI adds `xstate/graph` structural arc traversal.
It explores every transition alternative with guards/actions omitted; it cannot
prove that a guarded transition will occur. Named action parameters are currently
JSON data whose runtime semantics await M1b.

**M1a coverage:** existing rival personality/starting stats and goal targets can
be injected into today's World. All other modified sections appear in the
checker's **M1b deferred** list. New names, headlines, cards, arcs and skins are
validated but not executed by that bridge. Live `?mod=` loading, runtime content
lookups and game hot-reload are M1b. `flt-mod dev` currently only serves the data.

Shared mods are data; shared script execution is a later sandbox milestone.
The SDK/CLI stay private in this repo and are not published.
