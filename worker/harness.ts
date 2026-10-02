import { build } from "esbuild";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Miniflare, Response as MfResponse, type Request as MfRequest } from "miniflare";

/**
 * A local copy of the prod Worker for tests (FLT-67): the real bundle of `worker/index.ts` in workerd, with a local D1
 * (the real migrations applied) and R2, and huggingface.co answered by a fake OAuth server.
 */

const root = fileURLToPath(new URL("../", import.meta.url));

export const HOST = "localhost";
export const ORIGIN = `http://${HOST}`;

/** What the fake Hugging Face saw, so a test can check the scopes we asked for and the code we traded. */
export interface HfLog {
  tokenRequests: URLSearchParams[];
  userinfo: string[];
}

export interface HfProfile {
  sub: string;
  name: string;
  preferred_username: string;
  picture: string;
  email?: string;
}

async function bundle() {
  const out = await build({
    entryPoints: [`${root}worker/index.ts`],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    conditions: ["workerd", "worker", "browser", "import"],
    mainFields: ["module", "main"],
    external: ["node:*"],
    logLevel: "silent",
  });
  return out.outputFiles[0]!.text;
}

export interface WorkerOptions {
  /** The host a player types (and Better Auth allows); `localhost` in tests. */
  host?: string;
  /** The static assets. Tests get a stub that names the path it was asked for. */
  assets?: (req: MfRequest) => MfResponse | Promise<MfResponse>;
  /** Extra plain-text bindings (AUTH_HOSTS for a host that doesn't sign in, say). */
  vars?: Record<string, string>;
}

export async function startWorker(profile: HfProfile, { host = HOST, assets, vars }: WorkerOptions = {}) {
  const origin = `http://${host}`;
  const hf: HfLog = { tokenRequests: [], userinfo: [] };
  const mf = new Miniflare({
    // Listed by hand: the bundle keeps a few dynamic `import()`s that Miniflare's module walker can't follow.
    modules: [{ type: "ESModule", path: "index.mjs", contents: await bundle() }],
    compatibilityDate: "2026-08-04",
    compatibilityFlags: ["nodejs_compat"],
    // Miniflare reaches workerd over 127.0.0.1:<port>; this makes the Worker see the host a player would have typed.
    upstream: origin,
    d1Databases: ["DB"],
    r2Buckets: ["SAVES"],
    bindings: {
      AUTH_HOSTS: host,
      AUTH_PROTOCOL: "http",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      HF_CLIENT_ID: "test-client",
      HF_CLIENT_SECRET: "test-client-secret",
      ...vars,
    },
    serviceBindings: {
      // The static assets: tell a test which path fell through to them.
      ASSETS: assets ?? ((req: MfRequest) => new MfResponse(`asset ${new URL(req.url).pathname}`, { headers: { "content-type": "text/html" } })),
    },
    // Every fetch the Worker makes to the outside world lands here: this is the mocked Hugging Face.
    outboundService: async (req: MfRequest) => {
      const url = new URL(req.url);
      if (url.hostname !== "huggingface.co") return new MfResponse("offline in tests", { status: 502 });
      if (url.pathname === "/oauth/token") {
        const form = new URLSearchParams(await req.text());
        hf.tokenRequests.push(form);
        if (form.get("code") !== "good-code") return MfResponse.json({ error: "invalid_grant" }, { status: 400 });
        return MfResponse.json({ access_token: "hf-access-token", token_type: "bearer", expires_in: 3600, scope: "openid profile" });
      }
      if (url.pathname === "/oauth/userinfo") {
        hf.userinfo.push(req.headers.get("authorization") ?? "");
        return MfResponse.json(profile);
      }
      return new MfResponse("not found", { status: 404 });
    },
  });
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync(`${root}worker/migrations`).sort()) {
    const sql = readFileSync(`${root}worker/migrations/${file}`, "utf8");
    for (const statement of sql.split(";").map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) {
      await db.prepare(statement).run();
    }
  }
  const saves = await mf.getR2Bucket("SAVES");
  // Every request looks like a browser behind Cloudflare (unless a test says who it is), so a test can check that none
  // of it is kept.
  const fetch = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has("user-agent")) headers.set("user-agent", "Mozilla/5.0 (Frontier 95; Paperclip)");
    headers.set("cf-connecting-ip", "203.0.113.7");
    return mf.dispatchFetch(`${origin}${path}`, { ...init, headers } as never) as unknown as Promise<Response>;
  };
  return { mf, db, saves, hf, fetch };
}

/** A cookie jar just big enough for Better Auth's state and session cookies. */
export class Jar {
  private cookies = new Map<string, string>();
  take(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const at = pair!.indexOf("=");
      const name = pair!.slice(0, at).trim();
      const value = pair!.slice(at + 1).trim();
      if (value === "" || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(fragment: string) {
    return [...this.cookies.keys()].some((k) => k.includes(fragment));
  }
}
