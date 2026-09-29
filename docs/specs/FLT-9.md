# FLT-9: The Race

_Copied from the FLT-9 task description on Sep 29 (Sonnet 5.5 builder). Decisions where the spec was silent are listed in the PR._

**Slice 2 · The Race · Sonnet 5.5 builder · runs alongside FLT-10**

**Screenshot moment:** the Frontier Arena leaderboard shuffles and you drop from #1 to #4 the same week an open-weights lab releases a free model matching yours. Then a full-screen card: **"ERA 2: CODING AUTOMATION. The interns have been automated. The interns are fine."**

**Build**
- **Weekly cycle:** every 7 game days rivals act, the leaderboard updates, and the news cycle turns.
- **Rivals** (6 parody labs, each a machine `idle → training → releasing → cooldown`, with personality parameters for cadence, growth, openness, poaching and hype-hunger):
  - **Anthropomorphic:** safety-first, ships late, writes essays.
  - **Open-ish AI:** ships every week, product sprawl.
  - **MetaMeta Superintelligence Labs:** poaches with $100M offers, flip-flops on open weights.
  - **Very Safe Superintelligence Inc.:** no product, $30B valuation.
  - **Sirocco:** open weights, releases via a torrent link at 3am.
  - **Macrohard:** BigCo, bundles everything into spreadsheet software.
  - Parody names only; no nationalities.
- **Frontier Arena leaderboard:** a score from capability and hype, with animated reordering and a rank chip in the TopBar ("#4 on Arena ↑2").
- **R&D multiplier:** `1 + agents × agentSkill(capability) / max(1, researchers × 10)`, shown big: "AI R&D: 3.2× faster than humans alone". It speeds up training.
- **Eras by multiplier:** 1 Stumbling Agents (< 2×), 2 Coding Automation (2–5×), 3 Superhuman Coder (5–25×), 4 Intelligence Explosion (> 25×). Each era has:
  - a full-screen title card with a one-liner
  - new agent looks
  - its own thought and headline pools
  - faster event pacing
  - more aggressive rivals
  - Stumbling Agents thought: "I ordered 400 burritos to the office. Was that the task?"
- **Open-weights drop:** when an open-weights rival comes within 10% of your capability, your revenue per capability drops 30% for 30 days. A card offers: **Cut prices** (revenue −15% permanently, hype +), **Release last year's model as "open"** (hype ++, Sirocco loses momentum), or **"Raise safety concerns"** (sets the flag for the FLT-5 Capture arc).
- **Compute auction** (a card about every 40 days): bid Low/Mid/All-in against the rivals. Winning unlocks and grants a **Datacenter** (4×4, +60 compute/day). It needs power: **Gas Turbine** (cheap, discourse +) or **Solar Farm** (pricey, hype +).
- **Funding rounds:** when runway is under 3 months and Vibes > 400, investors offer a round at a valuation derived from capability, hype and rank. "{lab} raises at $500B valuation on $4B revenue; 'it's about the future'."
- **Scenario:** the Y1 goals become a 45-minute run: reach Era 3 and Top 3 on the Arena by Y3. The final endings arrive in FLT-11.

**Done when:** `pnpm check` is green; tests cover rival machines, leaderboard, multiplier and era transitions, the open-weights trigger, the auction and a funding round. Screenshots: leaderboard shuffle, era card, auction card, phone. Preview link posted here.

