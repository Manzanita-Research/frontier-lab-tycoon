# FLT-33: Factions: the discourse as a sim (e/accs, safetyists, doomers, ethicists, luddites, open-weights maxis…)

**Factions: the discourse, as a sim.** Jem: *"Better represent the dynamics in the movement right now: the schisms between e/accs, safetyists, ethicists, uninformed Instagram luddites, etc."* It's **affectionate satire of everyone, not a lecture.** Every faction is a bit right and a bit ridiculous.

- **Factions (data, in `Content.factions`, so mods can add more):**
  - **Accelerationists** ("e/acc"-flavoured): hoodies, "ship it", love your launch cadence.
  - **Safetyists:** want evals and pauses, read every system card.
  - **Doomers:** a subset of safetyists, but with a timeline and a spreadsheet.
  - **Ethicists:** bias, labour, consent, water.
  - **Open-weights maximalists:** "weights or it didn't happen".
  - **VCs:** hype-positive, runway-agnostic.
  - **Policy wonks:** memos about memos.
  - **Instagram luddites:** vibes-based, loud, easily confused ("is the AI drinking the water").
  - **Normies:** just want the chatbot to write their wedding toast.

  Each faction has **beliefs** (a small vector over axes: speed, safety, openness, fairness, profit), **grievances** (which policies anger them), a **look** (a colour and one prop), and signature **thoughts and chants**.
- **Membership:** visitors and staff get a faction (weighted by kind: VCs are mostly VCs, researchers are split between safetyists and accelerationists, protesters are ethicists and luddites). Don't assume every actor is a walker; factions can also exist as off-map audiences.
- **Per-faction reputation meters** (−100 to +100) react to your **policies and actions**: open vs. closed (FLT-28), safety spend, lobbying and capture (FLT-22), publishing, launch cadence (FLT-27), incidents (FLT-17/18) and water use.
- **What factions do:**
  - **argue on the paths** (two-person bubbles, e.g. "Just ship it." / "Just *read* it.")
  - **form protests** at the gate (the existing protest system generalised to any faction with its own signs)
  - **boycott or hype your launches** (share-of-voice, FLT-27)
  - **show up at hearings** (FLT-21) and in auditor reports (FLT-19)
  - **recruit or repel** researchers (FLT-26 defection)
- **Coalitions and schisms:** a small relationship matrix between factions that drifts with events. Two factions can **ally** (e.g. ethicists and luddites against water use) or **schism** (safetyists vs. doomers over a pause letter), and the result shows up as joint protests, dueling op-eds in the *Frontier Times*, or a counter-protest (FLT-25).
- **Faction events:** 2–3 per faction as content-pack statecharts (e.g. an accelerationist "vibe shift" party, an open letter from the doomers, an open-weights torrent drop).
- **UI:** a **Factions panel** with meters, current alliances and each faction's top grievance, plus faction colour chips on inspector cards. The UI is a separate Sonnet sub-task; this task is the sim and content (Sol).
- **Pack:** `mods/base-factions/`. Its content is split per faction so a mod can add "Crypto Guys" without touching the rest.
- **Done when:**
  - Faction meters respond sensibly in a headless run under two opposite policy strategies (open + fast vs. closed + careful).
  - A schism and an alliance each happen at least once.
  - Path arguments and faction protests are visible.
  - There are screenshots and a preview link.

