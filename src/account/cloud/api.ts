import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { SaveList, SaveSummary, type Slot } from "../contract";

/**
 * The browser side of `/api/saves` (FLT-67): plain `fetch` on the game's own origin, with the session cookie. Nothing
 * here throws: a network that's down, a Worker that's busy and a session that ended are all answers.
 */
export interface CloudApi {
  /** The cloud's saves, or null when they couldn't be read (offline, logged off). */
  list(): Promise<readonly SaveSummary[] | null>;
  /** A slot's save, the `.fltsave` text byte for byte, or null. */
  get(slot: Slot): Promise<string | null>;
  put(slot: Slot, text: string, keepalive: boolean): Promise<PutResult>;
}

export type PutResult =
  | { kind: "ok"; summary: SaveSummary }
  /** Try again later: offline, a 5xx, or the slot was written a moment ago (429). */
  | { kind: "retry" }
  | { kind: "signed-out" }
  /** The Worker read it and said no (too big, not a save): sending the same bytes again won't help. */
  | { kind: "refused"; message: string };

const decodeList = Schema.decodeUnknownResult(SaveList);
const decodeSummary = Schema.decodeUnknownResult(SaveSummary);

/** fetch's keepalive (a save that goes up as the tab closes) carries at most 64 KiB. */
export const KEEPALIVE_MAX = 60_000;

export const cloudApi: CloudApi = {
  async list() {
    try {
      const res = await fetch("/api/saves", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return null;
      const list = decodeList(await res.json());
      return Result.isFailure(list) ? null : list.success.saves;
    } catch {
      return null;
    }
  },
  async get(slot) {
    try {
      const res = await fetch(`/api/saves/${slot}`, { credentials: "same-origin", cache: "no-store" });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  },
  async put(slot, text, keepalive) {
    try {
      const res = await fetch(`/api/saves/${slot}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/x-fltsave+json" },
        body: text,
        keepalive: keepalive && text.length <= KEEPALIVE_MAX,
      });
      if (res.ok) {
        const summary = decodeSummary(await res.json().catch(() => null));
        return Result.isFailure(summary) ? { kind: "retry" } : { kind: "ok", summary: summary.success };
      }
      if (res.status === 401) return { kind: "signed-out" };
      if (res.status === 400 || res.status === 413) {
        const body = (await res.json().catch(() => ({}))) as { message?: unknown };
        return { kind: "refused", message: typeof body.message === "string" ? body.message : "The Frontier Network refused it." };
      }
      return { kind: "retry" };
    } catch {
      return { kind: "retry" };
    }
  },
};
