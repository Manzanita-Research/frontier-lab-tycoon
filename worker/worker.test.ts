import { getMigrations } from "better-auth/db/migration";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { META_HEADER, type SaveMeta } from "../src/account/contract";
import { authOptions } from "./auth";
import type { Env } from "./env";
import { Jar, ORIGIN, startWorker, type HfProfile } from "./harness";

// FLT-67: the prod Worker end to end in workerd (Miniflare), against a local D1 and R2 and a fake huggingface.co.

const profile: HfProfile = {
  sub: "6512a1b2c3",
  name: "Ada Founder",
  preferred_username: "ada",
  picture: "https://cdn.example.test/ada.png",
  // Hugging Face would not send this for `openid profile`; it is here to prove we would not keep it if it did.
  email: "ada@example.test",
};

let w: Awaited<ReturnType<typeof startWorker>>;
beforeAll(async () => {
  w = await startWorker(profile);
}, 60_000);
afterAll(async () => {
  await w?.mf.dispose();
});

async function signIn(code = "good-code") {
  const jar = new Jar();
  const start = jar.take(
    await w.fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ provider: "huggingface", callbackURL: "/?welcome=1" }),
    }),
  );
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const authorize = new URL(url);
  const callback = jar.take(
    await w.fetch(`/api/auth/callback/huggingface?code=${code}&state=${authorize.searchParams.get("state")}`, {
      headers: { cookie: jar.header() },
      redirect: "manual",
    }),
  );
  return { jar, authorize, callback };
}

const meta = (over: Partial<SaveMeta> = {}): SaveMeta => ({
  v: 1,
  savedAt: 1_760_000_000_000,
  seed: 12,
  lab: "Paperclip Maximal",
  day: 400,
  mods: [{ id: "golden-retriever-protest", version: "1.0.0", hash: "abc123", url: "https://mods.example.test/grp.json" }],
  skin: "frontier-95",
  device: "laptop-1",
  ...over,
});

const put = (jar: Jar, slot: string, body: BodyInit, m: unknown = meta(), headers: Record<string, string> = {}) =>
  w.fetch(`/api/saves/${slot}`, {
    method: "PUT",
    headers: { cookie: jar.header(), origin: ORIGIN, [META_HEADER]: typeof m === "string" ? m : JSON.stringify(m), ...headers },
    body,
  });

