// The published Daily Drama feed (FLT-34 part 2). Jem reviews every Drama PR, so "merged into main" is what
// "approved" means, and the feed is read from main's git tree, never from the working tree: a Drama PR's preview, a
// local branch or an edit to an old pack cannot put unmerged copy on a page. Where there is no main to read (a checkout
// without history), the feed is empty.
//
// The build (and the dev server) serve, from the site root:
//   /mods/drama/index.json          { apiVersion, packs: [newest first] }
//   /mods/drama/latest.json         the newest pack's entry (or { apiVersion, pack: null })
//   /mods/drama/<date>/mod.json     each published pack, byte for byte as merged
//   /mods/drama-fixture/...         the same shape from drama/fixtures/feed/ (tests and screenshots: ?drama=fixture)
//
// Usage: node scripts/drama-feed.mjs [--ref <git ref>]   prints the feed the build would publish
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const FEED_API = 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PACK_PATH = /^mods\/drama\/(\d{4}-\d{2}-\d{2})\/mod\.json$/;

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });

/** Where the published packs are read from: main as the remote has it, else a local main, else nothing. */
export function publishedRef(cwd = root) {
  for (const ref of ["refs/remotes/origin/main", "refs/heads/main"]) {
    try {
      git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd);
      return ref;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/** Every `mods/drama/<date>/mod.json` in `ref`'s tree, as `{ date, text }`. */
export function packsAt(ref, cwd = root) {
  if (!ref) return [];
  let paths;
  try {
    paths = git(["ls-tree", "-r", "--name-only", ref, "--", "mods/drama/"], cwd).split("\n");
  } catch {
    return [];
  }
  return paths.flatMap((path) => {
    const date = PACK_PATH.exec(path)?.[1];
    return date ? [{ date, text: git(["show", `${ref}:${path}`], cwd) }] : [];
  });
}

/** The fixture feed's packs, from a directory of `<date>/mod.json` (the working tree: they are not Drama PRs). */
export function packsIn(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((date) => {
    const path = join(dir, date, "mod.json");
    if (!DATE.test(date) || !statSync(join(dir, date)).isDirectory()) return [];
    try {
      return [{ date, text: readFileSync(path, "utf8") }];
    } catch {
      return [];
    }
  });
}

const list = (section) => (section && Array.isArray(section.add) ? section.add : []);
const sizes = (section) => list(section).length + (section && Array.isArray(section.override) ? section.override.length : 0);

/** A line that reads on its own: a headline without template slots ("{lab}"), or with them filled in plainly. */
const teaserText = (text) => text.replace(/\{lab\}/g, "Your lab").replace(/\{[a-z]+\}/gi, "someone");

/** The first day an event card can turn up, when its condition says so plainly (`{ stat: "day", atLeast: n }`). */
function eventDay(event) {
  const when = event?.when;
  if (when?.stat === "day" && typeof when.atLeast === "number") return when.atLeast;
  const day = Array.isArray(when?.all) ? when.all.find((c) => c?.stat === "day" && typeof c.atLeast === "number") : null;
  return day ? day.atLeast : null;
}

/**
 * One feed entry per pack that parses; a pack that doesn't is left out with a warning (main's CI checked it, so this
 * is belt and braces). Newest first; one pack per date.
 */
export function buildFeed(packs, base = "/mods/drama", warn = () => undefined) {
  const entries = [];
  for (const { date, text } of packs) {
    let mod;
    try {
      mod = JSON.parse(text);
    } catch (error) {
      warn(`mods/drama/${date}/mod.json: not JSON (${error.message}); left out of the feed`);
      continue;
    }
    if (!mod || mod.apiVersion !== 1 || typeof mod.id !== "string" || typeof mod.name !== "string") {
      warn(`mods/drama/${date}/mod.json: not a mod manifest; left out of the feed`);
      continue;
    }
    const content = mod.content ?? {};
    const headlines = list(content.headlines).filter((h) => typeof h?.text === "string");
    const plain = headlines.filter((h) => !h.text.includes("{"));
    const events = list(content.events);
    entries.push({
      id: mod.id,
      date,
      title: mod.name.replace(/^Daily Drama:\s*/, ""),
      description: typeof mod.description === "string" ? mod.description : "",
      url: `${base}/${date}/mod.json`,
      teasers: [...plain, ...headlines.filter((h) => !plain.includes(h))].slice(0, 3).map((h) => teaserText(h.text)),
      event: events[0] && typeof events[0].title === "string" ? { title: events[0].title, day: eventDay(events[0]) } : null,
      counts: { events: events.length, headlines: sizes(content.headlines), thoughts: sizes(content.thoughts), rivals: sizes(content.rivals) },
      text,
    });
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const seen = new Set();
  const published = entries.filter((e) => !seen.has(e.date) && seen.add(e.date));
  const listed = published.map(({ text: _text, ...entry }) => entry);
  return {
    index: { apiVersion: FEED_API, packs: listed },
    latest: { apiVersion: FEED_API, pack: listed[0] ?? null },
    files: published.map((e) => ({ path: `${e.date}/mod.json`, text: e.text })),
  };
}

/** Everything the site serves under `/mods/`: path (without the leading "/mods/") to text. */
export function feedFiles({ cwd = root, ref = publishedRef(cwd), fixtures = join(cwd, "drama/fixtures/feed"), warn = () => undefined } = {}) {
  const out = new Map();
  const add = (prefix, feed) => {
    out.set(`${prefix}/index.json`, `${JSON.stringify(feed.index, null, 1)}\n`);
    out.set(`${prefix}/latest.json`, `${JSON.stringify(feed.latest, null, 1)}\n`);
    for (const f of feed.files) out.set(`${prefix}/${f.path}`, f.text);
  };
  if (!ref) warn("no main branch to read Drama packs from; the Drama feed is empty");
  add("drama", buildFeed(packsAt(ref, cwd), "/mods/drama", warn));
  add("drama-fixture", buildFeed(packsIn(fixtures), "/mods/drama-fixture", warn));
  return out;
}

/** @returns {import("vite").Plugin} */
export function dramaFeed() {
  let files = null;
  const current = (log) => (files ??= feedFiles({ warn: (m) => log(`[drama feed] ${m}`) }));
  return {
    name: "flt-drama-feed",
    configureServer(server) {
      const log = (m) => server.config.logger.warn(m);
      // Re-read main on each dev-server start only: a `git fetch` mid-session shows up after a restart.
      server.middlewares.use("/mods/", (req, res, next) => {
        const wanted = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\//, "");
        const text = current(log).get(wanted);
        if (text === undefined) return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.end(text);
      });
    },
    generateBundle() {
      for (const [path, source] of current((m) => this.warn(m))) this.emitFile({ type: "asset", fileName: `mods/${path}`, source });
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf("--ref");
  const ref = at > 0 ? process.argv[at + 1] : publishedRef();
  const feed = buildFeed(packsAt(ref), "/mods/drama", (m) => console.error(m));
  console.log(JSON.stringify({ ref, ...feed.index }, null, 2));
}
