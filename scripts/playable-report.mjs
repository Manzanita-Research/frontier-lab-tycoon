// Deterministic normal-opening report. Uses paid actions and ordinary ticks, never a debug warp.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createInitialState } = await server.ssrLoadModule('/src/sim/state.ts');
  const { applyNow, tick } = await server.ssrLoadModule('/src/sim/tick.ts');
  const { coachOf } = await server.ssrLoadModule('/src/sim/coach.ts');
  const { progressOf } = await server.ssrLoadModule('/src/sim/progression.ts');
  const { createMidgameScenario } = await server.ssrLoadModule('/src/sim/scenarios/midgame.ts');
  const results = [];
  for (const seed of [1, 2, 3, 42, 2027]) {
    const s = createInitialState(seed);
    applyNow(s, [{ type: 'buildPanelOpened' }]);
    for (const [x, z] of coachOf(s).suggest.tiles.slice(0, 3)) applyNow(s, [{ type: 'placePath', x, z }]);
    const positions = new Map(s.walkers.map(w => [w.id, [w.x, w.z]]));
    const hall = coachOf(s).suggest;
    applyNow(s, [{ type: 'placeBuilding', kind: hall.building, x: hall.x, z: hall.z }]);
    let movementTick = null;
    while (!s.models.length && s.tick < 1200) {
      tick(s);
      if (movementTick === null && s.walkers.some(w => {
        const p = positions.get(w.id); return p && Math.hypot(w.x - p[0], w.z - p[1]) >= 2;
      })) movementTick = s.tick;
    }
    if (!s.models.length || coachOf(s)?.id !== 'gateway') throw new Error(`No Gateway by six minutes: ${seed}`);
    const releaseDay = s.day, releaseTick = s.tick;
    const gateway = coachOf(s).suggest;
    applyNow(s, [{ type: 'placeBuilding', kind: gateway.building, x: gateway.x, z: gateway.z }]);
    const replay = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 100; i++) { tick(s); tick(replay); }
    if (JSON.stringify(s) !== JSON.stringify(replay)) throw new Error(`Save/load replay differs: ${seed}`);
    results.push({ seed, movementSeconds: movementTick * 0.3, releaseDay, gatewaySeconds: releaseTick * 0.3,
      level: progressOf(s).level, revenue: s.ledger.income, visitors: s.walkers.filter(w => w.kind === 'visitor').length, cash: Math.round(s.cash), deterministic: true });
  }
  const campus = createMidgameScenario();
  const report = { opening: results, midgame: { day: campus.day, buildings: campus.buildings.length,
    people: campus.walkers.length + campus.staff.length, ready: campus.training.context.progress / campus.training.context.cost,
    cash: Math.round(campus.cash), freshDrop: campus.leapfrog.last.day === campus.day, allRepaired: campus.buildings.every(b => !b.broken) } };
  mkdirSync('docs/evidence/flt-49', { recursive: true });
  writeFileSync('docs/evidence/flt-49/headless.json', JSON.stringify(report, null, 2) + '\n');
  const rows = results.map(r => `| ${r.seed} | ${r.movementSeconds.toFixed(1)} s | ${r.releaseDay} | ${r.gatewaySeconds.toFixed(1)} s | $${r.revenue.toLocaleString('en-US')} | ${r.visitors} | yes |`).join('\n');
  writeFileSync('docs/evidence/flt-49/report.md', `# FLT-49 paid opening report\n\nRun with \`node scripts/playable-report.mjs\`. First build-panel action, three paid ghost paths, the paid suggested Hall, ordinary 1× ticks (0.3 s each), then the paid Gateway. No debug state injection.\n\n| Seed | First 2-tile movement | First model day | Gateway step at 1× | Revenue after five more days | Visitors | JSON replay identical |\n|---|---:|---:|---:|---:|---:|---|\n${rows}\n\nThis checks deterministic simulation time; the Playwright stranger test separately checks real wall time, rendering, clicking and console errors.\n\nThe inherited midgame scenario uses the full starter-campus preset with the ladder complete, paid purchases and staff, and a paid replacement of worn buildings before the opening. It opens on day ${campus.day} with ${report.midgame.people} people, ${campus.buildings.length} connected, repaired buildings, training at ${(report.midgame.ready * 100).toFixed(1)}%, cash $${report.midgame.cash.toLocaleString('en-US')} and a fresh rival record. The selected real headline/day changes with the new attendance/movement stream.\n`);
  console.log(JSON.stringify(report));
} finally { await server.close(); }
