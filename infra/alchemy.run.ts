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

    // One app, one Worker. Prod deploys the app Worker (APP_WORKER) itself. Each PR stage deploys a
    // Cloudflare Workers *Preview* of that same Worker, served at https://pr-N-flt-prod.<subdomain>.workers.dev.
    // It isn't a script of its own, so the dashboard shows one app. A Preview carries only the bindings
    // declared here, never prod's; keep it that way when D1/R2 arrive (auth and cloud saves are prod-only).
    const APP_WORKER = "flt-prod";
    const revision = yield* Config.String("DEPLOY_REVISION").pipe(Config.withDefault(""));
    const site = yield* Cloudflare.Website.StaticSite("Website", {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      command: "node scripts/build-deployment.mjs",
      outdir: "dist",
      assets: { notFoundHandling: "single-page-application" },
      ...(stack.stage === "prod"
        ? { name: APP_WORKER, workersDev: true, ...(useDomain ? { domain: { name: `app.${customDomain}` } } : {}) }
        : {
            preview: {
              of: APP_WORKER,
              name: stack.stage,
              message: `PR #${stack.stage.slice(3)}`,
              ...(revision ? { tag: revision.slice(0, 12) } : {}),
            },
          }),
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
      const shown = revision || github.sha;
      yield* GitHub.Comment("preview-comment", {
        owner: github.owner,
        repository: github.repository,
        issueNumber: github.pr,
        body: Output.interpolate`## Preview deployed

[Play this preview](${site.url}) · commit ${shown.slice(0, 7)}

This comment updates on each push. It's a Preview of the one app Worker (\`flt-prod\`), removed when the PR closes.`,
      });
    }

    return { url: site.url };
  }),
);
