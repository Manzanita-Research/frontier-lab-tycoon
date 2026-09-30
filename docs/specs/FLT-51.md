# FLT-51: Notification policy (source + importance; ticker vs toast)

The task's description on the board was empty, so the builder brief is the spec. This is it, verbatim where it matters.

## Why now

Jem's main feedback is *overwhelm*. FLT-31 stopped Release Leapfrog's flood by matching toast **text** in
`src/app/notices.ts`; every other system (ops, staff, economy, the race, mods) still toasted whatever it liked.

## Build

- `addToast(state, text, tone, { source, importance })`.
  - `source`: `leapfrog | ops | staff | economy | coach | event | disaster | papers | collusion | hearing | politics |
    defection | auditors | factions | mod:<id>`.
  - `importance`: `you | world`, defaulting to `world`.
- One policy, in one place in the app:
  - `world` goes to the ticker (and the panel that owns it).
  - `you` becomes a toast, rate-limited to **1 per 15 real seconds**, with a **batch summary** of what piled up.
  - At 3x and up, only `you` toasts.
  - The coach and the confirm are never throttled.
- Mods can set these fields too (update the modding skill).
- Remove FLT-31's text matching. Keep its year-long flood test, now keyed on `source`.
- Merge train: when `origin/flt-wave-2` (FLT-52) exists, merge it and tag every toast those features emit.

## Evidence

- Toasts per real minute at 1x / 3x / 10x in `?scenario=midgame`, before and after, in logic and in the UI.
- A before/after screenshot of a busy moment (`pnpm shots`, `--out docs/img/flt-51`).
- Determinism and the perf tests stay green; report the strict perf number (plain `pnpm check`).

## Where the spec was silent (builder's calls)

- **`world` never toasts, at any speed.** The spec says `world` goes to the ticker and that 3x+ shows only `you`; the
  simplest rule that satisfies both is that `world` is always ticker news. At 1x the lab is calm enough that the ticker
  is where your eyes already are.
- **The window is real time, not game time**, so the faster you play, the fewer toasts per game day.
- **Replies skip the window, if they are about you.** A toast sent while applying your own command or card answer
  ("Build a Training Hall first.") is the answer to what you just did, so it is shown at once, like
  the coach. The pleasantries a reply drags along ("the livestream went flawlessly") are `world` and go to the ticker, or
  they would bury the answer (the paperclip shows only the newest).
- **Four more sources**: `race` (Arena ranks, auctions, poaching), `training` (your releases), `crowd` (demos and
  visitors), `build` (the guardrails on building). They name real systems the list did not cover.
- **The batch leads with the worst of it.** "3 things happened while you were busy. Top of the pile: ..." picks the
  first bad line, else the newest. In Frontier 95 the paperclip says it in its own voice: "It looks like 3 things
  happened while you were busy." with the lines listed, bad news first, and "...and 2 more on the ticker. Would you like
  help with that?" past four.
- **The same words twice are one line** in the pile (two Gateways down is one "API Gateway is out of order").
- **A breakdown is `you` only when nobody can fix it.** With an SRE on staff, "X is out of order. An SRE is on it." is
  ticker news; with none, it is your problem and a toast.
- **"The panel that owns it"** is taken to already show its news (the Benchmarks board flashes a launch, the Staff list
  shows a hire). Per-panel unread badges are a follow-up if they are wanted.
