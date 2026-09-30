import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { MAX_SAVE_BYTES, META_HEADER, SaveMeta, Slot, type SaveSummary } from "../src/account/contract";
import type { Env } from "./env";

/** A slot can't be rewritten more often than this (the client throttles autosaves to one per 5 minutes anyway). */
export const MIN_WRITE_GAP_MS = 10_000;

const decodeSlot = Schema.decodeUnknownResult(Slot);
const decodeMeta = Schema.decodeUnknownResult(Schema.fromJsonString(SaveMeta));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (status: number, error: string, message: string) => json({ error, message }, status);

const blobKey = (userId: string, slot: Slot) => `saves/${userId}/${slot}.fltsave`;

interface Row {
  slot: string;
  size: number;
  updated_at: number;
  meta: string;
}

const summary = (row: Row): SaveSummary | null => {
  const slot = decodeSlot(row.slot);
  const meta = decodeMeta(row.meta);
  if (Result.isFailure(slot) || Result.isFailure(meta)) return null;
  return { slot: slot.success, size: row.size, updatedAt: row.updated_at, meta: meta.success };
};

/**
 * `/api/saves` and `/api/saves/<slot>` for a signed-in player: list, download, upload, delete. The Worker has already
 * checked the session; `userId` is the player's.
 */
export async function handleSaves(request: Request, env: Env, userId: string, path: string, now = Date.now()): Promise<Response> {
  const rest = path.slice("/api/saves".length);
  if (rest === "" || rest === "/") {
    if (request.method !== "GET") return fail(405, "method", "Use GET to list saves.");
    const { results } = await env.DB.prepare("SELECT slot, size, updated_at, meta FROM saves WHERE user_id = ? ORDER BY slot")
      .bind(userId)
      .all<Row>();
    return json({ saves: results.map(summary).filter((s) => s !== null) });
  }

  const slot = decodeSlot(decodeURIComponent(rest.slice(1)));
  if (Result.isFailure(slot)) return fail(404, "slot", "Slots are auto, 1, 2 and 3.");
  const key = blobKey(userId, slot.success);

  switch (request.method) {
    case "GET": {
      const row = await env.DB.prepare("SELECT meta FROM saves WHERE user_id = ? AND slot = ?").bind(userId, slot.success).first<{ meta: string }>();
      const blob = row ? await env.SAVES.get(key) : null;
      if (!row || !blob) return fail(404, "empty", "Nothing saved in that slot.");
      return new Response(blob.body, {
        headers: { "content-type": "application/octet-stream", [META_HEADER]: row.meta, "cache-control": "no-store" },
      });
    }
    case "PUT": {
      const meta = decodeMeta(request.headers.get(META_HEADER) ?? "");
      if (Result.isFailure(meta)) return fail(400, "meta", `The ${META_HEADER} header is missing or malformed.`);
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (declared > MAX_SAVE_BYTES) return fail(413, "size", "Saves are capped at 2 MB.");
      const body = await request.arrayBuffer();
      if (body.byteLength === 0) return fail(400, "empty", "The save is empty.");
      if (body.byteLength > MAX_SAVE_BYTES) return fail(413, "size", "Saves are capped at 2 MB.");
      const last = await env.DB.prepare("SELECT updated_at FROM saves WHERE user_id = ? AND slot = ?")
        .bind(userId, slot.success)
        .first<{ updated_at: number }>();
      if (last && now - last.updated_at < MIN_WRITE_GAP_MS) return fail(429, "slow", "That slot was saved a moment ago.");
      const metaText = JSON.stringify(meta.success);
      await env.SAVES.put(key, body);
      await env.DB.prepare(
        `INSERT INTO saves (user_id, slot, size, updated_at, meta) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, slot) DO UPDATE SET size = excluded.size, updated_at = excluded.updated_at, meta = excluded.meta`,
      )
        .bind(userId, slot.success, body.byteLength, now, metaText)
        .run();
      return json({ slot: slot.success, size: body.byteLength, updatedAt: now, meta: meta.success } satisfies SaveSummary);
    }
    case "DELETE": {
      await env.DB.prepare("DELETE FROM saves WHERE user_id = ? AND slot = ?").bind(userId, slot.success).run();
      await env.SAVES.delete(key);
      return new Response(null, { status: 204 });
    }
    default:
      return fail(405, "method", "Use GET, PUT or DELETE.");
  }
}
