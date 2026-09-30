// The Save/Load window's view-model (FLT-65): plain data about the slots in, SavesVM out. Pure, like vm.ts: the clock
// comes in as `now`, and nothing here reads storage.
import type { SaveFile, SaveMeta, SlotListing } from "../../save";
import { formatDate } from "../../sim/format";
import type { SaveModPromptVM, SaveSummaryVM, SavesVM, ToneVM } from "./types";

/** Roughly what a browser gives one site (localStorage counts characters; most allow about five million). */
export const STORAGE_BUDGET = 5_000_000;

export interface SavesInput {
  open: boolean;
  available: boolean;
  listing: readonly SlotListing[];
  /** The autosave "Welcome back" offers, or null once answered (or when there is none). */
  welcome: SaveMeta | null;
  busy: boolean;
  status: { text: string; tone: ToneVM } | null;
  modPrompt: SaveModPromptVM | null;
  dragging: boolean;
  /** Skin ids to names ("frontier-95" to "Frontier 95"). */
  skinNames: Readonly<Record<string, string>>;
  now: number;
}

export const NO_SAVES_VM: SavesVM = {
  open: false,
  available: true,
  slots: [],
  current: { lab: "", date: "" },
  welcome: null,
  busy: false,
  status: null,
  modPrompt: null,
  storage: { text: "", used: 0 },
  dragging: false,
};

/** "just now", "12 minutes ago", "3 hours ago", "yesterday", "5 days ago", then the date. */
export function agoText(savedAt: string, now: number): string {
  const t = Date.parse(savedAt);
  if (!Number.isFinite(t)) return "some time ago";
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 2) return "just now";
  if (min < 60) return `${min} minutes ago`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return new Date(t).toISOString().slice(0, 10);
}

/** "812 B", "45K", "1.2 MB" */
export function sizeText(chars: number): string {
  if (chars < 1000) return `${chars} B`;
  if (chars < 1_000_000) return `${Math.round(chars / 1000)}K`;
  return `${(chars / 1_000_000).toFixed(1)} MB`;
}

export function saveSummary(meta: SaveMeta, now: number, skinNames: Readonly<Record<string, string>> = {}): SaveSummaryVM {
  return {
    lab: meta.lab,
    date: formatDate(meta.day),
    day: meta.day,
    ago: agoText(meta.savedAt, now),
    size: sizeText(meta.size),
    skin: meta.skin ? (skinNames[meta.skin] ?? meta.skin) : null,
    mods: meta.mods.map((m) => m.id),
  };
}

export function savesViewModel(i: SavesInput, current: { lab: string; day: number }): SavesVM {
  const used = i.listing.reduce((n, l) => n + (l.meta?.size ?? 0), 0);
  return {
    open: i.open,
    available: i.available,
    slots: i.listing.map((l) => ({
      slot: l.slot,
      label: l.slot === "auto" ? "Autosave" : `Slot ${l.slot}`,
      save: l.meta ? saveSummary(l.meta, i.now, i.skinNames) : null,
      broken: l.broken ?? null,
    })),
    current: { lab: current.lab, date: formatDate(current.day) },
    welcome: i.welcome ? saveSummary(i.welcome, i.now, i.skinNames) : null,
    busy: i.busy,
    status: i.status,
    modPrompt: i.modPrompt,
    storage: { text: `${sizeText(used)} of about ${STORAGE_BUDGET / 1_000_000} MB`, used: Math.min(1, used / STORAGE_BUDGET) },
    dragging: i.dragging,
  };
}

/** Which of the save's mods this session lacks, and which it has that the save didn't. Null when they match. */
export function modMismatch(save: SaveFile, running: readonly { id: string; name?: string; hash: string }[]): SaveModPromptVM | null {
  const key = (m: { id: string; hash: string }) => `${m.id}@${m.hash}`;
  const have = new Set(running.map(key));
  const had = new Set(save.mods.map(key));
  const missing = save.mods.filter((m) => !have.has(key(m)));
  const extra = running.filter((m) => !had.has(key(m)));
  if (missing.length === 0 && extra.length === 0) return null;
  return {
    lab: save.lab,
    missing: missing.map((m) => `${m.id} ${m.version}`),
    extra: extra.map((m) => m.name ?? m.id),
    canFetch: missing.length > 0 && missing.every((m) => !!m.source),
  };
}
