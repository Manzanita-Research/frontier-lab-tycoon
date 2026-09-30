import { makeAuth } from "./auth";
import type { Env } from "./env";
import { handleSaves } from "./saves";

/**
 * The prod Worker (FLT-67), deployed only when the repo variable `FLT_AUTH=on`. It answers `/api/auth/*` (Better Auth)
 * and `/api/saves/*` (cloud saves). Cloudflare only runs it for `/api/*` (`assets.run_worker_first`); every other path
 * is served straight from the static assets, exactly as the assets-only Worker does with the flag off.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

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
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

const error = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
