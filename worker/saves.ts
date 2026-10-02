import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { MAX_SAVE_BYTES, SAVE_MIME, SaveHead, SaveUpload, Slot, type SaveSummary } from "../src/account/contract";
import type { Env } from "./env";

/** A slot can't be rewritten more often than this (the client sends the autosave at most once a minute, and waits SLOT_GAP_MS between writes to a slot: src/account/cloud/sync.ts). */
export const MIN_WRITE_GAP_MS = 10_000;

const decodeSlot = Schema.decodeUnknownResult(Slot);
const decodeHead = Schema.decodeUnknownResult(Schema.fromJsonString(SaveHead));
const decodeUpload = Schema.decodeUnknownResult(Schema.fromJsonString(SaveUpload));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (status: number, error: string, message: string) => json({ error, message }, status);

const blobKey = (userId: string, slot: Slot) => `saves/${userId}/${slot}.fltsave`;

interface Row {
  slot: string;
  size: number;
  updated_at: number;
  head: string;
}

const summary = (row: Row): SaveSummary | null => {
  const slot = decodeSlot(row.slot);
  const head = decodeHead(row.head);
  if (Result.isFailure(slot) || Result.isFailure(head)) return null;
  return { slot: slot.success, size: row.size, updatedAt: row.updated_at, head: head.success };
};

/**
 * `/api/saves` and `/api/saves/<slot>` for a signed-in player: list, download, upload, delete. A save goes up and comes
 * back as FLT-65's `.fltsave` text, byte for byte. The Worker has already checked the session; `userId` is the player's.
 */
export async function handleSaves(request: Request, env: Env, userId: string, path: string, now = Date.now()): Promise<Response> {
  const rest = path.slice("/api/saves".length);
  if (rest === "" || rest === "/") {
    if (request.method !== "GET") return fail(405, "method", "Use GET to list saves.");
    const { results } = await env.DB.prepare("SELECT slot, size, updated_at, head FROM saves WHERE user_id = ? ORDER BY slot")
      .bind(userId)
      .all<Row>();
    return json({ saves: results.map(summary).filter((s) => s !== null) });
  }

  const slot = decodeSlot(decodeURIComponent(rest.slice(1)));
  if (Result.isFailure(slot)) return fail(404, "slot", "Slots are auto, 1, 2 and 3.");
  const key = blobKey(userId, slot.success);

  switch (request.method) {
    case "GET": {
      const row = await env.DB.prepare("SELECT 1 FROM saves WHERE user_id = ? AND slot = ?").bind(userId, slot.success).first();
      const blob = row ? await env.SAVES.get(key) : null;
      if (!row || !blob) return fail(404, "empty", "Nothing saved in that slot.");
      return new Response(blob.body, { headers: { "content-type": SAVE_MIME, "cache-control": "no-store" } });
    }
    case "PUT": {
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (declared > MAX_SAVE_BYTES) return fail(413, "size", "Saves are capped at 2 MB.");
      const body = await request.arrayBuffer();
      if (body.byteLength === 0) return fail(400, "empty", "The save is empty.");
      if (body.byteLength > MAX_SAVE_BYTES) return fail(413, "size", "Saves are capped at 2 MB.");
      const upload = decodeUpload(new TextDecoder().decode(body));
      if (Result.isFailure(upload)) return fail(400, "not-a-save", "That isn't a lab save (.fltsave).");
      const last = await env.DB.prepare("SELECT updated_at FROM saves WHERE user_id = ? AND slot = ?")
        .bind(userId, slot.success)
        .first<{ updated_at: number }>();
      if (last && now - last.updated_at < MIN_WRITE_GAP_MS) return fail(429, "slow", "That slot was saved a moment ago.");
      const { state: _state, ...head } = upload.success;
      await env.SAVES.put(key, body, { httpMetadata: { contentType: SAVE_MIME } });
      await env.DB.prepare(
        `INSERT INTO saves (user_id, slot, size, updated_at, head) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, slot) DO UPDATE SET size = excluded.size, updated_at = excluded.updated_at, head = excluded.head`,
      )
        .bind(userId, slot.success, body.byteLength, now, JSON.stringify(head))
        .run();
      return json({ slot: slot.success, size: body.byteLength, updatedAt: now, head } satisfies SaveSummary);
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
