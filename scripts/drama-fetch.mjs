#!/usr/bin/env node
// Daily Drama, step 1: read the public feeds in drama/sources.json and write today's candidate stories.
// No dependencies: RSS <item> and Atom <entry> are pulled apart with a few regexes, which is plenty for headlines.
//
//   node scripts/drama-fetch.mjs [--out <dir>] [--hours 36]
// writes <dir>/candidates.json and <dir>/candidates.md (the list the agent reads).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const text = (s) => decode(decode(s ?? "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const tag = (block, name) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1];

/** Items from an RSS or Atom document: { title, link, date, summary }. */
export function parseFeed(xml) {
  const items = [];
  for (const [, block] of xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)) {
    const atomLink =
      block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
      block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1];
    const link = text(tag(block, "link")) || atomLink || text(tag(block, "guid"));
    const date = text(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date"));
    const summary = text(tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content:encoded") ?? tag(block, "content"));
    const title = text(tag(block, "title"));
    if (title && link) items.push({ title, link: decode(link), date: date ? new Date(date).toISOString() : null, summary: summary.slice(0, 400) });
  }
  return items;
}

const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, " ");
export function aiScore(item, keywords) {
  const hay = ` ${words(`${item.title} ${item.summary}`)} `;
  return keywords.filter((k) => hay.includes(` ${k} `) || hay.includes(` ${k}.`) || hay.includes(` ${k}'`)).length;
}

async function fetchText(url, userAgent, ms = 20000) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" }, signal: AbortSignal.timeout(ms) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function fetchCandidates({ hours, now = new Date() } = {}) {
  const config = JSON.parse(await readFile(join(root, "drama/sources.json"), "utf8"));
  const window = (hours ?? config.window) * 3600 * 1000;
  const report = [];
  const seen = new Map();
  await Promise.all(
    config.sources.map(async (source) => {
      try {
        const items = parseFeed(await fetchText(source.url, config.userAgent));
        let kept = 0;
        for (const item of items) {
          const age = item.date ? now - new Date(item.date) : 0;
          if (age > window || age < -6 * 3600 * 1000) continue;
          const ai = aiScore(item, config.aiKeywords);
          if (source.aiOnly && ai === 0) continue;
          const key = words(item.title).replace(/\s+/g, " ").trim().slice(0, 80);
          const score = source.weight * (1 + Math.min(ai, 4));
          const prior = seen.get(key);
          if (prior) { prior.score += score / 2; prior.also.push(source.name); continue; }
          seen.set(key, { ...item, source: source.name, sourceId: source.id, kind: source.kind, score, also: [] });
          kept++;
        }
        report.push({ id: source.id, ok: true, items: items.length, kept });
      } catch (error) {
        report.push({ id: source.id, ok: false, error: String(error.message ?? error) });
      }
    }),
  );
  const candidates = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 60).map((c, i) => ({ n: i + 1, ...c, score: Math.round(c.score * 10) / 10 }));
  return { fetchedAt: now.toISOString(), hours: window / 3600000, sources: report.sort((a, b) => a.id.localeCompare(b.id)), candidates };
}

export function candidatesMarkdown({ fetchedAt, hours, sources, candidates }) {
  const lines = [
    `# Candidate stories, ${fetchedAt.slice(0, 10)}`,
    "",
    `The last ${hours} hours of the feeds in drama/sources.json, roughly ordered by how AI-shaped and cross-posted they are. The order is a hint, not a ranking of comic potential: that part is your job.`,
    "",
    `Feeds: ${sources.map((s) => (s.ok ? `${s.id} ${s.kept}/${s.items}` : `${s.id} FAILED (${s.error})`)).join(" · ")}`,
    "",
  ];
  for (const c of candidates) {
    lines.push(`## ${c.n}. ${c.title}`);
    lines.push(`${c.source}${c.also.length ? ` (also: ${c.also.join(", ")})` : ""} · ${c.date ?? "undated"} · ${c.link}`);
    if (c.summary) lines.push("", `> ${c.summary}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function main(args = process.argv.slice(2)) {
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const out = resolve(flag("--out") ?? join(root, "drama/.work", new Date().toISOString().slice(0, 10)));
  const hours = flag("--hours") ? Number(flag("--hours")) : undefined;
  const result = await fetchCandidates({ hours });
  await mkdir(out, { recursive: true });
  await writeFile(join(out, "candidates.json"), JSON.stringify(result, null, 2) + "\n");
  await writeFile(join(out, "candidates.md"), candidatesMarkdown(result));
  const failed = result.sources.filter((s) => !s.ok);
  console.log(`drama-fetch: ${result.candidates.length} candidates from ${result.sources.length - failed.length}/${result.sources.length} feeds → ${out}/candidates.md`);
  for (const s of failed) console.log(`  feed ${s.id} failed: ${s.error}`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(`drama-fetch: ${e.stack ?? e}`); process.exitCode = 1; });
