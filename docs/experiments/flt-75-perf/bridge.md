816 people, 26 of them protesters (Koota), 26 <Protester> components subscribed with useTrait
| Per frame (read loop only) | µs |
|---|---:|
| the other walkers alone (state.walkers, no protesters) | 4.2 |
| branch today: for (w of people(sim)), protesters through view getters | 10.9 |
| Koota direct: state.walkers, then the protesters' SoA stores (query.useStores) | 19.1 |
| Koota readEach: state.walkers, then a snapshot object per protester | 15.1 |
| useTrait(entity, Body) on every protester | value |
|---|---:|
| protesters that moved over 20 real ticks | 14 |
| change renders for those moves (the sim writes untracked: useTrait goes stale) | 0 |
| renders from protesters leaving (onRemove still fires) | 2 |
| renders per tick if the march wrote tracked | 24 |
| listener calls per tick (each of 26 components hears all 24 changes) | 624 |
| tracked write of 24 bodies, with those listeners | 73.7 µs |
| the same write untracked | 9.8 µs |
      Tests  1 passed (1)
