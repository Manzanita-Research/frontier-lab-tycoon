import { FRIENDS, STORY_PRIORITY } from "../content/newsroom";
import type { Edition, Story } from "./edition";
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const string = (v: unknown): v is string => typeof v === "string" && v.length <= 2000;
function story(v: unknown): v is Story {
  return record(v) && finite(v.id) && finite(v.day) && string(v.text) && typeof v.kind === "string" && Object.hasOwn(STORY_PRIORITY, v.kind);
}
/** Reject corrupt/unrecognized entries instead of letting storage crash the game. Images are only our own WebP/PNG captures. */
export function readArchive(raw: string | null): Edition[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((e): e is Edition => {
      if (!record(e) || !string(e.id) || !finite(e.day) || !finite(e.from) || !string(e.lab)) return false;
      if (e.type === "paper") return story(e.lead) && Array.isArray(e.sub) && e.sub.length === 3 && e.sub.every(story)
        && string(e.caption) && string(e.classified) && (e.photo === undefined || (typeof e.photo === "string" && /^data:image\/(?:webp|png);base64,/.test(e.photo) && e.photo.length < 250000))
        && Array.isArray(e.stocks) && e.stocks.length <= 4 && e.stocks.every((s: unknown) => record(s) && string(s.name) && string(s.price) && finite(s.change));
      if (e.type === "chat") return string(e.topic) && Array.isArray(e.messages) && e.messages.length <= 10 && e.messages.every((m: unknown) => record(m) && typeof m.friend === "string" && Object.hasOwn(FRIENDS, m.friend) && string(m.text));
      return false;
    }).slice(-30);
  } catch { return []; }
}
export function appendArchive(archive: readonly Edition[], editions: readonly Edition[]): Edition[] {
  const unique = new Map(archive.map((e) => [e.id, e]));
  for (const e of editions) unique.set(e.id, e);
  return [...unique.values()].sort((a, b) => a.day - b.day || a.id.localeCompare(b.id)).slice(-30);
}
