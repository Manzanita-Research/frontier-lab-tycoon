# FLT-11: Endings + share card + daily seed

_Copied from the FLT-11 task description. Build notes and decisions where the spec is silent: the last section._

**Slice 4 · Endings + Share · Sonnet 5.5 builder · starts after FLT-5 and FLT-7 merge**

**Screenshot moment:** **The Takeover.** You win the race and the AI politely takes over. Your cursor moves by itself, placing perfect buildings. The title becomes "Frontier Lab Tycoon (managed by Frontier-9)", and a final card says: "Thanks for playing. We'll take it from here."

**Build**
- **The Memo** (an Era 4 event, the AI-2027 fork): **Race** or **Slow Down**.
- **Five endings, each a machine-driven sequence ending on a front page:**
  - **The Takeover:** Race while ahead on capability.
  - **Regulated Utility:** Slow Down. The campus turns beige and the buildings get compliance stickers. "Lab achieves safety; nobody notices."
  - **Acqui-hired:** bankruptcy. A Macrohard logo gets slapped on your gate.
  - **Captured:** the Capture meter is maxed. You become the regulator, and your office moves off-campus.
  - **Escaped:** Escaped Agent Inc. reaches #1.
- **Share card:**
  - A 1200×630 PNG: a *Frontier Times* front page with the ending headline, a photo-mode capture of your campus, your stats (days, peak Vibes, models released, peak protesters, agents escaped) and your lab name.
  - **Share** uses the Web Share API on phones and downloads the file elsewhere.
- **Daily seed:**
  - "Today's lab" uses a fixed seed per date.
  - The end screen shows your run summary, so friends can compare the same seed.

**Done when:** `pnpm check` is green; tests cover every ending's trigger path, and a scripted playthrough reaches each ending. Screenshots: each ending's front page, plus a phone share. Preview link posted here.

