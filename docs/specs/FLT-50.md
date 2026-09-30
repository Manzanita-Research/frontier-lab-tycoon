# FLT-50: Playable v1 UI: coach marks (paperclip), Start build panel + teasers, New! cards, hidden HUD, Help ▸ How to play

**Playable v1: UI** (Sonnet 5.5). The parent is FLT-47. Read the plan comment on FLT-47 (the mockups are attached there) and **the contract below**. Branch from `origin/flt-47-playable` (it contains your FLT-29 work) and open the PR into `flt-47-playable`.

1. **Coach marks:**
   - A dimmed overlay with a spotlight on `[data-coach="<coach.target>"]`, plus the balloon with the approved line, "N of 7" and **Skip tutorial**.
   - This goes through a new `Coach` slot: the **paperclip** in Frontier 95, the base balloon in other skins.
   - No Continue button except on `timer` lines (optional "Got it").
   - **Replace** FLT-29's old tutorial UI (the Next buttons).
   - Start ▸ Help ▸ **Replay tutorial**.
2. **Build panel:** building choices live in a panel you open (the Start menu in Frontier 95, and a single "Build" button plus panel in the base skin). Show **only unlocked items**, then **locked teasers** ("🔒 ??? · ship your first model") from `progress.teasers`. Every item carries `data-coach="build:<kind>"`.
3. **"New!" unlock cards** from `unlockCard`: small and celebratory, RCT news-style (Frontier 95: a message box "New items available!" listing the items). `dismissUnlock` closes it.
4. **Hide HUD windows until unlocked** using `hud.visible` (Arena, AI R&D, Thoughts, News Room, Staff, papers, disasters, events). Level 1 shows only cash, runway, date, speed, the training bar (once running), goals and the ticker.
5. **Goals:** a single clear line from `progress.goal` ("Ship your first model · 0/1"), with `data-coach="goals"`.
6. **Help ▸ How to play:** one window (Frontier 95 Win95 Help; the base skin's own), covering the loop in 5 bullets, one line per unlocked building, and what cash/runway/Vibes/hype mean. Plain, warm copy with no jokes in instructions (the jokes live in the world). Put the text in `content/help.ts`.
7. **Every skin needs `data-coach` hooks.** Add them to the merged ported skins' custom slots (Discovery Disc '96, Homepage '98). The Swag Drop, Karaoke Night and Field Almanac port builders are adding them in their own PRs.
8. **Evidence:** `pnpm shots` before/after of steps 1–5 in Frontier 95 plus the base skin, and phone. Follow the mockups on FLT-47.
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
- A **read-only** probe, `window.__fltProbe()`, returns `{date, day, paused, speed, walkers:[{id,kind,x,z,mode}], gate:{x,z}, coachId}`. It's always present, has no side effects, and needs no URL param.
