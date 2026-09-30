#!/usr/bin/env node
// The Daily Drama parody linter. Every string in a Drama pack must be parody: no real org, product or person,
// no nationality, no handle, no URL. It fails the run on any of them.
//
// Three passes over each string:
//   1. links: URLs, bare domains, @handles, r/subreddits.
//   2. denylist (drama/denylist.json): real names, matched as written, with the spaces taken out, in leetspeak,
//      and one or two typos away ("Altmann", "0penAI", "Deep-Mind").
//   3. proper nouns: a capitalised word must be either an everyday word
//      (an English dictionary, drama/words.txt.gz, or lowercase in the game's own text)
//      or a name the game already uses (the glossary harvested from src/content and mods/base-*), or a new parody
//      name the pack declares in its own glossary.json, which the PR then lists for the reviewer.
//
// Usage: node drama/lint.mjs <pack dir | mod.json> [--json]
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, "..");

// ---------------------------------------------------------------------------------------------------------------
// Text helpers

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’._-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu;
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", $: "s", "!": "i", "|": "l" };

/** Lowercase, no accents, leetspeak undone, only letters and digits left: "0pen-A.I." → "openai". */
export function squash(text) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[0134578$!|]/g, (c) => LEET[c])
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Leetspeak undone, but only for a token that also has letters ("0penAI", not "2026"). */
const unleet = (token) => {
  const bare = token.replace(/['’]s$/i, "");
  return /\p{L}/u.test(bare) ? squash(bare) : bare.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
};

const isUpper = (c) => c !== c.toLowerCase() && c === c.toUpperCase();
const capitalised = (s) => s.length > 0 && isUpper(s[0]);
const hasUpper = (s) => [...s].some(isUpper);
const allCaps = (s) => /\p{L}/u.test(s) && !/\p{Ll}/u.test(s);

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent swaps), stopping early past `max`. */
export function distance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    rows.push(row);
  }
  return rows[a.length][b.length];
}

/** How many typos still count as the same name, by length: short names must match exactly. */
const typos = (length) => (length >= 9 ? 2 : length >= 6 ? 1 : 0);

// ---------------------------------------------------------------------------------------------------------------
// The world the linter knows: what the game already says, and the denylist

function* files(dir, test) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path, test);
    else if (test(path)) yield path;
  }
}

/** Every string value in a JSON document, with its path. */
export function* strings(value, path = "") {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
}

/** String literals in a TS source file (quotes and template text; good enough for data files). */
function* literals(source) {
  for (const m of source.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) yield m[1] ?? m[2] ?? m[3];
}

let cached;
/**
 * The linter's knowledge, read from the checkout. `names` are the game's own proper nouns (lowercased), `everyday`
 * the lowercase words its player-facing text uses, `words` everyday plus the dictionary and every lowercase word in
 * src, docs and mods.
 * Drama packs themselves are never harvested: a pack cannot vouch for itself.
 */
export function loadWorld(base = root) {
  if (cached && cached.base === base) return cached;
  const names = new Set();
  const everyday = new Set();
  const words = new Set();
  const game = [];
  const notDrama = (p) => !relative(join(base, "mods"), p).startsWith("drama");
  for (const path of files(join(base, "src/content"), (p) => p.endsWith(".ts") && !p.endsWith(".test.ts")))
    for (const text of literals(readFileSync(path, "utf8"))) game.push(text);
  for (const path of files(join(base, "mods"), (p) => p.endsWith(".json") && notDrama(p)))
    for (const [, text] of strings(JSON.parse(readFileSync(path, "utf8")))) game.push(text);
  for (const text of game)
    for (const token of text.match(WORD) ?? [])
      for (const part of parts(token)) {
        if (hasUpper(part)) names.add(part.toLowerCase());
        else if (/\p{L}/u.test(part)) everyday.add(part);
      }
  const prose = [
    ...files(join(base, "src"), (p) => /\.(ts|tsx)$/.test(p)),
    ...files(join(base, "docs"), (p) => p.endsWith(".md")),
    ...files(join(base, "mods"), (p) => p.endsWith(".json") && notDrama(p)),
  ];
  for (const path of prose)
    for (const token of readFileSync(path, "utf8").match(WORD) ?? [])
      for (const part of parts(token)) if (/^\p{Ll}+$/u.test(part)) words.add(part);
  for (const word of gunzipSync(readFileSync(join(base, "drama/words.txt.gz"))).toString("utf8").split("\n")) if (word) words.add(word);
  const glossary = JSON.parse(readFileSync(join(base, "drama/glossary.json"), "utf8"));
  for (const name of glossary.names) for (const part of name.match(WORD) ?? []) names.add(part.toLowerCase());
  for (const word of glossary.words) everyday.add(word.toLowerCase());
  for (const word of everyday) words.add(word);
  const deny = compileDenylist(JSON.parse(readFileSync(join(base, "drama/denylist.json"), "utf8")), everyday);
  const phrases = [...(glossary.phrases ?? [])].sort((a, b) => b.length - a.length);
  cached = { base, names, everyday, words, deny, phrases };
  return cached;
}

