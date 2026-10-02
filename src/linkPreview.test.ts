import { describe, expect, it } from "vitest";
import edge from "../infra/edge.mjs";
import html from "../index.html?raw";
import manifestText from "../public/manifest.webmanifest?raw";

// FLT-99: pasting the link anywhere shows a card. Crawlers don't run JS, so everything here is in the static HTML.
const files = import.meta.glob<string>("/public/**/*.{png,jpg,ico,svg}", { query: "?inline", import: "default", eager: true });
const bytes = (path: string) => {
  const url = files[path];
  if (!url) throw new Error(`${path} is missing`);
  const b64 = url.slice(url.indexOf(",") + 1);
  return url.includes(";base64,") ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(b64));
};
const be16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const be32 = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const pngSize = (b: Uint8Array) => {
  expect([...b.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
  return [be32(b, 16), be32(b, 20)];
};
const jpegSize = (b: Uint8Array) => {
  expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
  for (let i = 2; i < b.length; ) {
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xc2) return [be16(b, i + 7), be16(b, i + 5)];
    i += 2 + be16(b, i + 2);
  }
  throw new Error("no frame header");
};

const doc = parseHead(html);
const APP = "https://app.frontierlabtycoon.com";

describe("FLT-99: link previews", () => {
  it("has a real title and description", () => {
    expect(doc.title).toMatch(/^Frontier Lab Tycoon: .*AI lab/);
    expect(doc.meta("description")!.length).toBeGreaterThan(80);
    expect(doc.meta("description")).toMatch(/Free, in your browser/);
  });

  it("has the Open Graph tags, with absolute URLs on app.", () => {
    expect(doc.meta("og:type")).toBe("website");
    expect(doc.meta("og:site_name")).toBe("Frontier Lab Tycoon");
    expect(doc.meta("og:url")).toBe(`${APP}/`);
    expect(doc.meta("og:title")).toBe(doc.title);
    expect(doc.meta("og:description")).toBeTruthy();
    expect(doc.meta("og:image")).toBe(`${APP}/og/card.jpg`);
    expect(doc.meta("og:image:type")).toBe("image/jpeg");
    expect([doc.meta("og:image:width"), doc.meta("og:image:height")]).toEqual(["1200", "630"]);
    expect(doc.meta("og:image:alt")).toMatch(/box/);
  });

  it("has a large Twitter card and no made-up handle", () => {
    expect(doc.meta("twitter:card")).toBe("summary_large_image");
    expect(doc.meta("twitter:title")).toBe(doc.title);
    expect(doc.meta("twitter:description")).toBe(doc.meta("og:description"));
    expect(doc.meta("twitter:image")).toBe(doc.meta("og:image"));
    expect(doc.meta("twitter:image:alt")).toBe(doc.meta("og:image:alt"));
    expect(doc.meta("twitter:site")).toBeUndefined();
  });

  it("the card is a 1200×630 JPEG small enough for every unfurler (WhatsApp drops images over ~300 KB)", () => {
    const card = bytes("/public/og/card.jpg");
    expect(jpegSize(card)).toEqual([1200, 630]);
    expect(card.length).toBeLessThan(300 * 1024);
  });

  it("has the icons and a manifest", () => {
    expect(doc.links("icon")).toEqual(["/favicon.ico", "/favicon.svg"]);
    expect(doc.links("apple-touch-icon")).toEqual(["/apple-touch-icon.png"]);
    expect(doc.links("manifest")).toEqual(["/manifest.webmanifest"]);
    expect(pngSize(bytes("/public/apple-touch-icon.png"))).toEqual([180, 180]);
    expect(new TextDecoder().decode(bytes("/public/favicon.svg"))).toMatch(/^<svg[^>]+viewBox="0 0 16 16"/);
    const ico = bytes("/public/favicon.ico");
    expect([ico[2], ico[4]]).toEqual([1, 3]);

    const manifest = JSON.parse(manifestText) as { name: string; short_name: string; theme_color: string; icons: { src: string; sizes: string; purpose?: string }[] };
    expect(manifest.name).toBe("Frontier Lab Tycoon");
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.theme_color).toBe(doc.meta("theme-color"));
    for (const icon of manifest.icons) {
      const [w, h] = pngSize(bytes(`/public${icon.src}`));
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    }
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });
});

describe("FLT-99: the edge script", () => {
  const UA = {
    human: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    twitter: "Twitterbot/1.0",
    slack: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    imessage: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    discord: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    whatsapp: "WhatsApp/2.23.20.0 A",
  };
  const assets = { fetch: async (r: Request) => new Response(`asset ${new URL(r.url).pathname}`, { status: new URL(r.url).pathname === "/og/nope.jpg" ? 404 : 200 }) };
  const get = (url: string, ua: string) => edge.fetch(new Request(url, { headers: { "user-agent": ua } }), { ASSETS: assets });

  it("humans on the apex and www still get the 302 to app., path and query kept", async () => {
    for (const host of ["frontierlabtycoon.com", "www.frontierlabtycoon.com"]) {
      const res = await get(`https://${host}/box?x=1`, UA.human);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`${APP}/box?x=1`);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("link-preview crawlers on the apex and www get the page itself", async () => {
    for (const [who, ua] of Object.entries(UA)) {
      if (who === "human") continue;
      for (const host of ["frontierlabtycoon.com", "www.frontierlabtycoon.com"]) {
        const res = await get(`https://${host}/`, ua);
        expect(res.status, `${who} on ${host}`).toBe(200);
        expect(await res.text()).toBe("asset /");
      }
    }
  });

  it("app. serves everyone, and the card and icons are cached a day", async () => {
    const page = await get(`${APP}/`, UA.human);
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBeNull();
    for (const path of ["/og/card.jpg", "/icons/icon-192.png", "/favicon.ico", "/favicon.svg", "/apple-touch-icon.png", "/manifest.webmanifest"]) {
      const res = await get(`${APP}${path}`, UA.slack);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("cache-control"), path).toBe("public, max-age=86400");
    }
    expect((await get(`${APP}/og/nope.jpg`, UA.slack)).headers.get("cache-control")).toBeNull();
  });
});

/** Just enough of a parser for <title>, <meta> and <link rel>: the test environment is node, without a DOM. */
function parseHead(source: string) {
  const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
  const metas = [...source.matchAll(/<meta\s[^>]*>/g)].map((m) => attrs(m[0]));
  const links = [...source.matchAll(/<link\s[^>]*>/g)].map((m) => attrs(m[0]));
  return {
    title: /<title>([^<]*)<\/title>/.exec(source)?.[1],
    meta: (key: string) => metas.find((m) => m.name === key || m.property === key)?.content,
    links: (rel: string) => links.filter((l) => l.rel === rel).map((l) => l.href),
  };
}
