import edge from "../infra/edge.mjs";
import { isBareRoot } from "../src/introRoute";
import { makeAuth } from "./auth";
import type { Env } from "./env";
import { handleSaves } from "./saves";

/**
 * The prod Worker (FLT-67), deployed only when the repo variable `FLT_AUTH=on`, in place of the edge script
 * (`infra/edge.mjs`). On the hosts that sign in (app. and workers.dev) it answers `/api/auth/*` (Better Auth) and
 * `/api/saves/*` (cloud saves); everything else goes through the edge script itself, so the apex and www still 302 to
 * app. (link previews excepted) and the icons keep their cache headers. Cloudflare serves `/assets/*` directly without
 * running it, as it does for the edge script.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Any other host (the apex, www) is the edge script's: it 302s to app., /api included.
    if (!env.AUTH_HOSTS.split(",").some((h) => h.trim() === url.host)) return edge.fetch(request, env);

    if (path === "/api/auth" || path.startsWith("/api/auth/")) return makeAuth(env).handler(request);

    if (path === "/api/saves" || path.startsWith("/api/saves/")) {
      // Cookies are SameSite=Lax, so a cross-site PUT or DELETE never carries the session; refusing a foreign Origin
      // on writes is the belt to those braces.
      if (request.method !== "GET" && request.method !== "HEAD") {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return error(403, "origin", "Cross-site request refused.");
      }
      const session = await makeAuth(env).api.getSession({ headers: request.headers });
      if (!session) return error(401, "signed-out", "Log on to use cloud saves.");
      return handleSaves(request, env, session.user.id, path);
    }

    if (path === "/api" || path.startsWith("/api/")) return error(404, "not-found", "No such API.");

    // FLT-95 opens the bare root on the software shelf for a browser with no saves. A logged-on player's lab may be in
    // the cloud instead, so they go to the game, where "Continue from the cloud" is waiting. The account client reads
    // and removes `?member=1`; it only makes the address something other than bare.
    if ((request.method === "GET" || request.method === "HEAD") && isBareRoot(url) && /session_token=/.test(request.headers.get("cookie") ?? "")) {
      const session = await makeAuth(env)
        .api.getSession({ headers: request.headers })
        .catch(() => null);
      if (session) {
        url.searchParams.set("member", "1");
        return new Response(null, { status: 302, headers: { Location: `${url.pathname}${url.search}`, "Cache-Control": "no-store" } });
      }
    }
    return edge.fetch(request, env);
  },
} satisfies ExportedHandler<Env>;

const error = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