/** Word pieces worth checking on their own: "Frontier-4-Mini's" → Frontier, 4, Mini. */
function parts(token) {
  return token
    .replace(/['’]s$/i, "")
    .split(/[-_.'’]+/)
    .filter((p) => /\p{L}/u.test(p));
}

/**
 * Each denylist entry becomes a matcher. `mode`: "any" (any case), "capital" (only when written with a capital),
 * "exact" (ALL-CAPS acronyms, case-sensitive). `warn` marks the ambiguous tier.
 */
export function compileDenylist(list, everyday = new Set()) {
  const entries = [];
  for (const [category, tiers] of Object.entries(list)) {
    if (category.startsWith("_")) continue;
    for (const [tier, names] of Object.entries(tiers))
      for (const name of names) {
        const lettersOnly = name.replace(/[^\p{L}]/gu, "");
        const mode =
          allCaps(name) && lettersOnly.length <= 5 ? "exact"
          : tier === "any" && !everyday.has(name.toLowerCase()) ? "any"
          : "capital";
        const pattern = name
          .split(/[\s-]+/)
          .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]"))
          .join("[\\s_-]*");
        entries.push({
          name,
          category,
          warn: tier === "ambiguous",
          mode,
          squashed: squash(name),
          regex: new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}]|['’][\\p{L}](?!\\b))`, mode === "exact" ? "gu" : "giu"),
        });
      }
  }
  return entries;
}

// ---------------------------------------------------------------------------------------------------------------
// Linting

const TLD = "com|ai|io|org|net|dev|co|app|gg|xyz|so|me|ly|tv|fm|news|tech|us|uk|cn|fr|de|jp|sh|to|inc|lol|info|biz|edu|gov";
const LINKS = [
  [/\b(?:https?|ftp):\/\/\S+/giu, "URL"],
  [/\bwww\.\S+/giu, "URL"],
  [new RegExp(`\\b[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*\\.(?:${TLD})\\b(?!-)`, "giu"), "domain"],
  [/(?<![\p{L}\p{N}_])@[\p{L}\p{N}_]{2,}/gu, "handle"],
  [/(?<![\p{L}\p{N}])[ru]\/[\p{L}\p{N}_]{2,}/gu, "subreddit or user link"],
];

/**
 * Lints one string. Returns `{ errors, warnings, declared }`: `declared` are the pack's own new names this text uses.
 * `pack` is the lowercased set of names the pack declares in its glossary.json.
 */
export function lintText(text, { world = loadWorld(), pack = new Set(), path = "" } = {}) {
  const errors = [];
  const warnings = [];
  const declared = new Set();
  const flagged = new Set();
  const hit = (list, word, reason) => {
    const key = `${word.toLowerCase()}|${reason.split(":")[0]}`;
    if (flagged.has(key)) return;
    flagged.add(key);
    list.push({ path, text, word, reason });
  };

  if (text.startsWith("data:")) return { errors, warnings, declared }; // bundled asset, not copy

  for (const [regex, what] of LINKS) for (const m of text.matchAll(regex)) hit(errors, m[0], `${what}: Drama packs never link or tag anyone`);

  // The game's own parody names that contain a real fragment ("Very Safe Superintelligence Inc.") are blanked first.
  let masked = text;
  for (const phrase of world.phrases) masked = masked.split(phrase).join(" ".repeat(phrase.length));

  // Denylist, as written.
  const denied = new Set();
  for (const entry of world.deny) {
    for (const m of masked.matchAll(entry.regex)) {
      if (entry.mode === "capital" && !capitalised(m[0])) continue;
      denied.add(entry.squashed);
      for (const piece of m[0].match(WORD) ?? []) denied.add(squash(piece));
      hit(entry.warn ? warnings : errors, m[0], `${entry.warn ? "might be" : "real name"}: ${entry.name} (${entry.category})`);
    }
  }

  // Denylist, disguised: joined-up capitalised words, leetspeak and near-misses.
  const tokens = (masked.match(WORD) ?? []).map((raw) => ({ raw, squashed: unleet(raw) }));
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= 3 && i + n <= tokens.length; n++) {
      const window = tokens.slice(i, i + n);
      const joined = window.map((t) => t.raw).join(" ");
      if (n > 1 && !window.every((t) => capitalised(t.raw) || /^\p{N}/u.test(t.raw))) break;
      const squashed = window.map((t) => t.squashed).join("");
      if (squashed.length < 2 || denied.has(squashed)) continue;
      const leet = /\p{N}/u.test(joined) && /\p{L}/u.test(joined);
      const suspicious = capitalised(joined) || leet;
      const known = window.every((t) => world.names.has(t.raw.toLowerCase()) || pack.has(t.raw.toLowerCase()) || world.words.has(t.raw.toLowerCase()));
      for (const entry of world.deny) {
        const exact = squashed === entry.squashed;
        if (!exact && (known || !suspicious)) continue;
        if (entry.mode !== "any" && !suspicious) continue;
        if (entry.mode === "exact" && !(exact && allCaps(joined))) continue;
        const allowed = typos(Math.min(squashed.length, entry.squashed.length));
        if (!exact && (allowed === 0 || distance(squashed, entry.squashed, allowed) > allowed)) continue;
        if (exact && !suspicious && entry.mode !== "any") continue;
        denied.add(squashed);
        for (const t of window) denied.add(t.squashed);
        hit(entry.warn ? warnings : errors, joined, `${exact ? "real name in disguise" : "too close to a real name"}: ${entry.name} (${entry.category})`);
        break;
      }
    }
  }

  // Proper nouns the game doesn't know.
  for (const token of text.match(WORD) ?? []) {
    for (const part of parts(token)) {
      if (!hasUpper(part) || denied.has(squash(part)) || denied.has(unleet(token))) continue;
      const lower = part.toLowerCase();
      if (pack.has(lower)) { if (!world.names.has(lower)) declared.add(part); continue; }
      if (world.names.has(lower)) continue;
      if (/^\p{N}[\p{N}.,]*\p{L}{1,2}$/u.test(part)) continue; // amounts and units: $4B, 100M, 5GW, 3PM
      if (part.length === 1) { if (part === "X") hit(warnings, part, "might be a real app (X); prefer a parody name"); continue; }
      const camel = /\p{Ll}\p{Lu}/u.test(part) || /^\p{Ll}+\p{Lu}/u.test(part);
      if (!camel && world.words.has(lower)) continue;
      hit(errors, part, camel ? "unknown CamelCase name (brand-shaped): use a parody name and declare it in the pack's glossary.json"
        : allCaps(part) ? "unknown acronym: spell it out or declare it in the pack's glossary.json"
        : "unknown proper noun: use a game name, a lowercase word, or declare a parody name in the pack's glossary.json");
    }
  }
  return { errors, warnings, declared };
}

