// Today's Drama (FLT-34), the pure half: the published feed's shape, the links that load a pack through `?mod=`, and
// the view-model. The feed is built from main's tree at build time (scripts/drama-feed.mjs), so all this ever sees is
// merged, reviewed packs served by the site itself.
import { Schema } from "effect";
import type { DramaPackVM, DramaVM } from "../ui/hud/types";

const text = Schema.String;
const count = Schema.Finite;
export const FeedPack = Schema.Struct({
  id: text,
  date: text.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  title: text,
  description: text,
  url: text.check(Schema.isPattern(/^\/mods\/drama(?:-fixture)?\/\d{4}-\d{2}-\d{2}\/mod\.json$/)),
  teasers: Schema.Array(text),
  event: Schema.NullOr(Schema.Struct({ title: text, day: Schema.NullOr(count) })),
  counts: Schema.Struct({ events: count, headlines: count, thoughts: count, rivals: count }),
});
export type FeedPackData = typeof FeedPack.Type;
export const FeedIndex = Schema.Struct({ apiVersion: Schema.Literal(1), packs: Schema.Array(FeedPack) });
export const FeedLatest = Schema.Struct({ apiVersion: Schema.Literal(1), pack: Schema.NullOr(FeedPack) });

/** Where a Drama pack lives on the site: the published feed, or the rehearsal one (`?drama=fixture`). */
const PACK_PATH = /^\/mods\/drama(?:-fixture)?\/\d{4}-\d{2}-\d{2}\/mod\.json$/;

/** The feed this page reads: `?drama=fixture` is the rehearsal feed (tests, screenshots), anything else the real one. */
export const feedBase = (search: string): string => (new URLSearchParams(search).get("drama") === "fixture" ? "/mods/drama-fixture" : "/mods/drama");

/** The site path of a `?mod=` value when it is a Drama pack on this site, else null. */
export function dramaPath(source: string, href: string): string | null {
  try {
    const url = new URL(source, href);
    return url.origin === new URL(href).origin && PACK_PATH.test(url.pathname) ? url.pathname : null;
  } catch {
    return null;
  }
}

/** `href` with its `mod=` values rewritten: `keep` decides which stay (in order), `add` goes last. */
function withMods(href: string, keep: (source: string) => boolean, add?: string): string {
  const url = new URL(href);
  const mods = url.searchParams.getAll("mod").filter(keep);
  url.searchParams.delete("mod");
  for (const m of mods) url.searchParams.append("mod", m);
  if (add) url.searchParams.append("mod", add);
  return url.href;
}

/** The link that plays `packUrl`: other mods stay, any other Drama pack goes (one drama at a time), the rest of the address too. */
export const withDrama = (href: string, packUrl: string): string => withMods(href, (m) => dramaPath(m, href) === null, packUrl);

/**
 * Hotfix for "Play it" wiping labs: a Drama lab is a NEW lab, so it must never autosave over the player's lab.
 * `autosave=off` makes it a staged link (no autosave, no "Welcome back"); the player's lab stays in the autosave.
 */
export const withoutAutosave = (href: string): string => {
  const url = new URL(href);
  url.searchParams.set("autosave", "off");
  return url.href;
};

/** What "Play it" asks before it reloads into a new lab. */
export const DRAMA_PLAY_CONFIRM =
  "Play it starts a NEW lab with today's Drama.\n\n" +
  "Your current lab won't be touched: it stays in your autosave (Start > Save / Load). " +
  "To keep your very latest progress, press Cancel and save first (Ctrl+S).\n\n" +
  "Start a new lab?";

/** The link without one `mod=` value. */
export const withoutMod = (href: string, source: string): string => withMods(href, (m) => m !== source);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "2026-09-29" → "Tue 29 Sep" (the pack's own date, whatever the reader's time zone). */
export function dateText(date: string): string {
  const d = utc(date);
  return Number.isNaN(d.getTime()) ? date : `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** How old a pack is, from the reader's calendar day: "today", "yesterday", "3 days ago". Tomorrow's (time zones) is today's. */
export function agoText(date: string, now: Date): string {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - utc(date).getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export function summaryText(c: FeedPackData["counts"]): string {
  return [
    c.events > 0 && plural(c.events, "event card"),
    c.headlines > 0 && plural(c.headlines, "headline"),
    c.thoughts > 0 && plural(c.thoughts, "thought"),
    c.rivals > 0 && plural(c.rivals, "rival tweak"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** UI-only state behind the window: what was fetched, and whether it is open. */
export interface DramaUi {
  open: boolean;
  status: DramaVM["status"];
  /** From latest.json (cheap, at start) or the index. */
  latest: FeedPackData | null;
  /** From index.json, once the window has asked. */
  packs: readonly FeedPackData[] | null;
  /** The newest pack the player has already looked at (kept across visits). */
  seen: string | null;
  intro: boolean;
}

export const NO_DRAMA_UI: DramaUi = { open: false, status: "idle", latest: null, packs: null, seen: null, intro: false };

/** A mod this run loaded, as far as Today's Drama cares. */
export interface LoadedModRef {
  id: string;
  name: string;
  description?: string;
  source: string;
}

/** The Drama pack among the run's mods (at most one: playing a pack swaps out any other), with its site path. */
export function loadedDrama(mods: readonly LoadedModRef[], href: string): (LoadedModRef & { path: string }) | null {
  for (const m of mods) {
    const path = dramaPath(m.source, href);
    if (path) return { ...m, path };
  }
  return null;
}

export function dramaViewModel(ui: DramaUi, mods: readonly LoadedModRef[], href: string, now: Date): DramaVM {
  const loaded = loadedDrama(mods, href);
  const pack = (p: FeedPackData): DramaPackVM => ({
    id: p.id,
    date: p.date,
    dateText: dateText(p.date),
    ago: agoText(p.date, now),
    title: p.title,
    description: p.description,
    teasers: [...p.teasers],
    event: p.event ? { ...p.event } : null,
    summary: summaryText(p.counts),
    on: loaded?.path === p.url,
  });
  const all = ui.packs ?? (ui.latest ? [ui.latest] : []);
  const latest = ui.packs ? (ui.packs[0] ?? null) : ui.latest;
  const inFeed = loaded ? all.find((p) => p.url === loaded.path) : undefined;
  // A pack loaded from a shared link may be older than anything fetched so far: describe it from its own manifest.
  const date = loaded?.path.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
  const on: DramaPackVM | null = inFeed
    ? pack(inFeed)
    : loaded
      ? { id: loaded.id, date, dateText: dateText(date), ago: agoText(date, now), title: loaded.name.replace(/^Daily Drama:\s*/, ""), description: loaded.description ?? "", teasers: [], event: null, summary: "", on: true }
      : null;
  return {
    open: ui.open,
    status: ui.status,
    latest: latest ? pack(latest) : null,
    archive: (ui.packs ?? []).slice(1).map(pack),
    on,
    fresh: latest !== null && latest.id !== ui.seen && !(on && on.id === latest.id),
    intro: ui.open && ui.intro && on !== null,
  };
}
