# FLT-55 evidence: the acceptance test, after M1c

The FLT-55 "done when" asks for a mod made from the skill alone, on the first try. The brief said to spawn nothing: write the
prompt a fresh agent would get, then do it in a clean temp dir using only the skill, and report honestly what was missing.

**Caveat, up front:** the builder who ran this also wrote the looks renderer and the skill section, so this is a test
of whether the skill contains enough, not a test of a stranger's first reading. FLT-37's run with a real headless agent
(`FLT-37-fresh-agent.md`) is the stronger kind of evidence; rerun that with this skill when the kit is next touched.

## The prompt

> Make me a Frontier Lab Tycoon mod where the protesters are all golden retrievers. You have only the `SKILL.md` in the
> scaffold. Scaffold it, run `flt-mod check` until green, and give me a `?mod=` link.

## The run

- `node packages/flt-mod-cli/create.mjs good-boys` in `/tmp/accept` (a clean directory outside the repo). The scaffold
  carries `SKILL.md`, `AGENTS.md` and the starter `mod.json`.
- Wrote [`FLT-55-good-boys.mod.json`](FLT-55-good-boys.mod.json) using only the skill. From "Presentation", it has:
  - an 11-part retriever recipe, adapted from the skill's sheep (example 7): head at +z, legs with `step`/`step-alt`, a wagging tail, floppy ears
  - four golden coats and four placards
  - a `good.woof` cue and an override of `protest.grow`
  - the "protesters on day 1" recipe from "When the player sees it": a `progression` override plus an arc adding 16 discourse
  - three thoughts and two headlines
- **1 check run, green.** Wall clock from the scaffold to green: 34 s. Writing the JSON was the rest; about three minutes all told.
- Loaded it with `flt-mod dev` on 5174 and `?mod=http://localhost:5174/mod.json`:
  [`docs/img/flt-55/acceptance-stranger-mod.png`](../../../docs/img/flt-55/acceptance-stranger-mod.png). The dogs are recognisable, trot, and hold
  the placards on the first try.

```
PASS good-boys@1.0.0: 365 days, 7300 ticks, 32 cards answered, 2 releases
Replay identical: a542ea6a…; cash $6275600; 2062 ms
Arc reachability: 11 arcs checked with xstate/graph (structural, guards/actions omitted), 10 of them the base game's, unchanged
  gb-arrival: 2 states, 2 configurations
Your arcs ran in the sim: gb-arrival ended in "picketing"
Executed: progression, headlines, thoughts, arcs (the real sim ran with your definition)
Sound: adds good.woof; replaces protest.grow; arcs play good.woof
Look: protester is a recipe (11 parts, 4 placards, "Golden Retriever")
```

## What was missing (and what changed because of it)

- **Fixed:** the first check listed all ten of the base game's arcs (FLT-25/33's water escalation and faction arcs) as
  if they were the mod's, and "Arcs ran in the sim" was a wall of them. `flt-mod check` now counts the base game's
  unchanged arcs and lists only yours. (That is the second check run in the log above; the mod didn't change.)
- **Fixed in the skill:** the base protester thoughts ("I'm here for the water. And the free kombucha.") still showed
  beside the dogs' own. They are anonymous lines a mod can remove only by index, and the skill didn't say which. It now
  names them (`base-thoughts-74` to `-78`), and the example mod removes them.
- **Open:** `check` can't hear the bark. The skill says how to write a cue and when the hooks fire, but the only way to
  hear it is to load the game.
- **Open:** the recipe coordinates took one careful read ("faces +z", "a leg's pivot is half its height"); a
  wrong-facing dog would still pass `check`. A `flt-mod preview` screenshot (FLT-15's MCP idea) is the real fix.
