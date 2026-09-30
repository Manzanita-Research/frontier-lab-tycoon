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

    // Custom domains (app., the apex and www) are attached to flt-prod in the Cloudflare dashboard, not here.
    // Never set `domain` on this Worker: omitted = unmanaged, so Alchemy preserves dashboard-added domains.
    // The apex and www get a temporary 302 to app. from EDGE_SCRIPT below (the big box, FLT-70, takes the apex later).
    const APP_HOST = "app.frontierlabtycoon.com";
    const REDIRECT_HOSTS = ["frontierlabtycoon.com", "www.frontierlabtycoon.com"];
    const EDGE_SCRIPT = `const REDIRECT_HOSTS = new Set(${JSON.stringify(REDIRECT_HOSTS)});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.hostname)) {
      // 302, not 301: browsers cache 301s forever, and the apex becomes the big-box shelf later.
      return new Response(null, {
        status: 302,
        headers: { Location: "https://${APP_HOST}" + url.pathname + url.search, "Cache-Control": "no-store" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
`;

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
      script: EDGE_SCRIPT,
      // Navigations run the edge script first (one invocation per page load); hashed assets stay served directly.
      assets: { notFoundHandling: "single-page-application", runWorkerFirst: ["/*", "!/assets/*"] },
      ...(stack.stage === "prod"
        ? { name: APP_WORKER, workersDev: true }
        : {
            preview: {
              of: APP_WORKER,
              name: stack.stage,
              message: `PR #${stack.stage.slice(3)}`,
              ...(revision ? { tag: revision.slice(0, 12) } : {}),
            },
          }),
    });


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