describe("Hugging Face sign-in (Better Auth, mocked HF OAuth server)", () => {
  it("asks Hugging Face for openid and profile only, and comes back to this host", async () => {
    const { authorize } = await signIn();
    expect(authorize.origin + authorize.pathname).toBe("https://huggingface.co/oauth/authorize");
    expect(authorize.searchParams.get("scope")).toBe("openid profile");
    expect(authorize.searchParams.get("client_id")).toBe("test-client");
    expect(authorize.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback/huggingface`);
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("trades the code, starts a cookie session and stores a placeholder email, never the real one", async () => {
    const { jar, callback } = await signIn();
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/?welcome=1");
    const cookie = callback.headers.getSetCookie().find((c) => c.includes("session_token"));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(w.hf.tokenRequests.at(-1)?.get("code")).toBe("good-code");
    expect(w.hf.userinfo.at(-1)).toBe("Bearer hf-access-token");

    const session = (await (await w.fetch("/api/auth/get-session", { headers: { cookie: jar.header() } })).json()) as {
      user: { email: string; name: string; image: string; handle: string };
    };
    expect(session.user).toMatchObject({
      email: "huggingface-6512a1b2c3@users.invalid",
      name: "Ada Founder",
      image: "https://cdn.example.test/ada.png",
      handle: "ada",
    });
    const dump = JSON.stringify(await w.db.prepare("SELECT * FROM user").all());
    expect(dump).not.toContain("ada@example.test");
  });

  it("won't let a player rename themselves: the profile is Hugging Face's", async () => {
    const { jar } = await signIn();
    const res = await w.fetch("/api/auth/update-user", {
      method: "POST",
      headers: { cookie: jar.header(), origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ name: "Someone Famous", handle: "someone" }),
    });
    expect(res.status).toBe(404);
    expect(await w.db.prepare("SELECT handle FROM user").first()).toEqual({ handle: "ada" });
  });

  it("signs the same Hugging Face account into the same user every time", async () => {
    await signIn();
    await signIn();
    const users = await w.db.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>();
    expect(users?.n).toBe(1);
  });

  it("refuses a bad code without a session", async () => {
    const { jar, callback } = await signIn("bad-code");
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toContain("error");
    expect(jar.has("session_token")).toBe(false);
  });

  it("refuses a callback whose state it did not issue", async () => {
    const res = await w.fetch("/api/auth/callback/huggingface?code=good-code&state=forged", { redirect: "manual" });
    expect(res.headers.get("location") ?? "").toContain("error");
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token=") && !/max-age=0/i.test(c))).toBe(false);
  });
});

describe("routing", () => {
  it("serves the game's assets for everything outside /api", async () => {
    expect(await (await w.fetch("/")).text()).toBe("asset /");
    expect(await (await w.fetch("/?seed=12")).text()).toBe("asset /");
  });

  it("answers unknown /api paths with a JSON 404, not the game", async () => {
    const res = await w.fetch("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not-found" });
  });
});

describe("/api/saves (local D1 + R2)", () => {
  it("needs a session", async () => {
    expect((await w.fetch("/api/saves")).status).toBe(401);
    expect((await put(new Jar(), "1", "x")).status).toBe(401);
  });

  it("uploads, lists, downloads and deletes a slot", async () => {
    const { jar } = await signIn();
    const bytes = new Uint8Array([0x1f, 0x8b, 8, 0, 1, 2, 3, 4, 5]);
    const up = await put(jar, "1", bytes);
    expect(up.status).toBe(200);
    expect(await up.json()).toMatchObject({ slot: "1", size: bytes.length, meta: meta() });

    const list = (await (await w.fetch("/api/saves", { headers: { cookie: jar.header() } })).json()) as { saves: unknown[] };
    expect(list.saves).toEqual([expect.objectContaining({ slot: "1", size: bytes.length, meta: meta() })]);

    const down = await w.fetch("/api/saves/1", { headers: { cookie: jar.header() } });
    expect(down.status).toBe(200);
    expect(new Uint8Array(await down.arrayBuffer())).toEqual(bytes);
    expect(JSON.parse(down.headers.get(META_HEADER)!)).toEqual(meta());

    const userId = (await w.db.prepare("SELECT id FROM user").first<{ id: string }>())!.id;
    expect(await w.saves.head(`saves/${userId}/1.fltsave`)).not.toBeNull();

    expect((await w.fetch("/api/saves/1", { method: "DELETE", headers: { cookie: jar.header(), origin: ORIGIN } })).status).toBe(204);
    expect((await w.fetch("/api/saves/1", { headers: { cookie: jar.header() } })).status).toBe(404);
    expect(await w.saves.head(`saves/${userId}/1.fltsave`)).toBeNull();
  });

  it("validates the slot, the metadata and the size", async () => {
    const { jar } = await signIn();
    expect((await put(jar, "9", "x")).status).toBe(404);
    expect((await put(jar, "2", "x", "{not json")).status).toBe(400);
    expect((await put(jar, "2", "x", { ...meta(), v: "one" })).status).toBe(400);
    expect((await put(jar, "2", "x", { ...meta(), device: "" })).status).toBe(400);
    expect((await put(jar, "2", "")).status).toBe(400);
    expect((await put(jar, "2", new Uint8Array(2 * 1024 * 1024 + 1))).status).toBe(413);
  });

  it("refuses a slot rewritten within seconds, and a cross-site write", async () => {
    const { jar } = await signIn();
    expect((await put(jar, "auto", "one")).status).toBe(200);
    expect((await put(jar, "auto", "two")).status).toBe(429);
    expect((await put(jar, "3", "x", meta(), { origin: "https://evil.example.test" })).status).toBe(403);
  });

  it("deleting the account wipes its saves from D1 and R2 at once", async () => {
    const { jar } = await signIn();
    await put(jar, "2", "keep me?");
    const userId = (await w.db.prepare("SELECT id FROM user").first<{ id: string }>())!.id;
    const res = await w.fetch("/api/auth/delete-user", {
      method: "POST",
      headers: { cookie: jar.header(), origin: ORIGIN, "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    expect((await w.db.prepare("SELECT COUNT(*) AS n FROM saves").first<{ n: number }>())?.n).toBe(0);
    expect((await w.db.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>())?.n).toBe(0);
    expect((await w.saves.list({ prefix: `saves/${userId}/` })).objects).toHaveLength(0);
  });
});

describe("the D1 schema", () => {
  it("has every table and column Better Auth expects (worker/migrations is complete)", async () => {
    const db = new DatabaseSync(":memory:");
    const dir = fileURLToPath(new URL("./migrations/", import.meta.url));
    for (const file of readdirSync(dir).sort()) db.exec(readFileSync(dir + file, "utf8"));
    const env = { AUTH_HOSTS: "localhost", BETTER_AUTH_SECRET: "x".repeat(32), HF_CLIENT_ID: "a", HF_CLIENT_SECRET: "b" } as Env;
    const { toBeCreated, toBeAdded } = await getMigrations(authOptions(env, db as never));
    expect(toBeCreated).toEqual([]);
    expect(toBeAdded).toEqual([]);
  });
});
