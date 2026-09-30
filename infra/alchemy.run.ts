import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { fileURLToPath } from "node:url";

export default Alchemy.Stack(
  "FrontierLabTycoon",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack;
    if (stack.stage !== "prod" && !/^pr-[1-9]\d*$/.test(stack.stage)) {
      return yield* Effect.die(new Error(`Unsupported deployment stage: ${stack.stage}`));
    }

    // Custom domain, prod only. FLT_CUSTOM_DOMAIN is the zone (e.g. frontierlabtycoon.com)
    // and stays empty until the zone and token permissions exist, so deploys never
    // depend on it. The game lives on app.<zone>; the apex and www 302 to it through
    // a tiny redirect Worker until a marketing site takes the apex (easy to undo).
    // PR previews stay on workers.dev.
    const customDomain = yield* Config.String("FLT_CUSTOM_DOMAIN").pipe(Config.withDefault(""));
    const useDomain = stack.stage === "prod" && customDomain !== "";

    const site = yield* Cloudflare.Website.StaticSite("Website", {
      name: `flt-${stack.stage}`,
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      command: "node scripts/build-deployment.mjs",
      outdir: "dist",
      workersDev: true,
      assets: { notFoundHandling: "single-page-application" },
      ...(useDomain ? { domain: { name: `app.${customDomain}` } } : {}),
    });

    if (useDomain) {
      yield* Cloudflare.Worker("ApexRedirect", {
        name: "flt-apex-redirect",
        script: `export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect("https://app.${customDomain}" + url.pathname + url.search, 302);
  },
};
`,
        domain: { name: customDomain, aliases: [`www.${customDomain}`] },
      });
    }

    const github = yield* GitHub.GitHubEnv;
    if (github?.pr && stack.stage === `pr-${github.pr}`) {
      const revision = yield* Config.String("DEPLOY_REVISION").pipe(Config.withDefault(github.sha));
      yield* GitHub.Comment("preview-comment", {
        owner: github.owner,
        repository: github.repository,
        issueNumber: github.pr,
        body: Output.interpolate`## Preview deployed

[Play this preview](${site.url}) · commit ${revision.slice(0, 7)}

This comment updates on each push. The preview is removed when the PR closes.`,
      });
    }

    return { url: site.url };
  }),
);
