// FLT-75: the protesters as a Koota ECS family. Traits hold the data, systems in `../protest.ts` move it, XState still
// runs each protester's flow (arriving, picketing, leaving) through the stored `Flow`, and the World stays plain JSON:
// `state.protesters` reads as an array of rows in the legacy Walker shape, so saves, the determinism tests and
// `JSON.stringify` never see Koota.
//
// One Koota world for the whole process (a Koota world id is 4 bits, so at most 16 can be alive at once, and the
// tests hold far more labs than that). Each lab is an entity; its protesters point at it with `OnLab`, and when the
// GameState is garbage collected the lab entity goes, taking its orphans with it.
import { createWorld, getStore, Not, relation, trait, type Entity, type World } from "koota";
import type { MoodStored } from "../machines/mood";
import type { WalkerStored } from "../machines/walker";
import type { GameState, NeedKey, Point, Walker, WalkerStats } from "../types";

/** Where they are, where they were at the start of the tick, and which way they face. `id` is the Walker id. */
export const Body = trait({ id: 0, x: 0, z: 0, px: 0, pz: 0, dir: 0 });
/** The spot they picket from and the countdown to their next shuffle. */
export const Picket = trait({ homeX: 0, homeZ: 0, timer: 0, targetId: -1 });
/** The waypoints left to walk. */
export const Route = trait(() => [] as Point[]);
/** The walker machine's stored state: XState still owns the flow. */
export const Flow = trait(() => ({ value: "arriving", context: {} }) as WalkerStored);
/** The faction crowd they marched in with. Absent: the water crowd. */
export const Crowd = trait({ id: "" });
/** The faction they side with, once `updateFactions` hands one out. */
export const Faction = trait({ id: "" });
/** Walking a route (to their spot, a shuffle, or home). */
export const IsMarching = trait();
/** Finished a route this tick: the picket system leaves them be until the next one, as the old loop's `continue` did. */
export const JustArrived = trait();
/** Which lab a protester is standing outside. */
export const OnLab = relation({ exclusive: true, autoDestroy: "orphan" });

export const ecs: World = createWorld();

/**
 * The Walker fields protesters carry but never use: the needs, the mood, the lines. They ride along on the view so a
 * generic consumer (the slop underfoot, the mood pass) that touches them behaves exactly as it did.
 */
interface Cold {
  name: string;
  role: string;
  pro: number;
  energy: number;
  focus: number;
  fomo: number;
  patience: number;
  impressed: number;
  drift: number;
  need: NeedKey | "work" | "tour" | "";
  lost: NeedKey | "";
  mood: MoodStored;
  stats: WalkerStats;
  visits: number;
  step: number;
  fountain: number;
  mess: number;
  queued: number;
  qtile: number;
  qslot: number;
  qrank: number;
}

// Koota registers a trait on first use; register these now so the stores below exist (and never move).
ecs.spawn(Body, Picket, Route, Flow).destroy();
const bodies = getStore(ecs, Body);
const pickets = getStore(ecs, Picket);
const routes = getStore(ecs, Route);
const flows = getStore(ecs, Flow);
const eidOf = (e: Entity) => e & 0xfffff;

/**
 * A protester as the rest of the sim sees it: a Walker. Reads and writes go straight to the Koota stores, so thoughts,
 * the Comms team, the factions, the renderer and the inspector keep working unchanged. The seam, not the sim.
 */
