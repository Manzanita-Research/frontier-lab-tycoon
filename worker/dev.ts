// A local prod Worker with accounts on (FLT-67), for trying the sign-in and taking screenshots without Cloudflare or
// Hugging Face: `node worker/dev.ts [--port 8787] [--dist dist-accounts]`, after `VITE_FLT_AUTH=on pnpm exec vite build
// --outDir dist-accounts`. The game is served from that build, /api/* by the real Worker in workerd with an in-memory
// D1 and R2, and huggingface.co by the tests' fake. A browser can't reach the fake Hugging Face, so any page opened
// with `?devlogon=1` goes through the whole OAuth dance server-side and comes back logged on as "Ada Founder" (@ada).
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Response as MfResponse, type Request as MfRequest } from "miniflare";
import { Jar, startWorker } from "./harness.ts";

const { values } = parseArgs({ options: { port: { type: "string", default: "8787" }, dist: { type: "string", default: "dist-accounts" } } });
const port = Number(values.port);
const dist = resolve(values.dist!);
if (!existsSync(join(dist, "index.html"))) {
  console.error(`No build in ${dist}. Run: VITE_FLT_AUTH=on pnpm exec vite build --outDir ${values.dist}`);
  process.exit(2);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".glb": "model/gltf-binary",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".txt": "text/plain",
};

/** The static assets, with the single-page fallback the prod site has (`notFoundHandling: "single-page-application"`). */
function assets(req: MfRequest) {
  const path = decodeURIComponent(new URL(req.url).pathname);
  let file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html");
  return new MfResponse(readFileSync(file), { headers: { "content-type": TYPES[extname(file)] ?? "application/octet-stream" } });
}

const host = `localhost:${port}`;
/** Ada's avatar: a data URL, so the dev server needs no image host. */
const AVATAR = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#ffd21e"/><circle cx="20" cy="17" r="8" fill="#7a4a1c"/><rect x="8" y="28" width="24" height="12" rx="6" fill="#7a4a1c"/></svg>')}`;
const w = await startWorker(
  { sub: "6512a1b2c3", name: "Ada Founder", preferred_username: "ada", picture: AVATAR },
  { host, assets },
);

/** The OAuth round trip a browser would make, done here against the fake Hugging Face; returns the session cookies. */
async function devLogOn(back: string) {
  const jar = new Jar();
  const start = jar.take(
    await w.fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://${host}` },
      body: JSON.stringify({ provider: "huggingface", callbackURL: back }),
    }),
  );
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  const callback = await w.fetch(`/api/auth/callback/huggingface?code=good-code&state=${state}`, { headers: { cookie: jar.header() }, redirect: "manual" });
  return { location: callback.headers.get("location") ?? back, cookies: callback.headers.getSetCookie() };
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.searchParams.has("devlogon")) {
      url.searchParams.delete("devlogon");
      url.searchParams.set("logon", "ok");
      const { location, cookies } = await devLogOn(url.pathname + url.search);
      res.writeHead(302, { location, "set-cookie": cookies, "cache-control": "no-store" }).end();
      return;
    }
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(await Array.fromAsync(req));
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const out = await w.mf.dispatchFetch(`http://${host}${url.pathname}${url.search}`, { method: req.method, headers, body, redirect: "manual" } as never);
    const outHeaders: Record<string, string | string[]> = {};
    out.headers.forEach((v, k) => (outHeaders[k] = v));
    const cookies = out.headers.getSetCookie();
    if (cookies.length) outHeaders["set-cookie"] = cookies;
    res.writeHead(out.status, outHeaders).end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(String(e));
  }
}).listen(port, "0.0.0.0", () => console.error(`accounts dev server: http://${host}/  (add ?devlogon=1 to arrive logged on)`));
