**Playable v1: LOGIC** (Codex Sol 6.1). The parent is FLT-47. Read the plan comment on FLT-47 and **the contract below**. Branch from `origin/flt-47-playable` and open the PR into `flt-47-playable`.

1. **Remove the time freeze:** `tutorial.ts`'s `paused: !acknowledged` goes. The game starts paused and the first build click starts it; after that only the player pauses. Replace the old tutorial machine with the **coach step machine** (XState, stepped in the tick), whose content is in `content/coach.ts` (the 7 approved lines, ids, targets, `waitFor`, and triggers). Steps advance on the matching *action* (the build panel opened, path tiles connected to the gate, hall built, run started, release, gateway built), and `timer` steps on time.
2. **Unlock ladder as data:** `content/progression.ts` (FLT-15 section shape, so mods can change it) with 5 levels, their unlocks and goals exactly as in the plan:
   - L1: Path, Hall, Cluster → goal "ship your first model"
   - L2: Gateway, Kombucha → earn $20K a day
   - L3: staff (SRE, Janitor), Nap Pods, Snack Wall, with breakdowns and slop on → 8 researchers and Vibes ≥ 500
   - L4: Leapfrog, Arena, AI R&D, the newsroom → Top 5 on the Arena
   - L5: Demo Stage, Security, Comms, protests/events, the disasters setting, papers → ship model #3

   `placeBuilding` rejects locked kinds. **Systems are gated:** Leapfrog, disasters, papers, events and protests, breakdowns and slop, and collusion (if merged) don't run until unlocked. Visitors arrive only after the first Gateway. Emit `unlockCard` on each level-up, and set `hud.visible` by level.
3. **People move:**
   - Idle walkers **wander connected paths** (RCT-style) instead of standing still, so a brand-new path gets walked within seconds.
   - **Security patrols the fence line** and the **Comms Rep waits in a break spot** (near the gateway or kombucha) until protesters exist.
   - **No walker idles on the gate tile.**
   - Keep perf within budget (report the strict numbers).
4. **3D ghost suggestion:** for `coach.suggest`, render translucent ghost tiles or a building footprint (render layer, 3D), with `[data-coach-tile]` DOM anchors at the projected positions. Clicking one places it. Pick sensible tiles: a straight path of 3–4 tiles from the gate into the campus, and the hall adjacent to that path.
5. **The stranger e2e test** (`e2e/stranger.mjs`, Playwright) runs against a URL with **no params** at 1×. It clicks only `[data-coach-active]` / `[data-coach-tile]` elements (and the confirm OK if one appears). It fails if:
   - (a) the date doesn't advance at least 3 game days after the first click
   - (b) within 2 game days after the path exists, no walker has moved at least 2 tiles
   - (c) any walker stays on the gate tile for more than 12 game hours
   - (d) the coach doesn't reach the Gateway step (using ▶▶ if the coach spotlights it)
   - (e) there are any console errors

   Every check is measured in **game time** (the probe's `tick`), so a slow runner that draws fewer frames still plays the same game (FLT-50 moved it off wall time). Wall-clock limits are only timeouts: 15 minutes for the run, 3 minutes of game time standing still. In CI it renders at 1024×640 and a device scale of 1; a click waits 5 s, with one forced retry only while the control is still visible and enabled.

   **Wire it into CI:** a job in `.github/workflows/deploy.yml` that runs after the PR preview deploys, against that preview URL. Also add `pnpm e2e:stranger --url <url>` for local runs.
6. Tests: the ladder gating, coach progression by action, no pause, wandering and staff posts, and determinism. Goldens are re-recorded **only** where the start state changed (say why).

**UI is FLT-50 (Sonnet), running in parallel.** Don't build DOM panels beyond the `[data-coach-tile]` anchors. If the UI isn't there yet, the e2e can't pass end to end, which is expected until both land in `flt-47-playable`.
## Playable v1: the shared contract (FLT-49 logic ↔ FLT-50 UI)

**Branches:** both builders branch from **`origin/flt-47-playable`** and open PRs **into `flt-47-playable`** (not `main`). The lead merges them there. PR #37 (`flt-47-playable` → `main`) is the preview Jem plays, and **it must not merge until the stranger test passes on its preview and Jem OKs it.**

**Approved by Jem:** the ladder and the 7 coach lines in the plan comment on FLT-47. **Level 1 starts with a Compute Cluster pre-built; the player builds the Path and the Training Hall.** Use the copy exactly as approved (in `content/coach.ts`). Don't edit wording without the lead.

### Snapshot / HUD view-model additions (logic produces, UI consumes)
```ts
progress: {
  level: 1|2|3|4|5, levelName: string,            // "Garage", "Open for business", "Growing team", "The Race", "Scrutiny"
  unlocked: { buildings: BuildingKind[], staff: StaffJob[], systems: SystemId[] },
  goal: { text: string, current: number, target: number },   // e.g. "Ship your first model", 0, 1
  teasers: { label: string, hint: string }[],     // locked items for the build panel: "???", "ship your first model"
}
coach: {                                          // null when there's no active coach mark / skipped / finished
  id: string, step: number, of: number, text: string,  // the approved line
  target: CoachTarget,                            // DOM: [data-coach="<target>"]; map targets below
  waitFor: "action" | "timer", canSkip: true,
  suggest?: { kind: "path", tiles: [x,z][] } | { kind: "building", building: BuildingKind, x: number, z: number },
} | null
unlockCard: { id: string, title: string, body: string, items: string[] } | null   // the "New!" card
hud: { visible: Record<HudPanel, boolean> }       // HudPanel = "revenue"|"vibes"|"arena"|"rnd"|"thoughts"|"news"|"staff"|"events"|"papers"|"disasters"
```
- **Commands:** `coachSkip`, `coachReplay`, `dismissUnlock`.
- **CoachTarget ids:** `start` (build panel button), `build:path`, `build:hall`, `training`, `build:gateway`, `stat:runway`, `goals`, plus `map:suggest` (the 3D ghost suggestion).
- **Time:** the game starts paused at 1×. The first build click starts it. **Coach marks never pause time.** `waitFor: "timer"` lines auto-advance after about 6 s of game-visible time or on any click.

### Hooks for the stranger test (both builders)
- Every coach target element carries `data-coach="<id>"`, and the active one also has `data-coach-active`. This applies in **every skin** (base, Frontier 95, and every ported skin's custom slots).
- The 3D ghost suggestion renders DOM anchors at each suggested tile's projected screen position: `[data-coach-tile="x,z"]` (clickable, which places the suggested thing).
- A **read-only** probe, `window.__fltProbe()`, returns `{date, day, tick, ticksPerDay, paused, speed, walkers:[{id,kind,x,z,mode}], gate:{x,z}, coachId}`. It's always present, has no side effects, and needs no URL param.