export class ProtesterView implements Walker {
  readonly kind = "protester" as const;
  constructor(
    readonly entity: Entity,
    private cold: Cold,
  ) {}
  get id() { return bodies.id[eidOf(this.entity)]!; }
  get x() { return bodies.x[eidOf(this.entity)]!; }
  set x(v) { bodies.x[eidOf(this.entity)] = v; }
  get z() { return bodies.z[eidOf(this.entity)]!; }
  set z(v) { bodies.z[eidOf(this.entity)] = v; }
  get px() { return bodies.px[eidOf(this.entity)]!; }
  set px(v) { bodies.px[eidOf(this.entity)] = v; }
  get pz() { return bodies.pz[eidOf(this.entity)]!; }
  set pz(v) { bodies.pz[eidOf(this.entity)] = v; }
  get dir() { return bodies.dir[eidOf(this.entity)]!; }
  set dir(v) { bodies.dir[eidOf(this.entity)] = v; }
  get homeX() { return pickets.homeX[eidOf(this.entity)]!; }
  set homeX(v) { pickets.homeX[eidOf(this.entity)] = v; }
  get homeZ() { return pickets.homeZ[eidOf(this.entity)]!; }
  set homeZ(v) { pickets.homeZ[eidOf(this.entity)] = v; }
  get timer() { return pickets.timer[eidOf(this.entity)]!; }
  set timer(v) { pickets.timer[eidOf(this.entity)] = v; }
  get targetId() { return pickets.targetId[eidOf(this.entity)]!; }
  set targetId(v) { pickets.targetId[eidOf(this.entity)] = v; }
  get route() { return routes[eidOf(this.entity)]!; }
  set route(v) { setRoute(this.entity, v); }
  get machine() { return flows[eidOf(this.entity)]!; }
  set machine(v) { flows[eidOf(this.entity)] = v; }
  get crowd() { return this.entity.has(Crowd) ? this.entity.get(Crowd)!.id : undefined; }
  set crowd(v) { tagWith(this.entity, Crowd, v); }
  get faction() { return this.entity.has(Faction) ? this.entity.get(Faction)!.id : undefined; }
  set faction(v) { tagWith(this.entity, Faction, v); }
  get name() { return this.cold.name; }
  set name(v) { this.cold.name = v; }
  get role() { return this.cold.role; }
  set role(v) { this.cold.role = v; }
  get pro() { return this.cold.pro; }
  set pro(v) { this.cold.pro = v; }
  get energy() { return this.cold.energy; }
  set energy(v) { this.cold.energy = v; }
  get focus() { return this.cold.focus; }
  set focus(v) { this.cold.focus = v; }
  get fomo() { return this.cold.fomo; }
  set fomo(v) { this.cold.fomo = v; }
  get patience() { return this.cold.patience; }
  set patience(v) { this.cold.patience = v; }
  get impressed() { return this.cold.impressed; }
  set impressed(v) { this.cold.impressed = v; }
  get drift() { return this.cold.drift; }
  set drift(v) { this.cold.drift = v; }
  get need() { return this.cold.need; }
  set need(v) { this.cold.need = v; }
  get lost() { return this.cold.lost; }
  set lost(v) { this.cold.lost = v; }
  get mood() { return this.cold.mood; }
  set mood(v) { this.cold.mood = v; }
  get stats() { return this.cold.stats; }
  set stats(v) { this.cold.stats = v; }
  get visits() { return this.cold.visits; }
  set visits(v) { this.cold.visits = v; }
  get step() { return this.cold.step; }
  set step(v) { this.cold.step = v; }
  get fountain() { return this.cold.fountain; }
  set fountain(v) { this.cold.fountain = v; }
  get mess() { return this.cold.mess; }
  set mess(v) { this.cold.mess = v; }
  get queued() { return this.cold.queued; }
  set queued(v) { this.cold.queued = v; }
  get qtile() { return this.cold.qtile; }
  set qtile(v) { this.cold.qtile = v; }
  get qslot() { return this.cold.qslot; }
  set qslot(v) { this.cold.qslot = v; }
  get qrank() { return this.cold.qrank; }
  set qrank(v) { this.cold.qrank = v; }

