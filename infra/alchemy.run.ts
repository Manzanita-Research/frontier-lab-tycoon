import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { readFileSync } from "node:fs";
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
    // The apex and www get a temporary 302 to app. from the edge script (infra/edge.mjs, the big box, FLT-70, takes the
    // apex later); link-preview crawlers get the page's tags there instead (FLT-99). It is uploaded as it is, unbundled.
    const EDGE_SCRIPT = readFileSync(fileURLToPath(new URL("./edge.mjs", import.meta.url)), "utf8");

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
