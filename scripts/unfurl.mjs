#!/usr/bin/env node
// A local link-preview renderer (FLT-99): fetch a URL the way the unfurlers do, read its tags, and draw the card as
// X, Slack, iMessage and Discord would, in one PNG. Nothing is posted anywhere: no real card validator sees the link.
//
//   node scripts/unfurl.mjs https://app.frontierlabtycoon.com/ docs/img/flt-99/after.png
//   node scripts/unfurl.mjs https://pr-114-flt-prod.manzanita.workers.dev/ out.png --image-from https://pr-114-flt-prod.manzanita.workers.dev
//
// `--image-from <origin>` fetches og:image from another origin with the same path (a PR preview's tags point at prod).
// It prints each crawler's redirect chain and the tags it found.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [target, out, ...rest] = process.argv.slice(2);
if (!target || !out) {
  console.error("usage: unfurl.mjs <url> <out.png> [--image-from <origin>]");
  process.exit(2);
}
const imageFrom = (() => {
  const i = rest.indexOf("--image-from");
  return i >= 0 ? rest[i + 1] : null;
})();

const UAS = {
  Twitterbot: "Twitterbot/1.0",
  Slackbot: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "facebookexternalhit (iMessage)": "facebookexternalhit/1.1 Facebot Twitterbot/1.0",
  Discordbot: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
  WhatsApp: "WhatsApp/2.23.20.0 A",
};

// Follow redirects by hand, so the chain is on the record.
const crawl = async (url, ua) => {
  const hops = [];
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { headers: { "user-agent": ua }, redirect: "manual" });
    hops.push(`${res.status} ${url}`);
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) url = new URL(next, url).href;
    else return { hops, html: await res.text() };
  }
  throw new Error(`too many redirects: ${hops.join(" -> ")}`);
};

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const tagsOf = (html) => {
  const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
  const tags = { title: decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "") };
  for (const m of html.matchAll(/<meta\s[^>]*>/g)) {
    const a = attrs(m[0]);
    const key = a.property ?? a.name;
    if (key && a.content !== undefined && /^(og:|twitter:|description$)/.test(key)) tags[key] = a.content;
  }
  return tags;
};

let tags = {};
for (const [who, ua] of Object.entries(UAS)) {
  const { hops, html } = await crawl(target, ua);
  tags = tagsOf(html);
  console.log(`# ${who}\n  ${hops.join("\n  ")}`);
  for (const [k, v] of Object.entries(tags)) console.log(`  ${k}: ${v}`);
}