  /** The row a save holds: the legacy Walker, key for key, so the World's JSON is byte-identical to before the port. */
  toJSON(): Walker {
    const c = this.cold;
    const row: Walker = {
      id: this.id, kind: "protester", name: c.name, role: c.role, pro: c.pro, x: this.x, z: this.z, px: this.px, pz: this.pz, dir: this.dir,
      route: this.route, targetId: this.targetId, timer: this.timer, energy: c.energy, focus: c.focus, fomo: c.fomo, patience: c.patience,
      impressed: c.impressed, drift: c.drift, need: c.need, lost: c.lost, mood: c.mood, stats: c.stats, visits: c.visits, step: c.step,
      machine: this.machine, fountain: c.fountain, homeX: this.homeX, homeZ: this.homeZ, mess: c.mess, queued: c.queued, qtile: c.qtile,
      qslot: c.qslot, qrank: c.qrank,
    };
    // The old sim set `w.crowd = w.faction = crowd`, which assigns faction first: keep that key order.
    const faction = this.faction;
    if (faction !== undefined) row.faction = faction;
    const crowd = this.crowd;
    if (crowd !== undefined) row.crowd = crowd;
    for (const t of modTraits) {
      const v = t.save(this.entity);
      if (v !== undefined) (row as unknown as Record<string, unknown>)[t.key] = v;
    }
    return row;
  }
}

function tagWith(e: Entity, t: typeof Crowd | typeof Faction, v: string | undefined) {
  if (v === undefined) e.remove(t);
  else if (e.has(t)) e.set(t, { id: v });
  else e.add(t({ id: v }));
}

/** Give a protester a route; walking one is what `IsMarching` means. */
export function setRoute(e: Entity, route: Point[]) {
  routes[eidOf(e)] = route;
  if (route.length > 0) {
    if (!e.has(IsMarching)) e.add(IsMarching);
  } else if (e.has(IsMarching)) e.remove(IsMarching);
}

/**
 * A mod's own trait on a protester (the golden retrievers' `WagLevel`): how to save it, and how to put it back.
 * `key` is the field it takes in the save row, so an old save without it just loads without it.
 */
export interface ModTrait {
  key: string;
  save(e: Entity): unknown;
  load(e: Entity, value: unknown): void;
}
const modTraits: ModTrait[] = [];
export function registerModTrait(t: ModTrait) {
  if (!modTraits.some((m) => m.key === t.key)) modTraits.push(t);
}

/** One lab's crowd: the lab entity, its protesters in spawn (= id) order, and their views. */
export class Ground {
  readonly lab: Entity = ecs.spawn();
  /** Bumped whenever someone arrives or leaves, so `people()` knows its merge is stale. */
  version = 0;
  private list: ProtesterView[] = [];
  private byEntity = new Map<Entity, ProtesterView>();

  /** Every protester, in id order (spawns take the next id, so arrival order is id order). */
  views(): readonly ProtesterView[] {
    return this.list;
  }
  view(e: Entity): ProtesterView {
    return this.byEntity.get(e)!;
  }
  get size() {
    return this.list.length;
  }

  /** A protester in, from a legacy Walker (a fresh `newWalker`, or a save row). */
  adopt(w: Walker): ProtesterView {
    const e = ecs.spawn(
      OnLab(this.lab),
      Body({ id: w.id, x: w.x, z: w.z, px: w.px, pz: w.pz, dir: w.dir }),
      Picket({ homeX: w.homeX, homeZ: w.homeZ, timer: w.timer, targetId: w.targetId }),
      Route,
      Flow,
    );
    flows[eidOf(e)] = w.machine;
    setRoute(e, w.route);
    if (w.faction !== undefined) e.add(Faction({ id: w.faction }));
    if (w.crowd !== undefined) e.add(Crowd({ id: w.crowd }));
    const v = new ProtesterView(e, {
      name: w.name, role: w.role, pro: w.pro, energy: w.energy, focus: w.focus, fomo: w.fomo, patience: w.patience, impressed: w.impressed,
      drift: w.drift, need: w.need, lost: w.lost, mood: w.mood, stats: w.stats, visits: w.visits, step: w.step, fountain: w.fountain, mess: w.mess,
      queued: w.queued, qtile: w.qtile, qslot: w.qslot, qrank: w.qrank,
    });
    for (const t of modTraits) {
      const saved = (w as unknown as Record<string, unknown>)[t.key];
      if (saved !== undefined) t.load(e, saved);
    }
    this.list.push(v);
    this.byEntity.set(e, v);
    this.version++;
    return v;
  }

