# FLT-54: Level 5 and high-speed pacing

_The task description, copied from FLT-54. The PR's own notes (what was chosen where this is silent) are at the end._

**Level 5 and high-speed pacing (overwhelm, part 2)** (logic + UI). Runs after the merge train (#60) has landed #59–#63. It's built on FLT-51's notification policy. Sources: the FLT-53 journey test (issues 4–5) and FLT-51's review.

1. **Level 5 dumps everything at once.** Today one card lists 15 unlocks on day 42, and 13 event cards follow within 60 game days, including four hearing cards back to back.
   - Stagger the wake-ups in #53's `PACKS` table: Scrutiny wakes one pack about every 8–12 game days, most dramatic first. Each wake gets its own small New! card.
   - Add a per-arc cooldown so no arc's cards run back to back.
   - Or split the late packs into Levels 6–7 if that reads better; say which you chose and why.
2. **Windows pile up from Level 4.** About ten windows open by themselves and leave a hole roughly 450 px square for the campus.
   - At most 2 auto-opened windows at a time. The rest go to the taskbar as a flashing button (in Frontier 95; the other skins use their own equivalent).
   - Auto-opened windows close themselves when their moment passes.
   - Nothing may cover the campus centre on 1440×900.
3. **Event cards at high speed:** at 10× about 8 cards a minute still interrupt.
   - Add a real-time card budget: at most 1 card per ~20 real seconds, with the rest queued.
   - Minor cards auto-resolve with their default at 10× and log to the ticker.
   - The queueing is by game time, so the sim stays deterministic; only the presentation is rate-limited.
4. **Repetitive toasts:**
   - Coalesce same-kind toasts ("3 staff handed in the box" instead of three toasts).
   - Give staff-quit lines variety.
5. **Unread badges** (a small dot plus a count) on panels whose news went to the ticker.

**Evidence:**
- The FLT-53 journey test (`pnpm e2e:journey`) green, with Level 5 → +60 days reporting at most 1 card per 5 game days and at most 2 auto windows.
- Cards and toasts per real minute at 1×, 3× and 10× in `?scenario=midgame`, before and after.
- Before/after screenshots of Level 4–5 at 1440×900.

