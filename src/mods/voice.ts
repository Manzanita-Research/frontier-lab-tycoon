// A mod's voice (FLT-102): rules that rewrite the flavour text the player reads, in someone else's style. Presentation
// only, and deterministic without touching the game's RNG: every line seeds its own dice from its own text, so the same
// headline always comes out the same (screenshots and replays agree), and nothing in the World ever sees it.
import type { VoiceData, VoiceMoment } from "./schema";

/** FNV-1a, 32 bits. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a few dice from one seed. Not the sim's RNG, on purpose. */
function dice(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A token the voice must not touch: numbers, money, percentages, handles, tags, links and placeholders. */
const KEEP = /[\d$%@#{}/\\<>=_|~^]/;
/** Split a token into its leading punctuation, the word, and its trailing punctuation. */
const PARTS = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su;
const LETTER = /\p{L}/u;
const MAX_CACHE = 4000;

export type Say = (text: string) => string;

/**
 * The voice as a function. It keeps what it has already said, so a HUD redrawn five times a second costs a lookup.
 * `keep` are names it says as they are (the loaded mods' names: "Mods on: …" still names them).
 */
export function makeVoice(rules: VoiceData, keep: readonly string[] = []): Say {
  const cache = new Map<string, string>();
  // A kept name rides through as a placeholder the KEEP rule leaves alone, then comes back.
  const kept = [...new Set(keep.filter((k) => k.trim() !== ""))].sort((a, b) => b.length - a.length);
  const hold = (text: string) => kept.reduce((t, name, i) => t.split(name).join(`{kept${i}}`), text);
  const give = (text: string) => text.replace(/\{kept(\d+)\}/g, (all, i: string) => kept[Number(i)] ?? all);
  const emoji = rules.emoji?.list ?? [];
  const words = rules.words ?? {};
  const letters = rules.letters ?? [];
  const leet = rules.leet;
  const voiced = (text: string) => emoji.some((e) => text.trimEnd().endsWith(e));

  function word(core: string, roll: () => number): string {
    const lower = core.toLowerCase();
    let out = Object.hasOwn(words, lower) ? words[lower]! : null;
    if (out === null) {
      out = lower;
      for (const { from, to, odds } of letters) {
        if (!out.includes(from)) continue;
        out = out.split(from).reduce((acc, piece) => acc + (roll() < odds ? to : from) + piece);
      }
      if (leet && out.length >= 4 && roll() < leet.odds) out = [...out].map((ch) => (Object.hasOwn(leet.map, ch) && roll() < 0.5 ? leet.map[ch]! : ch)).join("");
    }
    if (rules.lowercase) return out;
    // Keep a capital where the original had one: "Rules" -> "Wuwes", "LAB" -> "WAB".
    if (core === core.toUpperCase() && core.length > 1) return out.toUpperCase();
    return core[0] !== lower[0] ? out.charAt(0).toUpperCase() + out.slice(1) : out;
  }

  function transform(text: string): string {
    if (!LETTER.test(text) || voiced(text)) return text;
    const roll = dice(hash(text));
    const tokens = text.split(/(\s+)/);
    const last = tokens.length - 1 - [...tokens].reverse().findIndex((t) => t.trim() !== "");
    // Numbers and handles keep their case (`$1.2M`, `Frontier-4.5`): only the words are lowercased.
    let out = tokens
      .map((token, i) => {
        if (i % 2 === 1 || token === "") return token;
        if (KEEP.test(token)) return token;
        const [, lead = "", core = "", tail = ""] = PARTS.exec(token) ?? [];
        if (!core || !LETTER.test(core)) return token;
        // A sentence that ends in "." or "!" trails off instead, now and then.
        const ends = /^[.!]+$/.test(tail) && (i === last || /^\p{Lu}/u.test(tokens[i + 2] ?? ""));
        const trail = ends && rules.ellipsis !== undefined && roll() < rules.ellipsis ? "..." : tail;
        return lead + word(core, roll) + trail;
      })
      .join("");
    const openers = rules.openers;
    if (openers && out.length > 40 && roll() < openers.odds) out = openers.lines[Math.floor(roll() * openers.lines.length)]! + out;
    if (emoji.length > 0 && rules.emoji) {
      const { min, max } = rules.emoji;
      const n = Math.max(0, Math.round(min + roll() * (max - min)));
      const tail = Array.from({ length: n }, () => emoji[Math.floor(roll() * emoji.length)]!).join("");
      if (tail) out = `${out.trimEnd()} ${tail}`;
    }
    return out;
  }

  return (text: string) => {
    let out = cache.get(text);
    if (out === undefined) {
      if (cache.size >= MAX_CACHE) cache.clear();
      cache.set(text, (out = kept.length > 0 && kept.some((k) => text.includes(k)) ? give(transform(hold(text))) : transform(text)));
    }
    return out;
  };
}

/** One of the voice's own lines for a moment, picked by `key` (a day, a level): the same key, the same line. */
export function momentLine(rules: VoiceData, moment: VoiceMoment, key: number | string): string | null {
  const lines = rules.moments?.[moment];
  if (!lines || lines.length === 0) return null;
  return lines[hash(`${moment}:${key}`) % lines.length]!;
}
