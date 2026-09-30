import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
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

    const site = yield* Cloudflare.Website.StaticSite("Website", {
      name: `flt-${stack.stage}`,
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      command: "pnpm build && node scripts/deployment-info.mjs",
      outdir: "dist",
      workersDev: true,
      assets: { notFoundHandling: "single-page-application" },
    });

    const github = yield* GitHub.GitHubEnv;
    if (github?.pr && stack.stage === `pr-${github.pr}`) {
      yield* GitHub.Comment("preview-comment", {
        owner: github.owner,
        repository: github.repository,
        issueNumber: github.pr,
        body: Output.interpolate`## Preview deployed

[Play this preview](${site.url}) · commit ${github.sha.slice(0, 7)}

This comment updates on each push. The preview is removed when the PR closes.`,
      });
    }

    return { url: site.url };
  }),
);
