---
name: flt-modding
description: Create, edit, validate, bundle and load data mods for Frontier Lab Tycoon, including headline packs, rival renames, entity thoughts, buildings, cards, JSON story arcs, disasters, Release Leapfrog benchmarks and mishaps. Use for FLT mod.json or mod.ts authoring, Daily Drama content packs, and loading a mod with ?mod=.
---

# Frontier Lab Tycoon modding

Start from the supplied template (`pnpm create-mod my-mod` in the game checkout).
Edit `mod.json`; run **`flt-mod check` until green**. From the game checkout use
`pnpm flt-mod check /path/to/mod.json` if the bin is not on PATH. A scaffold's
`pnpm test` calls that same checker. JSON is the shared format. Optional trusted
local `mod.ts` (copy the supplied `mod.example.ts`) exports `defineMod({...})` from `@flt/mod-sdk`; directory commands
prefer it. `flt-mod bundle /path/to/mod mod.json` converts it to JSON.

`check` validates the schema, composition, every guard/action name **and its
params**, card ids and arc graphs, then plays seed 42 for 365 days **in the real
sim with your definition**, twice, answering every card, and compares the World
byte for byte. The report says which sections executed, which state each arc ended
in, and which sections validate but nothing reads yet (`walkerKinds`, `endings`,
`tips`, `tables`; a manifest's `skin`, `assets` and `audio` are not applied either).
A green check proves the content runs; it does not prove how it looks. For that,
load it in the game.

## Loading a mod: `?mod=`

Add `?mod=<url of a mod.json>` to the game's address and reload:

- The shipped example on any build, preview or PR preview:
  `https://<the site>/?mod=/mods/examples/every-lab-is-steve/mod.json`
  (every Arena rival is Steve). Relative URLs resolve against the site.
- Your own mod while you work: `flt-mod dev <dir>` serves it with CORS on
  `http://localhost:5174/mod.json`; open the game at
  `http://localhost:5173/?mod=http://localhost:5174/mod.json`. Each reload rereads it (no hot reload).
- A public gist: `?mod=gist:<hex id>` (its `mod.json`, or its only `.fltmod.json`).
- Several: repeat the parameter (`?mod=a.json&mod=b.json`). They load in order; later mods wrap earlier ones.

**When the player sees it.** A game day is about 6 seconds at 1x speed (a tick is
1.2 game hours, 20 ticks a day). A new game starts in the garage and unlocks
systems as the player climbs the ladder (`progression`): the Arena board and the
news ticker at level 4 (`race`), protesters, random cards and disasters at level 5
(`scrutiny`). Arcs run from day one, and their toasts, camera moves and the cards
they open show at any level (in the default skin a toast waits while the first-run
tutorial is on screen: a player who has skipped or finished it sees it at once). Rival renames show on the Arena board once it is
unlocked. Reaching level 5 takes a while (several models and a top-5 Arena rank),
so a mod that needs a late system in the first minutes should move it down the
ladder itself: override a level and list the system there, e.g.
`"progression":{"override":[{"id":"garage","level":1,"name":"Garage","buildings":["hall","cluster"],"staff":[],"systems":["protests"],"panels":[],"goal":{"text":"Ship your first model","metric":"models","target":1}}]}`
(override replaces the whole entry, so copy the base fields). With that and an arc that
adds 8+ discourse on the first DAY, protesters stand at the gate on day 1 of a new game.
To look at a late-game mod straight away without changing the ladder, add
`&scenario=midgame` (a campus 480 days in, every system unlocked):
`?mod=/mods/examples/every-lab-is-steve/mod.json&scenario=midgame`.

**The starter `mod.json` shows every section, not every effect.** Its `walkerKinds`
"Golden Retriever" sprite, `endings`, `tips` and `skin` validate but change nothing on
screen yet, and `names.DOG_NAMES` is a pool nothing draws from (only the name pools
listed below are read). Delete what you don't use; `check` lists the sections left
that nothing reads.

A mod that fails to fetch or decode is skipped and the rest still load; if the set
fails to compose, the game starts unmodded. Either way the reason is listed in the
Mod Manager (Frontier 95: Start menu, **Mods…**), which also lists what loaded.
Nothing is installed: remove the parameter and reload to play the base game. A
saved run records its mods' ids, versions and content hash.

## Contract and canonical ids

Manifest: `apiVersion: 1`, kebab-case `id`, nonempty `name`, `version`; optional
`author`, `description`, `content`, `skin`, `assets`, `audio`. Unknown keys fail.
Each content section accepts `add`, `override`, `remove` in that order. Adds need
complete entries and unused ids; overrides need existing ids; removes list existing
ids. Fields merge only at the top level: nested objects/arrays replace whole fields.
Later mods wrap earlier ones; conflicts report consecutive touches, without waiving
missing-id/duplicate-add errors. Buildings require **id equal to kind**.

- Rivals: `anthro`, `openish`, `metameta`, `supersuper`, `sirocco`, `macrohard`. `name`
  is the Arena's long name, `short` its short one.
- Buildings: `cluster`, `hall`, `gateway`, `kombucha`, `nap`, `snack`, `demo`,
  `fountain`, `datacenter`, `gas`, `solar`, `security`. A new building also needs a
  rung in `progression` (below) or the checker rejects it. It renders as a plain
  coloured block in its `color`.
- Progression (the unlock ladder): `garage`, `business`, `team`, `race`, `scrutiny`.
- Coach lines: `start`, `path`, `hall`, `training`, `gateway`, `runway`, `goals`.
- Goals: `release`, `era`, `arena`.
- Cards (`events`): `waterDiscourse`, `drumCircle`, `openWeights`, `era2`, `era3`,
  `era4`, `fundingRound`, `computeAuction`, `shipNow`, `collusion-sign`, the
  livestream cards `stream:<mishap id>`, and disaster cards `dz:<disaster>:<card>`
  (change those through `disasters`, not `events`).
- Disasters: `rogueSwarm`, `gpuFire`, `weightsLeak`, `viralJailbreak`, `gridBrownout`.
- Benchmarks: starters `mmlu`, `humaneval`, `swe`, `gpqa`, `arc`, `hle`, `arena`;
  successors `mmlu2`, `mmlu3`, `humaneval2`, … `hle3` (each `replaces` the one before).
- Mishaps: `dog`, `wrongChart`, `comingWeeks`, `frozen`, `systemPrompt`, `hotMic`, `wrongModel`.
- Name pools (`names`, `{id, values}`): `LAB_NAMES` (your lab's name), `FIRST_NAMES`,
  `LAST_NAMES`, `RESEARCHER_ROLES`, `AGENT_NICKNAMES`, `RIVALS`, `RIVAL_SHORT`,
  `THEIR`. An override replaces the whole pool. (`VISITOR_ROLES` validates but is not read yet.)
- Entities (`walkerKinds` is a historical section name): `researcher`, `agent`,
  `visitor`, `protester` (rename one with `override`; `add` is for new ids). Keep
  `presentation: walker | flow | sprite | offmap` separate from mechanics. Don't
  assume every actor walks. **Validated but not read yet: a mod cannot change how a
  walker looks or what it is called on the map.** Make a crowd feel different through
  its thoughts, headlines, toasts, cards and arcs.
- Thought conditions: `always`, `noKombucha`, `lowCash`, `training`, `justReleased`,
  `highHype`, `unreachable`, `crowded`, `discourse`, `protest`, `night`, `era1`,
  `era2`, `era3`, `era4`, `openDrop`, `unpowered`, `top`, `rankFell` (use SDK
  `ThoughtCondition` for the exact baseline; checker rejects unknown conditions).
  Thought `kind` is `researcher`, `agent`, `visitor` or `protester`.
- Headlines: omit `trigger` for `filler`; common triggers `start`, `rival`,
  `runStarted`, `runDone`, `protest`, `built:<building-id>`. `start` fires as a game
  begins (the ticker itself unlocks at level 4, so it is the first line only on a late start). Optional `when` (one of):
  `{"stat.gte":["hype",50]}`, `{"flag.is":["agreed",true]}`, `{"day.after":30}`,
  `{"chance":0.5}`. Text fills `{lab}`, `{model}`, `{rival}`, `{cash}`.
- Legacy anonymous line keys: `base-headlines-N`, `base-thoughts-N` (zero-based
  indices for the pinned content version). Prefer unique add ids for portable packs.

### Cards

A card: `id`, `title`, `body`, `tone` (`good|bad|neutral|joke`), `when`, 1 to 3
`choices` of `{label, hint, effects}`, optional `cooldown` (days). It opens on its
own once a day when its `when` holds: `{stat:"day",atLeast:20}` (stats `day`, `hype`,
`cash`, `capability`, `waterDiscourse`), `{flag:"agreed",daysAgo:2}` (the flag was set
at least 2 days ago), or `{all:[…]}`. A card an arc opens can use an unreachable
`when` such as `{stat:"day",atLeast:100000}` so only the arc opens it.
Choice effects (a different format from arc actions): `{type:"cash",amount:100}`,
`{type:"hype",amount:2}`, `{type:"discourse",add:-2}` (or `set`), `{type:"protesters",set:0}`,
`{type:"flag",name:"agreed"}` (`clear:true` clears), `{type:"news",text:"…",tone:"joke"}`,
`{type:"thought",text:"…",count:3,kind:"protester"}`, `{type:"place",kind:"fountain",near:"gate"}`,
`{type:"trust",amount:2}`, `{type:"voice",amount:5}`.

### Story arcs: JSON statecharts

`arcs` entries (or arc-shaped `events` entries) are `{id, initial, states}`. A node
has optional `initial` + `states` (compound), `type:"final"`, `entry`, `exit`
(lists of actions) and `on`. Transitions are a target string or
`{target?, guard?, actions?}`, or an array of these tried in order (the first
whose guard holds wins). `guard` is one guard or a list that must all hold; a
transition with no guard always fires. Targets name a sibling (or a sibling's descendant,
`sibling.child`); `.child` enters a child of the source. No `after` delays,
actors, inline JS, parallel states or random calls. The checker's graph test is
structural: it ignores whether guards can fire.

**How an arc runs.** An arc hears exactly two events:

- `DAY`: once per game day, at midnight (a day is 20 ticks, a tick 1.2 game hours).
- `CHOSE`: the player answered **any** card (a base card, yours, a disaster's).
  The `choice` guard reads which card and which choice.

Nested states work like XState: the current leaf hears first, then its parents.
Moving exits the states being left (deepest first, their `exit` runs), then enters
the new ones (outermost first, their `entry` runs). A transition with no target runs
its actions and stays. A top-level `final` state ends the arc for the run. The
arc starts, running its initial states' `entry`, at its first beat (normally the first midnight). Actions
run in order, the moment the transition fires. Arcs are deterministic: the same
seed and mods replay exactly.

**Guards** (`{type, params}`):

| Guard | Params | True when |
| --- | --- | --- |
| `day.after` | `day` | today's day number is greater than `day` (day 0 is the first) |
| `stat.gte` / `stat.lte` | `stat`, `value` | the stat is at least / at most `value` |
| `flag.is` | `flag`, `set?` (default true) | the flag is set (with `set:false`, is not set) |
| `choice` | `is`, `card?` | on `CHOSE`: the answer was choice `is`, its position as a string (`"0"`, `"1"`, `"2"`), on card `card`. Always name `card` in an arc |
| `chance` | `p` (0 to 1) | the day's die is under `p`. One die per beat per arc, so ordered transitions share it |
| `after` | `days?`, `hours?`, `ticks?` | the arc has been in this state that long, counted from the start of the day it entered, so `{days:3}` fires on the third midnight |
| `every` | `days?`, `hours?`, `ticks?` | a whole number of that span since the state began: `{days:1}` is every midnight, `{days:7}` weekly |
| `not` | `guard` | the other guard does not hold |
| `any` | `guards` (a list) | at least one holds |
| `progress.gte` | `value` | disasters only (cleanup progress); always 0 in an arc |

Stats: `day`, `cash`, `hype` (0 to 100), `capability`, `compute`, `discourse`,
`trust` (0 to 100, starts at 50), `heat` (0 to 100), `models` (released), `agents`,
`clusters`, `halls`, `gateways`, `datacenters`, `gas`, `solar`, `broken`, staff
counts `security`, `sre`, `comms`, `janitor`, and `sreAttending`. (`burning` and
`adjacent` are disaster-only; 0 in an arc.) The checker suggests the right name for a typo.

**Actions** (`{type, params}`; `?` marks optional params):

| Action | Params | Does |
| --- | --- | --- |
| `cash.delta` | `amount` | adds to the bank (negative takes) |
| `hype.delta`, `trust.delta`, `heat.delta` | `amount` | adds to the stat, clamped 0 to 100 |
| `discourse.delta` | `amount` | the water discourse: 4 points is one protester at the gate (they march in at the next midnight, once protests are unlocked). It fades by 0.3 a day and each compute cluster adds 0.5 |
| `news` | `text`, `tone?` | a ticker headline; fills `{lab}`, `{model}`, `{rival}`, `{cash}` |
| `toast` | `text`, `tone?`, `importance?`, `source?` | a notice. `importance: "world"` (the default) puts it on the ticker; `"you"` makes it a toast over the map, rate-limited to one per 15 real seconds (what piles up comes out as one "N things happened while you were busy" toast). `source` defaults to `mod:<your id>`; set it (`ops`, `staff`, `economy`, `event`, ...) only to file it with a base system |
| `card` | `id` | opens that card from `content.events` (yours or a base one) whatever its `when`; it waits if another card is open. The answer comes back as `CHOSE` |
| `flag.set` / `flag.clear` | `name` | sets a flag (to today's day number) / clears it. Card `when` and `flag.is` read flags |
| `compute.drain` | `pct`, `days?` | lose `pct`% of the compute stockpile and output each day |
| `cost.spike` | `mult`, `days?`, `kinds?` | multiply upkeep (of those building kinds, default all) |
| `revenue.mult` | `mult`, `days?` | multiply API revenue (0 stops it) |
| `auditor.odds` | `mult`, `days?` | multiply the odds of an auditor's visit |
| `effects.end` | `kind?` | end this arc's open-ended effects (`drain`, `spike`, `revenue`, `auditor`) |
| `building.fire` / `building.offline` | `building` (a kind, or `$office`), `text?`, `importance?`, `source?` (offline; its toast is `you` by default) | breaks the best working building of that kind until an SRE fixes it |
| `building.wear` | `building`, `to` (0 to 1) | caps its reliability |
| `building.ensure` | `kind`, `text?` | a free one arrives beside the gate if the lab has none |
| `staff.divert` | `job` (`janitor`, `sre`, `comms`, `security`), `to` (a building kind, `$office` or `gate`), `fraction?` (default 1), `jog?` | pulls that share of the job's current staff off their posts; they stay away until `staff.release` |
| `staff.release` | `job?` | sends this arc's diverted staff back |
| `rival.leap` | `relative`, `open?` | the most open-weights rival jumps to (1 + `relative`) × your capability; `open` ships open weights |
| `camera.focus` | `on` (`gate`, `$office` or a kind), `zoom?` (times closer, default 1.3; 1 = no zoom), `hold?` (seconds, default 2.4) | flies the camera there (not in photo mode) |
| `shake` | `strength` (0 to 1) | shakes the screen |
| `sound.cue` | `cue` (`alarm`, `card`, `era`, `release`) | plays a cue |
| `investigate.start` | `id`, `days`, `job`, `to` | starts an inquiry; advanced, read by the collusion system |

**Always give timed effects `days` from an arc.** Without `days` they last until the
arc calls `effects.end`, which, if it never does, is forever. `$target` and
`$adjacent` only mean something inside a disaster (it has a target building).

### Disasters, benchmarks and mishaps

- `disasters`: `{id, name, blurb, tags?, odds, requires?, target?, initial, states, cards?}`.
  The same statechart language as arcs, but it hears `TICK` (every tick, so
  `after {hours:3}` is precise) and `CHOSE` from its own `cards` (each card has
  choices with a `key`; `choice` `is` is that key). `odds`:
  `{weight, minDay, gapDays, scale?:[{stat, per}]}`. It fires on its own when the
  odds roll, once the `disasters` system is unlocked; a final state ends it. Copy a
  shipped one's shape (`gpuFire` is the simplest) and read `docs/DISASTERS.md` in
  the game checkout for the full schema. Its cards become events `dz:<id>:<card>`.
- `benchmarks` (Release Leapfrog): `{id, name, short, kind:"score"|"elo", difficulty, replaces?}`.
  Entries without `replaces` are in play from day one; one with `replaces:"x"`
  takes over when `x` is solved. Keep at least one starter.
- `mishaps` (livestream accidents): `{id, weight, voice, headline}`; `weight` is the
  relative odds, `voice` the share-of-voice hit (negative hurts). If you also add a
  card `stream:<id>`, it follows the headline.

## Worked examples

Each JSON block is a complete **content patch** (put it under `content` in the
manifest); example 7 is a top-level skin fragment. Minimal envelope:
`{"apiVersion":1,"id":"my-mod","name":"My Mod","version":"1.0.0","content":{…}}`.
All names must be parody: no real companies, products, people or nationalities.
Local assets map ids to relative files; bundle inlines PNG/JPEG/WebP/GIF, fonts or
GLB into data URLs (2 MiB aggregate; no remote assets).

1. Rename rivals using their ids, not their display names. Visible on the Arena board.
```json
{"rivals":{"override":[{"id":"anthro","name":"Steve (Safety-Flavoured)","short":"Steve"},{"id":"openish","name":"Steve (Formerly Non-Profit)","short":"Steve"},{"id":"metameta","name":"Steve's Very Large Lab","short":"Steve"}]}}
```
2. A headline pack, one line gated on hype. Omitted triggers default to filler.
```json
{"headlines":{"add":[{"id":"drama-fetch","text":"{lab} replaces benchmark with tennis ball; all models retrieve","tone":"joke"},{"id":"drama-hype","text":"{lab} hype now measurable from orbit","tone":"joke","when":{"stat.gte":["hype",60]}}]}}
```
3. A thought set for the protesters.
```json
{"thoughts":{"add":[{"id":"dog-opinion","kind":"protester","when":"always","text":"I support open treats. I oppose closed doors."},{"id":"dog-water","kind":"protester","when":"protest","text":"Water bowl transparency NOW."}]}}
```
4. A new building with its rung on the unlock ladder.
```json
{"buildings":{"add":[{"id":"opinion-booth","kind":"opinion-booth","name":"Opinion Booth","size":[1,1],"price":1000,"upkeepPerDay":10,"blurb":"Unlimited opinions. Two seats.","color":"#d8ac48","hosts":["researcher"],"capacity":2,"stay":[2,4],"serves":{"researcher":{"focus":0.2}}}]},"progression":{"override":[{"id":"business","buildings":["gateway","kombucha","opinion-booth"]}]}}
```
5. A story arc: after day 20 it opens a card only it can open, then remembers the answer.
```json
{"events":{"add":[{"id":"fetch-card","title":"Fetch Summit","body":"A ball and a position paper, please.","tone":"joke","when":{"stat":"day","atLeast":100000},"choices":[{"label":"Throw the ball","hint":"Discourse -2","effects":[{"type":"discourse","add":-2}]},{"label":"Write the paper","hint":"Hype +3","effects":[{"type":"hype","amount":3}]}]}]},
 "arcs":{"add":[{"id":"fetch-arc","initial":"waiting","states":{
  "waiting":{"on":{"DAY":{"target":"asked","guard":{"type":"day.after","params":{"day":20}},"actions":[{"type":"card","params":{"id":"fetch-card"}}]}}},
  "asked":{"on":{"CHOSE":[
    {"target":"thrown","guard":{"type":"choice","params":{"card":"fetch-card","is":"0"}},"actions":[{"type":"news","params":{"text":"{lab} throws the ball. The ball is returned, slightly damp","tone":"joke"}}]},
    {"target":"written","guard":{"type":"choice","params":{"card":"fetch-card","is":"1"}},"actions":[{"type":"flag.set","params":{"name":"fetchPaper"}}]}]}},
  "thrown":{"type":"final"},"written":{"type":"final"}}}]}}
```
6. A week-long arc with a timed effect, a daily drip and staff pulled to the gate.
```json
{"arcs":{"add":[{"id":"biscuit-week","initial":"calm","states":{
  "calm":{"on":{"DAY":{"target":"shortage","guard":[{"type":"day.after","params":{"day":30}},{"type":"stat.gte","params":{"stat":"hype","value":40}}]}}},
  "shortage":{"entry":[{"type":"toast","params":{"text":"The Strategic Biscuit Reserve is empty","tone":"bad"}},{"type":"cost.spike","params":{"mult":1.5,"kinds":["kombucha","snack"],"days":7}},{"type":"staff.divert","params":{"job":"janitor","to":"gate","fraction":0.5}}],
    "exit":[{"type":"staff.release"}],
    "on":{"DAY":[{"target":"over","guard":{"type":"after","params":{"days":7}}},{"guard":{"type":"every","params":{"days":1}},"actions":[{"type":"cash.delta","params":{"amount":-200}}]}]}},
  "over":{"type":"final","entry":[{"type":"news","params":{"text":"Biscuits restored at {lab}; morale returns to baseline anxiety","tone":"good"}}]}}}]}}
```
7. A skin tweak (top-level fragment). Flat CSS only, no imports or remote URLs.
Validated, but the game does not apply mod skins yet.
```json
{"skin":{"id":"golden-hour","name":"Golden Hour","tokens":{"--accent":"#d8ac48"},"css":".fetch-note { color: #d8ac48; }"}}
```
8. A new disaster with one card (it rolls on its own after day 30).
```json
{"disasters":{"add":[{"id":"steveOutage","name":"Steve Is Out Sick","blurb":"Every Steve calls in sick at once.","tags":["staff"],"odds":{"weight":0.5,"minDay":30,"gapDays":30},"initial":"warning",
 "states":{"warning":{"entry":[{"type":"news","params":{"text":"All the Steves are out today","tone":"joke"}}],"on":{"TICK":[{"guard":{"type":"after","params":{"hours":2}},"target":"active"}]}},
  "active":{"entry":[{"type":"card","params":{"id":"soup"}}],"on":{"CHOSE":[{"guard":{"type":"choice","params":{"is":"soup"}},"target":"done","actions":[{"type":"hype.delta","params":{"amount":5}}]}]}},
  "done":{"type":"final"}},
 "cards":[{"id":"soup","title":"Steve Is Sick","body":"Send soup?","tone":"joke","choices":[{"key":"soup","label":"Send soup","hint":"Steve appreciates it.","effects":[]}]}]}],
 "override":[{"id":"gpuFire","name":"Steve's GPU Fire"}]}}
```
9. Rename a benchmark, add a harder successor and a livestream mishap.
```json
{"benchmarks":{"override":[{"id":"mmlu","name":"Steve's Last Exam","short":"SLE"}],"add":[{"id":"steve2","name":"Steve's Last Exam 2","short":"SLE 2","kind":"score","difficulty":150,"replaces":"mmlu"}]},
 "mishaps":{"add":[{"id":"steveMic","weight":1,"voice":-2,"headline":"{lab}'s livestream mic picks up Steve eating crisps"}]}}
```
10. Add, then override your own entry; remove it if the pack should suppress it.
```json
{"tips":{"add":[{"id":"fetch-tip","text":"Paths help."}],"override":[{"id":"fetch-tip","text":"Paths help people. Opinions need no path."}],"remove":["fetch-tip"]}}
```

Validate the edited manifest, then `flt-mod bundle <dir>` and check the resulting
`.fltmod.json`. Then load it with `?mod=` (above) and look: the report proves the
content runs, the game shows whether it is funny. Keep the checker transcript with the mod.
