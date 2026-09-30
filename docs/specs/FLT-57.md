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
