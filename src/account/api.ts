import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

/**
 * The browser side of `/api/auth/*` (Better Auth on the prod Worker, FLT-67). Plain `fetch` on the game's own origin:
 * the session is an HttpOnly cookie the page never sees, so there is no token to keep and no client library to ship.
 */

/** What the game shows of a player: all of it comes from their Hugging Face profile. */
export const Player = Schema.Struct({
  name: Schema.String,
  handle: Schema.optionalKey(Schema.NullOr(Schema.String)),
  image: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
export type Player = typeof Player.Type;

const decodeSession = Schema.decodeUnknownResult(Schema.NullOr(Schema.Struct({ user: Player })));

const post = (path: string, body: unknown = {}) =>
  fetch(`/api/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** The signed-in player, or null for a guest (and for any answer we can't read: a guest is always safe). */
export async function getPlayer(): Promise<Player | null> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    const session = decodeSession(await res.json());
    return Result.isFailure(session) || !session.success ? null : session.success.user;
  } catch {
    return null;
  }
}

/** Marks the page Hugging Face sends a player back to, so the game can say how it went (then tidy the URL). */
export const RETURN_PARAM = "logon";

function backTo(outcome: "ok" | "failed"): string {
  const url = new URL(window.location.href);
  url.searchParams.set(RETURN_PARAM, outcome);
  return url.pathname + url.search;
}

/** Off to Hugging Face. Resolves only if the Worker refused to start (the page is navigating away otherwise). */
export async function logOn(): Promise<string> {
  try {
    const res = await post("sign-in/social", { provider: "huggingface", callbackURL: backTo("ok"), errorCallbackURL: backTo("failed") });
    const body = (await res.json().catch(() => ({}))) as { url?: unknown; message?: unknown };
    if (res.ok && typeof body.url === "string") {
      window.location.assign(body.url);
      return "";
    }
    return typeof body.message === "string" ? body.message : "The Frontier Network didn't answer.";
  } catch {
    return "The Frontier Network didn't answer. Check your connection and try again.";
  }
}

export async function logOff(): Promise<boolean> {
  try {
    return (await post("sign-out")).ok;
  } catch {
    return false;
  }
}

/** Deletes the account and every cloud save with it. Better Auth wants a recent log-on for this; `stale` says so. */
export async function deleteAccount(): Promise<"deleted" | "stale" | "failed"> {
  try {
    const res = await post("delete-user");
    if (res.ok) return "deleted";
    const body = (await res.json().catch(() => ({}))) as { code?: unknown };
    return typeof body.code === "string" && /FRESH|EXPIRED/.test(body.code) ? "stale" : "failed";
  } catch {
    return "failed";
  }
}

/** Reads and removes `?logon=` (and Better Auth's `error` params) from the address bar. */
export function takeReturn(): "ok" | "failed" | null {
  const url = new URL(window.location.href);
  const outcome = url.searchParams.get(RETURN_PARAM);
  if (outcome !== "ok" && outcome !== "failed") return null;
  for (const key of [RETURN_PARAM, "error", "error_description"]) url.searchParams.delete(key);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return outcome;
}
