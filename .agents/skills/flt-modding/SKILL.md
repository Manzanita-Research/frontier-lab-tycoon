---
name: flt-modding
description: Create, edit, validate and bundle data mods for Frontier Lab Tycoon, including headline packs, rival renames, entity thoughts, buildings, cards, JSON arcs and skins. Use for FLT mod.json or mod.ts authoring and Daily Drama content packs.
---

# Frontier Lab Tycoon modding

Start from the supplied template (`pnpm create-mod my-mod` in the game checkout).
Edit `mod.json`; run **`flt-mod check` until green**. From the game checkout use
`pnpm flt-mod check /path/to/mod.json` if the bin is not on PATH. A scaffold's
`pnpm test` calls that same checker. JSON is the shared format. Optional trusted
local `mod.ts` (copy the supplied `mod.example.ts`) exports `defineMod({...})` from `@flt/mod-sdk`; directory commands
prefer it. `flt-mod bundle /path/to/mod mod.json` converts it to JSON.

M1a validates schema/composition/assets and structural arcs, then runs seed 42
for 365 actual days twice, answering event cards and comparing the complete World.
Read **M1b deferred** in the report: new copy, entities, buildings, cards, arcs and
skins are validated but do not execute/render in the game until M1b. Never claim
that a green report proves their visuals. `flt-mod dev <dir>` serves with CORS on
5174; loading and hot-reload in the game await M1b. Publishing is a separate action.

## Contract and canonical ids

Manifest: `apiVersion: 1`, kebab-case `id`, nonempty `name`, `version`; optional
`author`, `description`, `content`, `skin`, `assets`, `audio`. Unknown keys fail.
Each content section accepts `add`, `override`, `remove` in that order. Adds need
complete entries and unused ids; overrides need existing ids; removes list existing
ids. Fields merge only at the top level: nested objects/arrays replace whole fields.
Later mods wrap earlier ones; conflicts report consecutive touches, without waiving
missing-id/duplicate-add errors. Buildings require **id equal to kind**.

- Rivals: `anthro`, `openish`, `metameta`, `vssi`, `sirocco`, `macrohard`.
- Buildings: `cluster`, `hall`, `gateway`, `kombucha`, `nap`, `snack`, `demo`,
  `fountain`, `datacenter`, `gas`, `solar`.
- Entities (`walkerKinds` is a historical section name): `researcher`, `agent`,
  `visitor`, `protester`. Keep `presentation: walker | flow | sprite | offmap`
  separate from mechanics. Don't assume every actor walks.
- Goals: `release`, `era`, `arena`. Name pools include `FIRST_NAMES`, `LAST_NAMES`,
  `AGENT_NICKNAMES`, `VISITOR_ROLES`, `LAB_NAMES`.
- Thought conditions: `always`, `noKombucha`, `lowCash`, `training`, `justReleased`,
  `highHype`, `unreachable`, `crowded`, `discourse`, `protest`, `night`, `era1`,
  `era2`, `era3`, `era4`, `openDrop`, `unpowered`, `top`, `rankFell` (use SDK
  `ThoughtCondition` for the exact baseline; checker rejects unknown conditions).
- Headlines: omit `trigger` for `filler`; common triggers `start`, `rival`,
  `runStarted`, `runDone`, `protest`, `built:<building-id>`.
- Legacy anonymous line keys: `base-headlines-N`, `base-thoughts-N` (zero-based
  indices for the pinned content version). Prefer unique add ids for portable packs.

Guards: `stat.gte`, `flag.is`, `day.after`, `chance`.
Actions: `effect.cash`, `effect.hype`, `effect.discourse`, `news`, `card`,
`spawn.protesters`, `flag.set`. Named calls are a string or `{type, params}`.
M1a validates names, **not the params' runtime semantics**; examples below use
illustrative params. Verify against the runtime vocabulary when M1b lands.
Choice-card effects have a different concrete format: `{type:"cash",amount:100}`,
`{type:"hype",amount:2}`, `{type:"discourse",add:-2}`, `{type:"protesters",set:0}`,
`{type:"flag",name:"agreed"}`, `{type:"news",text:"…",tone:"joke"}`,
`{type:"thought",text:"…",count:3,kind:"protester"}`, `{type:"place",kind:"fountain",near:"gate"}`.
Card `when`: `{stat:"day",atLeast:20}`, `{flag:"agreed",daysAgo:2}`, or `{all:[…]}`.