  /** Protesters out (gone through the gate). */
  remove(gone: ReadonlySet<Entity>) {
    if (gone.size === 0) return;
    this.list = this.list.filter((v) => !gone.has(v.entity));
    for (const e of gone) {
      this.byEntity.delete(e);
      e.destroy();
    }
    this.version++;
  }

  dispose() {
    this.lab.destroy();
  }
}

const grounds = new WeakMap<GameState, Ground>();
const labs = new FinalizationRegistry<Entity>((lab) => {
  if (ecs.has(lab)) lab.destroy();
});

/**
 * The lab's crowd, hydrated on first use from `state.protesters` (save rows, or nothing). From then on
 * `state.protesters` is a getter that serializes the crowd, so the World still reads (and clones, and compares) as JSON.
 */
export function ground(state: GameState): Ground {
  let g = grounds.get(state);
  if (g) return g;
  g = new Ground();
  const rows = (state as { protesters?: Walker[] }).protesters;
  if (Array.isArray(rows)) for (const w of rows) g.adopt(w);
  grounds.set(state, g);
  labs.register(state, g.lab);
  Object.defineProperty(state, "protesters", {
    configurable: true,
    enumerable: true,
    get: () => grounds.get(state)!.views().map((v) => v.toJSON()),
    set: (next: Walker[]) => {
      // A whole new crowd (a load into the same object): start over.
      grounds.get(state)?.dispose();
      grounds.delete(state);
      Object.defineProperty(state, "protesters", { configurable: true, enumerable: true, writable: true, value: next });
      ground(state);
    },
  });
  return g;
}

/** The queries the systems run, per lab. Koota caches them by hash. */
export const marching = (g: Ground) => ecs.query(OnLab(g.lab), IsMarching, Body, Route, Flow);
export const standing = (g: Ground) => ecs.query(OnLab(g.lab), Body, Picket, Flow, Not(IsMarching), Not(JustArrived));
export const arrived = (g: Ground) => ecs.query(OnLab(g.lab), JustArrived);
/** Iteration order is the store's (swap-remove), not arrival: a system that rolls dice sorts by Walker id first. */
export const byWalkerId = (a: Entity, b: Entity) => bodies.id[eidOf(a)]! - bodies.id[eidOf(b)]!;

/**
 * Everyone in the lab as Walkers, in id order: `state.walkers` plus the protesters' views. Cached until someone
 * arrives or leaves, so the per-frame readers (renderer, overlays) pay for the merge once.
 */
const merged = new WeakMap<GameState, { walkers: Walker[]; n: number; version: number; out: Walker[] }>();
export function people(state: GameState): Walker[] {
  const g = ground(state);
  if (g.size === 0) return state.walkers;
  const hit = merged.get(state);
  if (hit && hit.walkers === state.walkers && hit.n === state.walkers.length && hit.version === g.version) return hit.out;
  const out: Walker[] = [];
  const a = state.walkers;
  const b = g.views();
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i]!.id < b[j]!.id)) out.push(a[i++]!);
    else out.push(b[j++]!);
  }
  merged.set(state, { walkers: a, n: a.length, version: g.version, out });
  return out;
}

/** The pre-port World: protesters folded back into `walkers` by id, no `protesters` key. For the determinism proofs. */
export function legacyWorld(state: GameState): unknown {
  const json = JSON.parse(JSON.stringify(state)) as GameState & { protesters?: Walker[] };
  const rows = json.protesters ?? [];
  delete json.protesters;
  json.walkers = [...json.walkers, ...rows].sort((a, b) => a.id - b.id);
  return json;
}
