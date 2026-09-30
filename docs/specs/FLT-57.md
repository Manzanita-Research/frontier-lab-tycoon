# FLT-57: Endings II: no dead ends (Found a new lab), the Memo countdown, streaks + friend-comparison links

_Copied from the FLT-57 task description. Build notes and decisions where the spec is silent: the last section._

**Endings II: no dead ends, and a reason to come back** (follow-ups from the lead's review of FLT-11, #62).

1. **No dead ends:** **Acqui-hired** and **Pivot** endings offer **"Found a new lab"**. It's a New Game+ lite:
   - You keep one perk: the famous-founder hype bonus, a loyal researcher who follows you, or extra seed money.
   - The lab name gets a suffix ("Reward Hacking Holdings 2: This Time It's Aligned").
   - The share card says "Lab #2".
   - Every ending ends with a clear next action.
2. **The Memo** (FLT-11): give it a visible countdown before it lands and an aftermath once it has (a front page, staff reactions and a lingering effect).
3. **A reason to return to Today's lab:**
   - **Streaks:** consecutive days played, with a streak flame on the share card. Use localStorage only (no accounts, no backend) and inject the date so tests are deterministic.
   - **Friend comparison by link:** the share URL encodes your result (ending, day, a couple of stats). A friend who opens it sees a banner such as "Your friend's lab was Captured on day 212. Beat it?" and plays the same seed.
   - Nothing personal is ever encoded.
4. **Captured** must fire once #58's Capture meter is in (the merge train verifies that). Add a test for it here as well.
5. **Escaped:** leave a clear hook and don't fake it; nothing can trigger it yet.

**Rules:**
- Copy is short and lands on first read.
- Parody names only.
- All six skins show the new ending actions (Frontier 95 first).

**Evidence:**
- Before/after screenshots of the Acqui-hired ending, the share card with a streak, and the friend banner (1440×900 and 390×844).
- Tests for the streak and the link encoding.
- The stranger e2e green on the preview.

## Build notes (where the spec was silent, we picked the funnier option)

- **Every ending says "What now?"**, with a prompt and one clear next action (`next` on each ending in `mods/base-endings/mod.json`). Acqui-hired and The Pivot offer **Found a new lab**. Captured says "Keep regulating", since you run the Office now. Regulated Utility says "Keep the lights on", and The Takeover says "Watch Frontier-5 work". That button now comes first; Share moves down beside **Copy a challenge link**, Copy run summary, New lab and Play today's lab.
- **Found a new lab** keeps the seed and the campus map, puts a sequel on the name, and lets you keep one of three things:
  - **Famous founder:** Hype starts 25 higher.
  - **A loyal researcher:** they follow you out the door with the role "Followed you here". Training runs 10% faster while they stay, and they think "I followed you here. Don't make it weird." The loyal researcher is the happiest one you had.
  - **Extra seed money:** "a 'second-time founder premium'", $2M.
  
  Sequel names go "2: This Time It's Aligned", "3: Return Of The Founder", "4: Back In Stealth Mode", "5: Series Z", "6: Pivot Harder", then "N: We Mean It This Time". A second-time founder skips the coach. Lab #N shows beside the name, on the card and in the summary. "Start from scratch" replaces "New lab" when there's a sequel on offer. State lives in `GameState.lineage` (additive), applied by `src/sim/endings/lineage.ts`.
- **The Memo countdown** runs five days. The rumour goes on the ticker ("A memo is going round … Nobody has read page two yet"), then there's one line a day: "Page one is a chart." → "Page two is the same chart, steeper." → "Legal has read it. Legal has gone home." → "Someone printed it. The printer is still warm." → "It's on your desk tomorrow." It isn't a dialog and it doesn't pause the game. In Frontier 95 it's a Windows file copy that takes five days ("Copying… MEMO.DOC From 'Leadership' to 'Your desk'"), with a paper icon flying between folders; the bar turns red on the last day. The other skins get a small paper strip above the build bar.
- **The Memo's aftermath:**
  - A late-edition front page ("… Ticks The Box Marked RACE / SLOW DOWN") with three named staff saying it out loud as bubbles. The first walker of each kind speaks, so no dice are drawn and the goldens are untouched.
  - A "From now on" list. **Race:** training +25%, and the protest grows 4% a day. **Slow Down:** training at half speed, and the protest shrinks by a quarter a day ("The protesters go home").
  - A chip in the stats, and memo-flavoured thoughts for the rest of the game.
  - The late edition shows only within 2 days of the answer, and once. A reloaded save doesn't shout old news.
- **Streaks:** only localStorage (`src/ui/share/streak.ts`, with the store and date injected for tests). Today counts once a game day has passed on this page, so a paused screenshot doesn't. From two days in a row, a toast says "🔥 3-day streak. See you tomorrow." The card paints a three-tongued flame; no emoji, because headless browsers and some phones draw them as boxes. `?streak=N` pins a streak for screenshots and is never stored.
- **Friend links:** `?seed=123&vs=captured.212.88.7` (or `seed=daily&date=…` for Today's lab). They carry the ending, the day, peak Vibes, models released and the seed, and never the lab's name, the streak or anything about the person.
  - A friend who opens one gets a message box: "Your friend's lab was Captured on day 212. Beat it?", with their stamp and stats, and "Same seed, same campus. Nobody's name in the link."
  - At the end they see a verdict: "You beat your friend's lab." / "Your friend's lab wins. Rematch?" / "A dead heat. Suspicious."
  - Verdict order: a better ending wins (good > neutral > bad). Between endings of the same kind, a good or neutral one wins by getting there sooner and a bad one by holding out longer. Then peak Vibes, then models.
  - A challenge applies only on its own seed and Lab #1 (a sequel lab isn't the same game). A Lab #2 link replays the seed without the perk.
  - Each ending has a `brag` phrase for the banner ("was Acqui-hired", "was taken over by its own model", "pivoted to NFTs").
- **Captured** fires from #58's `capture` meter; `sequel.test.ts` stages it.
- **Escaped** is a stat hook only (`escapedAhead` in the driver); nothing can trigger it yet.
- **Phones:** on a 390px screen the "What now?" block is below the fold, so a floating **What now? ↓** button scrolls to it and hides once it's in view (`useJumpTo` in the skin kit).