const image = tags["og:image"] && imageFrom ? imageFrom + new URL(tags["og:image"]).pathname : tags["og:image"];
const imageData = image ? await fetch(image).then(async (r) => (r.ok ? `data:${r.headers.get("content-type")};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null)) : null;
const esc = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const title = esc(tags["og:title"] ?? tags.title);
const desc = esc(tags["og:description"] ?? tags.description);
const site = esc(tags["og:site_name"] ?? new URL(target).hostname);
const host = esc(new URL(tags["og:url"] ?? target).hostname.replace(/^www\./, ""));
// No og:image, no picture: each service then falls back to its plain text link (and X shows no card at all).
const img = () => (imageData ? `<img src="${imageData}">` : "");
const large = tags["twitter:card"] === "summary_large_image";

const page = /* html */ `<!doctype html><html><head><style>
body { margin: 0; padding: 28px; background: #e9e9ee; font-family: "Liberation Sans", sans-serif; width: 1180px; }
h2 { font: 700 15px "Liberation Mono"; color: #555; margin: 0 0 8px; }
.row { display: flex; gap: 28px; margin-bottom: 28px; align-items: flex-start; }
.none { padding: 10px; color: #8b98a5; font: 14px "Liberation Mono"; }
.src { font: 13px "Liberation Mono"; color: #555; margin: 0 0 18px; }
/* X */
.x { width: 516px; background: #000; padding: 14px; border-radius: 4px; }
.x .card { position: relative; border: 1px solid #2f3336; border-radius: 16px; overflow: hidden; }
.x img { display: block; width: 100%; aspect-ratio: 1.91; object-fit: cover; }
.x .cap { position: absolute; left: 12px; bottom: 12px; background: rgba(0,0,0,.77); color: #fff; font-size: 13px; padding: 2px 6px; border-radius: 4px; }
.x .from { color: #71767b; font-size: 13px; margin-top: 4px; }
.x.small .card { display: flex; } .x.small img { width: 130px; aspect-ratio: 1; }
/* Slack */
.slack { width: 560px; background: #fff; padding: 14px 18px; border-radius: 4px; }
.slack .msg { font-size: 15px; color: #1d1c1d; margin-bottom: 6px; } .slack .msg a { color: #1264a3; }
.slack .att { border-left: 4px solid #ddd; padding-left: 12px; }
.slack .site { font-size: 13px; color: #616061; display: flex; align-items: center; gap: 6px; } .slack .site img { width: 16px; height: 16px; }
.slack .t { font-weight: 700; color: #1264a3; font-size: 15px; margin: 2px 0; } .slack .d { font-size: 15px; color: #1d1c1d; }
.slack .big { display: block; width: 360px; margin-top: 8px; border-radius: 8px; }
/* iMessage */
.im { width: 300px; background: #fff; padding: 18px; border-radius: 4px; display: flex; justify-content: flex-end; }
.im .bubble { width: 260px; border-radius: 18px; overflow: hidden; background: #e9e9eb; }
.im img { display: block; width: 100%; aspect-ratio: 1.91; object-fit: cover; }
.im .meta { padding: 8px 12px; } .im .t { font: 600 14px/1.2 "Liberation Sans"; color: #000; } .im .h { font-size: 13px; color: #8a8a8e; }
/* Discord */
.dc { width: 516px; background: #313338; padding: 14px; border-radius: 4px; }
.dc .msg { color: #00a8fc; font-size: 15px; margin-bottom: 6px; }
.dc .embed { background: #2b2d31; border-left: 4px solid #1e1f22; border-radius: 4px; padding: 10px 14px 14px; max-width: 432px; }
.dc .site { color: #dbdee1; font-size: 12px; } .dc .t { color: #00a8fc; font-weight: 700; font-size: 16px; margin: 6px 0; } .dc .d { color: #dbdee1; font-size: 14px; }
.dc img { display: block; width: 400px; aspect-ratio: 1.91; object-fit: cover; border-radius: 4px; margin-top: 12px; }
</style></head><body>
<div class="src">${esc(target)} — rendered locally from the tags the crawlers fetched (scripts/unfurl.mjs)</div>
<div class="row">
  <div><h2>X</h2><div class="x ${large ? "" : "small"}">${
    imageData ? `<div class="card">${img()}<div class="cap">${host}</div></div><div class="from">From ${host}</div>` : `<div class="none">no card: no og:image or twitter:card</div>`
  }</div></div>
  <div><h2>Slack</h2><div class="slack"><div class="msg"><a>${esc(target)}</a></div><div class="att">
    <div class="site">${site}</div><div class="t">${title}</div><div class="d">${desc}</div>${imageData ? `<img class="big" src="${imageData}">` : ""}</div></div></div>
</div>
<div class="row">
  <div><h2>iMessage</h2><div class="im"><div class="bubble">${img()}<div class="meta"><div class="t">${title}</div><div class="h">${host}</div></div></div></div></div>
  <div><h2>Discord</h2><div class="dc"><div class="msg">${esc(target)}</div><div class="embed"><div class="site">${site}</div><div class="t">${title}</div><div class="d">${desc}</div>${img()}</div></div></div>
</div>
</body></html>`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1236, height: 600 }, deviceScaleFactor: 1 });
await tab.setContent(page, { waitUntil: "load" });
mkdirSync(dirname(out), { recursive: true });
await tab.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${out}`);
