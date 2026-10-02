// flt-prod's edge script: it runs before the static assets on every navigation (`runWorkerFirst` in alchemy.run.ts).
// Alchemy uploads this file as it is, a single ES module, so it must not import anything.
const APP_HOST = "app.frontierlabtycoon.com";
const REDIRECT_HOSTS = new Set(["frontierlabtycoon.com", "www.frontierlabtycoon.com"]);
// Link-preview fetchers (FLT-99). The tags are static, so on the apex and www they get the page itself, not the 302:
// not every unfurler follows a redirect. (iMessage sends facebookexternalhit.) Humans and search engines still get the 302.
const UNFURLERS = /Twitterbot|Slackbot|facebookexternalhit|Facebot|Discordbot|WhatsApp|TelegramBot|LinkedInBot|Mastodon|Bluesky|Cardyb|redditbot|Iframely|Embedly|SkypeUriPreview|Pinterestbot|vkShare/i;
// The preview card and the icons live at stable paths (crawlers cache them by URL), so they can't be hashed: cache a day.
const STABLE = /^\/(?:og\/|icons\/|favicon\.(?:ico|svg)$|apple-touch-icon\.png$|manifest\.webmanifest$)/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.hostname) && !UNFURLERS.test(request.headers.get("user-agent") ?? "")) {
      // 302, not 301: browsers cache 301s forever, and the apex becomes the big-box shelf later.
      return new Response(null, {
        status: 302,
        headers: { Location: "https://" + APP_HOST + url.pathname + url.search, "Cache-Control": "no-store" },
      });
    }
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 200 || !STABLE.test(url.pathname)) return response;
    const cached = new Response(response.body, response);
    cached.headers.set("Cache-Control", "public, max-age=86400");
    return cached;
  },
};