JSON statechart subset: `id`, `initial`, `states`; node `initial`, `states`,
`type:"final"`, `entry`, `exit`, `on`. Transitions are target strings or
`{target?,guard?,actions?}`, or arrays of these. Targets are sibling paths,
including a sibling's descendants; `.child` enters a descendant of the source.
Compound nodes need an initial child. No `after`, actors, inline JS, parallel
states or random calls. XState graph checks structural reachability, ignoring
whether guards can actually fire. Sim time is ticks; RNG remains owned by the game.

## Ten worked examples

Each JSON block is a complete **content patch** (put it under `content` in the
manifest); example 7 is a top-level skin fragment. Minimal envelope:
`{"apiVersion":1,"id":"my-mod","name":"My Mod","version":"1.0.0","content":{…}}`.
All names must be parody. Local assets map ids to relative files; bundle inlines
PNG/JPEG/WebP/GIF, fonts or GLB into data URLs (2 MiB aggregate; no remote assets).

1. Rename rivals using their ids, not their display names.
```json
{"rivals":{"override":[{"id":"anthro","name":"Steve (Safety-Flavoured)"},{"id":"openish","name":"Steve (Formerly Non-Profit)"},{"id":"metameta","name":"Steve's Very Large Lab"}]}}
```
2. A headline pack. Omitted triggers default to filler.
```json
{"headlines":{"add":[{"id":"drama-fetch","text":"Lab replaces benchmark with tennis ball; all models retrieve","tone":"joke"}]}}
```
3. A thought set for a faction: today target the existing protester kind. Arbitrary
`faction` fields await the faction API; do not invent them.
```json
{"thoughts":{"add":[{"id":"dog-opinion","kind":"protester","when":"always","text":"I support open treats. I oppose closed doors."},{"id":"dog-water","kind":"protester","when":"protest","text":"Water bowl transparency NOW."}]}}
```
4. A new building needs its entire data record.
```json
{"buildings":{"add":[{"id":"opinion-booth","kind":"opinion-booth","name":"Opinion Booth","size":[1,1],"price":1000,"upkeepPerDay":10,"blurb":"Unlimited opinions. Two seats.","color":"#d8ac48","hosts":["researcher"],"capacity":2,"stay":[2,4],"serves":{"researcher":{"focus":0.2}}}]}}
```
5. A two-step arc with a card; both records have unique ids. The card can be
validated today; the arc-to-card params contract awaits M1b.
```json
{"events":{"add":[{"id":"fetch-card","title":"Fetch Summit","body":"A ball and a position paper, please.","tone":"joke","when":{"stat":"day","atLeast":20},"choices":[{"label":"Throw the ball","hint":"Discourse -2","effects":[{"type":"discourse","add":-2}]}]}]},"arcs":{"add":[{"id":"fetch-arc","initial":"waiting","states":{"waiting":{"on":{"DAY":{"target":"resolved","guard":{"type":"day.after","params":{"day":20}},"actions":[{"type":"card","params":{"id":"fetch-card"}}]}}},"resolved":{"type":"final"}}}]}}
```
6. A disaster-shaped card using today's supported effects. FLT-17 verbs are not
registered on this baseline, so do not invent `disaster.*` actions. Upgrade this
example only after its schema/vocabulary lands.
```json
{"events":{"add":[{"id":"biscuit-shortage","title":"Strategic Biscuit Reserve Empty","body":"The crowd has opinions and receipts.","tone":"bad","when":{"stat":"hype","atLeast":30},"choices":[{"label":"Restock","hint":"Costs $500","effects":[{"type":"cash","amount":-500},{"type":"hype","amount":2}]}]}]}}
```
7. A skin tweak (top-level fragment). Flat CSS only, no imports or remote URLs.
```json
{"skin":{"id":"golden-hour","name":"Golden Hour","tokens":{"--accent":"#d8ac48"},"css":".fetch-note { color: #d8ac48; }"}}
```
8. Rename the protester entity without claiming a new 3D dog mesh.
```json
{"walkerKinds":{"override":[{"id":"protester","name":"Golden Retriever with Opinions"}]}}
```
9. A model represented as a flow, independent of its future rendering.
```json
{"walkerKinds":{"add":[{"id":"biscuit-model","name":"Biscuit Model","presentation":"flow","needs":[]}]}}
```
10. Add, then override your own entry; remove it if the pack should suppress it.
```json
{"tips":{"add":[{"id":"fetch-tip","text":"Paths help."}],"override":[{"id":"fetch-tip","text":"Paths help people. Opinions need no path."}],"remove":["fetch-tip"]}}
```

Validate the edited manifest, then `flt-mod bundle <dir>` and check the resulting
`.fltmod.json`. Keep the checker transcript and its deferred list with the mod.
