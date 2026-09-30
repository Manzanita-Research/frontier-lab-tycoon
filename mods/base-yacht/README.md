# Corporate Collusion: the yacht summit (FLT-24)

The labs invite you onto a yacht, the *MY Fiduciary Duty*, to sign voluntary safety commitments. Thirty days later the group chat leaks.

The pack uses the FLT-15 section shape and is direct-loaded. `content.arcs.add[0]` is the chart. `content.events.add` holds the invitation (`yacht-invite`, an ordinary card) and the leak (`yacht-leak`, `kind: "leak"`). `content.headlines.add` includes the price-fixing jokes (`trigger: "priceFixing"`). `rules.yacht` holds the yacht's name, the group's name, two chat logs (`signed`, `declined`) written by the rival labs the game already knows, and the ticker cadence.

## Flow

1. **Invited**: 12 days after the pack wakes (Level 5 Scrutiny, unless `flags.yachtOff` / `?yacht=off`), once the lab has shipped a model. Sign (hype +12), send an intern (hype +6; the intern signs everything, including a menu), or decline (hype −3, trust +2).
2. **Leaked**: 30 days later, heat +10. The leaked chat is the `signed` log if the lab went (in person or via the intern), and the `declined` log if it did not. Either way the lab is in it.
3. **Reply**:
   - **Deny** (trust −8, heat +12)
   - **Apologise** (trust +6, $2M back pay, hype −4)
   - **Blame the yacht** (hype +8, heat +6, trust −2)

   Deny and blame set `subpoena:yacht`, which summons the lab to The Hearing.
4. For 40 days after the leak, the ticker runs a price-fixing joke every 5 days.

## Saved state and the UI

`s.yacht` is `{ enabled, rngState, machine, rsvp, leakDay, ending }`. The chart hears `DAY` and `CHOSE`. Picks arrive as `yacht:pick:*` flags. `yachtView(world)` is what the HUD reads; the `LeakedChat` skin slot draws it.

Review links: `?debug=1&moment=yacht-invite` and `?moment=yacht-leak`.
