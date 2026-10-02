import { isBareRoot } from "../src/introRoute";
import { makeAuth } from "./auth";
import type { Env } from "./env";
import { handleSaves } from "./saves";

/**
 * The prod Worker (FLT-67), deployed only when the repo variable `FLT_AUTH=on`, in place of the edge script in
 * `infra/alchemy.run.ts`. It does that script's job first (the apex and www 302 to app.), then answers `/api/auth/*`
 * (Better Auth) and `/api/saves/*` (cloud saves), and hands everything else to the static assets. Cloudflare serves
 * `/assets/*` directly without running it, as it does for the edge script.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // The edge script's redirect, unchanged: 302, not 301 (browsers cache 301s forever).
    if (env.APP_HOST && env.REDIRECT_HOSTS?.split(",").includes(url.hostname)) {
      return new Response(null, {
        status: 302,
        headers: { Location: `https://${env.APP_HOST}${url.pathname}${url.search}`, "Cache-Control": "no-store" },
      });
    }

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
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

const error = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