/** Lints a whole pack: every string in mod.json, plus the pack's declared names themselves. */
export function lintPack(mod, { world = loadWorld(), names = [] } = {}) {
  const errors = [];
  const warnings = [];
  const declared = new Set();
  const pack = new Set();
  for (const name of names) {
    for (const part of name.match(WORD) ?? []) pack.add(part.toLowerCase());
    // A declared name must itself pass: it cannot be (or look like) a real one.
    const own = lintText(name, { world, path: "glossary.json" });
    errors.push(...own.errors.filter((e) => !e.reason.startsWith("unknown")));
    warnings.push(...own.warnings);
  }
  for (const [path, text] of strings(mod)) {
    if (path === "apiVersion") continue;
    const result = lintText(text, { world, pack, path });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    for (const name of result.declared) declared.add(name);
  }
  const unused = names.filter((n) => !(n.match(WORD) ?? []).some((p) => [...declared].some((d) => d.toLowerCase() === p.toLowerCase())));
  for (const name of unused) warnings.push({ path: "glossary.json", text: name, word: name, reason: "declared but never used" });
  return { ok: errors.length === 0, errors, warnings, newNames: names.filter((n) => !unused.includes(n)) };
}

/** Reads a pack from a directory (mod.json + optional glossary.json) or a bare mod.json path. */
export function readPack(input) {
  const path = resolve(input);
  const dir = statSync(path).isDirectory() ? path : dirname(path);
  const modPath = statSync(path).isDirectory() ? join(path, "mod.json") : path;
  const glossaryPath = join(dir, "glossary.json");
  const mod = JSON.parse(readFileSync(modPath, "utf8"));
  const names = existsSync(glossaryPath) ? JSON.parse(readFileSync(glossaryPath, "utf8")).names ?? [] : [];
  return { dir, modPath, mod, names };
}

export function formatReport(label, report) {
  const lines = [`drama-lint ${label}: ${report.ok ? "PASS" : "FAIL"} (${report.errors.length} errors, ${report.warnings.length} warnings)`];
  const show = (mark, item) => lines.push(`  ${mark} ${item.path}: "${item.word}": ${item.reason}${item.text !== item.word ? `\n      in: ${item.text.slice(0, 140)}` : ""}`);
  for (const e of report.errors) show("✗", e);
  for (const w of report.warnings) show("!", w);
  lines.push(`New parody names (the pack's glossary.json): ${report.newNames.join(", ") || "none"}`);
  return lines.join("\n");
}

export function main(args = process.argv.slice(2)) {
  const input = args.find((a) => !a.startsWith("--"));
  if (!input) {
    console.error("Usage: node drama/lint.mjs <pack dir | mod.json> [--json]");
    return 2;
  }
  const { dir, mod, names } = readPack(input);
  const report = lintPack(mod, { names });
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(formatReport(relative(process.cwd(), dir).startsWith("..") ? dir : relative(process.cwd(), dir) || basename(dir), report));
  return report.ok ? 0 : 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
